// POST /api/reservas — toma un horario de la agenda. Valida, revisa el honeypot, calcula el total, guarda en D1
// (el INSERT rechaza horarios que choquen con otra reserva del mismo juego) y avisa al CRM si está configurado.
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { CRM_WEBHOOK_SECRET, CRM_WEBHOOK_URL, META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { PRODUCTOS } from "@design/data";
import { aMinutos, calcularPrecio, etiquetaHorario, pesos, rangoReservable, REGION, reservaSchema } from "@/lib/reservas";
import { sendToCrm } from "@/lib/server/crm";
import { sha256Hex } from "@/lib/server/crypto";
import { buildFbc, sendMetaEvent } from "@/lib/server/meta-capi";
import { auditar } from "@/lib/server/admin-auth";
import { crearReserva, reservasRecientes } from "@/lib/server/reservas-db";

export const prerender = false;

const MAX_BODY_BYTES = 16_000;
/** Máximo de reservas por conexión cada 24 horas (antispam, junto con el honeypot). */
const MAX_RESERVAS_POR_IP = 3;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json(403, { ok: false, error: "origin" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });

  let parsed;
  try {
    parsed = reservaSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!parsed.success) {
    return json(422, { ok: false, error: "validation", issues: parsed.error.issues.map((i) => i.message) });
  }
  const r = parsed.data;
  if (r.website) return json(200, { ok: true });

  // Nunca el mismo día ni más allá del rango publicado.
  const { desde, hasta } = rangoReservable();
  if (r.fecha < desde || r.fecha > hasta) return json(422, { ok: false, error: "fecha" });

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;

  const inicio = aMinutos(r.inicio);
  const fin = inicio + r.horas * 60;
  const precio = calcularPrecio(r.producto, r.horas, r.comuna);

  // Huella de la IP (no se guarda la IP) para limitar reservas en serie.
  const ipHash = ip ? await sha256Hex(`reservas:${ip}`) : null;

  const datos = {
    fecha: r.fecha,
    producto: r.producto,
    inicio,
    fin,
    total: precio.total,
    nombre: r.nombre,
    apellido: r.apellido ?? null,
    email: r.email ?? null,
    telefono: r.telefono,
    empresa: r.empresa ?? null,
    comuna: r.comuna,
    direccion: r.direccion ?? null,
    depto: r.depto ?? null,
    ciudad: r.ciudad ?? null,
    region: r.region ?? REGION,
    mensaje: r.mensaje ?? null,
    notas: null,
  };
  let id: number | null;
  try {
    if (ipHash && (await reservasRecientes(ipHash)) >= MAX_RESERVAS_POR_IP) {
      return json(429, { ok: false, error: "limite" });
    }
    id = await crearReserva(datos, {
      origen: "web",
      ipHash,
      atribucion: r.attribution,
      medicion: r.consent
        ? { fbp: cookies.get("_fbp")?.value ?? null, fbc: buildFbc(cookies.get("_fbc")?.value, r.attribution?.fbclid) ?? null }
        : undefined,
    });
  } catch (err) {
    console.error("[reservas] D1:", String(err));
    return json(503, { ok: false, error: "db" });
  }
  if (id === null) return json(409, { ok: false, error: "ocupado" });

  // Historial del panel /admin. Si falla, la reserva igual queda guardada.
  await auditar(request, null, "reserva_web", `${r.fecha} ${etiquetaHorario(inicio, fin)} · ${r.nombre}`, { reservaId: id, despues: datos }).catch((err) =>
    console.error("[reservas] historial:", String(err)),
  );

  // Lead a Meta Conversions API con el mismo event_id que dispara el Pixel en el navegador.
  if (r.consent && PUBLIC_META_PIXEL_ID && META_CAPI_ACCESS_TOKEN) {
    await sendMetaEvent({
      pixelId: PUBLIC_META_PIXEL_ID,
      accessToken: META_CAPI_ACCESS_TOKEN,
      testEventCode: META_CAPI_TEST_EVENT_CODE,
      eventName: "Lead",
      eventId: r.event_id,
      eventSourceUrl: r.page_url,
      phone: r.telefono,
      email: r.email,
      firstName: r.nombre,
      lastName: r.apellido,
      city: r.ciudad ?? r.comuna,
      ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
      fbp: cookies.get("_fbp")?.value,
      fbc: buildFbc(cookies.get("_fbc")?.value, r.attribution?.fbclid),
      customData: { form: "reserva", value: precio.total, currency: "CLP" },
    }).catch((err) => console.error("[reservas] Meta CAPI:", String(err), r.event_id));
  }

  // El CRM es un aviso extra: si falla, la reserva igual queda guardada.
  if (CRM_WEBHOOK_URL) {
    await sendToCrm(CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET, {
      schema_version: 1,
      id: r.event_id,
      created_at: new Date().toISOString(),
      source: "saltabum.cl",
      form_name: "reserva",
      contact: {
        nombre: [r.nombre, r.apellido].filter(Boolean).join(" "),
        telefono: r.telefono,
        email: r.email,
        mensaje: r.mensaje,
      },
      extra: {
        fecha: r.fecha,
        horario: etiquetaHorario(inicio, fin),
        horas: String(r.horas),
        juego: PRODUCTOS.find((p) => p.id === r.producto)?.nombre ?? r.producto,
        comuna: r.comuna,
        despacho: pesos(precio.despacho),
        total: pesos(precio.total),
        ...(r.direccion ? { direccion: r.direccion } : {}),
        ...(r.depto ? { depto: r.depto } : {}),
        ...(r.ciudad ? { ciudad: r.ciudad } : {}),
        region: r.region ?? REGION,
        ...(r.empresa ? { empresa: r.empresa } : {}),
      },
      attribution: r.attribution,
      context: {
        page_url: r.page_url,
        ip,
        country: request.headers.get("cf-ipcountry") ?? undefined,
        user_agent: request.headers.get("user-agent") ?? undefined,
        consent: r.consent,
      },
    }).catch((err) => console.error("[reservas] CRM:", String(err), r.event_id));
  }

  return json(200, { ok: true, id: r.event_id });
};

export const ALL: APIRoute = () => json(405, { ok: false, error: "method_not_allowed" });

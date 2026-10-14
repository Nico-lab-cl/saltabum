// POST /api/reservas — toma un horario del calendario. Valida, verifica Turnstile, guarda en D1
// (la clave primaria impide reservar dos veces el mismo horario) y avisa al CRM si está configurado.
import type { APIRoute } from "astro";
import { CRM_WEBHOOK_SECRET, CRM_WEBHOOK_URL, TURNSTILE_SECRET_KEY } from "astro:env/server";
import { etiquetaBloque, rangoReservable, reservaSchema } from "@/lib/reservas";
import { sendToCrm } from "@/lib/server/crm";
import { sha256Hex } from "@/lib/server/crypto";
import { crearReserva, reservasRecientes } from "@/lib/server/reservas-db";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const prerender = false;

const MAX_BODY_BYTES = 16_000;
/** Máximo de reservas por conexión cada 24 horas (antispam, sobre todo si no hay Turnstile). */
const MAX_RESERVAS_POR_IP = 3;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const POST: APIRoute = async ({ request }) => {
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
  if (TURNSTILE_SECRET_KEY) {
    if (!(await verifyTurnstile(TURNSTILE_SECRET_KEY, r.turnstile_token, ip))) {
      return json(403, { ok: false, error: "captcha" });
    }
  } else if (import.meta.env.PROD) {
    // Sin Turnstile la reserva igual se acepta, pero queda limitada por conexión (ver abajo).
    console.warn("[reservas] TURNSTILE_SECRET_KEY no configurado: solo límite por IP");
  }

  // Huella de la IP (no se guarda la IP) para limitar reservas en serie.
  const ipHash = ip ? await sha256Hex(`reservas:${ip}`) : null;

  let tomado: boolean;
  try {
    if (ipHash && (await reservasRecientes(ipHash)) >= MAX_RESERVAS_POR_IP) {
      return json(429, { ok: false, error: "limite" });
    }
    tomado = await crearReserva({
      fecha: r.fecha,
      bloque: r.bloque,
      nombre: r.nombre,
      telefono: r.telefono,
      comuna: r.comuna,
      direccion: r.direccion ?? null,
      mensaje: r.mensaje ?? null,
    }, ipHash);
  } catch (err) {
    console.error("[reservas] D1:", String(err));
    return json(503, { ok: false, error: "db" });
  }
  if (!tomado) return json(409, { ok: false, error: "ocupado" });

  // El CRM es un aviso extra: si falla, la reserva igual queda guardada.
  if (CRM_WEBHOOK_URL) {
    await sendToCrm(CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET, {
      schema_version: 1,
      id: r.event_id,
      created_at: new Date().toISOString(),
      source: "saltabum.cl",
      form_name: "reserva",
      contact: { nombre: r.nombre, telefono: r.telefono, mensaje: r.mensaje },
      extra: {
        fecha: r.fecha,
        horario: etiquetaBloque(r.bloque),
        comuna: r.comuna,
        ...(r.direccion ? { direccion: r.direccion } : {}),
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

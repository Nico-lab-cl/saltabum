// POST /api/lead — recibe el formulario de contacto, valida, revisa el honeypot, guarda la consulta en D1 (pestaña
// «Consultas» del panel /admin), la envía al CRM si hay uno configurado y reporta el Lead a Meta Conversions API
// (si el usuario aceptó cookies).
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { CRM_WEBHOOK_SECRET, CRM_WEBHOOK_URL, META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { leadSchema } from "@/lib/lead-schema";
import { auditar } from "@/lib/server/admin-auth";
import { consultasRecientes, guardarConsulta } from "@/lib/server/consultas-db";
import { sha256Hex } from "@/lib/server/crypto";
import { sendToCrm, type CrmLeadPayload } from "@/lib/server/crm";
import { buildFbc, sendMetaEvent } from "@/lib/server/meta-capi";

export const prerender = false;

const MAX_BODY_BYTES = 16_000;
/** Máximo de consultas por conexión cada 24 horas (antispam, junto con el honeypot). */
const MAX_CONSULTAS_POR_IP = 5;
/** Datos de origen que se guardan con la consulta (de qué campaña o página llegó). */
const ORIGEN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing_page"];

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  // Solo aceptamos peticiones desde nuestro propio sitio
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json(403, { ok: false, error: "origin" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });

  let parsed;
  try {
    parsed = leadSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!parsed.success) {
    return json(422, { ok: false, error: "validation", issues: parsed.error.issues.map((i) => i.message) });
  }
  const lead = parsed.data;

  // Honeypot: respondemos OK para no darle pistas al bot, pero no procesamos nada.
  if (lead.website) return json(200, { ok: true });

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // La consulta queda guardada en el panel /admin aunque no haya CRM.
  const ipHash = ip ? await sha256Hex(`consultas:${ip}`) : null;
  try {
    if (ipHash && (await consultasRecientes(ipHash)) >= MAX_CONSULTAS_POR_IP) return json(429, { ok: false, error: "limite" });
    const origen = Object.fromEntries(Object.entries(lead.attribution).filter(([k]) => ORIGEN.includes(k)));
    if (lead.attribution.fbclid) origen.anuncio = "Meta";
    else if (lead.attribution.gclid) origen.anuncio = "Google";
    const id = await guardarConsulta({
      formulario: lead.form_name,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      mensaje: lead.mensaje,
      extra: lead.extra,
      origen,
      pagina: lead.page_url,
      ipHash,
      eventId: lead.event_id,
    });
    await auditar(request, null, "consulta_web", lead.nombre, { reservaId: id, despues: { nombre: lead.nombre, telefono: lead.telefono, email: lead.email, ...lead.extra } }).catch(
      (err) => console.error("[lead] historial:", String(err)),
    );
  } catch (err) {
    console.error("[lead] D1:", String(err), lead.event_id);
    return json(503, { ok: false, error: "db" });
  }

  const payload: CrmLeadPayload = {
    schema_version: 1,
    id: lead.event_id,
    created_at: new Date().toISOString(),
    source: "saltabum.cl",
    form_name: lead.form_name,
    contact: { nombre: lead.nombre, telefono: lead.telefono, email: lead.email, mensaje: lead.mensaje },
    extra: lead.extra,
    attribution: lead.attribution,
    context: {
      page_url: lead.page_url,
      ip,
      country: request.headers.get("cf-ipcountry") ?? undefined,
      user_agent: userAgent,
      consent: lead.consent,
    },
  };

  const capi =
    lead.consent && PUBLIC_META_PIXEL_ID && META_CAPI_ACCESS_TOKEN
      ? sendMetaEvent({
          pixelId: PUBLIC_META_PIXEL_ID,
          accessToken: META_CAPI_ACCESS_TOKEN,
          testEventCode: META_CAPI_TEST_EVENT_CODE,
          eventName: "Lead",
          eventId: lead.event_id,
          eventSourceUrl: lead.page_url,
          email: lead.email,
          phone: lead.telefono,
          firstName: lead.nombre,
          ip,
          userAgent,
          fbp: cookies.get("_fbp")?.value,
          fbc: buildFbc(cookies.get("_fbc")?.value, lead.attribution.fbclid),
          customData: { form: lead.form_name },
        }).catch((err) => console.error("[lead] Meta CAPI:", String(err)))
      : Promise.resolve();

  // El CRM es opcional: la consulta ya quedó guardada, así que si falla solo se registra el error.
  await Promise.allSettled([
    CRM_WEBHOOK_URL
      ? sendToCrm(CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET, payload).catch((err) => console.error("[lead] CRM:", String(err), lead.event_id))
      : Promise.resolve(),
    capi,
  ]);

  return json(200, { ok: true, id: lead.event_id });
};

export const ALL: APIRoute = () => json(405, { ok: false, error: "method_not_allowed" });

// POST /api/lead — recibe el formulario, valida, verifica Turnstile, envía al CRM
// y reporta el Lead a Meta Conversions API (si el usuario aceptó cookies).
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import {
  CRM_WEBHOOK_SECRET,
  CRM_WEBHOOK_URL,
  META_CAPI_ACCESS_TOKEN,
  META_CAPI_TEST_EVENT_CODE,
  TURNSTILE_SECRET_KEY,
} from "astro:env/server";
import { leadSchema } from "@/lib/lead-schema";
import { sendToCrm, type CrmLeadPayload } from "@/lib/server/crm";
import { buildFbc, sendMetaEvent } from "@/lib/server/meta-capi";
import { verifyTurnstile } from "@/lib/server/turnstile";

export const prerender = false;

const MAX_BODY_BYTES = 16_000;

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

  if (TURNSTILE_SECRET_KEY) {
    if (!(await verifyTurnstile(TURNSTILE_SECRET_KEY, lead.turnstile_token, ip))) {
      return json(403, { ok: false, error: "captcha" });
    }
  } else if (import.meta.env.PROD) {
    console.error("[lead] TURNSTILE_SECRET_KEY no configurado");
    return json(503, { ok: false, error: "not_configured" });
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

  if (!CRM_WEBHOOK_URL) {
    await capi;
    if (import.meta.env.PROD) {
      console.error("[lead] CRM_WEBHOOK_URL no configurado — lead no entregado", lead.event_id);
      return json(503, { ok: false, error: "not_configured" });
    }
    console.info("[lead] (dev, sin CRM) lead recibido:", JSON.stringify(payload, null, 2));
    return json(200, { ok: true, id: lead.event_id });
  }

  const [crmResult] = await Promise.allSettled([
    sendToCrm(CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET, payload),
    capi,
  ]);
  if (crmResult.status === "rejected") {
    console.error("[lead] CRM:", String(crmResult.reason), lead.event_id);
    return json(502, { ok: false, error: "crm" });
  }

  return json(200, { ok: true, id: lead.event_id });
};

export const ALL: APIRoute = () => json(405, { ok: false, error: "method_not_allowed" });

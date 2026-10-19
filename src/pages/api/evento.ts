// POST /api/evento — reenvía a Meta Conversions API los clics a WhatsApp (evento Contact) con el mismo
// event_id que el Pixel del navegador, para que Meta los deduplique. Solo se llama si el usuario aceptó cookies.
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { z } from "zod";
import { buildFbc, sendMetaEvent } from "@/lib/server/meta-capi";

export const prerender = false;

const MAX_BODY_BYTES = 4_000;

const eventoSchema = z.object({
  event_name: z.literal("Contact"),
  event_id: z.uuid(),
  page_url: z.url().max(1000),
  placement: z.string().max(60).optional(),
  fbclid: z.string().max(500).optional(),
});

const vacio = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return vacio(403);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return vacio(413);

  let parsed;
  try {
    parsed = eventoSchema.safeParse(JSON.parse(raw));
  } catch {
    return vacio(400);
  }
  if (!parsed.success) return vacio(422);
  const e = parsed.data;

  if (!PUBLIC_META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) return vacio(204);

  await sendMetaEvent({
    pixelId: PUBLIC_META_PIXEL_ID,
    accessToken: META_CAPI_ACCESS_TOKEN,
    testEventCode: META_CAPI_TEST_EVENT_CODE,
    eventName: e.event_name,
    eventId: e.event_id,
    eventSourceUrl: e.page_url,
    ip: request.headers.get("cf-connecting-ip") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    fbp: cookies.get("_fbp")?.value,
    fbc: buildFbc(cookies.get("_fbc")?.value, e.fbclid),
    customData: e.placement ? { placement: e.placement } : undefined,
  }).catch((err) => console.error("[evento] Meta CAPI:", String(err), e.event_id));

  return vacio(204);
};

export const ALL: APIRoute = () => vacio(405);

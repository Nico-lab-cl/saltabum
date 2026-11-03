// Webhook de Meta para los mensajes directos de Instagram y Facebook (ver src/lib/server/redes.ts).
// En la app de Meta → Webhooks, para «Page» (campo messages) y para «Instagram» (campo messages):
//   URL de devolución: https://saltabum.cl/api/meta
//   Token de verificación: el valor de META_WEBHOOK_TOKEN
//   GET  → verificación de Meta (hub.mode, hub.verify_token, hub.challenge)
//   POST → avisos firmados con META_APP_SECRET (X-Hub-Signature-256). Se responde 200 de inmediato y la IA trabaja
//          después (waitUntil), porque Meta reintenta si la respuesta tarda.
import type { APIRoute } from "astro";
import { META_WEBHOOK_TOKEN } from "astro:env/server";
import { sha256Hex } from "@/lib/server/crypto";
import {
  firmaValida,
  procesarEvento,
  redesConfiguradas,
  type CanalRed,
  type EventoMeta,
} from "@/lib/server/redes";

export const prerender = false;

const respuesta = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("hub.verify_token");
  const reto = url.searchParams.get("hub.challenge");
  if (!META_WEBHOOK_TOKEN || url.searchParams.get("hub.mode") !== "subscribe" || !token || !reto)
    return respuesta(403, { ok: false });
  const [a, b] = await Promise.all([sha256Hex(token), sha256Hex(META_WEBHOOK_TOKEN)]);
  if (a !== b) return respuesta(403, { ok: false });
  return new Response(reto, {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!redesConfiguradas()) return respuesta(503, { ok: false, error: "sin_configurar" });
  const raw = await request.text();
  if (raw.length > 1_000_000) return respuesta(200, { ok: true, ignorado: "muy_grande" });
  if (!(await firmaValida(raw, request.headers.get("x-hub-signature-256"))))
    return respuesta(401, { ok: false });

  let body: { object?: string; entry?: { messaging?: EventoMeta[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return respuesta(400, { ok: false, error: "json" });
  }
  const canal: CanalRed | null =
    body.object === "instagram" ? "instagram" : body.object === "page" ? "messenger" : null;
  if (!canal) return respuesta(200, { ok: true, ignorado: body.object ?? "sin_objeto" });

  const trabajos: (() => Promise<void>)[] = [];
  try {
    for (const entrada of body.entry ?? []) {
      for (const evento of entrada.messaging ?? []) {
        console.log(
          "webhook meta",
          canal,
          evento.message?.is_echo ? "pagina" : "cliente",
          evento.message?.mid ? "mensaje" : "otro",
        );
        const t = await procesarEvento(canal, evento);
        if (t) trabajos.push(t);
      }
    }
  } catch (err) {
    console.error("webhook meta", canal, err);
    // 500: Meta reintenta (no se pierde el mensaje si D1 falló un momento; los repetidos se descartan por su id).
    return respuesta(500, { ok: false });
  }

  const tarea = (async () => {
    for (const t of trabajos) await t();
  })();
  const cf = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext;
  if (cf?.waitUntil) cf.waitUntil(tarea);
  else await tarea;
  return respuesta(200, { ok: true });
};

export const ALL: APIRoute = () => respuesta(405, { ok: false, error: "method_not_allowed" });

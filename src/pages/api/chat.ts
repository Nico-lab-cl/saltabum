// POST /api/chat — un mensaje del chat con IA de la web. Recibe el historial visible y devuelve la respuesta.
//   { mensajes: [{ rol: "cliente" | "ia", texto }], page_url? } → { ok, texto, whatsapp?, reserva? }
// Sin ANTHROPIC_API_KEY, o pasado el límite del día, responde con error y la burbuja ofrece WhatsApp.
import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { hoyChile } from "@/lib/reservas";
import { contarMensaje } from "@/lib/server/chat-db";
import { chatConfigurado, responderChat } from "@/lib/server/chat-ia";
import { sha256Hex } from "@/lib/server/crypto";

export const prerender = false;

/** Mensajes por visitante al día y en total al día (tope de gasto además del límite mensual de la consola). */
const MAX_POR_VISITANTE = 40;
const MAX_POR_DIA = 1500;
/** Solo se manda a la IA lo más reciente de la conversación. */
const HISTORIAL = 20;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const pedidoSchema = z.object({
  mensajes: z
    .array(z.object({ rol: z.enum(["cliente", "ia"]), texto: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(60)
    .refine((m) => m[m.length - 1].rol === "cliente", "El último mensaje debe ser del cliente"),
  page_url: z.string().max(1000).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: "origin" });
  if (!chatConfigurado()) return json(503, { ok: false, error: "sin_ia" });

  const raw = await request.text();
  if (raw.length > 40_000) return json(413, { ok: false, error: "too_large" });
  let parsed;
  try {
    parsed = pedidoSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validation" });

  // La conversación que ve la IA empieza siempre con un mensaje del cliente.
  let historial = parsed.data.mensajes.slice(-HISTORIAL);
  while (historial[0]?.rol === "ia") historial = historial.slice(1);

  const ip = request.headers.get("cf-connecting-ip");
  const dia = hoyChile();
  const visitante = await sha256Hex(`chat:${dia}:${ip ?? "sin-ip"}:${request.headers.get("user-agent") ?? ""}`);
  try {
    const cupo = await contarMensaje(dia, visitante, MAX_POR_VISITANTE, MAX_POR_DIA);
    if (cupo !== "ok") return json(429, { ok: false, error: "limite" });
  } catch (err) {
    console.error("[chat] D1:", String(err));
    return json(503, { ok: false, error: "db" });
  }

  try {
    const r = await responderChat(historial, {
      request,
      ipHash: ip ? await sha256Hex(`reservas:${ip}`) : null,
      pageUrl: parsed.data.page_url,
    });
    return json(200, { ok: true, ...r });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("[chat] API:", err.status, err.message);
    else console.error("[chat]:", String(err));
    return json(502, { ok: false, error: "ia" });
  }
};

export const ALL: APIRoute = () => json(405, { ok: false, error: "method_not_allowed" });

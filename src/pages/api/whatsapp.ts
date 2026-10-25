// Webhook de Evolution API (WhatsApp de Saltabum). Configurarlo en la instancia con:
//   URL:     https://saltabum.cl/api/whatsapp?clave=<EVOLUTION_WEBHOOK_SECRET>
//   Eventos: MESSAGES_UPSERT, SEND_MESSAGE, LABELS_ASSOCIATION · «Webhook by events» apagado · Base64 apagado
// Guarda en D1 solo los chats que llegan por un anuncio de Meta o que tienen la etiqueta «SALTABUM | LEADS»
// (ver src/lib/server/whatsapp-sync.ts). Siempre responde 200 a lo que ignora, para que Evolution no reintente.
import type { APIRoute } from "astro";
import { EVOLUTION_WEBHOOK_SECRET } from "astro:env/server";
import { sha256Hex } from "@/lib/server/crypto";
import { etiquetaLeads, instancia, type MensajeEvolution } from "@/lib/server/evolution";
import { quitarEtiqueta } from "@/lib/server/whatsapp-db";
import { etiquetaAgregada, procesarMensaje } from "@/lib/server/whatsapp-sync";

export const prerender = false;

const respuesta = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" } });

/** Compara las claves por su huella (mismo largo siempre, sin atajos que revelen cuánto coincidió). */
async function claveValida(recibida: string | null): Promise<boolean> {
  if (!EVOLUTION_WEBHOOK_SECRET || !recibida) return false;
  const [a, b] = await Promise.all([sha256Hex(recibida), sha256Hex(EVOLUTION_WEBHOOK_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!EVOLUTION_WEBHOOK_SECRET) return respuesta(503, { ok: false, error: "sin_configurar" });
  if (!(await claveValida(url.searchParams.get("clave") ?? request.headers.get("x-saltabum-clave")))) return respuesta(401, { ok: false });

  const raw = await request.text();
  if (raw.length > 2_000_000) return respuesta(200, { ok: true, ignorado: "muy_grande" });
  let body: { event?: string; instance?: string; data?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return respuesta(400, { ok: false, error: "json" });
  }
  if (body.instance && body.instance !== instancia()) return respuesta(200, { ok: true, ignorado: "instancia" });

  // Evolution v2 manda «messages.upsert»; algunas versiones, «MESSAGES_UPSERT».
  const evento = String(body.event ?? "").toLowerCase().replace(/_/g, ".");
  // Registro corto de cada aviso (sin el texto de los mensajes), para revisar en Cloudflare → Observability.
  if (evento.startsWith("labels")) console.log("webhook whatsapp", evento, JSON.stringify(body.data).slice(0, 500));
  else {
    const m = (Array.isArray(body.data) ? body.data[0] : body.data) as MensajeEvolution | undefined;
    console.log("webhook whatsapp", evento, m?.key?.remoteJid ?? "", m?.key?.fromMe ? "yo" : "cliente", m?.messageType ?? "");
  }
  try {
    if (evento === "messages.upsert" || evento === "send.message") {
      const lista = (Array.isArray(body.data) ? body.data : [body.data]) as MensajeEvolution[];
      let guardados = 0;
      for (const m of lista) if (m && (await procesarMensaje(m)) === "guardado") guardados++;
      return respuesta(200, { ok: true, guardados });
    }
    if (evento === "labels.association") {
      const d = (body.data ?? {}) as Record<string, unknown>;
      const a = ((d.association as Record<string, unknown>) ?? d) as Record<string, unknown>;
      const etiqueta = String(a.labelId ?? d.labelId ?? "");
      const chat = String(a.chatId ?? d.chatId ?? "");
      const tipo = String(d.type ?? a.type ?? "add");
      if (etiqueta !== etiquetaLeads() || !chat) return respuesta(200, { ok: true, ignorado: "etiqueta" });
      if (tipo === "remove") await quitarEtiqueta(chat);
      else await etiquetaAgregada(chat);
      return respuesta(200, { ok: true });
    }
  } catch (e) {
    console.error("webhook whatsapp", evento, e);
    // 500: Evolution reintenta (no se pierde el mensaje si D1 falló un momento).
    return respuesta(500, { ok: false });
  }
  return respuesta(200, { ok: true, ignorado: evento || "sin_evento" });
};

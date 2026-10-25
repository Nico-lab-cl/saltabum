// Chats de WhatsApp para la pestaña «WhatsApp» del panel /admin. Requiere sesión.
//   GET              → chats (de anuncios o con la etiqueta), el más reciente primero, y qué está configurado
//   GET ?chat=<jid>  → mensajes de ese chat
//   POST → { accion: "estado", jid, estado } · { accion: "notas", jid, notas } · { accion: "leido", jid }
//          { accion: "responder", jid, texto } · { accion: "importar", dias? }
import type { APIRoute } from "astro";
import { EVOLUTION_WEBHOOK_SECRET } from "astro:env/server";
import { z } from "zod";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { enviarTexto, evolutionConfigurado } from "@/lib/server/evolution";
import { actualizarChat, buscarChat, guardarMensajes, listarChats, listarMensajes } from "@/lib/server/whatsapp-db";
import { importarChatsDeAnuncios } from "@/lib/server/whatsapp-sync";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

const jid = z.string().min(5).max(120);
const accionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("estado"), jid, estado: z.enum(["nueva", "contactada", "cerrada"]) }),
  z.object({ accion: z.literal("notas"), jid, notas: z.string().trim().max(2000) }),
  z.object({ accion: z.literal("leido"), jid }),
  z.object({ accion: z.literal("responder"), jid, texto: z.string().trim().min(1).max(4000) }),
  z.object({ accion: z.literal("importar"), dias: z.number().int().min(1).max(730).optional() }),
]);

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  const chat = url.searchParams.get("chat");
  if (chat) return json(200, { ok: true, mensajes: await listarMensajes(chat) });
  return json(200, {
    ok: true,
    chats: await listarChats(500),
    configuracion: { evolution: evolutionConfigurado(), webhook: !!EVOLUTION_WEBHOOK_SECRET },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });

  const raw = await request.text();
  if (raw.length > 10_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = accionSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validacion" });
  const pedido = parsed.data;

  if (pedido.accion === "importar") {
    if (!evolutionConfigurado()) return json(503, { ok: false, error: "evolution" });
    try {
      const r = await importarChatsDeAnuncios(pedido.dias);
      await auditar(request, usuario, "whatsapp_importar", `${r.chats} chats de anuncios · ${r.mensajes} mensajes nuevos`);
      return json(200, { ok: true, ...r });
    } catch (e) {
      console.error("importar whatsapp", e);
      return json(502, { ok: false, error: "evolution" });
    }
  }

  const chat = await buscarChat(pedido.jid);
  if (!chat) return json(404, { ok: false, error: "no_existe" });
  const quien = chat.nombre ?? chat.telefono ?? "cliente";

  if (pedido.accion === "leido") {
    await actualizarChat(chat.jid, { leido: true });
    return json(200, { ok: true });
  }

  if (pedido.accion === "estado") {
    await actualizarChat(chat.jid, { estado: pedido.estado, leido: true });
    await auditar(request, usuario, "whatsapp_estado", `${quien} · ${pedido.estado}`, { antes: { estado: chat.estado }, despues: { estado: pedido.estado } });
    return json(200, { ok: true });
  }

  if (pedido.accion === "notas") {
    await actualizarChat(chat.jid, { notas: pedido.notas || null });
    await auditar(request, usuario, "whatsapp_notas", quien, { antes: { notas: chat.notas }, despues: { notas: pedido.notas || null } });
    return json(200, { ok: true });
  }

  // Responder: sale desde el mismo WhatsApp de Saltabum (también se ve en el teléfono).
  if (!evolutionConfigurado()) return json(503, { ok: false, error: "evolution" });
  try {
    const enviado = await enviarTexto(chat.telefono ?? chat.jid, pedido.texto);
    await guardarMensajes(chat.jid, [{ ...enviado, key: { ...enviado.key, fromMe: true }, messageType: "conversation", message: { conversation: pedido.texto } }], {
      por: usuario,
    });
    await actualizarChat(chat.jid, { leido: true, estado: chat.estado === "nueva" ? "contactada" : undefined });
    await auditar(request, usuario, "whatsapp_respuesta", quien);
    return json(200, { ok: true });
  } catch (e) {
    console.error("responder whatsapp", e);
    return json(502, { ok: false, error: "evolution" });
  }
};

// Chats de WhatsApp para la pestaña «WhatsApp» del panel /admin. Requiere sesión.
//   GET              → chats (de anuncios o con la etiqueta), el más reciente primero, y qué está configurado
//   GET ?chat=<jid>  → mensajes de ese chat
//   POST → { accion: "estado", jid, estado } · { accion: "notas", jid, notas } · { accion: "leido", jid }
//          { accion: "responder", jid, texto } · { accion: "audio", jid, audio (base64) }
//          { accion: "agregar", telefono, nombre?, mensaje? } → crea el chat y le pone la etiqueta en WhatsApp
//          { accion: "sincronizar", jids } → vuelve a traer de Evolution los últimos mensajes (de a 15 chats)
//          { accion: "importar", dias? } → busca chats que llegaron por anuncios
import type { APIRoute } from "astro";
import { EVOLUTION_WEBHOOK_SECRET } from "astro:env/server";
import { z } from "zod";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { cambiarEtiqueta, enviarAudio, enviarTexto, etiquetaLeads, evolutionConfigurado, verificarNumero } from "@/lib/server/evolution";
import { actualizarChat, asegurarChat, buscarChat, guardarMensajes, listarChats, listarMensajes, renombrarChat } from "@/lib/server/whatsapp-db";
import { importarChatsDeAnuncios, importarHistorial } from "@/lib/server/whatsapp-sync";

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
  // Nota de voz de hasta ~3 minutos (opus pesa ~16 KB por segundo; en base64, un tercio más).
  z.object({ accion: z.literal("audio"), jid, audio: z.string().min(100).max(5_000_000).regex(/^[A-Za-z0-9+/=]+$/) }),
  z.object({
    accion: z.literal("agregar"),
    telefono: z.string().trim().min(8).max(25),
    nombre: z.string().trim().max(120).optional(),
    mensaje: z.string().trim().max(4000).optional(),
  }),
  z.object({ accion: z.literal("sincronizar"), jids: z.array(jid).min(1).max(15) }),
  z.object({ accion: z.literal("importar"), dias: z.number().int().min(1).max(730).optional() }),
]);

/** «+56 9 6344 4133», «963444133» o «56963444133» → «56963444133» (los números chilenos de 9 dígitos llevan 56). */
const normalizarTelefono = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length === 9 ? `56${d}` : d;
};

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
  if (raw.length > 5_100_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = accionSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validacion" });
  const pedido = parsed.data;

  // ── Acciones que hablan con Evolution ─────────────────────────────────
  const conEvolution = ["importar", "agregar", "sincronizar", "responder", "audio"].includes(pedido.accion);
  if (conEvolution && !evolutionConfigurado()) return json(503, { ok: false, error: "evolution" });

  try {
    if (pedido.accion === "importar") {
      const r = await importarChatsDeAnuncios(pedido.dias);
      await auditar(request, usuario, "whatsapp_importar", `${r.chats} chats de anuncios · ${r.mensajes} mensajes nuevos`);
      return json(200, { ok: true, ...r });
    }

    if (pedido.accion === "sincronizar") {
      let mensajes = 0;
      for (const j of pedido.jids) {
        const chat = await buscarChat(j);
        if (chat) mensajes += await importarHistorial(chat.jid, chat.jid_alt, 60).catch(() => 0);
      }
      return json(200, { ok: true, mensajes });
    }

    if (pedido.accion === "agregar") {
      const telefono = normalizarTelefono(pedido.telefono);
      const jidWa = await verificarNumero(telefono);
      if (!jidWa) return json(404, { ok: false, error: "sin_whatsapp" });
      const canonico = await asegurarChat({ jid: jidWa, nombre: pedido.nombre || null, etiqueta: true });
      if (pedido.nombre) await renombrarChat(canonico, pedido.nombre);
      await cambiarEtiqueta(telefono, etiquetaLeads(), "add").catch((e) => console.error("etiqueta whatsapp", e));
      await importarHistorial(canonico, (await buscarChat(canonico))?.jid_alt ?? null, 100).catch(() => 0);
      if (pedido.mensaje) {
        const enviado = await enviarTexto(telefono, pedido.mensaje);
        await guardarEnviado(canonico, enviado, { conversation: pedido.mensaje }, usuario);
      }
      await auditar(request, usuario, "whatsapp_agregar", pedido.nombre ? `${pedido.nombre} · +${telefono}` : `+${telefono}`);
      return json(200, { ok: true, jid: canonico });
    }
  } catch (e) {
    console.error(`whatsapp ${pedido.accion}`, e);
    return json(502, { ok: false, error: "evolution" });
  }

  // ── Acciones sobre un chat del panel ─────────────────────────────────
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

  // Responder (texto o nota de voz): sale desde el mismo WhatsApp de Saltabum (también se ve en el teléfono).
  try {
    const numero = chat.telefono ?? chat.jid;
    if (pedido.accion === "audio") {
      const enviado = await enviarAudio(numero, pedido.audio);
      await guardarEnviado(chat.jid, enviado, { audioMessage: {} }, usuario, "audioMessage");
    } else {
      const enviado = await enviarTexto(numero, pedido.texto);
      await guardarEnviado(chat.jid, enviado, { conversation: pedido.texto }, usuario);
    }
    await actualizarChat(chat.jid, { leido: true, estado: chat.estado === "nueva" ? "contactada" : undefined });
    await auditar(request, usuario, "whatsapp_respuesta", `${quien}${pedido.accion === "audio" ? " · nota de voz" : ""}`);
    return json(200, { ok: true });
  } catch (e) {
    console.error("responder whatsapp", e);
    return json(502, { ok: false, error: "evolution" });
  }
};

/** Guarda en el panel lo que se acaba de enviar (el webhook también lo trae; no se duplica). */
async function guardarEnviado(
  jidChat: string,
  enviado: { key?: { id?: string; remoteJid?: string }; messageTimestamp?: number | string },
  message: Record<string, unknown>,
  usuario: string,
  tipo = "conversation",
) {
  await guardarMensajes(jidChat, [{ ...enviado, key: { ...enviado.key, fromMe: true }, messageType: tipo, message }], { por: usuario });
}


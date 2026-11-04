// Conversaciones del chat de la web y de los mensajes directos de Instagram y Facebook, para la pestaña «Chats» del
// panel /admin. Requiere sesión.
//   GET            → conversaciones, la más reciente primero
//   GET ?id=<uuid> → la conversación y sus mensajes
//   POST → { accion: "modo", id, modo: "humano" | "ia" } (tomar el control o devolvérselo a la IA)
//          { accion: "responder", id, texto } (si la atendía la IA, el equipo toma el control al responder)
//          { accion: "visto", id } (alguien del equipo abrió el chat: deja de contar como pedido de ayuda)
//          { accion: "sugerir", id } (solo redes: la IA propone de nuevo la respuesta, sin enviarla)
//          { accion: "descartar", id } (solo redes: borra la respuesta propuesta)
//          { accion: "comentarios", activo } (prende o apaga las respuestas de Sali a comentarios, ver comentarios.ts)
// En las redes «responder» envía el mensaje por Meta. Con REDES_MODO=sugerencia responder no le quita el turno a la IA
// (sigue proponiendo); con REDES_MODO=auto, igual que en la web, el equipo toma el control.
import type { APIRoute } from "astro";
import { z } from "zod";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { actualizarConversacion, guardarMensaje, listarConversaciones, mensajesDesde, obtenerConversacion } from "@/lib/server/chat-db";
import { activarComentarios, comentariosActivos } from "@/lib/server/comentarios";
import { ErrorMeta, esRed, modoRedes, redesConfiguradas, responderDesdePanel, sugerir } from "@/lib/server/redes";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

const accionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("modo"), id: z.uuid(), modo: z.enum(["humano", "ia"]) }),
  z.object({ accion: z.literal("responder"), id: z.uuid(), texto: z.string().trim().min(1).max(2000) }),
  z.object({ accion: z.literal("visto"), id: z.uuid() }),
  z.object({ accion: z.literal("sugerir"), id: z.uuid() }),
  z.object({ accion: z.literal("descartar"), id: z.uuid() }),
  z.object({ accion: z.literal("comentarios"), activo: z.boolean() }),
]);

const quien = (nombre: string | null) => nombre ?? "sin nombre";

/** Toma el control: la IA deja de responder y el cliente ve quién lo atiende. */
async function tomarControl(request: Request, id: string, usuario: string, nombre: string | null) {
  await actualizarConversacion(id, { modo: "humano", atiende: usuario, ayuda: 0 });
  await guardarMensaje(id, "sistema", "Ahora te atiende una persona del equipo Saltabum 👋", usuario);
  await auditar(request, usuario, "chat_control", quien(nombre));
}

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  const id = url.searchParams.get("id");
  if (id) {
    const conv = await obtenerConversacion(id);
    if (!conv) return json(404, { ok: false, error: "no_existe" });
    return json(200, { ok: true, conversacion: conv, mensajes: await mensajesDesde(id, 0, 500), modoRedes: modoRedes() });
  }
  return json(200, { ok: true, conversaciones: await listarConversaciones(300), modoRedes: modoRedes(), redes: redesConfiguradas(), comentarios: await comentariosActivos() });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });

  const raw = await request.text();
  if (raw.length > 8_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = accionSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validacion" });
  const pedido = parsed.data;

  if (pedido.accion === "comentarios") {
    await activarComentarios(pedido.activo);
    await auditar(request, usuario, "chat_comentarios", pedido.activo ? "activadas" : "desactivadas");
    return json(200, { ok: true });
  }

  const conv = await obtenerConversacion(pedido.id);
  if (!conv) return json(404, { ok: false, error: "no_existe" });

  if (pedido.accion === "modo") {
    if (pedido.modo === conv.modo) return json(200, { ok: true });
    if (pedido.modo === "humano") await tomarControl(request, conv.id, usuario, conv.nombre);
    else {
      await actualizarConversacion(conv.id, { modo: "ia", atiende: null });
      await guardarMensaje(conv.id, "sistema", "Te vuelve a atender el asistente virtual 🤖", usuario);
      await auditar(request, usuario, "chat_ia", quien(conv.nombre));
    }
    return json(200, { ok: true });
  }

  if (pedido.accion === "visto") {
    if (conv.ayuda) await actualizarConversacion(conv.id, { ayuda: 0 });
    return json(200, { ok: true });
  }

  if (esRed(conv)) {
    if (pedido.accion === "descartar") {
      await actualizarConversacion(conv.id, { sugerencia: null });
      return json(200, { ok: true });
    }
    if (pedido.accion === "sugerir") {
      try {
        const texto = await sugerir(conv);
        await actualizarConversacion(conv.id, { sugerencia: texto });
        return json(200, { ok: true, texto });
      } catch (err) {
        console.error("[chats] sugerir:", String(err));
        return json(502, { ok: false, error: "ia" });
      }
    }
    if (!redesConfiguradas()) return json(503, { ok: false, error: "redes_sin_configurar" });
    try {
      await responderDesdePanel(conv, pedido.texto, usuario);
    } catch (err) {
      console.error("[chats] enviar a Meta:", String(err));
      return json(err instanceof ErrorMeta && err.fueraDeVentana ? 409 : 502, { ok: false, error: err instanceof ErrorMeta && err.fueraDeVentana ? "ventana_24h" : "meta" });
    }
    if (conv.modo === "ia" && modoRedes() === "auto") await tomarControl(request, conv.id, usuario, conv.nombre);
    await auditar(request, usuario, "chat_red_respuesta", quien(conv.nombre));
    return json(200, { ok: true });
  }
  if (pedido.accion !== "responder") return json(422, { ok: false, error: "solo_redes" });

  if (conv.modo === "ia") await tomarControl(request, conv.id, usuario, conv.nombre);
  await guardarMensaje(conv.id, "equipo", pedido.texto, usuario);
  return json(200, { ok: true });
};

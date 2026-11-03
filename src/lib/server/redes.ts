// Mensajes directos de Instagram y Facebook (Messenger) atendidos con la misma IA del chat de la web (chat-ia.ts).
// Meta avisa cada mensaje al webhook /api/meta (firmado con META_APP_SECRET) y las respuestas salen con el token de la
// página (META_PAGE_TOKEN), que sirve para Messenger y para el Instagram conectado a la página.
// Las conversaciones se guardan en las mismas tablas del chat (chat-db.ts, con «canal» y «externo») y se ven en la
// pestaña «Chats» de /admin. Con REDES_MODO=auto (por defecto) la IA responde sola, igual que en la web, y deja la
// reserva en la agenda (pide nombre, teléfono y dirección, que en las redes no vienen de un formulario). Con
// REDES_MODO=sugerencia solo propone la respuesta y el equipo la aprueba. Si alguien responde desde la app de Instagram
// o Facebook, la IA se calla en esa conversación hasta que el equipo pulse «Devolver a la IA» en el panel.
import { META_APP_SECRET, META_PAGE_TOKEN, REDES_MODO } from "astro:env/server";
import { hoyChile } from "@/lib/reservas";
import { avisarGrupo, enlacePanel } from "@/lib/server/chat-avisos";
import {
  actualizarConversacion,
  baseChat,
  contarMensaje,
  conversacionDeRed,
  guardarMensaje,
  marcarExterno,
  mensajeExterno,
  obtenerConversacion,
  ultimosMensajes,
  type Conversacion,
} from "@/lib/server/chat-db";
import { chatConfigurado, responderChat } from "@/lib/server/chat-ia";
import { hmacSha256Hex } from "@/lib/server/crypto";

export type CanalRed = "instagram" | "messenger";

const GRAPH = "https://graph.facebook.com/v23.0";
/** Mismos topes que el chat de la web: por persona al día y en total al día (contando ambos canales). */
const MAX_POR_PERSONA = 40;
const MAX_POR_DIA = 1500;
const HISTORIAL = 20;
const MINUTOS_ENTRE_AVISOS = 10;

export const redesConfiguradas = () => !!(META_APP_SECRET && META_PAGE_TOKEN);
export const modoRedes = () => REDES_MODO;
export const esRed = (
  c: Pick<Conversacion, "canal">,
): c is Pick<Conversacion, "canal"> & { canal: CanalRed } =>
  c.canal === "instagram" || c.canal === "messenger";
const nombreCanal = (canal: CanalRed) => (canal === "instagram" ? "Instagram" : "Facebook");

/** Firma «X-Hub-Signature-256: sha256=…» que Meta pone en cada aviso (comparación de largo fijo). */
export async function firmaValida(cuerpo: string, firma: string | null): Promise<boolean> {
  if (!META_APP_SECRET || !firma?.startsWith("sha256=")) return false;
  const esperada = await hmacSha256Hex(META_APP_SECRET, cuerpo);
  const recibida = firma.slice(7).toLowerCase();
  if (recibida.length !== esperada.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) diff |= esperada.charCodeAt(i) ^ recibida.charCodeAt(i);
  return diff === 0;
}

async function graph<T>(ruta: string, init?: RequestInit): Promise<T> {
  const sep = ruta.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${ruta}${sep}access_token=${encodeURIComponent(META_PAGE_TOKEN ?? "")}`, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const datos = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || datos.error) {
    const e = datos.error ?? {};
    throw new ErrorMeta(e.message ?? `HTTP ${res.status}`, e.code, e.error_subcode);
  }
  return datos;
}

export class ErrorMeta extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
  /** Meta solo deja responder dentro de las 24 horas desde el último mensaje de la persona. */
  get fueraDeVentana() {
    return this.code === 10 || this.subcode === 2018278 || this.subcode === 2534022;
  }
}

/** Nombre de perfil de quien escribe (si Meta lo entrega; si no, queda sin nombre). */
async function perfil(canal: CanalRed, id: string): Promise<string | null> {
  try {
    if (canal === "instagram") {
      const p = await graph<{ name?: string; username?: string }>(
        `/${encodeURIComponent(id)}?fields=name,username`,
      );
      return p.name || (p.username ? `@${p.username}` : null);
    }
    const p = await graph<{ first_name?: string; last_name?: string }>(
      `/${encodeURIComponent(id)}?fields=first_name,last_name`,
    );
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
  } catch (err) {
    console.error("[redes] perfil:", String(err));
    return null;
  }
}

/** Envía un mensaje de texto a la persona y devuelve el id que le dio Meta. */
async function enviar(externo: string, texto: string): Promise<string | null> {
  const r = await graph<{ message_id?: string }>("/me/messages", {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: externo },
      messaging_type: "RESPONSE",
      message: { text: texto.slice(0, 1000) },
    }),
  });
  return r.message_id ?? null;
}

/** Guarda y envía. Los bloques separados por una línea en blanco salen como mensajes aparte, igual que en la web. */
async function guardarYEnviar(conv: Conversacion, rol: "ia" | "equipo", texto: string, autor: string | null) {
  const bloques = texto
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const bloque of bloques.length ? bloques : [texto]) {
    // Se guarda antes de enviar para reconocer la copia que devuelve Meta; si Meta lo rechaza, se borra.
    const id = await guardarMensaje(conv.id, rol, bloque, autor);
    let mid: string | null;
    try {
      mid = await enviar(conv.externo!, bloque);
    } catch (err) {
      const d = await baseChat();
      await d.prepare("DELETE FROM chat_mensajes WHERE id = ?").bind(id).run();
      throw err;
    }
    if (mid) await marcarExterno(id, mid);
  }
}

/** Un mensaje nuestro que Meta devuelve como copia («echo»): ¿es uno que ya guardamos al enviarlo? */
async function copiaPropia(conv: Conversacion, mid: string, texto: string): Promise<boolean> {
  if (await mensajeExterno(mid)) return true;
  // La copia puede llegar antes de que alcancemos a anotar su id: se busca el mismo texto recién enviado.
  const d = await baseChat();
  const fila = await d
    .prepare(
      "SELECT id FROM chat_mensajes WHERE conversacion = ? AND externo_id IS NULL AND rol IN ('ia', 'equipo') AND texto = ? AND creado > ? ORDER BY id DESC LIMIT 1",
    )
    .bind(conv.id, texto, new Date(Date.now() - 2 * 60_000).toISOString())
    .first<{ id: number }>();
  if (!fila) return false;
  await marcarExterno(fila.id, mid);
  return true;
}

/** Un evento de «messaging» del webhook (Messenger o Instagram). */
export interface EventoMeta {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string }[];
    is_deleted?: boolean;
  };
}

/**
 * Procesa un evento: guarda el mensaje y devuelve, si corresponde, el trabajo de la IA (para hacerlo después de
 * responderle a Meta, que espera respuesta rápida).
 */
export async function procesarEvento(canal: CanalRed, e: EventoMeta): Promise<(() => Promise<void>) | null> {
  const m = e.message;
  if (!m?.mid || m.is_deleted) return null;

  // Copia de un mensaje que mandó la página (desde aquí o desde Business Suite / la app de Instagram).
  if (m.is_echo) {
    const persona = e.recipient?.id;
    if (!persona || !m.text) return null;
    const conv = await conversacionDeRed(canal, persona, null);
    if (await copiaPropia(conv, m.mid, m.text)) return null;
    await guardarMensaje(conv.id, "equipo", m.text, `${nombreCanal(canal)} (app)`, m.mid);
    // Alguien respondió directo en la app: la IA se calla en esa conversación para no pisarlo.
    if (conv.modo === "ia")
      await actualizarConversacion(conv.id, {
        modo: "humano",
        atiende: `${nombreCanal(canal)} (app)`,
        sugerencia: null,
      });
    return null;
  }

  const persona = e.sender?.id;
  if (!persona || (await mensajeExterno(m.mid))) return null;
  let conv = await conversacionDeRed(canal, persona, null);
  if (!conv.nombre) {
    const nombre = await perfil(canal, persona);
    if (nombre) {
      await actualizarConversacion(conv.id, { nombre });
      conv = { ...conv, nombre };
    }
  }
  const adjunto = m.attachments?.[0]?.type;
  const texto =
    m.text?.trim() ||
    `(envió ${adjunto === "image" ? "una imagen" : adjunto === "video" ? "un video" : adjunto === "audio" ? "un audio" : "un adjunto"})`;
  const idCliente = await guardarMensaje(conv.id, "cliente", texto.slice(0, 2000), null, m.mid);

  const quien = conv.nombre ?? "Alguien";
  const avisar = async (titulo: string) => {
    const ultimo = conv.aviso ? Date.parse(conv.aviso) : 0;
    if (Date.now() - ultimo < MINUTOS_ENTRE_AVISOS * 60_000) return;
    await actualizarConversacion(conv.id, { aviso: new Date().toISOString() });
    await avisarGrupo(`${titulo}\n«${texto.slice(0, 500)}»\nVer: ${enlacePanel(conv.id)}`);
  };

  // La atiende una persona, o la IA no puede leer el mensaje: solo se avisa al equipo.
  if (conv.modo === "humano") return () => avisar(`💬 *${quien} escribió por ${nombreCanal(canal)}*`);
  if (!m.text?.trim() || !chatConfigurado())
    return () => avisar(`📎 *${quien} escribió por ${nombreCanal(canal)}* (la IA no puede responder esto)`);
  const cupo = await contarMensaje(hoyChile(), `red:${canal}:${persona}`, MAX_POR_PERSONA, MAX_POR_DIA);
  if (cupo !== "ok")
    return () => avisar(`⚠️ *${quien} escribió por ${nombreCanal(canal)}* (se pasó el tope diario de la IA)`);

  return async () => {
    try {
      const r = await sugerir(conv);
      // Llegó otro mensaje mientras la IA pensaba: ese turno se encarga de responder (así no contesta dos veces).
      const ahora = await obtenerConversacion(conv.id);
      const ultimo = (await ultimosMensajes(conv.id, 1))[0];
      if (
        !ahora ||
        ahora.modo === "humano" ||
        (ultimo && ultimo.rol === "cliente" && ultimo.id !== idCliente)
      )
        return;
      if (REDES_MODO === "auto") {
        await guardarYEnviar(ahora, "ia", r, null);
      } else {
        await actualizarConversacion(conv.id, { sugerencia: r });
        await avisar(
          `✨ *${quien} escribió por ${nombreCanal(canal)}* · la IA dejó una respuesta para aprobar`,
        );
      }
    } catch (err) {
      console.error(`[redes] IA ${canal}:`, String(err));
      await avisar(`💬 *${quien} escribió por ${nombreCanal(canal)}* (la IA no pudo responder)`);
    }
  };
}

/** Lo que respondería la IA ahora en esta conversación (no lo envía). */
export async function sugerir(conv: Conversacion): Promise<string> {
  if (!esRed(conv)) throw new Error("No es una conversación de redes");
  const r = await responderChat(await ultimosMensajes(conv.id, HISTORIAL), {
    request: new Request("https://saltabum.cl/api/meta"),
    conversacion: conv.id,
    cliente: { nombre: conv.nombre, email: conv.email, telefono: conv.telefono },
    origen: { utm_source: conv.canal, utm_medium: "dm" },
    ipHash: null,
    canal: conv.canal,
  });
  return r.texto;
}

/**
 * Respuesta del equipo desde el panel (escrita o una sugerencia aprobada). Si era la sugerencia sin cambios queda
 * como mensaje de la IA aprobado por esa persona. Lanza ErrorMeta si Meta no la acepta (por ejemplo, fuera de 24 h).
 */
export async function responderDesdePanel(conv: Conversacion, texto: string, usuario: string): Promise<void> {
  const aprobada = !!conv.sugerencia && texto.trim() === conv.sugerencia.trim();
  await guardarYEnviar(conv, aprobada ? "ia" : "equipo", texto, usuario);
  await actualizarConversacion(conv.id, { sugerencia: null });
}

// Comentarios en publicaciones y reels de Instagram y Facebook, atendidos por Sali (la IA del chat, ver chat-ia.ts).
// Meta avisa cada comentario nuevo al webhook /api/meta (Instagram: campo «comments»; Facebook: campo «feed»).
// Sali lee el comentario y decide qué hacer:
//   interesado (precio, fecha, comuna, «info», «quiero»…) → responde en público «¡Te escribimos por interno! 📩» y le
//     manda un mensaje privado que abre la conversación (Meta permite uno solo por comentario hasta que la persona
//     conteste). Cuando contesta, sigue la conversación normal de redes.ts (cotiza, envía el catálogo y reserva).
//   reclamo → no responde y avisa al grupo del equipo.
//   elogio, spam u otro → nada.
// Se puede apagar desde /admin → Chats («Responder comentarios»). Cada comentario queda en «red_comentarios».
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "astro:env/server";
import { hoyChile } from "@/lib/reservas";
import { avisarGrupo, enlacePanel } from "@/lib/server/chat-avisos";
import {
  actualizarComentario,
  contarMensaje,
  conversacionDeRed,
  guardarAjuste,
  guardarMensaje,
  leerAjuste,
  registrarComentario,
  type ComentarioRed,
} from "@/lib/server/chat-db";
import { chatConfigurado } from "@/lib/server/chat-ia";
import { graph, type CanalRed } from "@/lib/server/redes";

const MODELO = "claude-haiku-5-5";
/** Tope de comentarios que lee la IA al día (protege los créditos si un reel se viraliza). */
const MAX_COMENTARIOS_DIA = 300;
const AJUSTE = "comentarios";

const RESPUESTAS_PUBLICAS = [
  "¡Te escribimos por interno! 📩",
  "¡Hola! Te enviamos la info por interno 📩",
  "¡Te respondimos por mensaje privado! 😊",
  "¡Revisa tus mensajes, te escribimos! 📩",
];

export async function comentariosActivos(): Promise<boolean> {
  return (await leerAjuste(AJUSTE)) !== "no";
}

export async function activarComentarios(activo: boolean): Promise<void> {
  await guardarAjuste(AJUSTE, activo ? "si" : "no");
}

/** Un cambio del webhook («changes») de Instagram o de la página de Facebook. */
export interface CambioMeta {
  field?: string;
  value?: {
    // Instagram
    id?: string;
    text?: string;
    media?: { id?: string; media_product_type?: string };
    from?: { id?: string; username?: string; name?: string };
    parent_id?: string;
    // Facebook (feed)
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    message?: string;
  };
}

/** Lee un comentario nuevo de primer nivel (no respuestas, ni los de la propia cuenta). */
function leerComentario(canal: CanalRed, cuenta: string | undefined, c: CambioMeta): ComentarioRed | null {
  const v = c.value;
  if (!v?.from?.id || v.from.id === cuenta) return null;
  if (canal === "instagram") {
    if (c.field !== "comments" || !v.id || v.parent_id) return null;
    return { id: v.id, canal, persona: v.from.id, nombre: v.from.username ? `@${v.from.username}` : null, texto: v.text ?? null, publicacion: v.media?.id ?? null };
  }
  if (c.field !== "feed" || v.item !== "comment" || v.verb !== "add" || !v.comment_id) return null;
  // En Facebook la respuesta a otro comentario trae parent_id distinto de la publicación.
  if (v.parent_id && v.parent_id !== v.post_id) return null;
  return { id: v.comment_id, canal, persona: v.from.id, nombre: v.from.name ?? null, texto: v.message ?? null, publicacion: v.post_id ?? null };
}

interface Decision {
  tipo: "interesado" | "elogio" | "reclamo" | "spam" | "otro";
  mensaje_privado?: string;
  resumen?: string;
}

const HERRAMIENTA: Anthropic.Tool = {
  name: "decidir",
  description: "Clasifica el comentario y, si es de alguien interesado, escribe el primer mensaje privado.",
  input_schema: {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: ["interesado", "elogio", "reclamo", "spam", "otro"],
        description:
          "interesado: pregunta o muestra interés en arrendar (precio, valor, fecha, disponibilidad, comuna, despacho, «info», «quiero», «me interesa», «cotizar», emojis de mano levantada). elogio: felicita o etiqueta a alguien sin preguntar. reclamo: queja o problema con un servicio. spam: publicidad, links o bots. otro: lo demás.",
      },
      mensaje_privado: {
        type: "string",
        description:
          "Solo si es interesado. Primer mensaje privado, máximo 20 palabras, español de Chile, tuteo: saluda como Sali de Saltabum, menciona en pocas palabras lo que preguntó y pregúntale su nombre. Sin precios ni enlaces todavía. Ejemplo: «¡Hola! Soy Sali de Saltabum 😊 Vi que preguntaste por el Megatobogán. ¿Con quién hablo?»",
      },
      resumen: { type: "string", description: "Lo que quiere la persona en una frase corta, para el equipo." },
    },
    required: ["tipo"],
    additionalProperties: false,
  },
};

async function decidir(canal: CanalRed, texto: string): Promise<Decision> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
  const res = await client.messages.create({
    model: MODELO,
    max_tokens: 400,
    tools: [HERRAMIENTA],
    tool_choice: { type: "tool", name: "decidir" },
    system:
      "Eres Sali, del equipo de Saltabum: arriendo de juegos inflables (Megatobogán Arcoíris, Castillo Pirata y Castillo Fórmula 1) para cumpleaños y eventos en la Región de Valparaíso, Chile. Lees un comentario dejado en una publicación de Saltabum y decides qué hacer con la herramienta decidir. Ante la duda entre interesado y otro, elige interesado si el comentario es una pregunta.",
    messages: [{ role: "user", content: `Comentario en ${canal === "instagram" ? "Instagram" : "Facebook"}: «${texto.slice(0, 1000)}»` }],
  });
  const uso = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  return (uso?.input as Decision) ?? { tipo: "otro" };
}

/**
 * Registra el comentario (para no repetirlo) y devuelve el trabajo de la IA, que corre después de responderle a Meta.
 */
export async function procesarCambio(canal: CanalRed, cuenta: string | undefined, cambio: CambioMeta): Promise<(() => Promise<void>) | null> {
  const c = leerComentario(canal, cuenta, cambio);
  if (!c?.texto?.trim()) return null;
  if (!(await registrarComentario(c))) return null;
  if (!chatConfigurado() || !(await comentariosActivos())) return null;
  if ((await contarMensaje(hoyChile(), `comentarios:${canal}`, MAX_COMENTARIOS_DIA, Number.MAX_SAFE_INTEGER)) !== "ok") return null;
  return () => atender(c);
}

async function atender(c: ComentarioRed) {
  const donde = c.canal === "instagram" ? "Instagram" : "Facebook";
  const quien = c.nombre ?? "Alguien";
  let d: Decision;
  try {
    d = await decidir(c.canal, c.texto!);
  } catch (err) {
    console.error("[comentarios] IA:", String(err));
    await actualizarComentario(c.id, { error: "ia" });
    return;
  }
  await actualizarComentario(c.id, { tipo: d.tipo });

  if (d.tipo === "reclamo") {
    await avisarGrupo(`⚠️ *Comentario delicado en ${donde}* de ${quien}\n«${c.texto!.slice(0, 500)}»\nSali no respondió: revísalo en ${donde}.`);
    return;
  }
  if (d.tipo !== "interesado") return;

  const privado = (d.mensaje_privado?.trim() || "¡Hola! Soy Sali de Saltabum 😊 Vi tu comentario. ¿Con quién hablo?").slice(0, 600);
  // Se anota antes de enviar para reconocer la copia («echo») que devuelve Meta del mensaje privado.
  await actualizarComentario(c.id, { mensaje_privado: privado });

  let enviado: { recipient_id?: string; message_id?: string };
  try {
    enviado = await graph("/me/messages", {
      method: "POST",
      body: JSON.stringify({ recipient: { comment_id: c.id }, message: { text: privado } }),
    });
  } catch (err) {
    console.error(`[comentarios] privado ${c.canal}:`, String(err));
    await actualizarComentario(c.id, { error: `privado: ${String(err).slice(0, 300)}` });
    return;
  }

  const publica = RESPUESTAS_PUBLICAS[Math.floor(Math.random() * RESPUESTAS_PUBLICAS.length)];
  try {
    await graph(c.canal === "instagram" ? `/${encodeURIComponent(c.id)}/replies` : `/${encodeURIComponent(c.id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ message: publica }),
    });
    await actualizarComentario(c.id, { respuesta_publica: publica });
  } catch (err) {
    console.error(`[comentarios] público ${c.canal}:`, String(err));
    await actualizarComentario(c.id, { error: `publico: ${String(err).slice(0, 300)}` });
  }

  // La conversación queda en /admin → Chats. En Facebook el id de Messenger de la persona es otro que el del comentario:
  // se usa el que devuelve Meta al enviar, que es el mismo con el que llegará su respuesta.
  const conv = await conversacionDeRed(c.canal, enviado.recipient_id ?? c.persona!, c.nombre);
  await guardarMensaje(conv.id, "cliente", `(Comentó en una publicación de ${donde}: «${c.texto!.slice(0, 500)}»)`);
  await guardarMensaje(conv.id, "ia", privado, null, enviado.message_id ?? null);
  await actualizarComentario(c.id, { conversacion: conv.id });
  await avisarGrupo(
    `💬 *${quien} comentó en ${donde}*\n«${c.texto!.slice(0, 300)}»${d.resumen ? `\n${d.resumen}` : ""}\nSali le escribió por interno. Ver: ${enlacePanel(conv.id)}`,
  );
}

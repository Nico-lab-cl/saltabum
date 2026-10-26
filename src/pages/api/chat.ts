// Chat de la web. Cada navegador tiene su conversación (id al azar) guardada en D1, que el equipo ve en /admin.
//   POST { accion: "contacto", conversacion, nombre, email, telefono, attribution?, page_url? } → abre la conversación
//        con los datos del formulario previo (también quedan como lead en el panel).
//   POST { conversacion, texto, page_url? } → guarda el mensaje del cliente y, si la conversación la atiende la IA,
//        devuelve su respuesta: { ok, modo, ids, texto?, whatsapp?, reserva? }. Si la atiende una persona, solo la guarda
//        y avisa al grupo del equipo.
//   GET  ?conversacion=…&desde=<id> → { ok, modo, mensajes } con lo nuevo (respuestas del equipo y avisos).
// Sin ANTHROPIC_API_KEY, o pasado el límite del día, responde con error y la burbuja ofrece WhatsApp.
import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { hoyChile } from "@/lib/reservas";
import { avisarGrupo, enlacePanel } from "@/lib/server/chat-avisos";
import {
  actualizarConversacion,
  contarMensaje,
  guardarMensaje,
  mensajesDesde,
  obtenerConversacion,
  registrarContacto,
  ultimosMensajes,
} from "@/lib/server/chat-db";
import { chatConfigurado, responderChat } from "@/lib/server/chat-ia";
import { sha256Hex } from "@/lib/server/crypto";

export const prerender = false;

/** Mensajes por visitante al día y en total al día (tope de gasto además del límite mensual de la consola). */
const MAX_POR_VISITANTE = 40;
const MAX_POR_DIA = 1500;
/** Cuántos mensajes recientes de la conversación lee la IA. */
const HISTORIAL = 20;
/** Mientras atiende una persona, se avisa al grupo como máximo una vez cada tantos minutos por conversación. */
const MINUTOS_ENTRE_AVISOS = 10;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Datos de origen que se guardan con el lead (de qué campaña o página llegó), igual que en /api/lead. */
const ORIGEN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "referrer", "landing_page"];

const leerOrigen = (s: string | null): Record<string, string> => {
  try {
    return s ? (JSON.parse(s) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const mensajeSchema = z.object({
  conversacion: z.uuid(),
  texto: z.string().trim().min(1).max(1000),
  page_url: z.string().max(1000).optional(),
});
const contactoSchema = z.object({
  accion: z.literal("contacto"),
  conversacion: z.uuid(),
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  telefono: z.string().trim().max(30).refine((t) => t.replace(/\D/g, "").length >= 8),
  attribution: z.record(z.string(), z.string().max(1000)).default({}),
  page_url: z.string().max(1000).optional(),
});

export const GET: APIRoute = async ({ url }) => {
  const id = z.uuid().safeParse(url.searchParams.get("conversacion"));
  if (!id.success) return json(422, { ok: false, error: "validation" });
  const desde = Math.max(0, Number(url.searchParams.get("desde")) || 0);
  try {
    const conv = await obtenerConversacion(id.data);
    if (!conv) return json(200, { ok: true, modo: "ia", mensajes: [] });
    const mensajes = (await mensajesDesde(conv.id, desde)).map(({ id, rol, texto, creado }) => ({ id, rol, texto, creado }));
    return json(200, { ok: true, modo: conv.modo, mensajes });
  } catch (err) {
    console.error("[chat] D1:", String(err));
    return json(503, { ok: false, error: "db" });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: "origin" });

  const raw = await request.text();
  if (raw.length > 8_000) return json(413, { ok: false, error: "too_large" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  // Formulario previo: nombre, correo y teléfono antes de empezar a chatear.
  if ((body as { accion?: string })?.accion === "contacto") {
    const c = contactoSchema.safeParse(body);
    if (!c.success) return json(422, { ok: false, error: "validation", campos: [...new Set(c.error.issues.map((i) => String(i.path[0])))] });
    const origen = Object.fromEntries(Object.entries(c.data.attribution).filter(([k]) => ORIGEN.includes(k)));
    try {
      await registrarContacto(c.data.conversacion, { ...c.data, origen, pagina: c.data.page_url });
    } catch (err) {
      console.error("[chat] D1:", String(err));
      return json(503, { ok: false, error: "db" });
    }
    return json(200, { ok: true });
  }

  const parsed = mensajeSchema.safeParse(body);
  if (!parsed.success) return json(422, { ok: false, error: "validation" });
  const { conversacion, texto, page_url } = parsed.data;

  const ip = request.headers.get("cf-connecting-ip");
  const dia = hoyChile();
  const visitante = await sha256Hex(`chat:${dia}:${ip ?? "sin-ip"}:${request.headers.get("user-agent") ?? ""}`);

  let conv;
  let idCliente: number;
  try {
    conv = await obtenerConversacion(conversacion);
    // Sin los datos del formulario previo no se puede chatear.
    if (!conv?.telefono) return json(409, { ok: false, error: "sin_contacto" });
    const cupo = await contarMensaje(dia, visitante, MAX_POR_VISITANTE, MAX_POR_DIA);
    if (cupo !== "ok") return json(429, { ok: false, error: "limite" });
    idCliente = await guardarMensaje(conv.id, "cliente", texto);
  } catch (err) {
    console.error("[chat] D1:", String(err));
    return json(503, { ok: false, error: "db" });
  }

  // La atiende una persona: la IA no responde y se avisa al grupo (sin repetir el aviso a cada mensaje).
  if (conv.modo === "humano") {
    const ultimoAviso = conv.aviso ? Date.parse(conv.aviso) : 0;
    if (Date.now() - ultimoAviso > MINUTOS_ENTRE_AVISOS * 60_000) {
      await actualizarConversacion(conv.id, { aviso: new Date().toISOString() });
      await avisarGrupo(`💬 *${conv.nombre ?? "Un cliente"} escribió en el chat de la web*\n«${texto.slice(0, 500)}»\nResponder: ${enlacePanel(conv.id)}`);
    }
    return json(200, { ok: true, modo: "humano", ids: [idCliente] });
  }

  if (!chatConfigurado()) return json(503, { ok: false, error: "sin_ia", ids: [idCliente] });

  try {
    const r = await responderChat(await ultimosMensajes(conv.id, HISTORIAL), {
      request,
      conversacion: conv.id,
      cliente: { nombre: conv.nombre, email: conv.email, telefono: conv.telefono },
      origen: leerOrigen(conv.origen),
      ipHash: ip ? await sha256Hex(`reservas:${ip}`) : null,
      pageUrl: page_url,
    });
    // Si alguien del equipo tomó el control mientras la IA pensaba, su respuesta se descarta.
    if ((await obtenerConversacion(conv.id))?.modo === "humano") return json(200, { ok: true, modo: "humano", ids: [idCliente] });
    const idIa = await guardarMensaje(conv.id, "ia", r.texto);
    return json(200, { ok: true, modo: "ia", ids: [idCliente, idIa], ...r });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("[chat] API:", err.status, err.message);
    else console.error("[chat]:", String(err));
    return json(502, { ok: false, error: "ia", ids: [idCliente] });
  }
};

export const ALL: APIRoute = () => json(405, { ok: false, error: "method_not_allowed" });

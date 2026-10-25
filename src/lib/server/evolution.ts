// Cliente mínimo de Evolution API (WhatsApp de Saltabum, en el VPS de Easypanel) y lectura de sus mensajes.
// Evolution nos avisa por webhook (/api/whatsapp) y el panel lo usa para importar chats y responder.
// Docs: https://doc.evolution-api.com — los mensajes vienen con la forma de Baileys (key, message, contextInfo…).
import { EVOLUTION_API_KEY, EVOLUTION_API_URL, EVOLUTION_INSTANCIA, WHATSAPP_ETIQUETA_ID } from "astro:env/server";

export const instancia = () => EVOLUTION_INSTANCIA || "Saltabum";
/** Etiqueta de WhatsApp Business cuyos chats se centralizan en el panel («SALTABUM | LEADS»). */
export const etiquetaLeads = () => WHATSAPP_ETIQUETA_ID || "12";
export const evolutionConfigurado = () => !!(EVOLUTION_API_URL && EVOLUTION_API_KEY);

/** Mensaje tal como lo entrega Evolution (webhook messages.upsert o /chat/findMessages). */
export interface MensajeEvolution {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string; remoteJidAlt?: string; participant?: string };
  pushName?: string | null;
  messageType?: string;
  message?: Record<string, unknown> | null;
  contextInfo?: Record<string, unknown> | null;
  messageTimestamp?: number | string;
}

/** Datos del anuncio de Meta (Click-to-WhatsApp) del que llegó el chat. */
export interface DatosAnuncio {
  titulo?: string;
  texto?: string;
  id?: string;
  url?: string;
  app?: string;
  ctwaClid?: string;
}

/** Chats que no son conversaciones con clientes (grupos, estados, canales). */
export const esChatPersonal = (jid?: string) => !!jid && !/@(g\.us|broadcast|newsletter)$/.test(jid) && jid !== "status@broadcast";

/** Teléfono (solo dígitos) si alguno de los identificadores lo trae; los «@lid» no lo traen. */
export function telefonoDe(...jids: (string | undefined | null)[]): string | null {
  const j = jids.find((x) => x?.endsWith("@s.whatsapp.net"));
  return j ? j.split("@")[0]!.split(":")[0]!.replace(/\D/g, "") || null : null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : undefined);

/** Tipos que no son mensajes para mostrar (reacciones, avisos técnicos, mensajes que aún no se descifran). */
const IGNORAR = new Set(["reactionMessage", "protocolMessage", "placeholderMessage", "senderKeyDistributionMessage", "associatedChildMessage", "messageContextInfo"]);

/** Texto legible del mensaje, o null si no es un mensaje para mostrar. */
export function textoDe(m: MensajeEvolution): string | null {
  const msg = m.message ?? {};
  const tipo = m.messageType ?? Object.keys(msg).find((k) => !IGNORAR.has(k));
  if (!tipo || IGNORAR.has(tipo)) return null;
  const cuerpo = obj(msg[tipo]) ?? {};
  switch (tipo) {
    case "conversation":
      return str(msg.conversation) ?? null;
    case "extendedTextMessage":
      return str(cuerpo.text) ?? null;
    case "imageMessage":
      return `📷 Foto${str(cuerpo.caption) ? `: ${str(cuerpo.caption)}` : ""}`;
    case "videoMessage":
      return `🎬 Video${str(cuerpo.caption) ? `: ${str(cuerpo.caption)}` : ""}`;
    case "audioMessage":
      return "🎤 Nota de voz";
    case "stickerMessage":
      return "Sticker";
    case "documentMessage":
    case "documentWithCaptionMessage":
      return `📄 Documento${str(cuerpo.fileName) ? `: ${str(cuerpo.fileName)}` : ""}`;
    case "locationMessage":
    case "liveLocationMessage":
      return "📍 Ubicación";
    case "contactMessage":
    case "contactsArrayMessage":
      return `👤 Contacto${str(cuerpo.displayName) ? `: ${str(cuerpo.displayName)}` : ""}`;
    case "buttonsResponseMessage":
      return str(cuerpo.selectedDisplayText) ?? "Respuesta a botón";
    case "templateButtonReplyMessage":
      return str(cuerpo.selectedDisplayText) ?? "Respuesta a botón";
    case "listResponseMessage":
      return str(cuerpo.title) ?? "Respuesta a lista";
    case "albumMessage":
      return "📷 Álbum";
    default: {
      // Mensajes interactivos o plantillas: se busca algún texto adentro.
      const texto = JSON.stringify(cuerpo).match(/"(?:text|caption|contentText|hydratedContentText)":"((?:[^"\\]|\\.)+)"/)?.[1];
      return texto ? JSON.parse(`"${texto}"`) : "Mensaje";
    }
  }
}

/**
 * Mensajes que manda el bot de otra empresa. Cuando desde el WhatsApp de Saltabum se toca el anuncio de OTRO negocio
 * (proveedores, importadores…), el saludo automático de ese negocio llega con los datos de SU anuncio y este tipo.
 */
const TIPOS_DE_EMPRESA = new Set(["interactiveMessage", "templateMessage", "buttonsMessage", "listMessage", "interactiveResponseMessage"]);

/**
 * Si el mensaje es de un cliente que llegó desde un anuncio de Saltabum en Meta (el primer mensaje de un chat
 * Click-to-WhatsApp trae los datos del anuncio). Se descartan los saludos de otras empresas (ver TIPOS_DE_EMPRESA).
 */
export function anuncioDe(m: MensajeEvolution): DatosAnuncio | null {
  if (m.key?.fromMe || (m.messageType && TIPOS_DE_EMPRESA.has(m.messageType))) return null;
  const msg = m.message ?? {};
  if (Object.keys(msg).some((k) => TIPOS_DE_EMPRESA.has(k))) return null;
  const contextos = [m.contextInfo, ...Object.values(msg).map((v) => obj(obj(v)?.contextInfo))].map(obj).filter(Boolean) as Record<string, unknown>[];
  for (const ci of contextos) {
    const ea = obj(ci.externalAdReply);
    if (ea?.sourceType === "ad" || ci.conversionSource === "FB_Ads" || str(ea?.ctwaClid)) {
      return {
        titulo: str(ea?.title),
        texto: str(ea?.body),
        id: str(ea?.sourceId),
        url: str(ea?.sourceUrl),
        app: str(ea?.sourceApp),
        ctwaClid: str(ea?.ctwaClid),
      };
    }
  }
  return null;
}

/** Nombre de perfil del cliente; WhatsApp a veces manda solo el número interno en su lugar. */
export function nombreDe(m: MensajeEvolution): string | null {
  const n = m.key?.fromMe ? undefined : str(m.pushName);
  return n && !/^[\d\s+]+$/.test(n) ? n.slice(0, 120) : null;
}

/** Fecha ISO del mensaje (Evolution la manda en segundos). */
export function fechaDe(m: MensajeEvolution): string {
  const s = Number(m.messageTimestamp);
  return new Date(Number.isFinite(s) && s > 0 ? s * 1000 : Date.now()).toISOString();
}

async function llamar<T>(ruta: string, body: unknown): Promise<T> {
  const base = (EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const res = await fetch(`${base}${ruta}`, {
    method: "POST",
    headers: { apikey: EVOLUTION_API_KEY ?? "", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Evolution ${ruta}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

interface PaginaMensajes {
  messages: { total: number; pages: number; currentPage: number; records: MensajeEvolution[] };
}

/** Mensajes guardados en Evolution, del más nuevo al más antiguo. `where` acepta { key: { remoteJid } }. */
export async function buscarMensajes(where: Record<string, unknown>, pagina = 1, porPagina = 1000) {
  const r = await llamar<PaginaMensajes>(`/chat/findMessages/${encodeURIComponent(instancia())}`, { where, page: pagina, offset: porPagina });
  return r.messages;
}

/** Nombre del contacto según Evolution (sirve cuando los mensajes traen solo el número interno). */
export async function nombreDeContacto(jid: string): Promise<string | null> {
  const r = await llamar<{ pushName?: string | null }[]>(`/chat/findContacts/${encodeURIComponent(instancia())}`, { where: { remoteJid: jid } });
  return (Array.isArray(r) ? r : []).map((c) => nombreDe({ pushName: c.pushName })).find(Boolean) ?? null;
}

/** Chats con mensajes guardados en Evolution, del de mensaje más reciente al más antiguo (solo personas). */
export async function listarChatsEvolution(): Promise<string[]> {
  const r = await llamar<{ remoteJid?: string; updatedAt?: string }[]>(`/chat/findChats/${encodeURIComponent(instancia())}`, {});
  return (Array.isArray(r) ? r : [])
    .filter((c) => esChatPersonal(c.remoteJid))
    .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
    .map((c) => c.remoteJid!);
}

/**
 * Etiquetas que tiene hoy un chat según Evolution. Se consulta chat por chat porque Evolution guarda bien las
 * etiquetas que pones en el celular, pero no siempre manda el aviso (LABELS_ASSOCIATION) al webhook.
 */
export async function etiquetasDeChat(jid: string): Promise<string[]> {
  const base = (EVOLUTION_API_URL ?? "").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/findChatByRemoteJid/${encodeURIComponent(instancia())}?remoteJid=${encodeURIComponent(jid)}`, {
    headers: { apikey: EVOLUTION_API_KEY ?? "" },
  });
  if (!res.ok) throw new Error(`Evolution findChatByRemoteJid: ${res.status}`);
  const chat = (await res.json().catch(() => null)) as { labels?: unknown } | null;
  return Array.isArray(chat?.labels) ? chat.labels.map(String) : [];
}

/** Revisa si un teléfono tiene WhatsApp. Devuelve el identificador del chat (…@s.whatsapp.net) o null. */
export async function verificarNumero(telefono: string): Promise<string | null> {
  const r = await llamar<{ exists?: boolean; jid?: string }[]>(`/chat/whatsappNumbers/${encodeURIComponent(instancia())}`, { numbers: [telefono] });
  const x = (Array.isArray(r) ? r : [])[0];
  return x?.exists && x.jid ? x.jid : null;
}

/** Pone (o quita) una etiqueta de WhatsApp Business a un chat. */
export async function cambiarEtiqueta(numero: string, etiqueta: string, accion: "add" | "remove"): Promise<void> {
  await llamar(`/label/handleLabel/${encodeURIComponent(instancia())}`, { number: numero, labelId: etiqueta, action: accion });
}

/** Envía una nota de voz. `audioBase64` sin el prefijo «data:»; Evolution la convierte al formato de WhatsApp. */
export async function enviarAudio(numero: string, audioBase64: string): Promise<MensajeEvolution> {
  return llamar<MensajeEvolution>(`/message/sendWhatsAppAudio/${encodeURIComponent(instancia())}`, { number: numero, audio: audioBase64 });
}

/** Envía un texto. `numero` puede ser el teléfono o el identificador del chat (…@lid). */
export async function enviarTexto(numero: string, texto: string): Promise<MensajeEvolution> {
  return llamar<MensajeEvolution>(`/message/sendText/${encodeURIComponent(instancia())}`, { number: numero, text: texto });
}

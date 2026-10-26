// Qué hacer con cada mensaje o etiqueta que llega de Evolution, y la importación de chats ya existentes.
import {
  anuncioDe,
  buscarMensajes,
  esChatPersonal,
  etiquetaLeads,
  etiquetasDeChat,
  evolutionConfigurado,
  listarChatsEvolution,
  nombreDe,
  nombreDeContacto,
  telefonoDeLid,
  type MensajeEvolution,
} from "./evolution";
import { asegurarChat, buscarChat, guardarMensajes, quitarEtiqueta } from "./whatsapp-db";

/**
 * Mensaje nuevo (webhook). Se guarda si el chat ya está en el panel, o si es el mensaje con que el cliente
 * llegó desde un anuncio (en ese caso se crea el chat). Los demás chats del teléfono se ignoran.
 */
export async function procesarMensaje(m: MensajeEvolution): Promise<"guardado" | "ignorado"> {
  const jid = m.key?.remoteJid;
  if (!esChatPersonal(jid) || !m.key?.id) return "ignorado";
  const alt = m.key.remoteJidAlt ?? null;
  const anuncio = anuncioDe(m);
  const chat = await buscarChat(jid, alt);
  if (!chat && !anuncio) return "ignorado";
  const canonico = await asegurarChat({ jid: jid!, jidAlt: alt, nombre: nombreDe(m), anuncio });
  if (!chat) {
    // Chat recién llegado de un anuncio: se trae lo que ya hubiera (ej. el saludo automático de la cuenta).
    await importarHistorial(canonico, alt).catch(() => 0);
  }
  await guardarMensajes(canonico, [m], { enVivo: true });
  return "guardado";
}

/** Identificadores de un chat de la etiqueta: si llegó como «@lid», el principal pasa a ser el del teléfono. */
async function idsDeEtiqueta(jid: string): Promise<{ jid: string; jidAlt: string | null }> {
  if (!jid.endsWith("@lid")) return { jid, jidAlt: null };
  const telefono = await telefonoDeLid(jid).catch(() => null);
  return telefono ? { jid: telefono, jidAlt: jid } : { jid, jidAlt: null };
}

/** Le pusieron la etiqueta a un chat: se agrega al panel con su historial. */
export async function etiquetaAgregada(jid: string): Promise<void> {
  if (!esChatPersonal(jid)) return;
  const ids = await idsDeEtiqueta(jid);
  const canonico = await asegurarChat({ ...ids, etiqueta: true });
  const chat = await buscarChat(canonico);
  await importarHistorial(canonico, chat?.jid_alt ?? null).catch(() => 0);
}

/** Le quitaron la etiqueta a un chat. */
export async function etiquetaQuitada(jid: string): Promise<void> {
  const ids = await idsDeEtiqueta(jid);
  await quitarEtiqueta(ids.jid, ...(ids.jidAlt ? [ids.jidAlt] : []));
}

/**
 * Revisa en Evolution qué chats tienen hoy la etiqueta «SALTABUM | LEADS», de a `cantidad` chats desde `desde`
 * (Cloudflare limita cuántas consultas puede hacer cada pedido). Agrega los etiquetados que falten y quita la marca
 * a los que ya no la tienen. No trae el historial: eso lo hace «sincronizar» con los chats nuevos.
 */
export async function revisarEtiquetas(desde: number, cantidad: number): Promise<{ total: number; siguiente: number | null; nuevos: string[] }> {
  const jids = await listarChatsEvolution();
  const tramo = jids.slice(desde, desde + cantidad);
  const etiqueta = etiquetaLeads();
  const nuevos: string[] = [];
  const resultados = await Promise.all(tramo.map(async (jid) => [jid, await etiquetasDeChat(jid).catch(() => null)] as const));
  for (const [jid, etiquetas] of resultados) {
    if (!etiquetas) continue;
    const chat = await buscarChat(jid);
    if (etiquetas.includes(etiqueta)) {
      if (!chat?.etiqueta) {
        nuevos.push(await asegurarChat({ jid, etiqueta: true }));
      }
    } else if (chat?.etiqueta) {
      await quitarEtiqueta(chat.jid);
    }
  }
  const siguiente = desde + cantidad < jids.length ? desde + cantidad : null;
  return { total: jids.length, siguiente, nuevos };
}

/** Copia desde Evolution los últimos mensajes de un chat (por sus dos identificadores). */
export async function importarHistorial(jid: string, alt: string | null, limite = 300): Promise<number> {
  if (!evolutionConfigurado()) return 0;
  let total = 0;
  for (const id of new Set([jid, alt].filter((x): x is string => !!x))) {
    const pagina = await buscarMensajes({ key: { remoteJid: id } }, 1, limite);
    // Completa el nombre del cliente con el primer mensaje suyo que lo traiga.
    const nombre = pagina.records.map(nombreDe).find(Boolean) ?? (await nombreDeContacto(id).catch(() => null));
    if (nombre) await asegurarChat({ jid, nombre });
    total += await guardarMensajes(jid, pagina.records);
  }
  return total;
}

/**
 * Busca en todo lo que guardó Evolution los chats que empezaron desde un anuncio y los trae al panel con su
 * historial. `dias` limita hasta dónde mirar hacia atrás. Se puede repetir sin duplicar nada.
 */
export async function importarChatsDeAnuncios(dias = 365): Promise<{ revisados: number; chats: number; mensajes: number }> {
  if (!evolutionConfigurado()) throw new Error("Evolution API no está configurada");
  const desde = Date.now() / 1000 - dias * 86400;
  const anuncios = new Map<string, MensajeEvolution>();
  let revisados = 0;
  // Las páginas vienen de la más nueva a la más antigua; con 1.000 por página son pocas llamadas.
  for (let pagina = 1; pagina <= 40; pagina++) {
    const res = await buscarMensajes({}, pagina, 1000);
    for (const m of res.records) {
      revisados++;
      const jid = m.key?.remoteJid;
      if (esChatPersonal(jid) && !anuncios.has(jid!) && anuncioDe(m)) anuncios.set(jid!, m);
    }
    const masAntiguo = Number(res.records.at(-1)?.messageTimestamp ?? 0);
    if (pagina >= res.pages || !res.records.length || masAntiguo < desde) break;
  }
  let mensajes = 0;
  for (const [jid, m] of anuncios) {
    const alt = m.key?.remoteJidAlt ?? null;
    const canonico = await asegurarChat({ jid, jidAlt: alt, nombre: nombreDe(m), anuncio: anuncioDe(m) });
    const chat = await buscarChat(canonico);
    mensajes += await importarHistorial(canonico, chat?.jid_alt ?? alt);
  }
  return { revisados, chats: anuncios.size, mensajes };
}

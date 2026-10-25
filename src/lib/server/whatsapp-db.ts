// Chats de WhatsApp centralizados en el panel /admin (pestaña «WhatsApp»), en la misma base D1 de las reservas.
// Solo se guardan los chats que llegaron por un anuncio de Meta o que tienen la etiqueta «SALTABUM | LEADS»;
// el resto de las conversaciones del teléfono no se copia. Los mensajes llegan por el webhook de Evolution API
// (/api/whatsapp) y por la importación del panel.
//
// Un mismo chat puede llegar con dos identificadores: el «@lid» (sin teléfono) y el «@s.whatsapp.net» (con teléfono).
// Se guarda uno como `jid` y el otro como `jid_alt`, y se busca por cualquiera de los dos.
import { baseReservas } from "./reservas-db";
import { fechaDe, telefonoDe, textoDe, type DatosAnuncio, type MensajeEvolution } from "./evolution";

export type EstadoChat = "nueva" | "contactada" | "cerrada";

export interface ChatWhatsapp {
  jid: string;
  jid_alt: string | null;
  telefono: string | null;
  nombre: string | null;
  /** 1 si el chat empezó desde un anuncio de Meta. */
  anuncio: number;
  /** Datos del anuncio (DatosAnuncio) como JSON. */
  anuncio_datos: string | null;
  /** 1 si hoy tiene la etiqueta «SALTABUM | LEADS». */
  etiqueta: number;
  estado: EstadoChat;
  notas: string | null;
  creado: string;
  ultimo: string | null;
  ultimo_texto: string | null;
  ultimo_de_mi: number | null;
  sin_leer: number;
  actualizado: string | null;
}

export interface MensajeWhatsapp {
  id: string;
  jid: string;
  de_mi: number;
  texto: string;
  tipo: string | null;
  enviado: string;
  /** Usuario del panel que lo respondió (null si se escribió desde el teléfono o es del cliente). */
  por: string | null;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS wa_chats (
    jid TEXT PRIMARY KEY,
    jid_alt TEXT,
    telefono TEXT,
    nombre TEXT,
    anuncio INTEGER NOT NULL DEFAULT 0,
    anuncio_datos TEXT,
    etiqueta INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'nueva',
    notas TEXT,
    creado TEXT NOT NULL,
    ultimo TEXT,
    ultimo_texto TEXT,
    ultimo_de_mi INTEGER,
    sin_leer INTEGER NOT NULL DEFAULT 0,
    actualizado TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS wa_chats_alt ON wa_chats (jid_alt)",
  "CREATE INDEX IF NOT EXISTS wa_chats_ultimo ON wa_chats (ultimo)",
  `CREATE TABLE IF NOT EXISTS wa_mensajes (
    jid TEXT NOT NULL,
    id TEXT NOT NULL,
    de_mi INTEGER NOT NULL,
    texto TEXT NOT NULL,
    tipo TEXT,
    enviado TEXT NOT NULL,
    por TEXT,
    PRIMARY KEY (jid, id)
  )`,
  "CREATE INDEX IF NOT EXISTS wa_mensajes_chat ON wa_mensajes (jid, enviado)",
];

const COLUMNAS =
  "jid, jid_alt, telefono, nombre, anuncio, anuncio_datos, etiqueta, estado, notas, creado, ultimo, ultimo_texto, ultimo_de_mi, sin_leer, actualizado";

let lista: Promise<unknown> | undefined;
async function db() {
  const d = await baseReservas();
  lista ??= d.batch(ESQUEMA.map((s) => d.prepare(s)));
  await lista;
  return d;
}

const ids = (jids: (string | null | undefined)[]) => [...new Set(jids.filter((j): j is string => !!j))];

/** El chat guardado que corresponde a cualquiera de estos identificadores. */
export async function buscarChat(...jids: (string | null | undefined)[]): Promise<ChatWhatsapp | null> {
  const lista = ids(jids);
  if (!lista.length) return null;
  const d = await db();
  const marcas = lista.map(() => "?").join(", ");
  return d.prepare(`SELECT ${COLUMNAS} FROM wa_chats WHERE jid IN (${marcas}) OR jid_alt IN (${marcas}) LIMIT 1`).bind(...lista, ...lista).first<ChatWhatsapp>();
}

/** Crea el chat o completa sus datos. Devuelve el identificador con que quedó guardado. */
export async function asegurarChat(c: {
  jid: string;
  jidAlt?: string | null;
  nombre?: string | null;
  anuncio?: DatosAnuncio | null;
  etiqueta?: boolean;
}): Promise<string> {
  const d = await db();
  const ahora = new Date().toISOString();
  const previo = await buscarChat(c.jid, c.jidAlt);
  const alt = c.jidAlt && c.jidAlt !== c.jid ? c.jidAlt : null;
  if (!previo) {
    await d
      .prepare(`INSERT INTO wa_chats (jid, jid_alt, telefono, nombre, anuncio, anuncio_datos, etiqueta, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(c.jid, alt, telefonoDe(c.jid, alt), c.nombre ?? null, c.anuncio ? 1 : 0, c.anuncio ? JSON.stringify(c.anuncio) : null, c.etiqueta ? 1 : 0, ahora)
      .run();
    return c.jid;
  }
  // El identificador que no es el principal queda como alternativo (si todavía no había uno).
  const otro = ids([c.jid, alt]).find((j) => j !== previo.jid && j !== previo.jid_alt) ?? null;
  await d
    .prepare(
      `UPDATE wa_chats SET
         jid_alt = COALESCE(jid_alt, ?),
         telefono = COALESCE(telefono, ?),
         nombre = CASE WHEN nombre IS NULL OR nombre GLOB '[0-9]*' THEN COALESCE(?, nombre) ELSE nombre END,
         anuncio = MAX(anuncio, ?),
         anuncio_datos = COALESCE(anuncio_datos, ?),
         etiqueta = CASE WHEN ? IS NULL THEN etiqueta ELSE ? END,
         actualizado = ?
       WHERE jid = ?`,
    )
    .bind(
      otro,
      telefonoDe(c.jid, alt),
      c.nombre ?? null,
      c.anuncio ? 1 : 0,
      c.anuncio ? JSON.stringify(c.anuncio) : null,
      c.etiqueta === undefined ? null : 1,
      c.etiqueta ? 1 : 0,
      ahora,
      previo.jid,
    )
    .run();
  return previo.jid;
}

/** Quita la etiqueta (el chat queda guardado, y sigue visible si vino de un anuncio). */
export async function quitarEtiqueta(...jids: string[]): Promise<void> {
  const chat = await buscarChat(...jids);
  if (!chat) return;
  const d = await db();
  await d.prepare("UPDATE wa_chats SET etiqueta = 0, actualizado = ? WHERE jid = ?").bind(new Date().toISOString(), chat.jid).run();
}

/** Recalcula el último mensaje del chat (para la lista del panel). */
async function actualizarUltimo(jid: string) {
  const d = await db();
  await d
    .prepare(
      `UPDATE wa_chats SET
         ultimo = (SELECT enviado FROM wa_mensajes WHERE jid = ?1 ORDER BY enviado DESC LIMIT 1),
         ultimo_texto = (SELECT texto FROM wa_mensajes WHERE jid = ?1 ORDER BY enviado DESC LIMIT 1),
         ultimo_de_mi = (SELECT de_mi FROM wa_mensajes WHERE jid = ?1 ORDER BY enviado DESC LIMIT 1)
       WHERE jid = ?1`,
    )
    .bind(jid)
    .run();
}

/**
 * Guarda mensajes de un chat ya guardado (se ignoran los repetidos).
 * `enVivo`: llegaron recién por el webhook → los del cliente suman «sin leer» y reabren el chat si estaba cerrado.
 */
export async function guardarMensajes(jid: string, mensajes: MensajeEvolution[], opciones: { enVivo?: boolean; por?: string | null } = {}): Promise<number> {
  const filas = mensajes
    .map((m) => ({ m, texto: textoDe(m) }))
    .filter((x): x is { m: MensajeEvolution; texto: string } => !!x.texto && !!x.m.key?.id);
  if (!filas.length) return 0;
  const d = await db();
  const insertar = d.prepare("INSERT OR IGNORE INTO wa_mensajes (jid, id, de_mi, texto, tipo, enviado, por) VALUES (?, ?, ?, ?, ?, ?, ?)");
  let nuevos = 0;
  let delCliente = 0;
  // D1 acepta lotes grandes, pero se parte en bloques para no pasarse del límite de una consulta.
  for (let i = 0; i < filas.length; i += 50) {
    const bloque = filas.slice(i, i + 50);
    const res = await d.batch(
      bloque.map(({ m, texto }) =>
        insertar.bind(jid, m.key!.id!, m.key?.fromMe ? 1 : 0, texto.slice(0, 4000), m.messageType ?? null, fechaDe(m), m.key?.fromMe ? (opciones.por ?? null) : null),
      ),
    );
    res.forEach((r, j) => {
      if (Number(r.meta.changes ?? 0) > 0) {
        nuevos++;
        if (!bloque[j]!.m.key?.fromMe) delCliente++;
      }
    });
  }
  if (nuevos) {
    if (opciones.enVivo && delCliente) {
      await d
        .prepare("UPDATE wa_chats SET sin_leer = sin_leer + ?, estado = CASE WHEN estado = 'cerrada' THEN 'nueva' ELSE estado END WHERE jid = ?")
        .bind(delCliente, jid)
        .run();
    }
    await actualizarUltimo(jid);
  }
  return nuevos;
}

/** Chats para el panel: los que vinieron de un anuncio o tienen la etiqueta, el de actividad más reciente primero. */
export async function listarChats(limite: number): Promise<ChatWhatsapp[]> {
  const d = await db();
  const { results } = await d
    .prepare(`SELECT ${COLUMNAS} FROM wa_chats WHERE anuncio = 1 OR etiqueta = 1 ORDER BY COALESCE(ultimo, creado) DESC LIMIT ?`)
    .bind(limite)
    .all<ChatWhatsapp>();
  return results;
}

/** Los últimos mensajes de un chat, del más antiguo al más nuevo. */
export async function listarMensajes(jid: string, limite = 300): Promise<MensajeWhatsapp[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT * FROM (SELECT id, jid, de_mi, texto, tipo, enviado, por FROM wa_mensajes WHERE jid = ? ORDER BY enviado DESC LIMIT ?) ORDER BY enviado ASC")
    .bind(jid, limite)
    .all<MensajeWhatsapp>();
  return results;
}

export async function actualizarChat(jid: string, cambios: { estado?: EstadoChat; notas?: string | null; leido?: boolean }): Promise<void> {
  const d = await db();
  await d
    .prepare(
      `UPDATE wa_chats SET
         estado = COALESCE(?, estado),
         notas = CASE WHEN ? THEN ? ELSE notas END,
         sin_leer = CASE WHEN ? THEN 0 ELSE sin_leer END,
         actualizado = ?
       WHERE jid = ?`,
    )
    .bind(cambios.estado ?? null, cambios.notas !== undefined ? 1 : 0, cambios.notas ?? null, cambios.leido ? 1 : 0, new Date().toISOString(), jid)
    .run();
}

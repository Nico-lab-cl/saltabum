// Conversaciones del chat de la web (tablas «chat_conversaciones» y «chat_mensajes» en la misma D1 de reservas) y
// el conteo diario de mensajes («chat_uso») para que nadie pueda gastar los créditos de la API.
// Cada conversación tiene un id al azar que genera el navegador; quien lo conoce puede leerla (no hay otra sesión).
// «modo» dice quién responde: la IA o una persona del equipo que tomó el control desde /admin.
import { baseReservas } from "@/lib/server/reservas-db";

export type ModoChat = "ia" | "humano";
export type RolMensaje = "cliente" | "ia" | "equipo" | "sistema";

export interface Conversacion {
  id: string;
  creado: string;
  actualizado: string;
  modo: ModoChat;
  atiende: string | null;
  /** La IA pidió ayuda de una persona y nadie ha tomado el control todavía. */
  ayuda: number;
  nombre: string | null;
  telefono: string | null;
  reserva_id: number | null;
  pagina: string | null;
  mensajes: number;
  ultimo: string | null;
  aviso: string | null;
}

export interface MensajeGuardado {
  id: number;
  rol: RolMensaje;
  texto: string;
  autor: string | null;
  creado: string;
}

const ESQUEMAS = [
  `CREATE TABLE IF NOT EXISTS chat_uso (
    dia TEXT NOT NULL,
    visitante TEXT NOT NULL,
    mensajes INTEGER NOT NULL,
    PRIMARY KEY (dia, visitante)
  )`,
  `CREATE TABLE IF NOT EXISTS chat_conversaciones (
    id TEXT PRIMARY KEY,
    creado TEXT NOT NULL,
    actualizado TEXT NOT NULL,
    modo TEXT NOT NULL DEFAULT 'ia',
    atiende TEXT,
    ayuda INTEGER NOT NULL DEFAULT 0,
    nombre TEXT,
    telefono TEXT,
    reserva_id INTEGER,
    pagina TEXT,
    mensajes INTEGER NOT NULL DEFAULT 0,
    ultimo TEXT,
    aviso TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chat_mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversacion TEXT NOT NULL,
    rol TEXT NOT NULL,
    texto TEXT NOT NULL,
    autor TEXT,
    creado TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS chat_mensajes_conversacion ON chat_mensajes (conversacion, id)",
  "CREATE INDEX IF NOT EXISTS chat_conversaciones_actualizado ON chat_conversaciones (actualizado)",
];

// Se guarda «ya está lista» y no la promesa (ver reservas-db.ts).
let tablasListas = false;

async function db() {
  const d = await baseReservas();
  if (!tablasListas) {
    for (const sql of ESQUEMAS) await d.prepare(sql).run();
    tablasListas = true;
  }
  return d;
}

/**
 * Suma un mensaje y dice si cabe en los límites del día: por visitante y en total.
 * El conteo se hace antes de llamar a la IA, así un mensaje rechazado no gasta créditos.
 */
export async function contarMensaje(dia: string, visitante: string, maxVisitante: number, maxDia: number): Promise<"ok" | "visitante" | "dia"> {
  const d = await db();
  const total = await d.prepare("SELECT COALESCE(SUM(mensajes), 0) AS n FROM chat_uso WHERE dia = ?").bind(dia).first<{ n: number }>();
  if ((total?.n ?? 0) >= maxDia) return "dia";
  const fila = await d
    .prepare(
      `INSERT INTO chat_uso (dia, visitante, mensajes) VALUES (?, ?, 1)
       ON CONFLICT (dia, visitante) DO UPDATE SET mensajes = mensajes + 1
       RETURNING mensajes`,
    )
    .bind(dia, visitante)
    .first<{ mensajes: number }>();
  return (fila?.mensajes ?? 0) > maxVisitante ? "visitante" : "ok";
}

/** La conversación, creándola si es la primera vez que escribe ese navegador. */
export async function asegurarConversacion(id: string, pagina?: string): Promise<Conversacion> {
  const d = await db();
  const ahora = new Date().toISOString();
  await d
    .prepare("INSERT INTO chat_conversaciones (id, creado, actualizado, pagina) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING")
    .bind(id, ahora, ahora, pagina?.slice(0, 500) ?? null)
    .run();
  return (await obtenerConversacion(id))!;
}

export async function obtenerConversacion(id: string): Promise<Conversacion | null> {
  const d = await db();
  return d.prepare("SELECT * FROM chat_conversaciones WHERE id = ?").bind(id).first<Conversacion>();
}

/** Guarda un mensaje y devuelve su id. */
export async function guardarMensaje(conversacion: string, rol: RolMensaje, texto: string, autor: string | null = null): Promise<number> {
  const d = await db();
  const ahora = new Date().toISOString();
  const fila = await d
    .prepare("INSERT INTO chat_mensajes (conversacion, rol, texto, autor, creado) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .bind(conversacion, rol, texto, autor, ahora)
    .first<{ id: number }>();
  await d
    .prepare("UPDATE chat_conversaciones SET actualizado = ?, mensajes = mensajes + 1, ultimo = ? WHERE id = ?")
    .bind(ahora, texto.slice(0, 200), conversacion)
    .run();
  return fila!.id;
}

/** Mensajes de una conversación después de `desde` (id), del más antiguo al más nuevo. */
export async function mensajesDesde(conversacion: string, desde = 0, limite = 200): Promise<MensajeGuardado[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT id, rol, texto, autor, creado FROM chat_mensajes WHERE conversacion = ? AND id > ? ORDER BY id LIMIT ?")
    .bind(conversacion, desde, limite)
    .all<MensajeGuardado>();
  return results;
}

/** Los últimos `n` mensajes, del más antiguo al más nuevo (para armar lo que lee la IA). */
export async function ultimosMensajes(conversacion: string, n: number): Promise<MensajeGuardado[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT id, rol, texto, autor, creado FROM chat_mensajes WHERE conversacion = ? ORDER BY id DESC LIMIT ?")
    .bind(conversacion, n)
    .all<MensajeGuardado>();
  return results.reverse();
}

export async function actualizarConversacion(
  id: string,
  cambios: Partial<Pick<Conversacion, "modo" | "atiende" | "ayuda" | "nombre" | "telefono" | "reserva_id" | "aviso">>,
): Promise<void> {
  const campos = Object.keys(cambios) as (keyof typeof cambios)[];
  if (!campos.length) return;
  const d = await db();
  await d
    .prepare(`UPDATE chat_conversaciones SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...campos.map((c) => cambios[c] ?? null), id)
    .run();
}

/** Conversaciones con al menos un mensaje, la más reciente primero. */
export async function listarConversaciones(limite = 200): Promise<Conversacion[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT * FROM chat_conversaciones WHERE mensajes > 0 ORDER BY actualizado DESC LIMIT ?")
    .bind(limite)
    .all<Conversacion>();
  return results;
}

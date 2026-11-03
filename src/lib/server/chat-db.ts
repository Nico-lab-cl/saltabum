// Conversaciones del chat de la web (tablas «chat_conversaciones» y «chat_mensajes» en la misma D1 de reservas) y
// el conteo diario de mensajes («chat_uso») para que nadie pueda gastar los créditos de la API.
// Cada conversación tiene un id al azar que genera el navegador; quien lo conoce puede leerla (no hay otra sesión).
// «modo» dice quién responde: la IA o una persona del equipo que tomó el control desde /admin.
// «canal» dice por dónde llegó: la web o un mensaje directo de Instagram o Facebook (ver redes.ts). En las redes
// «externo» es el id de la persona en Meta y «sugerencia» la respuesta que propone la IA para que el equipo la apruebe.
import { baseReservas } from "@/lib/server/reservas-db";

export type ModoChat = "ia" | "humano";
export type RolMensaje = "cliente" | "ia" | "equipo" | "sistema";
export type CanalChat = "web" | "instagram" | "messenger";

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
  email: string | null;
  /** De qué campaña o página llegó (utm_source, utm_campaign, fbclid…), como JSON. */
  origen: string | null;
  reserva_id: number | null;
  pagina: string | null;
  mensajes: number;
  ultimo: string | null;
  aviso: string | null;
  /** null en las conversaciones antiguas, que son todas de la web. */
  canal: CanalChat | null;
  externo: string | null;
  sugerencia: string | null;
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

// Columnas agregadas después (ALTER TABLE falla si ya existen, y se ignora).
const COLUMNAS_NUEVAS = ["email TEXT", "origen TEXT", "canal TEXT", "externo TEXT", "sugerencia TEXT"];
const COLUMNAS_MENSAJES = ["externo_id TEXT"];
const INDICES = [
  "CREATE INDEX IF NOT EXISTS chat_conversaciones_externo ON chat_conversaciones (canal, externo)",
  "CREATE INDEX IF NOT EXISTS chat_mensajes_externo ON chat_mensajes (externo_id)",
];

// Se guarda «ya está lista» y no la promesa (ver reservas-db.ts).
let tablasListas = false;

/** La base con las tablas del chat listas (también la usa la pestaña Leads). */
export async function baseChat() {
  return db();
}

async function db() {
  const d = await baseReservas();
  if (!tablasListas) {
    for (const sql of ESQUEMAS) await d.prepare(sql).run();
    for (const c of COLUMNAS_NUEVAS) await d.prepare(`ALTER TABLE chat_conversaciones ADD COLUMN ${c}`).run().catch(() => undefined);
    for (const c of COLUMNAS_MENSAJES) await d.prepare(`ALTER TABLE chat_mensajes ADD COLUMN ${c}`).run().catch(() => undefined);
    for (const sql of INDICES) await d.prepare(sql).run();
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

/** Crea la conversación con los datos que la persona dejó antes de chatear (o los actualiza si ya existía). */
export async function registrarContacto(
  id: string,
  datos: { nombre: string; email: string; telefono: string; origen: Record<string, string>; pagina?: string },
): Promise<void> {
  const d = await db();
  const ahora = new Date().toISOString();
  const origen = Object.keys(datos.origen).length ? JSON.stringify(datos.origen) : null;
  await d
    .prepare(
      `INSERT INTO chat_conversaciones (id, creado, actualizado, nombre, email, telefono, origen, pagina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, email = excluded.email, telefono = excluded.telefono, actualizado = excluded.actualizado`,
    )
    .bind(id, ahora, ahora, datos.nombre, datos.email, datos.telefono, origen, datos.pagina?.slice(0, 500) ?? null)
    .run();
}

export async function obtenerConversacion(id: string): Promise<Conversacion | null> {
  const d = await db();
  return d.prepare("SELECT * FROM chat_conversaciones WHERE id = ?").bind(id).first<Conversacion>();
}

/** Guarda un mensaje y devuelve su id. `externoId` es el id del mensaje en Meta (para no guardarlo dos veces). */
export async function guardarMensaje(
  conversacion: string,
  rol: RolMensaje,
  texto: string,
  autor: string | null = null,
  externoId: string | null = null,
): Promise<number> {
  const d = await db();
  const ahora = new Date().toISOString();
  const fila = await d
    .prepare("INSERT INTO chat_mensajes (conversacion, rol, texto, autor, creado, externo_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(conversacion, rol, texto, autor, ahora, externoId)
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
  cambios: Partial<Pick<Conversacion, "modo" | "atiende" | "ayuda" | "reserva_id" | "aviso" | "sugerencia" | "nombre" | "telefono" | "email">>,
): Promise<void> {
  const campos = Object.keys(cambios) as (keyof typeof cambios)[];
  if (!campos.length) return;
  const d = await db();
  await d
    .prepare(`UPDATE chat_conversaciones SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...campos.map((c) => cambios[c] ?? null), id)
    .run();
}

/** Conversaciones con datos de contacto o mensajes, la más reciente primero. */
export async function listarConversaciones(limite = 200): Promise<Conversacion[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT * FROM chat_conversaciones WHERE mensajes > 0 OR telefono IS NOT NULL ORDER BY actualizado DESC LIMIT ?")
    .bind(limite)
    .all<Conversacion>();
  return results;
}

/** Conversación de Instagram o Facebook de una persona (por su id en Meta), creándola si es la primera vez. */
export async function conversacionDeRed(canal: Exclude<CanalChat, "web">, externo: string, nombre: string | null): Promise<Conversacion> {
  const d = await db();
  const existente = await d.prepare("SELECT * FROM chat_conversaciones WHERE canal = ? AND externo = ?").bind(canal, externo).first<Conversacion>();
  if (existente) return existente;
  const ahora = new Date().toISOString();
  const id = crypto.randomUUID();
  await d
    .prepare("INSERT INTO chat_conversaciones (id, creado, actualizado, canal, externo, nombre, pagina) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, ahora, ahora, canal, externo, nombre, canal === "instagram" ? "Instagram" : "Facebook Messenger")
    .run();
  return (await obtenerConversacion(id))!;
}

/** ¿Ya se guardó este mensaje de Meta? (Meta reintenta los avisos y manda copia de lo que enviamos). */
export async function mensajeExterno(externoId: string): Promise<boolean> {
  const d = await db();
  return !!(await d.prepare("SELECT 1 AS si FROM chat_mensajes WHERE externo_id = ? LIMIT 1").bind(externoId).first());
}

/** Anota el id de Meta de un mensaje ya guardado (Meta lo devuelve al enviarlo). */
export async function marcarExterno(id: number, externoId: string): Promise<void> {
  const d = await db();
  await d.prepare("UPDATE chat_mensajes SET externo_id = ? WHERE id = ?").bind(externoId, id).run();
}

// Consultas del formulario de contacto (/api/lead), guardadas en la misma base D1 de las reservas.
// El panel /admin las muestra en la pestaña «Consultas»: el equipo las marca como contactadas o cerradas, les
// agrega notas o crea la reserva con sus datos. Si hay un CRM configurado, además se le envían (ver /api/lead).
import { baseReservas } from "./reservas-db";

export type EstadoConsulta = "nueva" | "contactada" | "cerrada";

export interface Consulta {
  id: number;
  creado: string;
  formulario: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  mensaje: string | null;
  /** Campos extra del formulario (comuna, fecha del evento…), como JSON. */
  extra: string | null;
  /** De qué campaña o página llegó (utm_source, utm_campaign…), como JSON. */
  origen: string | null;
  pagina: string | null;
  estado: EstadoConsulta;
  notas: string | null;
  actualizado: string | null;
}

const ESQUEMA = `CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creado TEXT NOT NULL,
  formulario TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  mensaje TEXT,
  extra TEXT,
  origen TEXT,
  pagina TEXT,
  estado TEXT NOT NULL DEFAULT 'nueva',
  notas TEXT,
  actualizado TEXT,
  ip_hash TEXT,
  event_id TEXT
)`;

const COLUMNAS = "id, creado, formulario, nombre, telefono, email, mensaje, extra, origen, pagina, estado, notas, actualizado";

// Bandera y no promesa compartida (ver baseReservas).
let lista = false;
async function db() {
  const d = await baseReservas();
  if (!lista) {
    await d.batch([d.prepare(ESQUEMA), d.prepare("CREATE INDEX IF NOT EXISTS consultas_creado ON consultas (creado)")]);
    lista = true;
  }
  return d;
}

const json = (v: Record<string, string> | undefined) => (v && Object.keys(v).length ? JSON.stringify(v) : null);

export async function guardarConsulta(c: {
  formulario: string;
  nombre: string;
  telefono?: string;
  email?: string;
  mensaje?: string;
  extra?: Record<string, string>;
  origen?: Record<string, string>;
  pagina?: string;
  ipHash: string | null;
  eventId: string;
}): Promise<number> {
  const d = await db();
  const res = await d
    .prepare(
      `INSERT INTO consultas (creado, formulario, nombre, telefono, email, mensaje, extra, origen, pagina, ip_hash, event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      new Date().toISOString(),
      c.formulario,
      c.nombre,
      c.telefono ?? null,
      c.email ?? null,
      c.mensaje ?? null,
      json(c.extra),
      json(c.origen),
      c.pagina ?? null,
      c.ipHash,
      c.eventId,
    )
    .run();
  return Number(res.meta.last_row_id);
}

/** Consultas enviadas desde una misma conexión en las últimas 24 horas (límite antispam). */
export async function consultasRecientes(ipHash: string): Promise<number> {
  const d = await db();
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const fila = await d.prepare("SELECT COUNT(*) AS n FROM consultas WHERE ip_hash = ? AND creado >= ?").bind(ipHash, desde).first<{ n: number }>();
  return fila?.n ?? 0;
}

/** Las más nuevas primero. */
export async function listarConsultas(limite: number): Promise<Consulta[]> {
  const d = await db();
  const { results } = await d.prepare(`SELECT ${COLUMNAS} FROM consultas ORDER BY id DESC LIMIT ?`).bind(limite).all<Consulta>();
  return results;
}

export async function obtenerConsulta(id: number): Promise<Consulta | null> {
  const d = await db();
  return d.prepare(`SELECT ${COLUMNAS} FROM consultas WHERE id = ?`).bind(id).first<Consulta>();
}

export async function actualizarConsulta(id: number, cambios: { estado?: EstadoConsulta; notas?: string | null }): Promise<boolean> {
  const d = await db();
  const res = await d
    .prepare("UPDATE consultas SET estado = COALESCE(?, estado), notas = CASE WHEN ? THEN ? ELSE notas END, actualizado = ? WHERE id = ?")
    .bind(cambios.estado ?? null, cambios.notas !== undefined ? 1 : 0, cambios.notas ?? null, new Date().toISOString(), id)
    .run();
  return Number(res.meta.changes ?? 0) > 0;
}

export async function eliminarConsulta(id: number): Promise<void> {
  const d = await db();
  await d.prepare("DELETE FROM consultas WHERE id = ?").bind(id).run();
}

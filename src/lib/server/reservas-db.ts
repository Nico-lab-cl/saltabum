// Acceso a la base de datos D1 de reservas (binding "DB" en wrangler.jsonc).
// Cada horario (fecha + bloque) es una fila con clave primaria: dos personas no pueden tomar el mismo horario.
import { env, type D1Database } from "cloudflare:workers";

export type EstadoHorario = "reservado" | "bloqueado";

export interface FilaReserva {
  fecha: string;
  bloque: string;
  estado: EstadoHorario;
  nombre: string | null;
  telefono: string | null;
  comuna: string | null;
  direccion: string | null;
  mensaje: string | null;
  creado: string;
}

const ESQUEMA = `CREATE TABLE IF NOT EXISTS reservas (
  fecha TEXT NOT NULL,
  bloque TEXT NOT NULL,
  estado TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  comuna TEXT,
  direccion TEXT,
  mensaje TEXT,
  ip_hash TEXT,
  creado TEXT NOT NULL,
  PRIMARY KEY (fecha, bloque)
)`;

let tablaLista: Promise<unknown> | undefined;

/** Devuelve la base de datos con la tabla creada (la primera vez la crea). */
export async function baseReservas(): Promise<D1Database> {
  const db = env.DB;
  if (!db) throw new Error("Binding DB no configurado");
  // ip_hash se agregó después: en bases antiguas se intenta agregar la columna (si ya existe, falla y se ignora).
  tablaLista ??= db
    .prepare(ESQUEMA)
    .run()
    .then(() => db.prepare("ALTER TABLE reservas ADD COLUMN ip_hash TEXT").run())
    .catch(() => undefined);
  await tablaLista;
  return db;
}

/** Horarios ocupados (reservados o bloqueados) entre dos fechas, sin datos personales. */
export async function horariosOcupados(desde: string, hasta: string): Promise<{ fecha: string; bloque: string }[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare("SELECT fecha, bloque FROM reservas WHERE fecha BETWEEN ? AND ? ORDER BY fecha, bloque")
    .bind(desde, hasta)
    .all<{ fecha: string; bloque: string }>();
  return results;
}

/** Intenta tomar un horario. Devuelve false si ya estaba ocupado. */
export async function crearReserva(
  fila: Omit<FilaReserva, "estado" | "creado">,
  ipHash: string | null,
): Promise<boolean> {
  const db = await baseReservas();
  const res = await db
    .prepare(
      `INSERT INTO reservas (fecha, bloque, estado, nombre, telefono, comuna, direccion, mensaje, ip_hash, creado)
       VALUES (?, ?, 'reservado', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (fecha, bloque) DO NOTHING`,
    )
    .bind(
      fila.fecha,
      fila.bloque,
      fila.nombre,
      fila.telefono,
      fila.comuna,
      fila.direccion,
      fila.mensaje,
      ipHash,
      new Date().toISOString(),
    )
    .run();
  return Number(res.meta.changes ?? 0) > 0;
}

/** Reservas hechas desde una misma conexión en las últimas 24 horas (límite antispam). */
export async function reservasRecientes(ipHash: string): Promise<number> {
  const db = await baseReservas();
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const fila = await db
    .prepare("SELECT COUNT(*) AS n FROM reservas WHERE ip_hash = ? AND creado >= ?")
    .bind(ipHash, desde)
    .first<{ n: number }>();
  return fila?.n ?? 0;
}

export async function listarDesde(desde: string): Promise<FilaReserva[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare("SELECT * FROM reservas WHERE fecha >= ? ORDER BY fecha, bloque")
    .bind(desde)
    .all<FilaReserva>();
  return results;
}

export async function bloquear(fecha: string, bloques: readonly string[]): Promise<void> {
  const db = await baseReservas();
  const ahora = new Date().toISOString();
  await db.batch(
    bloques.map((b) =>
      db
        .prepare(
          `INSERT INTO reservas (fecha, bloque, estado, creado) VALUES (?, ?, 'bloqueado', ?)
           ON CONFLICT (fecha, bloque) DO NOTHING`,
        )
        .bind(fecha, b, ahora),
    ),
  );
}

/** Libera horarios: borra bloqueos y también reservas (para cancelar). */
export async function liberar(fecha: string, bloques: readonly string[]): Promise<void> {
  const db = await baseReservas();
  await db.batch(bloques.map((b) => db.prepare("DELETE FROM reservas WHERE fecha = ? AND bloque = ?").bind(fecha, b)));
}

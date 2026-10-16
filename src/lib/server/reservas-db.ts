// Acceso a la base de datos D1 de reservas (binding "DB" en wrangler.jsonc).
// Tabla «agenda»: cada fila es una reserva (o un bloqueo del panel) con su juego y su horario en minutos.
// Al reservar, un solo INSERT … WHERE NOT EXISTS verifica que no choque con otra fila del mismo juego (contando
// el margen entre eventos), así dos personas no pueden tomar el mismo horario ni horarios que se topen.
import { env, type D1Database } from "cloudflare:workers";
import { MARGEN } from "@/lib/reservas";

export type EstadoHorario = "reservado" | "bloqueado";

export interface FilaAgenda {
  id: number;
  fecha: string;
  producto: string;
  inicio: number;
  fin: number;
  estado: EstadoHorario;
  nombre: string | null;
  telefono: string | null;
  comuna: string | null;
  direccion: string | null;
  mensaje: string | null;
  total: number | null;
  creado: string;
}

const ESQUEMA = `CREATE TABLE IF NOT EXISTS agenda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  producto TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fin INTEGER NOT NULL,
  estado TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  comuna TEXT,
  direccion TEXT,
  mensaje TEXT,
  total INTEGER,
  ip_hash TEXT,
  creado TEXT NOT NULL
)`;

// Traspaso único desde la tabla anterior «reservas» (bloques fijos de 3 horas: 10:00, 13:30 y 17:00).
// Solo corre si «agenda» está vacía; si «reservas» no existe, falla y se ignora.
const TRASPASO = `INSERT INTO agenda (fecha, producto, inicio, fin, estado, nombre, telefono, comuna, direccion, mensaje, ip_hash, creado)
  SELECT fecha, 'megatobogan',
    CASE bloque WHEN '10:00' THEN 600 WHEN '13:30' THEN 810 ELSE 1020 END,
    CASE bloque WHEN '10:00' THEN 780 WHEN '13:30' THEN 990 ELSE 1200 END,
    estado, nombre, telefono, comuna, direccion, mensaje, ip_hash, creado
  FROM reservas
  WHERE NOT EXISTS (SELECT 1 FROM agenda)`;

let tablaLista: Promise<unknown> | undefined;

/** Devuelve la base de datos con la tabla creada (la primera vez la crea y traspasa las reservas antiguas). */
export async function baseReservas(): Promise<D1Database> {
  const db = env.DB;
  if (!db) throw new Error("Binding DB no configurado");
  tablaLista ??= (async () => {
    await db.prepare(ESQUEMA).run();
    await db.prepare("CREATE INDEX IF NOT EXISTS agenda_fecha ON agenda (fecha)").run();
    await db.prepare(TRASPASO).run().catch(() => undefined);
  })();
  await tablaLista;
  return db;
}

/** Horarios tomados entre dos fechas, sin datos personales. */
export async function horariosOcupados(
  desde: string,
  hasta: string,
): Promise<{ fecha: string; producto: string; inicio: number; fin: number }[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare("SELECT fecha, producto, inicio, fin FROM agenda WHERE fecha BETWEEN ? AND ? ORDER BY fecha, inicio")
    .bind(desde, hasta)
    .all<{ fecha: string; producto: string; inicio: number; fin: number }>();
  return results;
}

/** Intenta tomar un horario. Devuelve false si choca con otra reserva o bloqueo del mismo juego. */
export async function crearReserva(
  fila: Omit<FilaAgenda, "id" | "estado" | "creado">,
  ipHash: string | null,
): Promise<boolean> {
  const db = await baseReservas();
  const res = await db
    .prepare(
      `INSERT INTO agenda (fecha, producto, inicio, fin, estado, nombre, telefono, comuna, direccion, mensaje, total, ip_hash, creado)
       SELECT ?, ?, ?, ?, 'reservado', ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM agenda
         WHERE fecha = ? AND (producto = ? OR producto = 'todos') AND inicio < ? AND fin > ?
       )`,
    )
    .bind(
      fila.fecha,
      fila.producto,
      fila.inicio,
      fila.fin,
      fila.nombre,
      fila.telefono,
      fila.comuna,
      fila.direccion,
      fila.mensaje,
      fila.total,
      ipHash,
      new Date().toISOString(),
      fila.fecha,
      fila.producto,
      fila.fin + MARGEN,
      fila.inicio - MARGEN,
    )
    .run();
  return Number(res.meta.changes ?? 0) > 0;
}

/** Reservas hechas desde una misma conexión en las últimas 24 horas (límite antispam). */
export async function reservasRecientes(ipHash: string): Promise<number> {
  const db = await baseReservas();
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const fila = await db
    .prepare("SELECT COUNT(*) AS n FROM agenda WHERE ip_hash = ? AND creado >= ?")
    .bind(ipHash, desde)
    .first<{ n: number }>();
  return fila?.n ?? 0;
}

export async function listarDesde(desde: string): Promise<FilaAgenda[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare(
      "SELECT id, fecha, producto, inicio, fin, estado, nombre, telefono, comuna, direccion, mensaje, total, creado FROM agenda WHERE fecha >= ? ORDER BY fecha, inicio",
    )
    .bind(desde)
    .all<FilaAgenda>();
  return results;
}

/** Bloquea un rango de horas (o el día completo) para todos los juegos. */
export async function bloquear(fecha: string, inicio: number, fin: number): Promise<void> {
  const db = await baseReservas();
  await db
    .prepare("INSERT INTO agenda (fecha, producto, inicio, fin, estado, creado) VALUES (?, 'todos', ?, ?, 'bloqueado', ?)")
    .bind(fecha, inicio, fin, new Date().toISOString())
    .run();
}

/** Borra una fila: libera un bloqueo o cancela una reserva. */
export async function liberar(id: number): Promise<void> {
  const db = await baseReservas();
  await db.prepare("DELETE FROM agenda WHERE id = ?").bind(id).run();
}

// Acceso a la base de datos D1 de reservas (binding "DB" en wrangler.jsonc).
// Tabla «agenda»: cada fila es una reserva (o un bloqueo del panel) con su juego y su horario en minutos.
// Al reservar, un solo INSERT … WHERE NOT EXISTS verifica que no choque con otra fila del mismo juego (contando
// el margen entre eventos), así dos personas no pueden tomar el mismo horario ni horarios que se topen.
// El panel /admin también crea, edita y elimina reservas; puede «forzar» un horario que choca (después de avisar).
import { env, type D1Database } from "cloudflare:workers";
import { MARGEN } from "@/lib/reservas";

export type EstadoHorario = "reservado" | "bloqueado";
/** Quién creó la fila: el cliente en la web o el equipo en el panel. */
export type OrigenReserva = "web" | "panel";

export interface FilaAgenda {
  id: number;
  fecha: string;
  producto: string;
  inicio: number;
  fin: number;
  estado: EstadoHorario;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  /** Comuna de despacho (define el valor del despacho). */
  comuna: string | null;
  direccion: string | null;
  /** Casa, departamento, block, etc. */
  depto: string | null;
  ciudad: string | null;
  region: string | null;
  mensaje: string | null;
  /** Notas internas del equipo (no las ve el cliente). */
  notas: string | null;
  total: number | null;
  /** null en las reservas anteriores a este campo (todas eran de la web). */
  origen: OrigenReserva | null;
  creado: string;
  actualizado: string | null;
  /** Monto pagado (abono o total) cuando se marca como pagada en el panel. */
  pagado: number | null;
  pagado_en: string | null;
  pagado_por: string | null;
}

/** Datos de una reserva que se pueden guardar o cambiar. */
export type DatosReserva = Pick<
  FilaAgenda,
  | "fecha"
  | "producto"
  | "inicio"
  | "fin"
  | "total"
  | "nombre"
  | "apellido"
  | "email"
  | "telefono"
  | "empresa"
  | "comuna"
  | "direccion"
  | "depto"
  | "ciudad"
  | "region"
  | "mensaje"
  | "notas"
>;

/** Datos para medir la venta en Meta (solo si el cliente aceptó las cookies de medición al reservar). */
export interface MedicionReserva {
  fbp: string | null;
  fbc: string | null;
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

// Columnas agregadas después (ALTER TABLE falla si ya existen, y se ignora).
const COLUMNAS_NUEVAS = [
  "pagado INTEGER",
  "pagado_en TEXT",
  "pagado_por TEXT",
  "fbp TEXT",
  "fbc TEXT",
  "apellido TEXT",
  "email TEXT",
  "empresa TEXT",
  "depto TEXT",
  "ciudad TEXT",
  "region TEXT",
  "notas TEXT",
  "origen TEXT",
  "actualizado TEXT",
];

/** Columnas que se leen para el panel (todas menos la huella de IP y los datos de medición). */
const COLUMNAS_PANEL =
  "id, fecha, producto, inicio, fin, estado, nombre, apellido, email, telefono, empresa, comuna, direccion, depto, ciudad, region, mensaje, notas, total, origen, creado, actualizado, pagado, pagado_en, pagado_por";

/** Columnas de datos, en el orden en que se escriben (INSERT y UPDATE). */
const CAMPOS = ["fecha", "producto", "inicio", "fin", "total", "nombre", "apellido", "email", "telefono", "empresa", "comuna", "direccion", "depto", "ciudad", "region", "mensaje", "notas"] as const;
const valores = (d: DatosReserva) => CAMPOS.map((c) => d[c]);

// Traspaso único desde la tabla anterior «reservas» (bloques fijos de 3 horas: 10:00, 13:30 y 17:00).
// Solo corre si «agenda» está vacía; si «reservas» no existe, falla y se ignora.
const TRASPASO = `INSERT INTO agenda (fecha, producto, inicio, fin, estado, nombre, telefono, comuna, direccion, mensaje, ip_hash, creado)
  SELECT fecha, 'megatobogan',
    CASE bloque WHEN '10:00' THEN 600 WHEN '13:30' THEN 810 ELSE 1020 END,
    CASE bloque WHEN '10:00' THEN 780 WHEN '13:30' THEN 990 ELSE 1200 END,
    estado, nombre, telefono, comuna, direccion, mensaje, ip_hash, creado
  FROM reservas
  WHERE NOT EXISTS (SELECT 1 FROM agenda)`;

/** Otra fila del mismo juego (o un bloqueo general) que se topa con el horario, contando el margen entre eventos. */
const CHOQUE = `SELECT 1 FROM agenda o
  WHERE o.fecha = ? AND (o.producto = ? OR o.producto = 'todos') AND o.inicio < ? AND o.fin > ? AND o.id != ?`;
const paramsChoque = (d: Pick<DatosReserva, "fecha" | "producto" | "inicio" | "fin">, excluir = 0) => [
  d.fecha,
  d.producto,
  d.fin + MARGEN,
  d.inicio - MARGEN,
  excluir,
];

// Se guarda «ya está lista» y no la promesa: en Workers una promesa de otro pedido puede quedar colgada para
// siempre si ese pedido se corta (ej. recargar la página), y con ella todos los pedidos que la esperan.
let tablaLista = false;

/** Devuelve la base de datos con la tabla creada (la primera vez la crea y traspasa las reservas antiguas). */
export async function baseReservas(): Promise<D1Database> {
  const db = env.DB;
  if (!db) throw new Error("Binding DB no configurado");
  if (!tablaLista) {
    await db.prepare(ESQUEMA).run();
    await db.prepare("CREATE INDEX IF NOT EXISTS agenda_fecha ON agenda (fecha)").run();
    await db.prepare(TRASPASO).run().catch(() => undefined);
    for (const c of COLUMNAS_NUEVAS) await db.prepare(`ALTER TABLE agenda ADD COLUMN ${c}`).run().catch(() => undefined);
    tablaLista = true;
  }
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

/**
 * Guarda una reserva nueva. Devuelve su id, o null si choca con otra reserva o bloqueo del mismo juego
 * (salvo que se pida `forzar`, que solo usa el panel).
 */
export async function crearReserva(
  datos: DatosReserva,
  opciones: { origen: OrigenReserva; ipHash?: string | null; medicion?: MedicionReserva; forzar?: boolean },
): Promise<number | null> {
  const db = await baseReservas();
  const res = await db
    .prepare(
      `INSERT INTO agenda (${CAMPOS.join(", ")}, estado, origen, ip_hash, creado, fbp, fbc)
       SELECT ${CAMPOS.map(() => "?").join(", ")}, 'reservado', ?, ?, ?, ?, ?
       WHERE ? OR NOT EXISTS (${CHOQUE})`,
    )
    .bind(
      ...valores(datos),
      opciones.origen,
      opciones.ipHash ?? null,
      new Date().toISOString(),
      opciones.medicion?.fbp ?? null,
      opciones.medicion?.fbc ?? null,
      opciones.forzar ? 1 : 0,
      ...paramsChoque(datos),
    )
    .run();
  return Number(res.meta.changes ?? 0) > 0 ? Number(res.meta.last_row_id) : null;
}

/** Cambia los datos de una reserva. «ocupado» si el nuevo horario choca con otra fila (salvo `forzar`). */
export async function actualizarReserva(id: number, datos: DatosReserva, forzar = false): Promise<"ok" | "no_existe" | "ocupado"> {
  const db = await baseReservas();
  const existe = await db.prepare("SELECT 1 FROM agenda WHERE id = ? AND estado = 'reservado'").bind(id).first();
  if (!existe) return "no_existe";
  const res = await db
    .prepare(
      `UPDATE agenda SET ${CAMPOS.map((c) => `${c} = ?`).join(", ")}, actualizado = ?
       WHERE id = ? AND estado = 'reservado' AND (? OR NOT EXISTS (${CHOQUE}))`,
    )
    .bind(...valores(datos), new Date().toISOString(), id, forzar ? 1 : 0, ...paramsChoque(datos, id))
    .run();
  return Number(res.meta.changes ?? 0) > 0 ? "ok" : "ocupado";
}

/** Filas que se topan con un horario (para mostrarle al equipo con qué choca). */
export async function choques(
  datos: Pick<DatosReserva, "fecha" | "producto" | "inicio" | "fin">,
  excluir = 0,
): Promise<Pick<FilaAgenda, "id" | "estado" | "inicio" | "fin" | "nombre" | "apellido">[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare(
      `SELECT id, estado, inicio, fin, nombre, apellido FROM agenda o
       WHERE o.fecha = ? AND (o.producto = ? OR o.producto = 'todos') AND o.inicio < ? AND o.fin > ? AND o.id != ?
       ORDER BY inicio`,
    )
    .bind(...paramsChoque(datos, excluir))
    .all<Pick<FilaAgenda, "id" | "estado" | "inicio" | "fin" | "nombre" | "apellido">>();
  return results;
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

/** Reservas y bloqueos desde una fecha (para el panel). */
export async function listarDesde(desde: string): Promise<FilaAgenda[]> {
  const db = await baseReservas();
  const { results } = await db
    .prepare(`SELECT ${COLUMNAS_PANEL} FROM agenda WHERE fecha >= ? ORDER BY fecha, inicio`)
    .bind(desde)
    .all<FilaAgenda>();
  return results;
}

/** Una fila cualquiera (reserva o bloqueo), para guardar cómo estaba antes de un cambio. */
export async function obtenerFila(id: number): Promise<FilaAgenda | null> {
  const db = await baseReservas();
  return db.prepare(`SELECT ${COLUMNAS_PANEL} FROM agenda WHERE id = ?`).bind(id).first<FilaAgenda>();
}

/** Bloquea un rango de horas (o el día completo) para todos los juegos. Devuelve el id del bloqueo. */
export async function bloquear(fecha: string, inicio: number, fin: number): Promise<number> {
  const db = await baseReservas();
  const res = await db
    .prepare("INSERT INTO agenda (fecha, producto, inicio, fin, estado, origen, creado) VALUES (?, 'todos', ?, ?, 'bloqueado', 'panel', ?)")
    .bind(fecha, inicio, fin, new Date().toISOString())
    .run();
  return Number(res.meta.last_row_id);
}

/** Borra una fila: libera un bloqueo o elimina una reserva (el historial guarda cómo era). */
export async function liberar(id: number): Promise<void> {
  const db = await baseReservas();
  await db.prepare("DELETE FROM agenda WHERE id = ?").bind(id).run();
}

/** Una reserva con sus datos de medición, para enviar la venta a Meta. */
export async function obtenerReserva(id: number): Promise<(FilaAgenda & MedicionReserva) | null> {
  const db = await baseReservas();
  return db.prepare("SELECT * FROM agenda WHERE id = ? AND estado = 'reservado'").bind(id).first<FilaAgenda & MedicionReserva>();
}

/** Marca una reserva como pagada (solo la primera vez). Devuelve false si ya estaba pagada o no existe. */
export async function marcarPagada(id: number, monto: number, usuario: string): Promise<boolean> {
  const db = await baseReservas();
  const res = await db
    .prepare("UPDATE agenda SET pagado = ?, pagado_en = ?, pagado_por = ? WHERE id = ? AND estado = 'reservado' AND pagado IS NULL")
    .bind(monto, new Date().toISOString(), usuario, id)
    .run();
  return Number(res.meta.changes ?? 0) > 0;
}

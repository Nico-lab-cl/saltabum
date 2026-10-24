// Reglas de la agenda de reservas (compartidas entre navegador y Worker).
// El cliente elige el juego, el día, la hora de inicio (cada 30 minutos entre APERTURA y CIERRE), cuántas horas
// (HORAS_BASE más hasta HORAS_EXTRA_MAX adicionales) y la comuna para el despacho. Entre un evento y otro del mismo
// juego quedan MARGEN minutos libres para retirar, trasladar y volver a montar.
import { z } from "zod";
import { ABONO, COMUNAS, HORA_EXTRA, PRODUCTOS } from "@design/data";

export const ZONA_HORARIA = "America/Santiago";

/** Primera hora de inicio y hora máxima de término, en minutos desde las 00:00. */
export const APERTURA = 9 * 60;
export const CIERRE = 22 * 60;
/** Cada cuántos minutos se puede elegir la hora de inicio. */
export const PASO = 30;
export const HORAS_BASE = 3;
export const HORAS_EXTRA_MAX = 3;
/** Minutos libres entre un evento y el siguiente. */
export const MARGEN = 90;

/** Cuántos días hacia adelante se puede reservar. Nunca el mismo día (evita choques de horario). */
export const DIAS_RESERVABLES = 90;

export const VALOR_HORA_EXTRA = Number(HORA_EXTRA.replace(/\D/g, ""));
export { ABONO };

export type ProductoId = (typeof PRODUCTOS)[number]["id"];
const PRODUCTO_IDS = PRODUCTOS.map((p) => p.id) as [ProductoId, ...ProductoId[]];
const COMUNA_NOMBRES = COMUNAS.map((c) => c.nombre) as [string, ...string[]];

/** Fecha de hoy en Chile, formato YYYY-MM-DD. */
export function hoyChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Primer y último día que se pueden reservar (desde mañana). */
export function rangoReservable(ahora: Date = new Date()): { desde: string; hasta: string } {
  const hoy = hoyChile(ahora);
  return { desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, DIAS_RESERVABLES) };
}

/** 600 → "10:00". */
export const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** "10:00" → 600. */
export const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const etiquetaHorario = (inicio: number, fin: number) => `${aHora(inicio)} a ${aHora(fin)}`;

/** Horas de inicio posibles (en minutos) para un arriendo de `horas` horas. */
export function iniciosPosibles(horas: number): number[] {
  const lista: number[] = [];
  for (let m = APERTURA; m + horas * 60 <= CIERRE; m += PASO) lista.push(m);
  return lista;
}

/** Un horario tomado: una reserva, o un bloqueo del panel (producto «todos»). */
export interface Ocupado {
  fecha: string;
  producto: string;
  inicio: number;
  fin: number;
}

/** ¿El juego está libre ese día de `inicio` por `horas` horas, contando el margen entre eventos? */
export function estaLibre(fecha: string, producto: string, inicio: number, horas: number, ocupados: readonly Ocupado[]): boolean {
  const fin = inicio + horas * 60;
  return !ocupados.some(
    (o) => o.fecha === fecha && (o.producto === producto || o.producto === "todos") && inicio < o.fin + MARGEN && fin + MARGEN > o.inicio,
  );
}

/** Desglose del precio en pesos. `comuna` puede faltar mientras el cliente no la elige. */
export function calcularPrecio(producto: string, horas: number, comuna?: string) {
  const base = PRODUCTOS.find((p) => p.id === producto)?.precio ?? PRODUCTOS[0].precio;
  const extras = Math.max(0, horas - HORAS_BASE) * VALOR_HORA_EXTRA;
  const despacho = COMUNAS.find((c) => c.nombre === comuna)?.despacho ?? 0;
  return { base, extras, despacho, total: base + extras + despacho };
}

export const pesos = (n: number) => (n === 0 ? "Gratis" : `$${n.toLocaleString("es-CL")}`);

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");
/** Texto opcional: vacío se guarda como undefined. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Correo opcional, guardado en minúsculas. */
const correo = opcional(200)
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo inválido")
  .transform((v) => v?.toLowerCase());

/** Región de todas las comunas donde llegamos. */
export const REGION = "Valparaíso";

export const reservaSchema = z
  .object({
    fecha: fechaISO,
    producto: z.enum(PRODUCTO_IDS),
    inicio: hora,
    horas: z.number().int().min(HORAS_BASE).max(HORAS_BASE + HORAS_EXTRA_MAX),
    nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
    telefono: z.string().trim().min(8, "Ingresa tu teléfono").max(30),
    // El formulario exige apellido, correo, dirección y ciudad; aquí quedan opcionales para no rechazar
    // reservas desde una página abierta antes de que se agregaran.
    apellido: opcional(120),
    email: correo,
    empresa: opcional(160),
    comuna: z.enum(COMUNA_NOMBRES),
    direccion: opcional(200),
    /** Casa, departamento, block, etc. */
    depto: opcional(120),
    ciudad: opcional(80),
    region: opcional(60),
    mensaje: opcional(1000),
    event_id: z.uuid(),
    page_url: z.string().max(1000).optional(),
    consent: z.boolean().default(false),
    attribution: z.record(z.string(), z.string().max(1000)).default({}),
    turnstile_token: z.string().max(2048).optional(),
    /** Honeypot anti-bots: debe venir vacío. */
    website: z.string().optional(),
  })
  .refine((r) => iniciosPosibles(r.horas).includes(aMinutos(r.inicio)), { message: "Horario fuera de rango", path: ["inicio"] });

export type ReservaInput = z.input<typeof reservaSchema>;

/** Hora del panel: cualquier minuto del día (el panel puede salirse del horario de la web). 24:00 = medianoche. */
const horaPanel = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Hora inválida");

/**
 * Reserva cargada o editada desde el panel /admin. Es más flexible que la de la web: cualquier horario, comuna
 * libre (puede ser una fuera de zona) y el total que acuerde el equipo. Las notas internas no las ve el cliente.
 */
export const reservaPanelSchema = z
  .object({
    fecha: fechaISO,
    producto: z.enum(PRODUCTO_IDS),
    inicio: horaPanel,
    fin: horaPanel,
    total: z.number().int().min(0).max(5_000_000),
    nombre: z.string().trim().min(2, "Escribe el nombre del cliente").max(120),
    apellido: opcional(120),
    telefono: opcional(30),
    email: correo,
    empresa: opcional(160),
    comuna: opcional(80),
    direccion: opcional(200),
    depto: opcional(120),
    ciudad: opcional(80),
    region: opcional(60),
    mensaje: opcional(1000),
    notas: opcional(2000),
  })
  .refine((r) => aMinutos(r.fin) > aMinutos(r.inicio), { message: "El término debe ser después del inicio", path: ["fin"] });

export type ReservaPanel = z.output<typeof reservaPanelSchema>;

/** Acciones del panel /admin sobre la agenda. */
export const bloqueoSchema = z.discriminatedUnion("accion", [
  /** «forzar» guarda aunque se cruce con otra reserva o bloqueo (el panel lo pide después de avisar). */
  z.object({ accion: z.literal("crear"), datos: reservaPanelSchema, forzar: z.boolean().default(false) }),
  z.object({ accion: z.literal("editar"), id: z.number().int().positive(), datos: reservaPanelSchema, forzar: z.boolean().default(false) }),
  z.object({ accion: z.literal("eliminar"), id: z.number().int().positive() }),
  z.object({
    accion: z.literal("bloquear"),
    fecha: fechaISO,
    /** Sin horas se bloquea el día completo. */
    desde: hora.optional(),
    hasta: hora.optional(),
  }),
  z.object({ accion: z.literal("liberar"), id: z.number().int().positive() }),
  /** Pago confirmado (abono o total), en pesos. Se informa a Meta como compra. */
  z.object({ accion: z.literal("pagada"), id: z.number().int().positive(), monto: z.number().int().min(1000).max(5_000_000) }),
]);

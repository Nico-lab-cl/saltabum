// Reglas del calendario de reservas (compartidas entre navegador y Worker).
// Para cambiar los horarios ofrecidos, edita BLOQUES: el id es la hora de inicio y se guarda en la base de datos.
import { z } from "zod";

export const ZONA_HORARIA = "America/Santiago";

/** Bloques fijos de arriendo (3 horas cada uno). */
export const BLOQUES = [
  { id: "10:00", inicio: "10:00", fin: "13:00" },
  { id: "13:30", inicio: "13:30", fin: "16:30" },
  { id: "17:00", inicio: "17:00", fin: "20:00" },
] as const;

export type BloqueId = (typeof BLOQUES)[number]["id"];
export const BLOQUE_IDS = BLOQUES.map((b) => b.id) as [BloqueId, ...BloqueId[]];

/** Cuántos días hacia adelante se puede reservar. Nunca el mismo día (evita choques de horario). */
export const DIAS_RESERVABLES = 90;

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

export function etiquetaBloque(id: string): string {
  const b = BLOQUES.find((x) => x.id === id);
  return b ? `${b.inicio} a ${b.fin}` : id;
}

/** Clave única de un horario: "2026-10-20|13:30". */
export const claveHorario = (fecha: string, bloque: string) => `${fecha}|${bloque}`;

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const reservaSchema = z.object({
  fecha: fechaISO,
  bloque: z.enum(BLOQUE_IDS),
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  telefono: z.string().trim().min(8, "Ingresa tu teléfono").max(30),
  comuna: z.string().trim().min(2).max(60),
  direccion: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  mensaje: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  event_id: z.uuid(),
  page_url: z.string().max(1000).optional(),
  consent: z.boolean().default(false),
  attribution: z.record(z.string(), z.string().max(1000)).default({}),
  turnstile_token: z.string().max(2048).optional(),
  /** Honeypot anti-bots: debe venir vacío. */
  website: z.string().optional(),
});

export type ReservaInput = z.input<typeof reservaSchema>;

export const bloqueoSchema = z.object({
  accion: z.enum(["bloquear", "liberar"]),
  fecha: fechaISO,
  /** "todos" bloquea o libera el día completo. */
  bloque: z.union([z.enum(BLOQUE_IDS), z.literal("todos")]),
});

// Tareas de seguimiento del CRM (vista «Tareas» de la pestaña Contactos del panel /admin).
//
// Hay dos tipos:
// - Automáticas: salen solas de la situación de cada contacto (ver REGLAS) y no se guardan. Cada una tiene una llave
//   que incluye la actividad que la originó, así que si la persona vuelve a escribir o cambia su reserva, la tarea
//   vieja desaparece y aparece la que corresponda.
// - A mano: las crea el equipo desde la ficha, con texto y fecha.
// En `crm_tareas` se guardan las tareas a mano y lo que el equipo hizo con las automáticas (hecha o pospuesta).
//
// Los tiempos siguen lo que recomiendan los cuadernos de ventas: insistir a las 24 horas y a los 3 días (dentro de
// la ventana de 72 horas de los anuncios a WhatsApp), y después de una semana sin respuesta, cerrar como perdido.
import { ABONO } from "@/lib/reservas";
import { baseReservas } from "./reservas-db";
import { listarContactos, type Contacto } from "./contactos";

export type TipoTarea = "seguimiento" | "ultimo_intento" | "cerrar" | "abono" | "logistica" | "manual";

export interface Tarea {
  /** «auto:<regla>:<referencia>» para las automáticas o «manual:<id>». */
  id: string;
  tipo: TipoTarea;
  clave: string;
  nombre: string;
  titulo: string;
  /** Por qué aparece (lo que pasó). */
  motivo: string;
  vence: string;
  /** Mensaje sugerido para WhatsApp (se puede editar antes de enviar). */
  mensaje: string | null;
  jid: string | null;
  telefono: string | null;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS crm_tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL,
    regla TEXT UNIQUE,
    texto TEXT,
    vence TEXT,
    creado TEXT NOT NULL,
    por TEXT,
    hecha_en TEXT,
    hecha_por TEXT,
    pospuesta TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS crm_tareas_clave ON crm_tareas (clave)",
];

let lista = false;
async function db() {
  const d = await baseReservas();
  if (!lista) {
    await d.batch(ESQUEMA.map((s) => d.prepare(s)));
    lista = true;
  }
  return d;
}

type FilaTarea = {
  id: number;
  clave: string;
  regla: string | null;
  texto: string | null;
  vence: string | null;
  hecha_en: string | null;
  pospuesta: string | null;
};

const HORA = 3_600_000;
const DIA = 24 * HORA;
const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;
const fecha = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const diaEvento = (f: string) => fecha.format(new Date(`${f}T12:00:00Z`));
const mas = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
const hoyChile = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const diasHasta = (f: string) =>
  Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${hoyChile()}T12:00:00Z`)) / DIA);
const primerNombre = (c: Contacto) => (c.nombre ?? "").split(/\s+/)[0] || "";

/** Las tareas automáticas de un contacto según su situación. */
function automaticas(c: Contacto): Omit<Tarea, "nombre" | "jid" | "telefono" | "clave">[] {
  if (c.perdido) return [];
  const n = primerNombre(c);
  const hola = `¡Hola${n ? ` ${n}` : ""}!`;
  const holaComa = `Hola${n ? ` ${n}` : ""},`;
  const tareas: Omit<Tarea, "nombre" | "jid" | "telefono" | "clave">[] = [];
  const quieto = Date.now() - Date.parse(c.ultimo);

  // Antes de reservar: si la persona no espera respuesta, la pelota está en su cancha.
  if (
    !c.reservas.length &&
    !c.esperando &&
    (c.etapa === "lead" || c.etapa === "calificado" || c.etapa === "cotizado")
  ) {
    const cotizo = c.etapa === "cotizado";
    if (quieto >= 7 * DIA)
      tareas.push({
        id: `auto:cerrar:${c.ultimo}`,
        tipo: "cerrar",
        titulo: "Cerrar como perdido",
        motivo: `Una semana sin respuesta${cotizo ? " después de cotizar" : ""}`,
        vence: mas(c.ultimo, 7 * DIA),
        mensaje: null,
      });
    else if (quieto >= 3 * DIA)
      tareas.push({
        id: `auto:ultimo_intento:${c.ultimo}`,
        tipo: "ultimo_intento",
        titulo: "Último intento",
        motivo: `3 días sin respuesta${cotizo ? " después de cotizar" : ""}`,
        vence: mas(c.ultimo, 3 * DIA),
        mensaje: `${holaComa} te escribo por si todavía buscas inflable para tu evento 🎈 Las fechas de fin de semana se toman rápido. Si me confirmas el día y la comuna, te lo reservo hoy mismo`,
      });
    else if (quieto >= DIA)
      tareas.push({
        id: `auto:seguimiento:${c.ultimo}`,
        tipo: "seguimiento",
        titulo: cotizo ? "Seguimiento de la cotización" : "Seguimiento",
        motivo: cotizo ? "Recibió precio y no ha respondido en 24 horas" : "No ha respondido en 24 horas",
        vence: mas(c.ultimo, DIA),
        mensaje: cotizo
          ? `${hola} ¿Pudiste revisar la cotización? Si me dices la fecha y la comuna te confirmo la disponibilidad de inmediato 😊`
          : `${hola} ¿Para qué fecha y en qué comuna sería tu evento? Así te confirmo disponibilidad y precio con despacho`,
      });
  }

  for (const r of c.reservas) {
    const faltan = diasHasta(r.fecha);
    if (faltan < 0) continue;
    // Reserva sin abono: recordar al día siguiente de reservar, o de inmediato si el evento es en menos de 3 días.
    if (!r.pagado && (Date.now() - Date.parse(r.creado) >= DIA || faltan <= 3))
      tareas.push({
        id: `auto:abono:${r.id}`,
        tipo: "abono",
        titulo: "Recordar el abono",
        motivo: `Reservó para el ${diaEvento(r.fecha)} y todavía no paga${faltan <= 3 ? ` (faltan ${faltan} días)` : ""}`,
        vence: faltan <= 3 ? new Date().toISOString() : mas(r.creado, DIA),
        mensaje: `${hola} Te recuerdo que tu reserva del ${diaEvento(r.fecha)} queda confirmada con el abono de ${pesos(ABONO)}. ¿Te envío los datos para transferir?`,
      });
    // Pagada: confirmar la llegada 2 días antes del evento.
    if (r.pagado && faltan <= 2)
      tareas.push({
        id: `auto:logistica:${r.id}`,
        tipo: "logistica",
        titulo: "Confirmar el día del evento",
        motivo:
          faltan === 0 ? "El evento es hoy" : `El evento es en ${faltan === 1 ? "1 día" : `${faltan} días`}`,
        vence: new Date(Date.parse(`${r.fecha}T12:00:00Z`) - 2 * DIA).toISOString(),
        mensaje: `${hola} Te confirmamos tu inflable para el ${diaEvento(r.fecha)} 🎉 Llegamos 30 minutos antes para armarlo. Necesitamos una superficie plana y un enchufe cerca. ¿Me confirmas la dirección?`,
      });
  }
  return tareas;
}

/** Tareas pendientes de todos los contactos, la más atrasada primero. */
export async function listarTareas(): Promise<Tarea[]> {
  const [contactos, d] = await Promise.all([listarContactos(), db()]);
  const { results } = await d
    .prepare(
      "SELECT id, clave, regla, texto, vence, hecha_en, pospuesta FROM crm_tareas WHERE hecha_en IS NULL OR regla IS NOT NULL",
    )
    .all<FilaTarea>();
  const porRegla = new Map(results.filter((t) => t.regla).map((t) => [t.regla!, t]));
  const ahora = new Date().toISOString();
  const tareas: Tarea[] = [];

  for (const c of contactos) {
    const base = {
      clave: c.clave,
      nombre: c.nombre ?? (c.telefono ? `+${c.telefono}` : "Sin nombre"),
      jid: c.whatsapp?.jid ?? null,
      telefono: c.telefono,
    };
    for (const t of automaticas(c)) {
      const guardada = porRegla.get(t.id);
      if (guardada?.hecha_en) continue;
      if (guardada?.pospuesta && guardada.pospuesta > ahora) continue;
      tareas.push({ ...base, ...t, vence: guardada?.pospuesta ?? t.vence });
    }
  }
  const porClave = new Map(contactos.map((c) => [c.clave, c]));
  for (const t of results.filter((x) => !x.regla && !x.hecha_en)) {
    const c = porClave.get(t.clave);
    tareas.push({
      id: `manual:${t.id}`,
      tipo: "manual",
      clave: t.clave,
      nombre: c?.nombre ?? (c?.telefono ? `+${c.telefono}` : t.clave),
      titulo: t.texto ?? "Tarea",
      motivo: "Tarea anotada por el equipo",
      vence: t.pospuesta ?? t.vence ?? ahora,
      mensaje: null,
      jid: c?.whatsapp?.jid ?? null,
      telefono: c?.telefono ?? null,
    });
  }
  return tareas.sort((a, b) => a.vence.localeCompare(b.vence));
}

export async function crearTarea(clave: string, texto: string, vence: string, por: string): Promise<void> {
  const d = await db();
  await d
    .prepare("INSERT INTO crm_tareas (clave, texto, vence, creado, por) VALUES (?, ?, ?, ?, ?)")
    .bind(clave, texto, vence, new Date().toISOString(), por)
    .run();
}

/** Marca hecha (o pospone hasta `hasta`) una tarea automática o a mano. */
export async function resolverTarea(
  id: string,
  clave: string,
  por: string,
  hasta?: string,
): Promise<boolean> {
  const d = await db();
  const ahora = new Date().toISOString();
  if (id.startsWith("manual:")) {
    const res = await d
      .prepare(
        hasta
          ? "UPDATE crm_tareas SET pospuesta = ? WHERE id = ? AND clave = ?"
          : "UPDATE crm_tareas SET hecha_en = ?, hecha_por = ? WHERE id = ? AND clave = ?",
      )
      .bind(...(hasta ? [hasta] : [ahora, por]), Number(id.slice(7)), clave)
      .run();
    return Number(res.meta.changes ?? 0) > 0;
  }
  if (!id.startsWith("auto:")) return false;
  await d
    .prepare(
      `INSERT INTO crm_tareas (clave, regla, creado, por, hecha_en, hecha_por, pospuesta) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(regla) DO UPDATE SET hecha_en = excluded.hecha_en, hecha_por = excluded.hecha_por, pospuesta = excluded.pospuesta`,
    )
    .bind(clave, id, ahora, por, hasta ? null : ahora, hasta ? null : por, hasta ?? null)
    .run();
  return true;
}

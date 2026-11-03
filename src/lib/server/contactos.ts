// Contactos del CRM (pestaña «Contactos» del panel /admin): una ficha por persona que une sus chats de WhatsApp, sus
// conversaciones del chat de la web, sus consultas y sus reservas, cruzados por teléfono.
//
// La ficha no se copia a ninguna tabla: se arma en cada consulta desde las tablas de cada canal, así nunca queda
// desactualizada. En `crm_contactos` solo se guarda lo que decide el equipo (perdido y su motivo, una etapa marcada a
// mano, notas, el festejado y si dejó reseña), en `crm_encuestas` la nota que puso cada cliente a su evento y en
// `crm_eventos` el historial de esas decisiones.
//
// Etapas (metodología inbound): Lead → Calificado → Cotizado → Reservado → Cliente → Promotor. Se pueden saltar
// (quien reserva en la web pasa directo a Reservado) y vale la más avanzada entre la automática y la marcada a mano.
// «Perdido» es una salida desde cualquier etapa antes de Cliente; si la persona vuelve a escribir o reserva, se
// reactiva sola.
import type { D1Database } from "cloudflare:workers";
import { baseChat } from "./chat-db";
import { baseReservas } from "./reservas-db";
import { normalizarTelefono } from "./whatsapp-db";

export const ETAPAS = ["lead", "calificado", "cotizado", "reservado", "cliente", "promotor"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const MOTIVOS_PERDIDA = [
  "no_respondio",
  "sin_disponibilidad",
  "fuera_de_zona",
  "presupuesto",
  "otra_empresa",
  "cancelo",
  "spam",
] as const;
export type MotivoPerdida = (typeof MOTIVOS_PERDIDA)[number];

export interface ReservaContacto {
  id: number;
  fecha: string;
  producto: string;
  total: number | null;
  pagado: number | null;
  pagado_en: string | null;
  creado: string;
  origen: string | null;
}

export interface Contacto {
  /** Teléfono normalizado (o «wa:<jid>» / «email:<correo>» si no hay teléfono). */
  clave: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  comuna: string | null;
  etapa: Etapa;
  /** La etapa que se calcula sola (sin lo marcado a mano). */
  etapa_auto: Etapa;
  perdido: { motivo: MotivoPerdida; etapa: Etapa; en: string; por: string | null } | null;
  /** Estuvo perdido y volvió a escribir o reservar después. */
  reactivado: boolean;
  /** Desde cuándo espera respuesta del equipo (null si no espera). */
  esperando: string | null;
  /** Dónde espera: el canal del mensaje más antiguo sin responder. */
  espera_en: "whatsapp" | "chatweb" | "consulta" | null;
  /** Canal y campaña por donde llegó la primera vez. */
  origen: string;
  /** Canal por donde llegó la primera vez (para los reportes). */
  canal: Canal;
  /** Minutos que tardamos en responder su primer mensaje de WhatsApp (null si no aplica). */
  respuesta_min: number | null;
  creado: string;
  ultimo: string;
  notas: string | null;
  whatsapp: { jid: string; anuncio: number; titulo: string | null } | null;
  chats: string[];
  consultas: number[];
  reservas: ReservaContacto[];
  /** El niño o niña del cumpleaños (para el recordatorio del año siguiente). */
  festejado: { nombre: string | null; cumple: string | null };
  /** Cuándo dejó reseña (en Google o Instagram); lo hace Promotor. */
  resena: string | null;
  /** Nota del 1 al 5 que puso a cada evento. */
  encuestas: Encuesta[];
}

export type Canal = "anuncio" | "whatsapp" | "chatweb" | "formulario" | "web" | "panel";

export interface Encuesta {
  reserva: number;
  nota: number;
  comentario: string | null;
  en: string;
}

export interface EventoContacto {
  en: string;
  tipo: "whatsapp" | "chatweb" | "consulta" | "reserva" | "pago" | "cotizacion" | "encuesta" | "equipo";
  texto: string;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS crm_contactos (
    clave TEXT PRIMARY KEY,
    etapa TEXT,
    perdido_motivo TEXT,
    perdido_etapa TEXT,
    perdido_en TEXT,
    perdido_por TEXT,
    notas TEXT,
    actualizado TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS crm_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL,
    creado TEXT NOT NULL,
    texto TEXT NOT NULL,
    por TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS crm_eventos_clave ON crm_eventos (clave, creado)",
  `CREATE TABLE IF NOT EXISTS crm_inversion (
    mes TEXT PRIMARY KEY,
    monto INTEGER NOT NULL,
    actualizado TEXT NOT NULL,
    por TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS crm_encuestas (
    reserva_id INTEGER PRIMARY KEY,
    clave TEXT NOT NULL,
    nota INTEGER NOT NULL,
    comentario TEXT,
    creado TEXT NOT NULL,
    por TEXT
  )`,
];

// Columnas agregadas después (ALTER TABLE falla si ya existen, y se ignora).
const COLUMNAS_NUEVAS = ["nino_nombre TEXT", "nino_cumple TEXT", "resena_en TEXT"];

// Bandera y no promesa compartida (ver baseReservas).
let lista = false;
async function db() {
  const d = await baseReservas();
  if (!lista) {
    await d.batch(ESQUEMA.map((s) => d.prepare(s)));
    for (const c of COLUMNAS_NUEVAS)
      await d
        .prepare(`ALTER TABLE crm_contactos ADD COLUMN ${c}`)
        .run()
        .catch(() => undefined);
    lista = true;
  }
  return d;
}

/** Si la tabla todavía no existe (nadie usó ese canal), viene vacía. */
async function consulta<T>(d: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const { results } = await d
      .prepare(sql)
      .bind(...params)
      .all<T>();
    return results;
  } catch (err) {
    if (!String(err).includes("no such table")) throw err;
    return [];
  }
}

const leer = (s: string | null): Record<string, string> => {
  try {
    return s ? (JSON.parse(s) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const APPS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp" };
const nivel = (e: Etapa) => ETAPAS.indexOf(e);
const masAvanzada = (a: Etapa, b: Etapa) => (nivel(a) >= nivel(b) ? a : b);
const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

type FilaWa = {
  jid: string;
  telefono: string | null;
  nombre: string | null;
  anuncio: number;
  anuncio_datos: string | null;
  estado: string;
  creado: string;
  ultimo: string | null;
  ultimo_de_mi: number | null;
  ultimo_cliente: string | null;
  cotizado: string | null;
  primera_respuesta: string | null;
  primer_cliente: string | null;
};
type FilaChat = {
  id: string;
  creado: string;
  actualizado: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  ayuda: number;
  origen: string | null;
  reserva_id: number | null;
  ultimo_cliente: string | null;
  cotizado: string | null;
};
type FilaConsulta = {
  id: number;
  creado: string;
  formulario: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  mensaje: string | null;
  extra: string | null;
  origen: string | null;
  estado: string;
};
type FilaReserva = ReservaContacto & {
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  comuna: string | null;
  atribucion: string | null;
};
type FilaCrm = {
  clave: string;
  etapa: Etapa | null;
  perdido_motivo: MotivoPerdida | null;
  perdido_etapa: Etapa | null;
  perdido_en: string | null;
  perdido_por: string | null;
  notas: string | null;
  nino_nombre: string | null;
  nino_cumple: string | null;
  resena_en: string | null;
};

/** Lee todos los canales. Lo comparten la lista y la ficha. */
async function leerCanales() {
  // Crea las tablas y columnas del chat si esta instancia todavía no lo hizo.
  await baseChat();
  const d = await db();
  const [wa, chats, consultas, reservas, crm, encuestas] = await Promise.all([
    // Primer mensaje nuestro con precio o catálogo = cotización enviada.
    consulta<FilaWa>(
      d,
      `SELECT c.jid, c.telefono, c.nombre, c.anuncio, c.anuncio_datos, c.estado, c.creado, c.ultimo, c.ultimo_de_mi,
         (SELECT MAX(enviado) FROM wa_mensajes m WHERE m.jid = c.jid AND m.de_mi = 0) AS ultimo_cliente,
         (SELECT MIN(enviado) FROM wa_mensajes m WHERE m.jid = c.jid AND m.de_mi = 1 AND (m.texto LIKE '%$%' OR m.texto LIKE '%atálogo%')) AS cotizado,
         (SELECT MIN(enviado) FROM wa_mensajes m WHERE m.jid = c.jid AND m.de_mi = 0) AS primer_cliente,
         (SELECT MIN(r.enviado) FROM wa_mensajes r WHERE r.jid = c.jid AND r.de_mi = 1
            AND r.enviado > (SELECT MIN(m.enviado) FROM wa_mensajes m WHERE m.jid = c.jid AND m.de_mi = 0)) AS primera_respuesta
       FROM wa_chats c WHERE c.anuncio = 1 OR c.etiqueta = 1`,
    ),
    // La IA cotiza con el total y el precio («el total es $99.980»).
    consulta<FilaChat>(
      d,
      `SELECT c.id, c.creado, c.actualizado, c.nombre, c.telefono, c.email, c.ayuda, c.origen, c.reserva_id,
         (SELECT MAX(creado) FROM chat_mensajes m WHERE m.conversacion = c.id AND m.rol = 'cliente') AS ultimo_cliente,
         (SELECT MIN(creado) FROM chat_mensajes m WHERE m.conversacion = c.id AND m.rol = 'ia' AND m.texto LIKE '%$%' AND m.texto LIKE '%total%') AS cotizado
       FROM chat_conversaciones c WHERE c.telefono IS NOT NULL`,
    ),
    consulta<FilaConsulta>(
      d,
      "SELECT id, creado, formulario, nombre, telefono, email, mensaje, extra, origen, estado FROM consultas",
    ),
    consulta<FilaReserva>(
      d,
      "SELECT id, fecha, producto, total, pagado, pagado_en, creado, origen, nombre, apellido, telefono, email, comuna, atribucion FROM agenda WHERE estado = 'reservado' ORDER BY fecha",
    ),
    consulta<FilaCrm>(
      d,
      "SELECT clave, etapa, perdido_motivo, perdido_etapa, perdido_en, perdido_por, notas, nino_nombre, nino_cumple, resena_en FROM crm_contactos",
    ),
    consulta<{ reserva_id: number; nota: number; comentario: string | null; creado: string }>(
      d,
      "SELECT reserva_id, nota, comentario, creado FROM crm_encuestas",
    ),
  ]);
  return { wa, chats, consultas, reservas, crm, encuestas };
}

/** Borrador de un contacto mientras se juntan sus canales. */
interface Borrador {
  clave: string;
  nombres: { valor: string; peso: number }[];
  telefono: string | null;
  email: string | null;
  comuna: string | null;
  origenes: { en: string; texto: string; canal: Canal }[];
  creado: string;
  ultimo: string;
  /** Último mensaje o acción del cliente (para reactivar un perdido). */
  ultimoCliente: string | null;
  calificado: boolean;
  cotizado: boolean;
  esperas: { desde: string; en: "whatsapp" | "chatweb" | "consulta" }[];
  wa: FilaWa | null;
  chats: FilaChat[];
  consultas: FilaConsulta[];
  reservas: FilaReserva[];
}

function claveDe(telefono: string | null | undefined, alterna: string): string {
  const t = telefono ? normalizarTelefono(telefono) : "";
  return t.length >= 8 ? t : alterna;
}

function juntar(canales: Awaited<ReturnType<typeof leerCanales>>): {
  borradores: Map<string, Borrador>;
  crm: Map<string, FilaCrm>;
  encuestas: Map<number, Encuesta>;
} {
  const borradores = new Map<string, Borrador>();
  const tomar = (clave: string, creado: string): Borrador => {
    let b = borradores.get(clave);
    if (!b) {
      b = {
        clave,
        nombres: [],
        telefono: /^\d+$/.test(clave) ? clave : null,
        email: null,
        comuna: null,
        origenes: [],
        creado,
        ultimo: creado,
        ultimoCliente: null,
        calificado: false,
        cotizado: false,
        esperas: [],
        wa: null,
        chats: [],
        consultas: [],
        reservas: [],
      };
      borradores.set(clave, b);
    }
    b.creado = minIso(b.creado, creado)!;
    b.ultimo = maxIso(b.ultimo, creado)!;
    return b;
  };

  for (const w of canales.wa) {
    const b = tomar(claveDe(w.telefono, `wa:${w.jid}`), w.creado);
    b.wa = w;
    if (w.nombre && !/^\d+$/.test(w.nombre)) b.nombres.push({ valor: w.nombre, peso: 1 });
    const a = leer(w.anuncio_datos);
    b.origenes.push({
      en: w.creado,
      canal: w.anuncio ? "anuncio" : "whatsapp",
      texto: w.anuncio
        ? `Anuncio${a.app ? ` ${APPS[a.app] ?? a.app}` : " de Meta"}${a.titulo ? ` · ${a.titulo}` : ""}`
        : "WhatsApp (etiqueta)",
    });
    b.ultimo = maxIso(b.ultimo, w.ultimo)!;
    b.ultimoCliente = maxIso(b.ultimoCliente, w.ultimo_cliente);
    if (w.cotizado) b.cotizado = true;
    // Espera respuesta si el último mensaje del chat es del cliente.
    if (w.estado !== "cerrada" && w.ultimo && w.ultimo_de_mi === 0)
      b.esperas.push({ desde: w.ultimo, en: "whatsapp" });
  }
  for (const c of canales.chats) {
    const b = tomar(claveDe(c.telefono, `chat:${c.id}`), c.creado);
    b.chats.push(c);
    if (c.nombre) b.nombres.push({ valor: c.nombre, peso: 2 });
    b.email ??= c.email;
    const o = leer(c.origen);
    b.origenes.push({
      en: c.creado,
      canal: o.fbclid ? "anuncio" : "chatweb",
      texto: `Chat de la web${o.utm_source ? ` · ${o.utm_source}${o.utm_campaign ? ` / ${o.utm_campaign}` : ""}` : o.fbclid ? " · anuncio de Meta" : ""}`,
    });
    b.ultimo = maxIso(b.ultimo, c.actualizado)!;
    b.ultimoCliente = maxIso(b.ultimoCliente, c.ultimo_cliente);
    if (c.cotizado) b.cotizado = true;
    if (c.ayuda) b.esperas.push({ desde: c.actualizado, en: "chatweb" });
  }
  for (const q of canales.consultas) {
    const b = tomar(
      claveDe(q.telefono, q.email ? `email:${q.email.toLowerCase()}` : `consulta:${q.id}`),
      q.creado,
    );
    b.consultas.push(q);
    if (q.nombre) b.nombres.push({ valor: q.nombre, peso: 2 });
    b.email ??= q.email;
    const extra = leer(q.extra);
    if (extra.comuna) b.comuna ??= extra.comuna;
    if (extra.fecha && extra.comuna) b.calificado = true;
    const o = leer(q.origen);
    b.origenes.push({
      en: q.creado,
      canal: o.fbclid ? "anuncio" : "formulario",
      texto: `Formulario ${q.formulario}${o.utm_source ? ` · ${o.utm_source}` : o.fbclid ? " · anuncio de Meta" : ""}`,
    });
    b.ultimoCliente = maxIso(b.ultimoCliente, q.creado);
    if (q.estado === "nueva") b.esperas.push({ desde: q.creado, en: "consulta" });
  }
  for (const r of canales.reservas) {
    const b = tomar(
      claveDe(r.telefono, r.email ? `email:${r.email.toLowerCase()}` : `reserva:${r.id}`),
      r.creado,
    );
    b.reservas.push(r);
    const nombre = [r.nombre, r.apellido].filter(Boolean).join(" ");
    if (nombre) b.nombres.push({ valor: nombre, peso: 3 });
    b.email ??= r.email;
    if (r.comuna) b.comuna = r.comuna;
    const o = leer(r.atribucion);
    b.origenes.push({
      en: r.creado,
      canal: o.fbclid ? "anuncio" : r.origen === "web" ? "web" : r.origen === "chat" ? "chatweb" : "panel",
      texto:
        r.origen === "web"
          ? `Reserva en la web${o.utm_source ? ` · ${o.utm_source}` : ""}`
          : r.origen === "chat"
            ? "Reserva en el chat de la web"
            : "Reserva anotada en el panel",
    });
    b.ultimo = maxIso(b.ultimo, maxIso(r.creado, r.pagado_en))!;
    if (r.origen !== "panel") b.ultimoCliente = maxIso(b.ultimoCliente, r.creado);
  }
  return {
    borradores,
    crm: new Map(canales.crm.map((c) => [c.clave, c])),
    encuestas: new Map(
      canales.encuestas.map((e) => [
        e.reserva_id,
        { reserva: e.reserva_id, nota: e.nota, comentario: e.comentario, en: e.creado },
      ]),
    ),
  };
}

function armar(b: Borrador, crm: FilaCrm | undefined, encuestas: Map<number, Encuesta>): Contacto {
  const pagadas = b.reservas.filter((r) => r.pagado);
  // Promotor: volvió a arrendar o dejó reseña.
  const auto: Etapa =
    pagadas.length >= 2 || (pagadas.length && crm?.resena_en)
      ? "promotor"
      : pagadas.length
        ? "cliente"
        : b.reservas.length
          ? "reservado"
          : b.cotizado
            ? "cotizado"
            : b.calificado
              ? "calificado"
              : "lead";
  const etapa = crm?.etapa && ETAPAS.includes(crm.etapa) ? masAvanzada(auto, crm.etapa) : auto;

  // Perdido solo antes de ser cliente; si escribió o reservó después de marcarlo, se reactiva solo.
  let perdido: Contacto["perdido"] = null;
  let reactivado = false;
  if (crm?.perdido_motivo && crm.perdido_en && nivel(etapa) < nivel("cliente")) {
    if (b.ultimoCliente && b.ultimoCliente > crm.perdido_en) reactivado = true;
    else
      perdido = {
        motivo: crm.perdido_motivo,
        etapa: crm.perdido_etapa ?? etapa,
        en: crm.perdido_en,
        por: crm.perdido_por,
      };
  }

  const espera = perdido ? undefined : b.esperas.sort((x, y) => x.desde.localeCompare(y.desde))[0];
  const nombre = b.nombres.sort((x, y) => y.peso - x.peso)[0]?.valor ?? null;
  const wa = b.wa;
  return {
    clave: b.clave,
    nombre,
    telefono: b.telefono,
    email: b.email,
    comuna: b.comuna,
    etapa,
    etapa_auto: auto,
    perdido,
    reactivado,
    esperando: espera?.desde ?? null,
    espera_en: espera?.en ?? null,
    origen: b.origenes.sort((x, y) => x.en.localeCompare(y.en))[0]?.texto ?? "Directo",
    canal: b.origenes[0]?.canal ?? "panel",
    respuesta_min:
      wa?.primer_cliente && wa.primera_respuesta
        ? Math.round((Date.parse(wa.primera_respuesta) - Date.parse(wa.primer_cliente)) / 60_000)
        : null,
    creado: b.creado,
    ultimo: b.ultimo,
    notas: crm?.notas ?? null,
    whatsapp: wa ? { jid: wa.jid, anuncio: wa.anuncio, titulo: leer(wa.anuncio_datos).titulo ?? null } : null,
    chats: b.chats.map((c) => c.id),
    consultas: b.consultas.map((q) => q.id),
    reservas: b.reservas.map(({ id, fecha, producto, total, pagado, pagado_en, creado, origen }) => ({
      id,
      fecha,
      producto,
      total,
      pagado,
      pagado_en,
      creado,
      origen,
    })),
    festejado: { nombre: crm?.nino_nombre ?? null, cumple: crm?.nino_cumple ?? null },
    resena: crm?.resena_en ?? null,
    encuestas: b.reservas.map((r) => encuestas.get(r.id)).filter((e): e is Encuesta => !!e),
  };
}

/** Todos los contactos, el de actividad más reciente primero. */
export async function listarContactos(): Promise<Contacto[]> {
  const { borradores, crm, encuestas } = juntar(await leerCanales());
  return [...borradores.values()]
    .map((b) => armar(b, crm.get(b.clave), encuestas))
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

/** Un contacto con su línea de tiempo (lo más nuevo primero). */
export async function obtenerContacto(
  clave: string,
): Promise<{ contacto: Contacto; eventos: EventoContacto[] } | null> {
  const canales = await leerCanales();
  const { borradores, crm, encuestas } = juntar(canales);
  const b = borradores.get(clave);
  if (!b) return null;
  const contacto = armar(b, crm.get(clave), encuestas);
  const fecha = new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const dia = (f: string) => fecha.format(new Date(`${f}T12:00:00Z`));
  const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;

  const eventos: EventoContacto[] = [];
  if (b.wa) {
    const a = leer(b.wa.anuncio_datos);
    eventos.push({
      en: b.wa.creado,
      tipo: "whatsapp",
      texto: b.wa.anuncio
        ? `Escribió por WhatsApp desde un anuncio${a.titulo ? ` («${a.titulo}»)` : ""}`
        : "Su chat de WhatsApp quedó con la etiqueta SALTABUM | LEADS",
    });
    if (b.wa.cotizado)
      eventos.push({
        en: b.wa.cotizado,
        tipo: "cotizacion",
        texto: "Le enviamos precio o catálogo por WhatsApp",
      });
    if (b.wa.ultimo_cliente && b.wa.ultimo_cliente !== b.wa.creado)
      eventos.push({ en: b.wa.ultimo_cliente, tipo: "whatsapp", texto: "Su último mensaje por WhatsApp" });
  }
  for (const c of b.chats) {
    eventos.push({ en: c.creado, tipo: "chatweb", texto: "Conversó con el chat de la web" });
    if (c.cotizado)
      eventos.push({ en: c.cotizado, tipo: "cotizacion", texto: "La IA le cotizó en el chat de la web" });
    if (c.ayuda)
      eventos.push({ en: c.actualizado, tipo: "chatweb", texto: "La IA pidió que lo atienda una persona" });
  }
  for (const q of b.consultas) {
    const extra = leer(q.extra);
    const datos = [extra.fecha && `para el ${extra.fecha}`, extra.comuna && `en ${extra.comuna}`]
      .filter(Boolean)
      .join(" ");
    eventos.push({
      en: q.creado,
      tipo: "consulta",
      texto: `Dejó una consulta (${q.formulario})${datos ? ` ${datos}` : ""}${q.mensaje ? `: «${q.mensaje.slice(0, 140)}»` : ""}`,
    });
  }
  for (const r of b.reservas) {
    const desde = r.origen === "web" ? " en la web" : r.origen === "chat" ? " en el chat de la web" : "";
    eventos.push({
      en: r.creado,
      tipo: "reserva",
      texto: `Reservó${desde} para el ${dia(r.fecha)}${r.total ? ` (${pesos(r.total)})` : ""}`,
    });
    if (r.pagado && r.pagado_en)
      eventos.push({
        en: r.pagado_en,
        tipo: "pago",
        texto: `Pagó ${pesos(r.pagado)} de la reserva del ${dia(r.fecha)}`,
      });
    const e = encuestas.get(r.id);
    if (e)
      eventos.push({
        en: e.en,
        tipo: "encuesta",
        texto: `Le puso ${e.nota} de 5 al evento del ${dia(r.fecha)}${e.comentario ? `: «${e.comentario}»` : ""}`,
      });
  }
  const d = await db();
  const propios = await d
    .prepare("SELECT creado, texto, por FROM crm_eventos WHERE clave = ? ORDER BY creado DESC LIMIT 100")
    .bind(clave)
    .all<{ creado: string; texto: string; por: string | null }>();
  for (const e of propios.results)
    eventos.push({ en: e.creado, tipo: "equipo", texto: `${e.texto}${e.por ? ` · ${e.por}` : ""}` });
  return { contacto, eventos: eventos.sort((x, y) => y.en.localeCompare(x.en)) };
}

const NOMBRE_ETAPA: Record<Etapa, string> = {
  lead: "Lead",
  calificado: "Calificado",
  cotizado: "Cotizado",
  reservado: "Reservado",
  cliente: "Cliente",
  promotor: "Promotor",
};
export const NOMBRE_MOTIVO: Record<MotivoPerdida, string> = {
  no_respondio: "No respondió",
  sin_disponibilidad: "Sin disponibilidad para su fecha",
  fuera_de_zona: "Fuera de la zona de despacho",
  presupuesto: "Presupuesto",
  otra_empresa: "Eligió otra empresa",
  cancelo: "Canceló la reserva",
  spam: "Spam o número equivocado",
};

async function guardar(clave: string, cambios: Partial<Omit<FilaCrm, "clave">>, evento: string, por: string) {
  const d = await db();
  const ahora = new Date().toISOString();
  const campos = Object.keys(cambios) as (keyof typeof cambios)[];
  await d.batch([
    d.prepare("INSERT OR IGNORE INTO crm_contactos (clave, actualizado) VALUES (?, ?)").bind(clave, ahora),
    d
      .prepare(
        `UPDATE crm_contactos SET ${campos.map((c) => `${c} = ?`).join(", ")}, actualizado = ? WHERE clave = ?`,
      )
      .bind(...campos.map((c) => cambios[c] ?? null), ahora, clave),
    d
      .prepare("INSERT INTO crm_eventos (clave, creado, texto, por) VALUES (?, ?, ?, ?)")
      .bind(clave, ahora, evento, por),
  ]);
}

export async function marcarPerdido(contacto: Contacto, motivo: MotivoPerdida, por: string) {
  await guardar(
    contacto.clave,
    {
      perdido_motivo: motivo,
      perdido_etapa: contacto.etapa,
      perdido_en: new Date().toISOString(),
      perdido_por: por,
    },
    `Marcado como perdido en ${NOMBRE_ETAPA[contacto.etapa]}: ${NOMBRE_MOTIVO[motivo]}`,
    por,
  );
}

export async function reactivar(clave: string, por: string) {
  await guardar(
    clave,
    { perdido_motivo: null, perdido_etapa: null, perdido_en: null, perdido_por: null },
    "Reactivado",
    por,
  );
}

/** Etapa marcada a mano (null la quita y vuelve a la automática). */
export async function marcarEtapa(clave: string, etapa: Etapa | null, por: string) {
  await guardar(
    clave,
    { etapa },
    etapa ? `Etapa marcada a mano: ${NOMBRE_ETAPA[etapa]}` : "Vuelve a la etapa automática",
    por,
  );
}

export async function guardarNotas(clave: string, notas: string | null, por: string) {
  await guardar(clave, { notas }, "Nota actualizada", por);
}

/** Nombre y cumpleaños (AAAA-MM-DD) del niño o niña del evento. */
export async function guardarFestejado(
  clave: string,
  nombre: string | null,
  cumple: string | null,
  por: string,
) {
  await guardar(
    clave,
    { nino_nombre: nombre, nino_cumple: cumple },
    `Festejado: ${[nombre, cumple && `cumple el ${cumple.slice(8, 10)}/${cumple.slice(5, 7)}`].filter(Boolean).join(", ") || "sin datos"}`,
    por,
  );
}

/** Nota del 1 al 5 que el cliente le puso a su evento (la respuesta a la encuesta post evento). */
export async function guardarEncuesta(
  clave: string,
  reservaId: number,
  nota: number,
  comentario: string | null,
  por: string,
) {
  const d = await db();
  await d
    .prepare(
      `INSERT INTO crm_encuestas (reserva_id, clave, nota, comentario, creado, por) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(reserva_id) DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario, creado = excluded.creado, por = excluded.por`,
    )
    .bind(reservaId, clave, nota, comentario, new Date().toISOString(), por)
    .run();
}

/** Dejó reseña en Google o Instagram (lo convierte en Promotor). null la quita. */
export async function marcarResena(clave: string, si: boolean, por: string) {
  await guardar(
    clave,
    { resena_en: si ? new Date().toISOString() : null },
    si ? "Dejó reseña" : "Se quitó la reseña",
    por,
  );
}

/** Inversión en anuncios por mes («AAAA-MM» → pesos), anotada en Reportes. */
export async function listarInversion(): Promise<{ mes: string; monto: number }[]> {
  const d = await db();
  const { results } = await d
    .prepare("SELECT mes, monto FROM crm_inversion ORDER BY mes")
    .all<{ mes: string; monto: number }>();
  return results;
}

export async function guardarInversion(mes: string, monto: number, por: string) {
  const d = await db();
  await d
    .prepare(
      `INSERT INTO crm_inversion (mes, monto, actualizado, por) VALUES (?, ?, ?, ?)
       ON CONFLICT(mes) DO UPDATE SET monto = excluded.monto, actualizado = excluded.actualizado, por = excluded.por`,
    )
    .bind(mes, monto, new Date().toISOString(), por)
    .run();
}

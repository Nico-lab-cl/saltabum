// Todos los leads en una sola lista para la pestaña «Leads» del panel /admin: formularios de contacto, chat de la web
// (datos que dejan antes de chatear), reservas de la web o del chat y chats de WhatsApp que llegaron por anuncios.
// Cada uno con su origen (utm_*, anuncio, página de entrada) tal como se guardó en su propia tabla.
import { baseChat } from "@/lib/server/chat-db";
import { baseReservas } from "@/lib/server/reservas-db";

export type FuenteLead = "formulario" | "chat" | "reserva" | "whatsapp";

export interface Lead {
  fuente: FuenteLead;
  id: string;
  creado: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** «Meta» o «Google» cuando llegó desde un clic en un anuncio (fbclid / gclid). */
  anuncio: string | null;
  referrer: string | null;
  landing: string | null;
  /** Lo que pidió o hizo (juego, fecha, comuna, mensaje…). */
  detalle: string | null;
  estado: string | null;
}

const leer = (s: string | null): Record<string, string> => {
  try {
    return s ? (JSON.parse(s) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/** Campos de origen comunes a partir del JSON guardado (utm_*, fbclid, gclid, referrer, landing_page). */
function origen(o: Record<string, string>) {
  return {
    utm_source: o.utm_source ?? null,
    utm_medium: o.utm_medium ?? null,
    utm_campaign: o.utm_campaign ?? null,
    utm_content: o.utm_content ?? null,
    utm_term: o.utm_term ?? null,
    anuncio: o.anuncio ?? (o.fbclid ? "Meta" : o.gclid ? "Google" : null),
    referrer: o.referrer ?? null,
    landing: o.landing_page ?? null,
  };
}

/** Si la tabla todavía no existe (nadie la ha usado), esa fuente viene vacía. */
async function consulta<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = await baseReservas();
  try {
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all<T>();
    return results;
  } catch (err) {
    if (!String(err).includes("no such table")) throw err;
    return [];
  }
}

export async function listarLeads(limite = 2000): Promise<Lead[]> {
  // Agrega las columnas nuevas de las conversaciones si esta instancia todavía no lo hizo.
  await baseChat();
  const [formularios, chats, reservas, whatsapp] = await Promise.all([
    consulta<{ id: number; creado: string; formulario: string; nombre: string; telefono: string | null; email: string | null; mensaje: string | null; extra: string | null; origen: string | null; pagina: string | null; estado: string }>(
      "SELECT id, creado, formulario, nombre, telefono, email, mensaje, extra, origen, pagina, estado FROM consultas ORDER BY id DESC LIMIT ?",
      limite,
    ),
    consulta<{ id: string; creado: string; nombre: string | null; telefono: string | null; email: string | null; origen: string | null; pagina: string | null; reserva_id: number | null; modo: string; ultimo: string | null }>(
      "SELECT id, creado, nombre, telefono, email, origen, pagina, reserva_id, modo, ultimo FROM chat_conversaciones WHERE telefono IS NOT NULL ORDER BY creado DESC LIMIT ?",
      limite,
    ),
    consulta<{ id: number; creado: string; nombre: string | null; apellido: string | null; telefono: string | null; email: string | null; fecha: string; producto: string; comuna: string | null; total: number | null; origen: string | null; atribucion: string | null; pagado: number | null }>(
      "SELECT id, creado, nombre, apellido, telefono, email, fecha, producto, comuna, total, origen, atribucion, pagado FROM agenda WHERE estado = 'reservado' AND origen IN ('web', 'chat') ORDER BY id DESC LIMIT ?",
      limite,
    ),
    consulta<{ jid: string; creado: string; nombre: string | null; telefono: string | null; anuncio: number; anuncio_datos: string | null; estado: string; ultimo_texto: string | null }>(
      "SELECT jid, creado, nombre, telefono, anuncio, anuncio_datos, estado, ultimo_texto FROM wa_chats WHERE anuncio = 1 OR etiqueta = 1 ORDER BY creado DESC LIMIT ?",
      limite,
    ),
  ]);

  const leads: Lead[] = [
    ...formularios.map((c): Lead => {
      const extra = leer(c.extra);
      return {
        fuente: "formulario",
        id: `consulta-${c.id}`,
        creado: c.creado,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email,
        ...origen({ landing_page: c.pagina ?? "", ...leer(c.origen) }),
        detalle: [c.formulario !== "contacto" ? c.formulario : "", extra.comuna, extra.fecha, c.mensaje].filter(Boolean).join(" · ") || null,
        estado: c.estado,
      };
    }),
    ...chats.map((c): Lead => ({
      fuente: "chat",
      id: `chat-${c.id}`,
      creado: c.creado,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      ...origen({ landing_page: c.pagina ?? "", ...leer(c.origen) }),
      detalle: c.ultimo,
      estado: c.reserva_id ? `reservó (N° ${c.reserva_id})` : c.modo === "humano" ? "con el equipo" : "con la IA",
    })),
    ...reservas.map((r): Lead => ({
      fuente: "reserva",
      id: `reserva-${r.id}`,
      creado: r.creado,
      nombre: [r.nombre, r.apellido].filter(Boolean).join(" ") || null,
      telefono: r.telefono,
      email: r.email,
      ...origen(leer(r.atribucion)),
      detalle: [r.producto, r.fecha, r.comuna, r.total ? `$${r.total.toLocaleString("es-CL")}` : "", r.origen === "chat" ? "desde el chat" : "desde la web"].filter(Boolean).join(" · "),
      estado: r.pagado ? (r.total && r.pagado >= r.total ? "pagada" : "con abono") : "sin pago",
    })),
    ...whatsapp.map((w): Lead => {
      const a = leer(w.anuncio_datos);
      return {
        fuente: "whatsapp",
        id: `whatsapp-${w.jid}`,
        creado: w.creado,
        nombre: w.nombre,
        telefono: w.telefono,
        email: null,
        utm_source: a.app ?? (w.anuncio ? "meta" : null),
        utm_medium: w.anuncio ? "anuncio" : null,
        utm_campaign: a.titulo ?? null,
        utm_content: a.id ?? null,
        utm_term: null,
        anuncio: w.anuncio ? "Meta" : null,
        referrer: null,
        landing: a.url ?? null,
        detalle: w.ultimo_texto,
        estado: w.estado,
      };
    }),
  ];
  return leads.sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, limite);
}

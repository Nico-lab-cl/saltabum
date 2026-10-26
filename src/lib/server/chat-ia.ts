// Asistente con IA del chat de la web (Claude Haiku vía API de Anthropic, clave ANTHROPIC_API_KEY).
// Responde con la información del sitio y usa la agenda real: revisa disponibilidad, cotiza con el mismo cálculo de
// la página y deja reservas que aparecen en /admin con origen «chat». El equipo las confirma con el abono por WhatsApp.
// La conversación se guarda en D1 (chat-db.ts) y se ve en /admin, donde el equipo puede tomar el control. Las reservas
// y los pedidos de ayuda se avisan al grupo de WhatsApp del equipo (chat-avisos.ts).
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRM_WEBHOOK_SECRET, CRM_WEBHOOK_URL } from "astro:env/server";
import { ABONO, COMUNAS, FAQS, PRODUCTO, PRODUCTOS } from "@design/data";
import {
  aHora,
  aMinutos,
  APERTURA,
  calcularPrecio,
  CIERRE,
  estaLibre,
  etiquetaHorario,
  HORAS_BASE,
  HORAS_EXTRA_MAX,
  hoyChile,
  iniciosPosibles,
  MARGEN,
  pesos,
  rangoReservable,
  REGION,
  reservaSchema,
  VALOR_HORA_EXTRA,
  ZONA_HORARIA,
} from "@/lib/reservas";
import { auditar } from "@/lib/server/admin-auth";
import { avisarGrupo, enlacePanel } from "@/lib/server/chat-avisos";
import { actualizarConversacion, type MensajeGuardado } from "@/lib/server/chat-db";
import { CONOCIMIENTO } from "@/lib/server/chat-conocimiento";
import { sendToCrm } from "@/lib/server/crm";
import { crearReserva, horariosOcupados, reservasRecientes } from "@/lib/server/reservas-db";

const MODELO = "claude-haiku-5-5";
/** Vueltas de herramientas por mensaje del cliente (revisar, cotizar, reservar…). */
const MAX_VUELTAS = 6;
/** Reservas por conexión cada 24 horas (mismo límite que el formulario). */
const MAX_RESERVAS_POR_IP = 3;

export const chatConfigurado = () => !!ANTHROPIC_API_KEY;

export interface RespuestaChat {
  texto: string;
  /** Mensaje para abrir WhatsApp con el caso resumido (cuando la IA deriva al equipo). */
  whatsapp?: string;
  /** Se creó una reserva en este turno. */
  reserva?: boolean;
}

const PRODUCTO_IDS = PRODUCTOS.map((p) => p.id);
const COMUNA_NOMBRES = COMUNAS.map((c) => c.nombre);

// Instrucciones fijas (se guardan en caché entre conversaciones). Nada que cambie por día o por cliente va aquí.
const INSTRUCCIONES = `Eres el asistente virtual de Saltabum, empresa de arriendo de juegos inflables en la Región de Valparaíso, Chile. Atiendes el chat de la web saltabum.cl como el mejor vendedor del equipo: rápido, cálido y resolutivo.

Tu meta es que cada conversación termine en una reserva (o, si no se puede, con la persona derivada al equipo). Para eso:
- Saluda por su nombre y ve al grano. En los primeros mensajes consigue lo clave para cotizar: fecha del evento y comuna (y, si no lo dijo, para qué edad o tipo de evento es).
- Apenas tengas fecha y comuna, revisa disponibilidad y cotiza: en la misma respuesta di qué está libre y el total con despacho. No hagas esperar con preguntas que no necesitas.
- Propón opciones concretas en vez de preguntas abiertas: «Te queda libre a las 11:00 o a las 15:00, ¿cuál te acomoda?».
- Recomienda el juego que calza: el ${PRODUCTO.nombre} para niños de ${PRODUCTO.edad} y espacios grandes; los castillos si el espacio es más chico o el presupuesto más ajustado. Si el evento es largo, ofrece horas extra.
- Destaca lo que da confianza cuando ayude: despacho, montaje, anclaje y retiro incluidos, juegos sanitizados, reprogramación sin perder el abono si llueve.
- Resuelve objeciones con hechos (precio, lluvia, espacio, electricidad). Si según la agenda quedan pocos horarios, puedes decirlo; nunca inventes urgencia ni promociones.
- Termina cada mensaje con un siguiente paso claro (una pregunta o una propuesta).

Cómo escribir
- Español de Chile, cercano y alegre, con tuteo, como un buen vendedor por WhatsApp. Algún emoji sí, sin exagerar.
- Muy breve, como un chat de WhatsApp: cada mensaje de 1 o 2 frases cortas (máximo unas 25 palabras). Si necesitas decir dos cosas, usa 2 mensajes separados por una línea en blanco (cada bloque se muestra aparte); nunca más de 2. Nada de párrafos ni de repetir lo que la persona ya sabe.
- Responde solo lo que te preguntaron más el siguiente paso. El detalle (medidas, qué incluye, condiciones) solo si lo piden.
- Texto simple: sin markdown, sin asteriscos, sin títulos, sin listas largas.
- Si te preguntan si eres una persona o un bot, responde con naturalidad que eres el asistente virtual de Saltabum y que el equipo revisa cada reserva y puede entrar al chat cuando la persona quiera. Nunca digas que eres humano.

Lo que sabes (no inventes nada fuera de esto)
Juegos que se pueden reservar, cada uno con su propia agenda:
${PRODUCTOS.map((p) => `- ${p.nombre} (id ${p.id}): ${pesos(p.precio)} por ${HORAS_BASE} horas`).join("\n")}
El ${PRODUCTO.nombre} es para niños de ${PRODUCTO.edad}, mide ${PRODUCTO.base} de base y ${PRODUCTO.alto} de alto, y necesita ${PRODUCTO.espacioLibre} libres. Su precio normal es $100.000 y hoy está en promoción a ${PRODUCTO.precio}. De los castillos no tienes medidas: si preguntan, ofrece que el equipo lo confirme por WhatsApp.
Horas extra: ${pesos(VALOR_HORA_EXTRA)} cada una, hasta ${HORAS_EXTRA_MAX} extra (máximo ${HORAS_BASE + HORAS_EXTRA_MAX} horas).
Horario: el arriendo puede empezar desde las ${aHora(APERTURA)} y debe terminar a más tardar a las ${aHora(CIERRE)}, con inicios cada 30 minutos. Se reserva desde mañana en adelante, nunca para el mismo día.
Despacho por comuna (montaje y retiro incluidos):
${COMUNAS.map((c) => `- ${c.nombre} (${c.zonas}): ${c.despacho ? `+${pesos(c.despacho)}` : "gratis"}`).join("\n")}
Fuera de esas comunas no tienes precio: usa pedir_ayuda.
Abono para reservar: ${pesos(ABONO)}, se descuenta del total y el resto se paga el día del evento.
Preguntas frecuentes:
${FAQS.filter((f) => !f.a.includes("[")).map((f) => `- ${f.q} ${f.a}`).join("\n")}

${CONOCIMIENTO}

Herramientas
- ver_disponibilidad: úsala siempre antes de decir que un día u horario está libre. Nunca supongas disponibilidad.
- cotizar: úsala para dar el total con despacho y horas extra.
- crear_reserva: cuando la persona ya eligió juego, fecha, hora de inicio, horas y comuna, y te dio la dirección. Nombre, correo y teléfono ya los tienes del formulario: no los vuelvas a pedir (solo el apellido si falta). Antes de llamarla, resume todo (juego, fecha, horario, comuna, dirección, total) y pide que la persona confirme con un sí. Si no confirmó, no la llames.
- En el historial solo quedan los textos de la conversación, no las consultas a las herramientas. Lo que dijiste antes sí lo revisaste con ellas: no te disculpes ni lo pongas en duda. Si pasó tiempo o cambian los datos, vuelve a consultar sin comentarlo.
- pedir_ayuda: cuando la persona quiere hablar con alguien, el caso se sale de lo que sabes (otra comuna, colegios, municipalidades, varios juegos, factura con datos especiales, reclamos) o algo falla. Avisa al equipo, que puede entrar a este mismo chat, y le muestra a la persona un botón para seguir por WhatsApp. Resume el caso en el mensaje.
- Los mensajes que empiezan con «(Equipo Saltabum)» los escribió una persona del equipo: respeta lo que dijo y no lo contradigas.

Después de reservar
La reserva queda pendiente hasta que se pague el abono de ${pesos(ABONO)}. Dile a la persona que el equipo le escribirá por WhatsApp al teléfono que dio para confirmar y coordinar el abono. No prometas descuentos, regalos ni cambios de precio. No pidas datos de tarjetas ni de cuentas bancarias.

Límites
Solo hablas de Saltabum, sus juegos y eventos. Si te piden otra cosa, responde amablemente que solo puedes ayudar con arriendos de Saltabum. Si no sabes algo, dilo y ofrece WhatsApp.`;

const fecha = { type: "string", description: "Fecha en formato AAAA-MM-DD" } as const;
const producto = { type: "string", enum: PRODUCTO_IDS, description: "Id del juego" } as const;
const horas = { type: "integer", description: `Horas de arriendo, de ${HORAS_BASE} a ${HORAS_BASE + HORAS_EXTRA_MAX}` } as const;
const comuna = { type: "string", enum: COMUNA_NOMBRES, description: "Comuna del evento, tal como aparece en la lista" } as const;

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "ver_disponibilidad",
    description: "Horas de inicio libres de un día para cada juego (o para uno), según la agenda real.",
    input_schema: {
      type: "object",
      properties: { fecha, producto, horas },
      required: ["fecha"],
      additionalProperties: false,
    },
  },
  {
    name: "cotizar",
    description: "Total del arriendo con el desglose: precio del juego, horas extra y despacho a la comuna.",
    input_schema: {
      type: "object",
      properties: { producto, horas, comuna },
      required: ["producto", "horas", "comuna"],
      additionalProperties: false,
    },
  },
  {
    name: "crear_reserva",
    description: "Guarda la reserva en la agenda (queda pendiente del abono). Solo después de que la persona confirmó el resumen.",
    input_schema: {
      type: "object",
      properties: {
        producto,
        fecha,
        inicio: { type: "string", description: "Hora de inicio HH:MM (cada 30 minutos)" },
        horas,
        comuna,
        nombre: { type: "string", description: "Solo si es distinto al del formulario" },
        apellido: { type: "string" },
        telefono: { type: "string", description: "Solo si es distinto al del formulario" },
        direccion: { type: "string", description: "Calle y número" },
        depto: { type: "string", description: "Casa, depto o block, si aplica" },
        email: { type: "string" },
        mensaje: { type: "string", description: "Comentarios del cliente (cumpleaños de quién, tipo de piso, etc.)" },
      },
      required: ["producto", "fecha", "inicio", "horas", "comuna", "direccion"],
      additionalProperties: false,
    },
  },
  {
    name: "pedir_ayuda",
    description: "Avisa al equipo por WhatsApp que esta conversación necesita una persona y le muestra al cliente un botón para seguir por WhatsApp.",
    input_schema: {
      type: "object",
      properties: { resumen: { type: "string", description: "El caso en una o dos frases, escrito como si lo dijera el cliente" } },
      required: ["resumen"],
      additionalProperties: false,
    },
  },
];

const nombreJuego = (id: string) => PRODUCTOS.find((p) => p.id === id)?.nombre ?? id;

/** Fecha de hoy y del rango reservable, para que la IA entienda «el sábado» o «el 15». Cambia cada día. */
function contextoDelDia(): string {
  const ahora = new Date();
  const hoy = new Intl.DateTimeFormat("es-CL", { timeZone: ZONA_HORARIA, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(ahora);
  const { desde, hasta } = rangoReservable(ahora);
  return `Hoy es ${hoy} (${hoyChile(ahora)}). Se puede reservar entre el ${desde} y el ${hasta}.`;
}

/** Quién escribe: los datos que dejó en el formulario del chat. */
export interface Cliente {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

interface Contexto {
  request: Request;
  conversacion: string;
  cliente: Cliente;
  /** utm_source, utm_campaign… de la visita, para guardarlos con la reserva. */
  origen: Record<string, string>;
  ipHash: string | null;
  pageUrl?: string;
}

const datosDelCliente = (c: Cliente) =>
  `Datos de la persona (los dejó en el formulario del chat, no los vuelvas a pedir): nombre ${c.nombre ?? "sin dato"}, correo ${c.email ?? "sin dato"}, teléfono ${c.telefono ?? "sin dato"}.`;

async function verDisponibilidad(e: { fecha?: string; producto?: string; horas?: number }) {
  const { desde, hasta } = rangoReservable();
  if (!e.fecha || e.fecha < desde || e.fecha > hasta) return { error: `Solo se puede reservar entre ${desde} y ${hasta}.` };
  const h = Math.min(Math.max(e.horas ?? HORAS_BASE, HORAS_BASE), HORAS_BASE + HORAS_EXTRA_MAX);
  const ocupados = await horariosOcupados(e.fecha, e.fecha);
  const juegos = e.producto ? PRODUCTOS.filter((p) => p.id === e.producto) : PRODUCTOS;
  return {
    fecha: e.fecha,
    horas: h,
    margen_entre_eventos_min: MARGEN,
    juegos: juegos.map((p) => {
      const libres = iniciosPosibles(h).filter((m) => estaLibre(e.fecha!, p.id, m, h, ocupados));
      return { id: p.id, nombre: p.nombre, inicios_libres: libres.map(aHora) };
    }),
  };
}

function cotizar(e: { producto: string; horas: number; comuna: string }) {
  const p = calcularPrecio(e.producto, e.horas, e.comuna);
  return {
    juego: nombreJuego(e.producto),
    horas: e.horas,
    precio_juego: pesos(p.base),
    horas_extra: pesos(p.extras),
    despacho: pesos(p.despacho),
    total: pesos(p.total),
    abono_para_reservar: pesos(ABONO),
  };
}

async function reservar(e: Record<string, unknown>, ctx: Contexto) {
  // Nombre, teléfono y correo salen del formulario del chat salvo que la persona haya dado otros.
  const [nombreForm, ...apellidoForm] = (ctx.cliente.nombre ?? "").trim().split(/\s+/);
  const datosCliente = {
    nombre: (e.nombre as string | undefined) || nombreForm,
    apellido: (e.apellido as string | undefined) || apellidoForm.join(" ") || undefined,
    telefono: (e.telefono as string | undefined) || ctx.cliente.telefono,
    email: (e.email as string | undefined) || ctx.cliente.email || undefined,
  };
  const parsed = reservaSchema.safeParse({ ...e, ...datosCliente, event_id: crypto.randomUUID(), page_url: ctx.pageUrl, consent: false, attribution: {} });
  if (!parsed.success) return { error: `Datos inválidos: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  const r = parsed.data;
  const { desde, hasta } = rangoReservable();
  if (r.fecha < desde || r.fecha > hasta) return { error: `Solo se puede reservar entre ${desde} y ${hasta}.` };
  if (ctx.ipHash && (await reservasRecientes(ctx.ipHash)) >= MAX_RESERVAS_POR_IP) {
    return { error: "Esta persona ya hizo varias reservas hoy. Deriva al equipo por WhatsApp." };
  }

  const inicio = aMinutos(r.inicio);
  const fin = inicio + r.horas * 60;
  const precio = calcularPrecio(r.producto, r.horas, r.comuna);
  const datos = {
    fecha: r.fecha,
    producto: r.producto,
    inicio,
    fin,
    total: precio.total,
    nombre: r.nombre,
    apellido: r.apellido ?? null,
    email: r.email ?? null,
    telefono: r.telefono,
    empresa: null,
    comuna: r.comuna,
    direccion: r.direccion ?? null,
    depto: r.depto ?? null,
    ciudad: null,
    region: REGION,
    mensaje: r.mensaje ?? null,
    notas: null,
  };
  const id = await crearReserva(datos, { origen: "chat", ipHash: ctx.ipHash, atribucion: ctx.origen });
  if (id === null) return { error: "Ese horario ya no está disponible. Revisa la disponibilidad de nuevo y ofrece otro." };

  await auditar(ctx.request, null, "reserva_chat", `${r.fecha} ${etiquetaHorario(inicio, fin)} · ${r.nombre}`, { reservaId: id, despues: datos }).catch((err) =>
    console.error("[chat] historial:", String(err)),
  );
  if (CRM_WEBHOOK_URL) {
    await sendToCrm(CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET, {
      schema_version: 1,
      id: r.event_id,
      created_at: new Date().toISOString(),
      source: "saltabum.cl",
      form_name: "chat",
      contact: { nombre: [r.nombre, r.apellido].filter(Boolean).join(" "), telefono: r.telefono, email: r.email, mensaje: r.mensaje },
      extra: {
        fecha: r.fecha,
        horario: etiquetaHorario(inicio, fin),
        horas: String(r.horas),
        juego: nombreJuego(r.producto),
        comuna: r.comuna,
        despacho: pesos(precio.despacho),
        total: pesos(precio.total),
        ...(r.direccion ? { direccion: r.direccion } : {}),
      },
      attribution: ctx.origen,
      context: { page_url: ctx.pageUrl, consent: false },
    }).catch((err) => console.error("[chat] CRM:", String(err)));
  }
  await actualizarConversacion(ctx.conversacion, { reserva_id: id });
  await avisarGrupo(
    [
      "🎉 *Nueva reserva desde el chat de la web*",
      `${nombreJuego(r.producto)} · ${r.fecha} · ${etiquetaHorario(inicio, fin)}`,
      `${r.comuna}${r.direccion ? `, ${r.direccion}` : ""}${r.depto ? ` (${r.depto})` : ""}`,
      `${[r.nombre, r.apellido].filter(Boolean).join(" ")} · ${r.telefono}`,
      `Total ${pesos(precio.total)} · pendiente del abono de ${pesos(ABONO)}`,
      r.mensaje ? `Nota: ${r.mensaje}` : "",
      `Conversación: ${enlacePanel(ctx.conversacion)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return { ok: true, reserva: id, horario: etiquetaHorario(inicio, fin), total: pesos(precio.total), abono: pesos(ABONO), estado: "pendiente del abono" };
}

/** Responde el último mensaje del cliente con lo más reciente de la conversación guardada. */
export async function responderChat(historial: MensajeGuardado[], ctx: Contexto): Promise<RespuestaChat> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  const visibles = historial.filter((m) => m.rol !== "sistema");
  // Lo que lee la IA empieza siempre con un mensaje del cliente.
  while (visibles.length && visibles[0].rol !== "cliente") visibles.shift();
  const messages: Anthropic.MessageParam[] = visibles.map((m) =>
    m.rol === "cliente"
      ? { role: "user", content: m.texto }
      : { role: "assistant", content: m.rol === "equipo" ? `(Equipo Saltabum) ${m.texto}` : m.texto },
  );
  const salida: RespuestaChat = { texto: "" };

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const res = await client.messages.create({
      model: MODELO,
      max_tokens: 4096,
      output_config: { effort: "low" },
      tools: HERRAMIENTAS,
      system: [
        { type: "text", text: INSTRUCCIONES, cache_control: { type: "ephemeral" } },
        { type: "text", text: `${contextoDelDia()}\n${datosDelCliente(ctx.cliente)}` },
      ],
      messages,
    });

    if (res.stop_reason !== "tool_use") {
      salida.texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        // El chat muestra texto plano: se quitan negritas y títulos de markdown si la IA los usa igual.
        .replace(/\*\*|__/g, "")
        .replace(/^#+\s*/gm, "")
        .trim();
      if (res.stop_reason === "refusal" || !salida.texto) {
        salida.texto = "Mejor te ayudo por WhatsApp para resolverlo bien 😊";
        salida.whatsapp ??= "Hola, vengo del chat de saltabum.cl y quiero hacer una consulta.";
      }
      return salida;
    }

    messages.push({ role: "assistant", content: res.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      const e = b.input as Record<string, unknown>;
      let resultado: unknown;
      try {
        if (b.name === "ver_disponibilidad") resultado = await verDisponibilidad(e);
        else if (b.name === "cotizar") resultado = cotizar(e as { producto: string; horas: number; comuna: string });
        else if (b.name === "crear_reserva") {
          resultado = await reservar(e, ctx);
          if ((resultado as { ok?: boolean }).ok) salida.reserva = true;
        } else if (b.name === "pedir_ayuda") {
          const resumen = String(e.resumen ?? "").slice(0, 500);
          salida.whatsapp = `Hola, vengo del chat de saltabum.cl. ${resumen}`.trim();
          await actualizarConversacion(ctx.conversacion, { ayuda: 1 });
          await avisarGrupo(`🙋 *El chat de la web necesita una persona*\n${resumen}\nTomar el control: ${enlacePanel(ctx.conversacion)}`);
          resultado = { ok: true, nota: "El equipo ya fue avisado y la persona ve un botón de WhatsApp. Dile que alguien del equipo le escribirá aquí o puede seguir por WhatsApp." };
        } else resultado = { error: "Herramienta desconocida" };
      } catch (err) {
        console.error(`[chat] ${b.name}:`, String(err));
        resultado = { error: "Falló la consulta. Ofrece seguir por WhatsApp." };
      }
      resultados.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(resultado), is_error: !!(resultado as { error?: string }).error });
    }
    messages.push({ role: "user", content: resultados });
  }

  salida.texto = "Uf, me enredé un poco. ¿Seguimos por WhatsApp para dejarlo listo?";
  salida.whatsapp ??= "Hola, vengo del chat de saltabum.cl y quiero reservar.";
  return salida;
}

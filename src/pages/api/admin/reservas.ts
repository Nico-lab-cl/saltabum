// Panel de reservas (/admin): requiere sesión iniciada (ver src/lib/server/admin-auth.ts).
//   GET  ?desde=AAAA-MM-DD → usuario de la sesión y reservas y bloqueos desde esa fecha (por defecto, hace 90 días)
//   POST → { accion: "crear", datos, forzar? } · { accion: "editar", id, datos, forzar? } · { accion: "eliminar", id }
//          { accion: "bloquear", fecha, desde?, hasta? } · { accion: "liberar", id } · { accion: "pagada", id, monto }
// Si un horario choca con otra reserva o bloqueo responde 409 con la lista de choques; el panel puede reenviar con
// «forzar». Cada cambio queda en el historial con cómo estaba antes y cómo quedó.
// «pagada» guarda el pago y lo envía a Meta (Conversions API) como compra cerrada por chat, para medir ventas reales.
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { PRODUCTOS } from "@design/data";
import { aMinutos, bloqueoSchema, etiquetaHorario, hoyChile, sumarDias, type ReservaPanel } from "@/lib/reservas";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { sendMetaEvent } from "@/lib/server/meta-capi";
import {
  actualizarReserva,
  bloquear,
  choques,
  crearReserva,
  liberar,
  listarDesde,
  marcarPagada,
  obtenerFila,
  obtenerReserva,
  type DatosReserva,
  type FilaAgenda,
} from "@/lib/server/reservas-db";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

/** Datos del formulario del panel → columnas de la agenda. */
const aDatos = (d: ReservaPanel): DatosReserva => ({
  fecha: d.fecha,
  producto: d.producto,
  inicio: aMinutos(d.inicio),
  fin: aMinutos(d.fin),
  total: d.total,
  nombre: d.nombre,
  apellido: d.apellido ?? null,
  email: d.email ?? null,
  telefono: d.telefono ?? null,
  empresa: d.empresa ?? null,
  comuna: d.comuna ?? null,
  direccion: d.direccion ?? null,
  depto: d.depto ?? null,
  ciudad: d.ciudad ?? null,
  region: d.region ?? null,
  mensaje: d.mensaje ?? null,
  notas: d.notas ?? null,
});

/** Cómo estaba una fila, para el historial (sin fechas internas ni datos de medición). */
const foto = (f: FilaAgenda) => {
  const { id: _id, creado: _c, actualizado: _a, pagado_en: _pe, pagado_por: _pp, ...resto } = f;
  return Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null && v !== ""));
};

const cliente = (d: { nombre: string | null; apellido: string | null }) => [d.nombre, d.apellido].filter(Boolean).join(" ") || "sin nombre";
const resumen = (d: Pick<DatosReserva, "fecha" | "inicio" | "fin" | "nombre" | "apellido">) =>
  `${d.fecha} ${etiquetaHorario(d.inicio, d.fin)} · ${cliente(d)}`;

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });
  const hoy = hoyChile();
  const pedido = url.searchParams.get("desde") ?? "";
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : sumarDias(hoy, -90);
  return json(200, { ok: true, usuario, hoy, desde, filas: await listarDesde(desde) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });

  const raw = await request.text();
  if (raw.length > 16_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = bloqueoSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) {
    return json(422, { ok: false, error: "validacion", detalle: parsed.error.issues.map((i) => i.message) });
  }
  const pedido = parsed.data;

  if (pedido.accion === "crear" || pedido.accion === "editar") {
    const datos = aDatos(pedido.datos);
    const excluir = pedido.accion === "editar" ? pedido.id : 0;
    if (!pedido.forzar) {
      const lista = await choques(datos, excluir);
      if (lista.length) return json(409, { ok: false, error: "ocupado", choques: lista });
    }

    if (pedido.accion === "crear") {
      const id = await crearReserva(datos, { origen: "panel", forzar: pedido.forzar });
      if (id === null) return json(409, { ok: false, error: "ocupado", choques: await choques(datos) });
      await auditar(request, usuario, "reserva_creada", resumen(datos), { reservaId: id, despues: datos });
      return json(200, { ok: true, id });
    }

    const antes = await obtenerFila(pedido.id);
    if (!antes || antes.estado !== "reservado") return json(404, { ok: false, error: "no_existe" });
    const resultado = await actualizarReserva(pedido.id, datos, pedido.forzar);
    if (resultado === "no_existe") return json(404, { ok: false, error: "no_existe" });
    if (resultado === "ocupado") return json(409, { ok: false, error: "ocupado", choques: await choques(datos, pedido.id) });
    await auditar(request, usuario, "reserva_editada", resumen(datos), { reservaId: pedido.id, antes: foto(antes), despues: datos });
    return json(200, { ok: true, id: pedido.id });
  }

  if (pedido.accion === "eliminar" || pedido.accion === "liberar") {
    const antes = await obtenerFila(pedido.id);
    if (!antes) return json(404, { ok: false, error: "no_existe" });
    await liberar(pedido.id);
    const accion = antes.estado === "bloqueado" ? "liberar" : "reserva_eliminada";
    const horas = antes.inicio === 0 && antes.fin === 24 * 60 ? "día completo" : etiquetaHorario(antes.inicio, antes.fin);
    const detalle = antes.estado === "bloqueado" ? `${antes.fecha} ${horas}` : resumen(antes);
    await auditar(request, usuario, accion, detalle, { reservaId: pedido.id, antes: foto(antes) });
    return json(200, { ok: true });
  }

  if (pedido.accion === "pagada") {
    const reserva = await obtenerReserva(pedido.id);
    if (!reserva) return json(404, { ok: false, error: "no_existe" });
    if (!(await marcarPagada(pedido.id, pedido.monto, usuario))) return json(409, { ok: false, error: "ya_pagada" });
    await auditar(request, usuario, "pagada", `${resumen(reserva)} · $${pedido.monto.toLocaleString("es-CL")}`, {
      reservaId: pedido.id,
      despues: { pagado: pedido.monto },
    });

    let meta: "enviada" | "sin_configurar" | "error" = "sin_configurar";
    if (PUBLIC_META_PIXEL_ID && META_CAPI_ACCESS_TOKEN) {
      meta = await sendMetaEvent({
        pixelId: PUBLIC_META_PIXEL_ID,
        accessToken: META_CAPI_ACCESS_TOKEN,
        testEventCode: META_CAPI_TEST_EVENT_CODE,
        eventName: "Purchase",
        actionSource: "chat",
        // Fijo por reserva: si se envía dos veces, Meta la cuenta una sola.
        eventId: `pago-${reserva.id}`,
        phone: reserva.telefono ?? undefined,
        email: reserva.email ?? undefined,
        firstName: reserva.nombre ?? undefined,
        lastName: reserva.apellido ?? undefined,
        city: reserva.ciudad ?? reserva.comuna ?? undefined,
        fbp: reserva.fbp ?? undefined,
        fbc: reserva.fbc ?? undefined,
        customData: {
          value: pedido.monto,
          currency: "CLP",
          content_type: "product",
          content_ids: reserva.producto,
          content_name: PRODUCTOS.find((p) => p.id === reserva.producto)?.nombre ?? reserva.producto,
        },
      })
        .then(() => "enviada" as const)
        .catch((err) => {
          console.error("[admin] Meta CAPI Purchase:", String(err), reserva.id);
          return "error" as const;
        });
    }
    return json(200, { ok: true, meta });
  }

  // Bloqueo de un día completo o de un rango de horas.
  const inicio = pedido.desde ? aMinutos(pedido.desde) : 0;
  const fin = pedido.hasta ? aMinutos(pedido.hasta) : 24 * 60;
  if (fin <= inicio) return json(422, { ok: false, error: "rango" });
  const id = await bloquear(pedido.fecha, inicio, fin);
  await auditar(request, usuario, "bloquear", `${pedido.fecha} ${pedido.desde ? etiquetaHorario(inicio, fin) : "día completo"}`, {
    reservaId: id,
    despues: { fecha: pedido.fecha, inicio, fin },
  });
  return json(200, { ok: true, id });
};

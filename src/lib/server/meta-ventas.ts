// Embudo de ventas en Meta: lo que pasa con una reserva después del formulario.
//   Reserva creada  → evento «Schedule» (agendó), una vez por reserva.
//   Pago registrado → evento «Purchase» con el monto y el cliente se suma al público «Clientes Saltabum».
// Los eventos llevan un event_id fijo por reserva: si se reenvían, Meta los cuenta una sola vez.
// Nada de esto lanza errores: si Meta falla, la reserva o el pago igual quedan guardados.
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { META_AUDIENCIA_CLIENTES, META_AUDIENCIA_TOKEN, META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { PRODUCTOS } from "@design/data";
import { agregarAPublico, sendMetaEvent, type MetaActionSource } from "./meta-capi";
import type { FilaAgenda } from "./reservas-db";

export type ResultadoMeta = "enviada" | "sin_configurar" | "error";

type Reserva = Pick<FilaAgenda, "id" | "producto" | "telefono" | "email" | "nombre" | "apellido" | "ciudad" | "comuna" | "total"> & {
  fbp?: string | null;
  fbc?: string | null;
};

const cliente = (r: Reserva) => ({
  phone: r.telefono ?? undefined,
  email: r.email ?? undefined,
  firstName: r.nombre ?? undefined,
  lastName: r.apellido ?? undefined,
  city: r.ciudad ?? r.comuna ?? undefined,
});

const producto = (r: Reserva) => ({
  content_type: "product",
  content_ids: r.producto,
  content_name: PRODUCTOS.find((p) => p.id === r.producto)?.nombre ?? r.producto,
});

async function enviar(
  r: Reserva,
  evento: { nombre: "Schedule" | "Purchase"; eventId: string; valor: number; fuente: MetaActionSource; extra?: { ip?: string; userAgent?: string; url?: string } },
): Promise<ResultadoMeta> {
  if (!PUBLIC_META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) return "sin_configurar";
  return sendMetaEvent({
    pixelId: PUBLIC_META_PIXEL_ID,
    accessToken: META_CAPI_ACCESS_TOKEN,
    testEventCode: META_CAPI_TEST_EVENT_CODE,
    eventName: evento.nombre,
    actionSource: evento.fuente,
    eventId: evento.eventId,
    eventSourceUrl: evento.extra?.url,
    ip: evento.extra?.ip,
    userAgent: evento.extra?.userAgent,
    ...cliente(r),
    fbp: r.fbp ?? undefined,
    fbc: r.fbc ?? undefined,
    customData: { value: evento.valor, currency: "CLP", ...producto(r) },
  })
    .then(() => "enviada" as const)
    .catch((err) => {
      console.error(`[meta] ${evento.nombre}:`, String(err), r.id);
      return "error" as const;
    });
}

/** Avisa a Meta que alguien agendó. «website» si reservó en la web; «chat» si el equipo la creó desde WhatsApp. */
export function enviarReserva(r: Reserva, fuente: MetaActionSource, extra?: { ip?: string; userAgent?: string; url?: string }) {
  return enviar(r, { nombre: "Schedule", eventId: `reserva-${r.id}`, valor: r.total ?? 0, fuente, extra });
}

/** Suma al cliente al público «Clientes Saltabum (pagaron)». */
export async function sumarCliente(r: Reserva): Promise<ResultadoMeta> {
  const token = META_AUDIENCIA_TOKEN || META_CAPI_ACCESS_TOKEN;
  if (!META_AUDIENCIA_CLIENTES || !token) return "sin_configurar";
  return agregarAPublico({ audienciaId: META_AUDIENCIA_CLIENTES, accessToken: token, ...cliente(r) })
    .then(() => "enviada" as const)
    .catch((err) => {
      console.error("[meta] público clientes:", String(err), r.id);
      return "error" as const;
    });
}

/** Compra cerrada (pago registrado en el panel): evento «Purchase» y alta en el público de clientes. */
export async function enviarCompra(r: Reserva, monto: number) {
  const [compra, publico] = await Promise.all([
    enviar(r, { nombre: "Purchase", eventId: `pago-${r.id}`, valor: monto, fuente: "chat" }),
    sumarCliente(r),
  ]);
  return { compra, publico };
}

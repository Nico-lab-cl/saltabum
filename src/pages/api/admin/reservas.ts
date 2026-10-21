// Panel de reservas (/admin): requiere sesión iniciada (ver src/lib/server/admin-auth.ts).
//   GET  → usuario de la sesión y reservas y bloqueos desde hoy (con datos de contacto)
//   POST → { accion: "bloquear", fecha, desde?, hasta? } · { accion: "liberar", id } · { accion: "pagada", id, monto }
// «pagada» guarda el pago y lo envía a Meta (Conversions API) como compra cerrada por chat, para medir ventas reales.
import type { APIRoute } from "astro";
import { PUBLIC_META_PIXEL_ID } from "astro:env/client";
import { META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE } from "astro:env/server";
import { PRODUCTOS } from "@design/data";
import { aMinutos, bloqueoSchema, hoyChile } from "@/lib/reservas";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { sendMetaEvent } from "@/lib/server/meta-capi";
import { bloquear, liberar, listarDesde, marcarPagada, obtenerReserva } from "@/lib/server/reservas-db";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });
  return json(200, { ok: true, usuario, hoy: hoyChile(), filas: await listarDesde(hoyChile()) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });

  const raw = await request.text();
  if (raw.length > 4_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = bloqueoSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validacion" });
  const pedido = parsed.data;

  if (pedido.accion === "liberar") {
    await liberar(pedido.id);
    await auditar(request, usuario, "liberar", `id ${pedido.id}`);
    return json(200, { ok: true });
  }

  if (pedido.accion === "pagada") {
    const reserva = await obtenerReserva(pedido.id);
    if (!reserva) return json(404, { ok: false, error: "no_existe" });
    if (!(await marcarPagada(pedido.id, pedido.monto, usuario))) return json(409, { ok: false, error: "ya_pagada" });
    await auditar(request, usuario, "pagada", `id ${pedido.id} · $${pedido.monto}`);

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
        firstName: reserva.nombre ?? undefined,
        city: reserva.comuna ?? undefined,
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

  const inicio = pedido.desde ? aMinutos(pedido.desde) : 0;
  const fin = pedido.hasta ? aMinutos(pedido.hasta) : 24 * 60;
  if (fin <= inicio) return json(422, { ok: false, error: "rango" });
  await bloquear(pedido.fecha, inicio, fin);
  await auditar(request, usuario, "bloquear", `${pedido.fecha} ${pedido.desde ?? "día completo"}-${pedido.hasta ?? ""}`);
  return json(200, { ok: true });
};

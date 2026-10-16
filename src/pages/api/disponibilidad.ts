// GET /api/disponibilidad — horarios tomados desde mañana hasta el último día reservable.
// Solo devuelve fecha, juego y horas (nunca datos de quien reservó). El navegador calcula qué horas de inicio
// quedan libres para la duración que elija el cliente.
import type { APIRoute } from "astro";
import { rangoReservable } from "@/lib/reservas";
import { horariosOcupados } from "@/lib/server/reservas-db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const { desde, hasta } = rangoReservable();
  try {
    const ocupados = await horariosOcupados(desde, hasta);
    return new Response(JSON.stringify({ ok: true, desde, hasta, ocupados }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[disponibilidad]", String(err));
    return new Response(JSON.stringify({ ok: false, error: "db" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};

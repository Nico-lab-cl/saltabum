// GET /api/disponibilidad — horarios ocupados desde mañana hasta el último día reservable.
// Solo devuelve fecha y bloque (nunca datos de quien reservó).
import type { APIRoute } from "astro";
import { claveHorario, rangoReservable } from "@/lib/reservas";
import { horariosOcupados } from "@/lib/server/reservas-db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const { desde, hasta } = rangoReservable();
  try {
    const ocupados = await horariosOcupados(desde, hasta);
    return new Response(
      JSON.stringify({ ok: true, desde, hasta, ocupados: ocupados.map((o) => claveHorario(o.fecha, o.bloque)) }),
      { headers: { "content-type": "application/json", "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[disponibilidad]", String(err));
    return new Response(JSON.stringify({ ok: false, error: "db" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};

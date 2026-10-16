// Panel de reservas (/admin): requiere el secreto ADMIN_TOKEN en el header Authorization.
//   GET  → reservas y bloqueos desde hoy (con datos de contacto)
//   POST → { accion: "bloquear", fecha, desde?, hasta? } (sin horas, el día completo) o { accion: "liberar", id }
import type { APIRoute } from "astro";
import { ADMIN_TOKEN } from "astro:env/server";
import { aMinutos, bloqueoSchema, hoyChile } from "@/lib/reservas";
import { bloquear, liberar, listarDesde } from "@/lib/server/reservas-db";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Compara en tiempo constante para no filtrar el token por tiempos de respuesta. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function autorizado(request: Request): boolean {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get("authorization") ?? "";
  return iguales(header, `Bearer ${ADMIN_TOKEN}`);
}

export const GET: APIRoute = async ({ request }) => {
  if (!ADMIN_TOKEN) return json(503, { ok: false, error: "not_configured" });
  if (!autorizado(request)) return json(401, { ok: false, error: "unauthorized" });
  return json(200, { ok: true, hoy: hoyChile(), filas: await listarDesde(hoyChile()) });
};

export const POST: APIRoute = async ({ request }) => {
  if (!ADMIN_TOKEN) return json(503, { ok: false, error: "not_configured" });
  if (!autorizado(request)) return json(401, { ok: false, error: "unauthorized" });

  let parsed;
  try {
    parsed = bloqueoSchema.safeParse(await request.json());
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validation" });

  const pedido = parsed.data;
  if (pedido.accion === "liberar") {
    await liberar(pedido.id);
    return json(200, { ok: true });
  }
  const inicio = pedido.desde ? aMinutos(pedido.desde) : 0;
  const fin = pedido.hasta ? aMinutos(pedido.hasta) : 24 * 60;
  if (fin <= inicio) return json(422, { ok: false, error: "rango" });
  await bloquear(pedido.fecha, inicio, fin);
  return json(200, { ok: true });
};

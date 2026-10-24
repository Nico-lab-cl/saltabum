// GET /api/admin/historial?limite=300 — historial del panel: reservas desde la web, reservas creadas, editadas y
// eliminadas, pagos, bloqueos e ingresos al panel, del más nuevo al más antiguo. Requiere sesión.
import type { APIRoute } from "astro";
import { listarHistorial, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  const limite = Math.min(1000, Math.max(20, Number(url.searchParams.get("limite")) || 300));
  return json(200, { ok: true, eventos: await listarHistorial(limite) });
};

// Escaneos de los QR para el panel (/admin): requiere sesión iniciada (ver src/lib/server/admin-auth.ts).
//   GET ?dias=30 → escaneos de los últimos N días (1 a 400), del más nuevo al más antiguo
import type { APIRoute } from "astro";
import { mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { listarEscaneos } from "@/lib/server/qr-db";

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

  const dias = Math.min(400, Math.max(1, Math.round(Number(url.searchParams.get("dias")) || 30)));
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  return json(200, { ok: true, escaneos: await listarEscaneos(desde) });
};

export const ALL: APIRoute = () => json(405, { ok: false });

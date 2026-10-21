// POST /api/admin/logout — cierra la sesión del panel en el servidor y borra la cookie.
import type { APIRoute } from "astro";
import { mismoOrigen, salir } from "@/lib/server/admin-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!mismoOrigen(request)) return new Response(null, { status: 403 });
  await salir(request, cookies);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

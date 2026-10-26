// Leads de todas las fuentes (formularios, chat, reservas y WhatsApp de anuncios) para la pestaña «Leads» del panel.
//   GET → { leads } del más nuevo al más antiguo. Requiere sesión.
import type { APIRoute } from "astro";
import { mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { listarLeads } from "@/lib/server/leads";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  return json(200, { ok: true, leads: await listarLeads() });
};

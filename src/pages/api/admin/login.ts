// POST /api/admin/login — { clave, codigo? } → abre la sesión del panel (cookie __Host-).
// Respuesta genérica si la contraseña no sirve. «codigo» solo si la cuenta tiene segundo factor.
import type { APIRoute } from "astro";
import { z } from "zod";
import { ingresar, mismoOrigen, panelConfigurado } from "@/lib/server/admin-auth";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const schema = z.object({
  clave: z.string().min(1).max(256),
  codigo: z.string().max(10).optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });

  const raw = await request.text();
  if (raw.length > 6_000) return json(413, { ok: false, error: "muy_grande" });
  let datos;
  try {
    datos = schema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!datos.success) return json(422, { ok: false, error: "credenciales" });

  const r = await ingresar(request, cookies, datos.data.clave, datos.data.codigo);
  if (!r.ok) return json(r.motivo === "bloqueado" ? 429 : 401, { ok: false, error: r.motivo });
  return json(200, { ok: true, usuario: r.usuario });
};

// Consultas del formulario de contacto, para la pestaña «Consultas» del panel /admin. Requiere sesión.
//   GET  ?limite=300 → consultas, de la más nueva a la más antigua
//   POST → { accion: "estado", id, estado } · { accion: "notas", id, notas } · { accion: "eliminar", id }
import type { APIRoute } from "astro";
import { z } from "zod";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import { actualizarConsulta, eliminarConsulta, listarConsultas, obtenerConsulta } from "@/lib/server/consultas-db";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

const id = z.number().int().positive();
const accionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("estado"), id, estado: z.enum(["nueva", "contactada", "cerrada"]) }),
  z.object({ accion: z.literal("notas"), id, notas: z.string().trim().max(2000) }),
  z.object({ accion: z.literal("eliminar"), id }),
]);

const ESTADOS = { nueva: "nueva", contactada: "contactada", cerrada: "cerrada" } as const;

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  const limite = Math.min(1000, Math.max(20, Number(url.searchParams.get("limite")) || 300));
  return json(200, { ok: true, consultas: await listarConsultas(limite) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  const usuario = await sesion(request, cookies);
  if (!usuario) return json(401, { ok: false, error: "sin_sesion" });

  const raw = await request.text();
  if (raw.length > 8_000) return json(413, { ok: false, error: "muy_grande" });
  let parsed;
  try {
    parsed = accionSchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "json" });
  }
  if (!parsed.success) return json(422, { ok: false, error: "validacion" });
  const pedido = parsed.data;

  const antes = await obtenerConsulta(pedido.id);
  if (!antes) return json(404, { ok: false, error: "no_existe" });

  if (pedido.accion === "eliminar") {
    await eliminarConsulta(pedido.id);
    await auditar(request, usuario, "consulta_eliminada", antes.nombre, { reservaId: pedido.id, antes });
    return json(200, { ok: true });
  }

  if (pedido.accion === "estado") {
    await actualizarConsulta(pedido.id, { estado: pedido.estado });
    await auditar(request, usuario, "consulta_estado", `${antes.nombre} · ${ESTADOS[pedido.estado]}`, {
      reservaId: pedido.id,
      antes: { estado: antes.estado },
      despues: { estado: pedido.estado },
    });
    return json(200, { ok: true });
  }

  await actualizarConsulta(pedido.id, { notas: pedido.notas || null });
  await auditar(request, usuario, "consulta_notas", antes.nombre, {
    reservaId: pedido.id,
    antes: { notas: antes.notas },
    despues: { notas: pedido.notas || null },
  });
  return json(200, { ok: true });
};

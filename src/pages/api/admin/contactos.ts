// Contactos del CRM para la pestaña «Contactos» del panel /admin (ver src/lib/server/contactos.ts). Requiere sesión.
//   GET               → { contactos } con su etapa, si espera respuesta y desde dónde llegó
//   GET ?clave=<...>  → { contacto, eventos } con la línea de tiempo
//   POST → { accion: "perdido", clave, motivo } · { accion: "reactivar", clave }
//          { accion: "etapa", clave, etapa } (null vuelve a la automática) · { accion: "notas", clave, notas }
import type { APIRoute } from "astro";
import { z } from "zod";
import { auditar, mismoOrigen, panelConfigurado, sesion } from "@/lib/server/admin-auth";
import {
  ETAPAS,
  guardarNotas,
  listarContactos,
  marcarEtapa,
  marcarPerdido,
  MOTIVOS_PERDIDA,
  NOMBRE_MOTIVO,
  obtenerContacto,
  reactivar,
} from "@/lib/server/contactos";

export const prerender = false;

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

const clave = z.string().trim().min(3).max(200);
const accionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("perdido"), clave, motivo: z.enum(MOTIVOS_PERDIDA) }),
  z.object({ accion: z.literal("reactivar"), clave }),
  // Reservado y Cliente salen solo de la agenda y del pago, no se marcan a mano.
  z.object({
    accion: z.literal("etapa"),
    clave,
    etapa: z.enum(["calificado", "cotizado", "promotor"]).nullable(),
  }),
  z.object({ accion: z.literal("notas"), clave, notas: z.string().trim().max(2000) }),
]);

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!panelConfigurado()) return json(503, { ok: false, error: "sin_configurar" });
  if (!mismoOrigen(request)) return json(403, { ok: false, error: "origen" });
  if (!(await sesion(request, cookies))) return json(401, { ok: false, error: "sin_sesion" });
  const pedida = url.searchParams.get("clave");
  if (pedida) {
    const ficha = await obtenerContacto(pedida);
    return ficha ? json(200, { ok: true, ...ficha }) : json(404, { ok: false, error: "no_existe" });
  }
  return json(200, { ok: true, contactos: await listarContactos() });
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

  const ficha = await obtenerContacto(pedido.clave);
  if (!ficha) return json(404, { ok: false, error: "no_existe" });
  const { contacto } = ficha;
  const quien = contacto.nombre ?? contacto.telefono ?? contacto.clave;

  if (pedido.accion === "perdido") {
    if (contacto.etapa === "cliente" || contacto.etapa === "promotor")
      return json(409, { ok: false, error: "ya_es_cliente" });
    await marcarPerdido(contacto, pedido.motivo, usuario);
    await auditar(request, usuario, "contacto_perdido", `${quien} · ${NOMBRE_MOTIVO[pedido.motivo]}`);
  } else if (pedido.accion === "reactivar") {
    await reactivar(contacto.clave, usuario);
    await auditar(request, usuario, "contacto_reactivado", quien);
  } else if (pedido.accion === "etapa") {
    await marcarEtapa(contacto.clave, pedido.etapa, usuario);
    await auditar(request, usuario, "contacto_etapa", `${quien} · ${pedido.etapa ?? "automática"}`);
  } else {
    await guardarNotas(contacto.clave, pedido.notas || null, usuario);
    await auditar(request, usuario, "contacto_notas", quien);
  }
  return json(200, { ok: true });
};

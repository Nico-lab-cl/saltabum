// GET /qr y /qr/<campaña> — destino de los códigos QR impresos (volantes, el inflable, el auto, etc.).
// Cuenta el escaneo en D1 y redirige al inicio con UTM, así GA4 también lo muestra en Adquisición de tráfico.
// Como el QR apunta aquí y no directo al inicio, el destino se puede cambiar sin reimprimir.
import type { APIRoute } from "astro";
import { registrarEscaneo } from "@/lib/server/qr-db";

export const prerender = false;

const CODIGO = /^[a-z0-9-]{1,40}$/;

function dispositivo(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "otro";
}

export const GET: APIRoute = async ({ params, request }) => {
  const pedido = (params.codigo ?? "").toLowerCase();
  const codigo = CODIGO.test(pedido) ? pedido : "general";
  const ua = request.headers.get("user-agent") ?? "";

  // Los bots que previsualizan enlaces (WhatsApp, Facebook) no cuentan como escaneo.
  if (!/bot|crawler|spider|facebookexternalhit|whatsapp|preview/i.test(ua)) {
    const cf = (request as Request & { cf?: { city?: string } }).cf;
    await registrarEscaneo(codigo, cf?.city ?? null, dispositivo(ua)).catch((err) =>
      console.error("[qr] no se pudo registrar:", String(err), codigo),
    );
  }

  const destino = new URL("/", request.url);
  destino.searchParams.set("utm_source", "qr");
  destino.searchParams.set("utm_medium", "impreso");
  destino.searchParams.set("utm_campaign", codigo);
  return new Response(null, {
    status: 302,
    headers: { location: destino.toString(), "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
};

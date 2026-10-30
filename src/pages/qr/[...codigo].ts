// GET /qr y /qr/<campaña> — destino de los códigos QR impresos (volantes, el inflable, el auto, etc.).
// Guarda el escaneo en D1 (ubicación aproximada, operador, celular y navegador) y redirige al inicio con UTM,
// así GA4 también lo muestra en Adquisición de tráfico. Los códigos «3d-<inflable>» (el QR de cada juego) llevan
// a su modelo 3D para verlo en tu espacio. Como el QR apunta aquí y no directo al destino, este se puede cambiar
// sin reimprimir.
import type { APIRoute } from "astro";
import { registrarEscaneo } from "@/lib/server/qr-db";
import { RUTAS } from "@design/seo";

export const prerender = false;

const CODIGO = /^[a-z0-9-]{1,40}$/;

/** Inflables con página «ver en tu espacio», por la parte final de su ruta («castillo-pirata»). */
const JUEGOS_3D = [RUTAS.megatobogan, RUTAS.castilloPirata, RUTAS.castilloFormula1].map((r) => r.split("/").filter(Boolean).pop()!);

// Lo que Cloudflare sabe de la conexión (por la IP, sin guardarla).
interface DatosCf {
  city?: string;
  region?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  asOrganization?: string;
}

/** Tipo de celular, sistema y navegador a partir del user agent y, en Chrome, de las client hints. */
function leerAgente(h: Headers) {
  const ua = h.get("user-agent") ?? "";
  const hint = (n: string) => h.get(n)?.replace(/^"|"$/g, "") || null;

  const dispositivo = /iphone|ipod/i.test(ua) ? "ios" : /ipad/i.test(ua) ? "ipad" : /android/i.test(ua) ? "android" : "otro";
  let so: string | null = null;
  if (dispositivo === "ios" || dispositivo === "ipad") {
    const v = ua.match(/OS (\d+)[_.](\d+)/);
    so = v ? `iOS ${v[1]}.${v[2]}` : "iOS";
  } else if (dispositivo === "android") {
    // Chrome recorta la versión del user agent («Android 10; K»): la real viene en Sec-CH-UA-Platform-Version.
    const v = hint("sec-ch-ua-platform-version")?.split(".")[0] ?? ua.match(/Android (\d+)/)?.[1];
    so = v ? `Android ${v}` : "Android";
  } else if (/windows/i.test(ua)) so = "Windows";
  else if (/mac os/i.test(ua)) so = "macOS";

  const modelo =
    dispositivo === "ios" ? "iPhone" : dispositivo === "ipad" ? "iPad" : hint("sec-ch-ua-model") || ua.match(/Android [\d.]+; ([^;)]+)\)/)?.[1]?.replace(/^K$/, "") || null;

  const navegador = /SamsungBrowser/i.test(ua)
    ? "Samsung Internet"
    : /Instagram/i.test(ua)
      ? "Instagram"
      : /FBAN|FBAV/i.test(ua)
        ? "Facebook"
        : /EdgA?\//i.test(ua)
          ? "Edge"
          : /OPR\//i.test(ua)
            ? "Opera"
            : /Firefox|FxiOS/i.test(ua)
              ? "Firefox"
              : /CriOS|Chrome/i.test(ua)
                ? "Chrome"
                : /Safari/i.test(ua)
                  ? "Safari"
                  : "Otro";

  return { ua, dispositivo, so, modelo, navegador };
}

/** Hash de IP + navegador con la fecha del día: cuenta personas distintas sin guardar la IP ni seguirlas entre días. */
async function visitante(ip: string, ua: string) {
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${dia}|${ip}|${ua}`));
  return [...new Uint8Array(bytes).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const numero = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : null);

export const GET: APIRoute = async ({ params, request }) => {
  const pedido = (params.codigo ?? "").toLowerCase();
  const codigo = CODIGO.test(pedido) ? pedido : "general";
  const h = request.headers;
  const agente = leerAgente(h);

  // Los bots que previsualizan enlaces (WhatsApp, Facebook) no cuentan como escaneo.
  if (!/bot|crawler|spider|facebookexternalhit|whatsapp|preview/i.test(agente.ua)) {
    const cf = (request as Request & { cf?: DatosCf }).cf ?? {};
    await registrarEscaneo(
      {
        codigo,
        ciudad: cf.city ?? null,
        region: cf.region ?? null,
        pais: cf.country ?? null,
        lat: numero(cf.latitude),
        lon: numero(cf.longitude),
        operador: cf.asOrganization ?? null,
        dispositivo: agente.dispositivo,
        so: agente.so,
        modelo: agente.modelo,
        navegador: agente.navegador,
        idioma: h.get("accept-language")?.split(",")[0]?.trim().slice(0, 20) || null,
        visitante: await visitante(h.get("cf-connecting-ip") ?? "", agente.ua),
      },
      h.has("sec-ch-ua-model"),
    ).catch((err) => console.error("[qr] no se pudo registrar:", String(err), codigo));
  }

  const juego = codigo.startsWith("3d-") ? codigo.slice(3) : "";
  const destino = new URL(JUEGOS_3D.includes(juego) ? `${RUTAS.verEnTuEspacio}${juego}/` : "/", request.url);
  destino.searchParams.set("utm_source", "qr");
  destino.searchParams.set("utm_medium", "impreso");
  destino.searchParams.set("utm_campaign", codigo);
  return new Response(null, {
    status: 302,
    headers: {
      location: destino.toString(),
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      // Pide a Chrome el modelo del celular y la versión real de Android (repite la visita una vez para mandarlos).
      "accept-ch": "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version",
      "critical-ch": "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version",
      vary: "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version",
    },
  });
};

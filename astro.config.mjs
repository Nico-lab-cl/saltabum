// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap, { ChangeFreqEnum } from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://saltabum.cl",
  // Todo es estático (HTML pre-generado) salvo las rutas con `export const prerender = false` (ej. /api/lead).
  output: "static",
  adapter: cloudflare({
    // Imágenes optimizadas al compilar (gratis); evita depender de Cloudflare Images (de pago).
    imageService: "compile",
    // Prerender en Node: más simple y evita un bug de rutas del prerender en workerd en Windows.
    prerenderEnvironment: "node",
  }),
  // No usamos sesiones: evita que el adaptador cree un KV namespace innecesario.
  session: false,
  // Sitemap: https://saltabum.cl/sitemap-index.xml (declarado en public/robots.txt). La landing pesa más que las páginas
  // legales; `lastmod` es la fecha del build, así Google sabe cuándo volver a rastrear.
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin") && !page.includes("/ver-en-tu-espacio"),
      // Prioridad según el tipo de página (portada > pillars > catálogo, producto y comunas > preguntas > legal).
      serialize(item) {
        const ruta = new URL(item.url).pathname;
        const [prioridad, frecuencia] =
          ruta === "/"
            ? [1.0, ChangeFreqEnum.WEEKLY]
            : ["/arriendo-juegos-inflables-cumpleanos/", "/precios-arriendo-juegos-inflables/", "/arriendo-inflables-eventos-empresas/"].includes(ruta)
              ? [0.9, ChangeFreqEnum.WEEKLY]
              : ruta.startsWith("/inflables/") || ruta.startsWith("/juegos-inflables-")
                ? [0.8, ChangeFreqEnum.WEEKLY]
                : ruta === "/preguntas-frecuentes/"
                  ? [0.7, ChangeFreqEnum.MONTHLY]
                  : [0.3, ChangeFreqEnum.YEARLY];
        return { ...item, lastmod: new Date().toISOString(), changefreq: frecuencia, priority: prioridad };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Visor 3D de la sección «¿Cabe en mi patio?»: pre-empaquetado para que el dev server no lo re-optimice al vuelo.
    optimizeDeps: { include: ["@google/model-viewer"] },
  },
  i18n: {
    defaultLocale: "es",
    locales: ["es"],
  },
  env: {
    schema: {
      // ---- Públicas: se inyectan en el HTML al compilar (no son secretos) ----
      // Pixel «Saltabum saltabum.cl» del portafolio Saltabum (Administrador de eventos). Se puede reemplazar con la variable.
      PUBLIC_META_PIXEL_ID: envField.string({ context: "client", access: "public", default: "1413656430383762" }),
      PUBLIC_GOOGLE_ADS_ID: envField.string({ context: "client", access: "public", optional: true }), // AW-XXXXXXXXX
      PUBLIC_GOOGLE_ADS_LEAD_LABEL: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_GA4_ID: envField.string({ context: "client", access: "public", optional: true }), // G-XXXXXXXXXX
      PUBLIC_CLARITY_ID: envField.string({ context: "client", access: "public", optional: true }),
      // WhatsApp de Saltabum (+56 9 6344 4133). Se puede reemplazar con la variable de entorno.
      PUBLIC_WHATSAPP_NUMBER: envField.string({ context: "client", access: "public", default: "56963444133" }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: "client", access: "public", optional: true }),

      // ---- Secretos: solo en el Worker, se leen en tiempo de ejecución (wrangler secret put) ----
      TURNSTILE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      META_CAPI_ACCESS_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      META_CAPI_TEST_EVENT_CODE: envField.string({ context: "server", access: "secret", optional: true }),
      CRM_WEBHOOK_URL: envField.string({ context: "server", access: "secret", optional: true }),
      CRM_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Usuarios del panel de reservas (/admin): «usuario:pbkdf2$…:<totp>», uno por línea. Se generan con
      // node scripts/admin-usuario.mjs (ver src/lib/server/admin-auth.ts).
      ADMIN_USUARIOS: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});

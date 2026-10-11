// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
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
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "es",
    locales: ["es"],
  },
  env: {
    schema: {
      // ---- Públicas: se inyectan en el HTML al compilar (no son secretos) ----
      PUBLIC_META_PIXEL_ID: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_GOOGLE_ADS_ID: envField.string({ context: "client", access: "public", optional: true }), // AW-XXXXXXXXX
      PUBLIC_GOOGLE_ADS_LEAD_LABEL: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_GA4_ID: envField.string({ context: "client", access: "public", optional: true }), // G-XXXXXXXXXX
      PUBLIC_CLARITY_ID: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_WHATSAPP_NUMBER: envField.string({ context: "client", access: "public", optional: true }), // 569XXXXXXXX
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: "client", access: "public", optional: true }),

      // ---- Secretos: solo en el Worker, se leen en tiempo de ejecución (wrangler secret put) ----
      TURNSTILE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      META_CAPI_ACCESS_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      META_CAPI_TEST_EVENT_CODE: envField.string({ context: "server", access: "secret", optional: true }),
      CRM_WEBHOOK_URL: envField.string({ context: "server", access: "secret", optional: true }),
      CRM_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});

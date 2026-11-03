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
      filter: (page) => !page.includes("/admin") && !page.includes("/ver-en-tu-espacio") && !page.includes("/gracias") && !page.includes("/fichas-pdf"),
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
    // Leaflet (mapa del panel QR) en su versión ESM. La versión CommonJS hacía que el bundler dejara sus helpers dentro del
    // chunk del panel, y el visor 3D del inicio lo importaba: se ejecutaba código del admin en el sitio público y fallaba.
    resolve: { alias: [{ find: /^leaflet$/, replacement: "leaflet/dist/leaflet-src.esm.js" }] },
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
      // Propiedad «saltabum.cl» de Google Analytics 4 (cuenta Saltabum). Se puede reemplazar con la variable.
      PUBLIC_GA4_ID: envField.string({ context: "client", access: "public", default: "G-3TTJNV5MR5" }),
      // Proyecto «saltabum.cl» en Microsoft Clarity. Se puede reemplazar con la variable.
      PUBLIC_CLARITY_ID: envField.string({ context: "client", access: "public", default: "z12kisbdh0" }),
      // WhatsApp de Saltabum (+56 9 6344 4133). Se puede reemplazar con la variable de entorno.
      PUBLIC_WHATSAPP_NUMBER: envField.string({ context: "client", access: "public", default: "56963444133" }),

      // ---- Secretos: solo en el Worker, se leen en tiempo de ejecución (wrangler secret put) ----
      META_CAPI_ACCESS_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      META_CAPI_TEST_EVENT_CODE: envField.string({ context: "server", access: "secret", optional: true }),
      // Público «Clientes Saltabum (pagaron)» de la cuenta Saltabum ADS: cada pago del panel suma al cliente.
      // Necesita un token con permiso ads_management; si no se carga META_AUDIENCIA_TOKEN se intenta con el de CAPI.
      META_AUDIENCIA_CLIENTES: envField.string({ context: "server", access: "public", default: "120250672349520254" }),
      META_AUDIENCIA_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      // Enlace para dejar reseña en el perfil de Google de Saltabum (Google Business → «Pedir reseñas»). Si falta,
      // la tarea «Pedir reseña» del CRM pide etiquetar a @saltabum en Instagram.
      GOOGLE_RESENA_URL: envField.string({ context: "server", access: "public", optional: true }),
      CRM_WEBHOOK_URL: envField.string({ context: "server", access: "secret", optional: true }),
      CRM_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Usuarios del panel de reservas (/admin): «usuario:pbkdf2$…:<totp>», uno por línea. Se generan con
      // node scripts/admin-usuario.mjs (ver src/lib/server/admin-auth.ts).
      ADMIN_USUARIOS: envField.string({ context: "server", access: "secret", optional: true }),
      // WhatsApp vía Evolution API (Easypanel). Ver src/lib/server/evolution.ts y la pestaña «WhatsApp» del panel.
      //   EVOLUTION_API_URL: https://evolution-api-evolution-api.db8enk.easypanel.host
      //   EVOLUTION_API_KEY: AUTHENTICATION_API_KEY de Evolution (para importar chats y responder desde el panel)
      //   EVOLUTION_WEBHOOK_SECRET: clave larga al azar; va en la URL del webhook (?clave=…)
      EVOLUTION_API_URL: envField.string({ context: "server", access: "secret", optional: true }),
      EVOLUTION_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      EVOLUTION_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      EVOLUTION_INSTANCIA: envField.string({ context: "server", access: "secret", optional: true }), // por defecto «Saltabum»
      WHATSAPP_ETIQUETA_ID: envField.string({ context: "server", access: "secret", optional: true }), // por defecto «12» (SALTABUM | LEADS)
      // Chat con IA de la web (Claude, console.anthropic.com). Sin la clave, la burbuja ofrece WhatsApp. Ver src/lib/server/chat-ia.ts.
      ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Grupo de WhatsApp que recibe los avisos del chat (reservas, pedidos de ayuda). Por defecto el grupo del equipo.
      WHATSAPP_GRUPO_AVISOS: envField.string({ context: "server", access: "secret", optional: true }),
      // Mensajes directos de Instagram y Facebook con la misma IA del chat. Ver src/lib/server/redes.ts.
      //   META_APP_SECRET: «Clave secreta» de la app de Meta (firma de cada aviso del webhook)
      //   META_WEBHOOK_TOKEN: texto al azar que se pega en «Token de verificación» al suscribir el webhook
      //   META_PAGE_TOKEN: token de la página de Facebook Saltabum (con Instagram conectado) para enviar respuestas
      META_APP_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      META_WEBHOOK_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      META_PAGE_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      // «auto» (por defecto): la IA responde sola, igual que en la web. «sugerencia»: la IA propone y el equipo aprueba.
      REDES_MODO: envField.enum({ context: "server", access: "public", values: ["sugerencia", "auto"], default: "auto" }),
    },
  },
});

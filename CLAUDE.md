# Saltabum — guía para Claude

Landing de saltabum.cl (Chile, español). Astro 7 + Tailwind v4 + Cloudflare Workers (`@astrojs/cloudflare` v14).

- **Separación diseño / lógica**: todo lo visual vive en `src/design/` (lo produce Claude Design).
  No pongas lógica de tracking ahí; usa los contratos documentados en `src/design/README.md`
  (`data-track="whatsapp"`, `<form data-lead-form>`, `data-consent-open`).
- Variables de entorno vía `astro:env` (schema en `astro.config.mjs`). Públicas: `astro:env/client`.
  Secretos: `astro:env/server` (se leen en runtime desde el Worker).
- Todo es estático salvo `src/pages/api/lead.ts` (`prerender = false`).
- Conversiones: siempre por `trackConversion()` en `src/lib/client/track.ts`; el `event_id` del navegador
  se reutiliza en Meta CAPI para deduplicar.
- Antes de terminar un cambio: `npm run check` y `npm run build`.
- Textos de usuario en español de Chile.

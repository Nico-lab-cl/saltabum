# Saltabum — saltabum.cl

Landing page de Saltabum. **Astro 7 + Tailwind v4**, desplegada en **Cloudflare Workers** (static assets + un endpoint `/api/lead`).

## Qué incluye

| Área           | Implementación                                                                                |
| -------------- | --------------------------------------------------------------------------------------------- |
| Páginas        | HTML estático pre-generado (rápido = mejor SEO y Quality Score de Ads)                        |
| Tracking       | Meta Pixel, Google Ads, GA4, Microsoft Clarity — `src/components/core/Tracking.astro`         |
| Consentimiento | Banner opt-in + Google Consent Mode v2 + consent API de Meta y Clarity                        |
| Conversiones   | `Lead` (formulario) y `Contact` (WhatsApp) a todas las plataformas, con `event_id` compartido |
| Server-side    | Meta Conversions API desde el Worker, deduplicada con el Pixel                                |
| Formulario     | `/api/lead`: validación (zod) + Turnstile + honeypot → webhook firmado (HMAC) a tu CRM        |
| Atribución     | UTMs, gclid, fbclid, msclkid y landing page viajan con cada lead al CRM                       |
| SEO            | meta/OG/canonical, JSON-LD, sitemap.xml, robots.txt                                           |
| Diseño         | **`src/design/`** ← aquí va lo de Claude Design (ver `src/design/README.md`)                  |

## Documentación del negocio

| Documento                                                      | Para qué                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [docs/investigacion-negocio.md](docs/investigacion-negocio.md) | Resumen curado: mercado, competencia, clientes, UX, marketing, operación             |
| [docs/prompt-claude-design.md](docs/prompt-claude-design.md)   | Prompt para crear el sistema de diseño en Claude Design                              |
| [docs/notebooklm/](docs/notebooklm/README.md)                  | Informes completos del cuaderno NotebookLM "Industria juegos inflables" (65 fuentes) |
| [docs/referencias/](docs/referencias)                          | Logo anterior (descartado, solo como referencia de lo que no repetir)                |

## Estructura

```
src/
├── design/            ← TODO lo visual (Claude Design)
├── components/core/   ← Tracking, CookieBanner, Turnstile, WhatsAppLink, SEO (no tocar el diseño aquí)
├── layouts/           ← BaseLayout: une SEO + tracking + diseño
├── lib/client/        ← scripts del navegador (consentimiento, conversiones, formulario, atribución)
├── lib/server/        ← CRM webhook, Meta CAPI, Turnstile
├── lib/lead-schema.ts ← contrato de datos del formulario
├── pages/             ← rutas (index, política de privacidad, 404, api/lead)
└── config/site.ts     ← nombre, SEO por defecto, datos legales
```

## Desarrollo local

Requisitos: Node.js 22+.

```bash
npm install
cp .env.example .env            # IDs públicos (pueden quedar vacíos en local)
cp .dev.vars.example .dev.vars  # secretos locales (ya trae los de prueba de Turnstile)
npm run dev                     # http://localhost:4321
```

Para probar exactamente como en Cloudflare (runtime workerd): `npm run preview`.

> ⚠️ Si la carpeta del proyecto está dentro de `AppData\Roaming` y usas la app de Claude de la Microsoft Store,
> Windows virtualiza esa ruta y `wrangler` falla con rutas rotas. Mantén el proyecto en una carpeta normal
> (ej. `Documentos\saltabum`) y con ruta corta (< 260 caracteres).

## Variables y secretos

**Públicas** (se incrustan al compilar) — ver `.env.example`:
`PUBLIC_META_PIXEL_ID`, `PUBLIC_GOOGLE_ADS_ID`, `PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL`,
`PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`, `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_TURNSTILE_SITE_KEY`.
Si un ID queda vacío, ese tag simplemente no se carga.

**Secretos** (solo en el Worker, en tiempo de ejecución):

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put CRM_WEBHOOK_URL
npx wrangler secret put CRM_WEBHOOK_SECRET
```

En producción, si falta `TURNSTILE_SECRET_KEY` o `CRM_WEBHOOK_URL`, `/api/lead` responde 503
(a propósito: así no se pierden leads en silencio). Mientras el CRM no exista, el diseño debería
priorizar WhatsApp.

## Despliegue

Manual (primera vez):

```bash
npx wrangler login
npm run deploy
```

Automático: `.github/workflows/deploy.yml` despliega en cada push a `main` cuando el repo esté en GitHub.
Configurar en GitHub → Settings → Secrets and variables → Actions:

- Secrets: `CLOUDFLARE_API_TOKEN` (plantilla "Edit Cloudflare Workers"), `CLOUDFLARE_ACCOUNT_ID`
- Variables: todas las `PUBLIC_*`

El dominio `saltabum.cl` y `www.saltabum.cl` se asocian solos al Worker (ver `routes` en `wrangler.jsonc`).
Recomendado: regla de redirección en Cloudflare `www.saltabum.cl/*` → `https://saltabum.cl/$1` (301).

## Contrato del webhook al CRM

`POST CRM_WEBHOOK_URL` con JSON (`schema_version: 1`, ver `src/lib/server/crm.ts`) y headers:

- `X-Saltabum-Timestamp`: unix segundos
- `X-Saltabum-Signature`: `sha256=` + HMAC-SHA256(`CRM_WEBHOOK_SECRET`, `${timestamp}.${body}`)
- `Idempotency-Key`: id del lead (para no duplicar si hay reintentos)

El CRM debe validar la firma, rechazar timestamps de más de 5 min y responder 2xx.

## Checklist antes de publicar

- [ ] Completar `src/config/site.ts` (descripción SEO, datos legales) y revisar la política de privacidad con un abogado
- [ ] Crear en Google Ads las acciones de conversión "Lead formulario" y "Clic WhatsApp" → copiar sus labels
- [ ] Activar Enhanced Conversions en Google Ads y verificar el Pixel/dominio en Meta Business
- [ ] Crear widget de Turnstile para `saltabum.cl`
- [ ] Probar eventos con Meta "Probar eventos" (`META_CAPI_TEST_EVENT_CODE`) y Google Tag Assistant
- [ ] Agregar `public/og-default.jpg` (1200×630)

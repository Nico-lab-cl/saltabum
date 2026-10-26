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
| Formulario     | `/api/lead`: validación (zod) + honeypot + límite por IP → webhook firmado (HMAC) a tu CRM   |
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
├── components/core/   ← Tracking, CookieBanner, WhatsAppLink, SEO (no tocar el diseño aquí)
├── layouts/           ← BaseLayout: une SEO + tracking + diseño
├── lib/client/        ← scripts del navegador (consentimiento, conversiones, formulario, atribución)
├── lib/server/        ← CRM webhook, Meta CAPI, panel /admin
├── lib/lead-schema.ts ← contrato de datos del formulario
├── pages/             ← rutas (index, política de privacidad, 404, api/lead)
└── config/site.ts     ← nombre, SEO por defecto, datos legales
```

## Desarrollo local

Requisitos: Node.js 22+.

```bash
npm install
cp .env.example .env            # IDs públicos (pueden quedar vacíos en local)
cp .dev.vars.example .dev.vars  # secretos locales
npm run dev                     # http://localhost:4321
```

Para probar exactamente como en Cloudflare (runtime workerd): `npm run preview`.

> ⚠️ Si la carpeta del proyecto está dentro de `AppData\Roaming` y usas la app de Claude de la Microsoft Store,
> Windows virtualiza esa ruta y `wrangler` falla con rutas rotas. Mantén el proyecto en una carpeta normal
> (ej. `Documentos\saltabum`) y con ruta corta (< 260 caracteres).

## Variables y secretos

**Públicas** (se incrustan al compilar) — ver `.env.example`:
`PUBLIC_META_PIXEL_ID`, `PUBLIC_GOOGLE_ADS_ID`, `PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL`,
`PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`, `PUBLIC_WHATSAPP_NUMBER`.
Si un ID queda vacío, ese tag simplemente no se carga. El píxel de Meta, GA4, Clarity y WhatsApp
ya traen su valor por defecto en `astro.config.mjs`, así que no hace falta cargarlas en Cloudflare.

**Secretos** (solo en el Worker, en tiempo de ejecución):

```bash
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put CRM_WEBHOOK_URL
npx wrangler secret put CRM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_USUARIOS   # usuarios del panel /admin (ver «Panel de reservas»)
# WhatsApp en /admin → pestaña «WhatsApp» (Evolution API en Easypanel)
npx wrangler secret put EVOLUTION_API_URL         # https://evolution-api-evolution-api.db8enk.easypanel.host
npx wrangler secret put EVOLUTION_API_KEY         # AUTHENTICATION_API_KEY de Evolution
npx wrangler secret put EVOLUTION_WEBHOOK_SECRET  # clave larga al azar
npx wrangler secret put ANTHROPIC_API_KEY         # chat con IA de la web (console.anthropic.com)
# Opcionales: EVOLUTION_INSTANCIA (por defecto «Saltabum») y WHATSAPP_ETIQUETA_ID (por defecto «12» = SALTABUM | LEADS)
```

**WhatsApp en el panel.** Evolution API manda cada mensaje a `/api/whatsapp`, y el sitio guarda en D1 solo los chats
que llegaron por un anuncio de Meta (Click-to-WhatsApp) o que tienen la etiqueta «SALTABUM | LEADS». El webhook de la
instancia se configura en Evolution con la URL `https://saltabum.cl/api/whatsapp?clave=<EVOLUTION_WEBHOOK_SECRET>`
y los eventos `MESSAGES_UPSERT`, `SEND_MESSAGE` y `LABELS_ASSOCIATION` (sin «by events» ni base64). Los chats de
anuncios anteriores se traen con el botón «Importar chats de anuncios» de la pestaña.

Las consultas del formulario de contacto (`/api/lead`) se guardan en D1 y se ven en `/admin` → Consultas; el CRM
(`CRM_WEBHOOK_URL`) es opcional y, si existe, también las recibe. Antispam: honeypot (`website`) y máximo 5
consultas por conexión cada 24 horas.

## Despliegue

Automático con **Cloudflare Workers Builds** (dashboard → Workers & Pages → `saltabum` → Settings → Build),
conectado al repo de GitHub, rama `main`:

| Campo                       | Valor                |
| --------------------------- | -------------------- |
| Build command               | `npm run build`      |
| Deploy command              | `npx wrangler deploy` |
| Root directory              | `/`                  |
| Build variables and secrets | todas las `PUBLIC_*` |

`npm run build` genera `dist/server/wrangler.json` y `.wrangler/deploy/config.json`, que es lo que lee
`wrangler deploy`. Sin el build, wrangler falla con "Missing entry-point to Worker script".

Las `PUBLIC_*` se incrustan al compilar, así que van en las **variables de build**; los secretos del Worker
(`META_CAPI_ACCESS_TOKEN`, etc.) van en Settings → Variables and Secrets (o con `wrangler secret put`).

`.github/workflows/ci.yml` solo verifica (`check` + `build`) en cada push y PR; no despliega.

Manual, desde tu computador:

```bash
npx wrangler login
npm run deploy
```

El dominio `saltabum.cl` y `www.saltabum.cl` se asocian solos al Worker (ver `routes` en `wrangler.jsonc`).
Recomendado: regla de redirección en Cloudflare `www.saltabum.cl/*` → `https://saltabum.cl/$1` (301).

## Calendario de reservas

- La sección «Elige tu fecha y horario» (`src/design/sections/Agenda.astro`) muestra los horarios libres y reserva
  vía `/api/reservas`. Los bloques (10:00–13:00, 13:30–16:30, 17:00–20:00) y el rango de días están en
  `src/lib/reservas.ts`. Nunca se puede reservar para el mismo día.
- Las reservas se guardan en Cloudflare D1 (binding `DB`, base `saltabum-reservas`). Wrangler la crea sola en el
  primer deploy y el Worker crea la tabla al primer uso. La clave primaria (fecha + bloque) impide reservas dobles.
- Antispam: honeypot y máximo 3 reservas por conexión cada 24 horas.
- Panel: `https://saltabum.cl/admin`. Ahí se ven las reservas con sus datos, se marcan pagos (se informan a Meta como
  compra cerrada por chat), se bloquean días u horarios y se cancelan reservas.

### Panel de reservas: acceso y seguridad

- Se entra en `https://saltabum.cl/admin` solo con la contraseña. Mientras no hay contraseña cargada, esa misma página
  muestra «Crear la contraseña del panel»: la contraseña se convierte en el navegador en una línea cifrada
  (PBKDF2-SHA256, 100.000 iteraciones, sal aleatoria) que se pega en Cloudflare como secreto `ADMIN_USUARIOS`
  (Workers & Pages → saltabum → Settings → Variables and Secrets). La contraseña nunca sale del navegador.
- Para cambiarla o sumar otra persona, se agrega otra línea al secreto (una por contraseña). Una línea puede llevar al
  final `:<clave TOTP>` para exigir además un código de 6 dígitos (`node scripts/admin-usuario.mjs` la genera).
- Sesiones en D1 (`admin_sesiones`) con cookie `__Host-sb_admin` HttpOnly, Secure y SameSite=Strict. Se cierran
  tras 2 horas sin uso o 12 horas en total, y quedan atadas al navegador que las abrió.
- Límite de intentos: 5 fallos por conexión cada 15 minutos y 10 en total cada hora. Cada código TOTP sirve una vez.
- CSRF: se exige el mismo origen y el encabezado `x-saltabum-admin`. CSP estricta y sin caché en `public/_headers`.
- Auditoría en la tabla `admin_auditoria` (ingresos, fallos, bloqueos, cancelaciones y pagos):
  `npx wrangler d1 execute saltabum-reservas --remote --command "SELECT * FROM admin_auditoria ORDER BY id DESC LIMIT 50"`

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
- [ ] Probar eventos con Meta "Probar eventos" (`META_CAPI_TEST_EVENT_CODE`) y Google Tag Assistant
- [ ] Agregar `public/og-default.jpg` (1200×630)

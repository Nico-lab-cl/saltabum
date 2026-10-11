# src/design — Espacio para Claude Design

Aquí va **todo lo visual**: secciones, componentes, header, footer e imágenes de la landing.
La lógica (tracking, consentimiento, envío de leads, SEO) ya está resuelta fuera de esta carpeta
y no hace falta tocarla.

```
src/design/
├── pages/        ← composición de cada página (Home.astro = la landing)
├── sections/     ← Hero, Beneficios, Precios, FAQ, Contacto...
├── components/   ← botones, tarjetas, header, footer...
└── assets/       ← imágenes (Astro las optimiza automáticamente)
```

Los tokens de diseño (colores, fuentes) van en `src/styles/global.css` dentro de `@theme { ... }`.

## Reglas para que el tracking funcione (importante)

### 1. Botones de WhatsApp

Usa el componente listo:

```astro
---
import WhatsAppLink from "@/components/core/WhatsAppLink.astro";
---

<WhatsAppLink placement="hero" class="tus-clases">
  Reserva por WhatsApp
</WhatsAppLink>
```

…o, si el diseño trae su propio `<a>`, agrégale `data-track="whatsapp"` y `data-track-placement="hero"`.
Así cada clic cuenta como conversión en Meta, Google Ads, GA4 y Clarity.

### 2. Formulario de contacto

El formulario puede tener el diseño que quieras mientras respete estos nombres:

| Atributo / campo                                                 | Obligatorio       | Notas                                       |
| ---------------------------------------------------------------- | ----------------- | ------------------------------------------- |
| `<form data-lead-form="contacto">`                               | ✅                | El valor identifica el formulario en el CRM |
| `name="nombre"`                                                  | ✅                |                                             |
| `name="telefono"` y/o `name="email"`                             | ✅ (al menos uno) |                                             |
| `name="mensaje"`                                                 |                   |                                             |
| `name="extra.<lo-que-sea>"`                                      |                   | Campos adicionales (ej. `extra.personas`)   |
| `<Turnstile />`                                                  | ✅                | Antispam de Cloudflare                      |
| `<input name="website" hidden tabindex="-1" autocomplete="off">` | ✅                | Trampa anti-bots, debe quedar invisible     |
| `<p data-lead-message>`                                          |                   | Aquí aparece "¡Gracias!" o el error         |

El `<form>` recibe `data-state="idle | sending | success | error"` para que lo estilices,
por ejemplo con `group-data-[state=sending]:opacity-50` en Tailwind.

### 3. Link "Configurar cookies"

En el footer, cualquier elemento con `data-consent-open` reabre el banner de cookies.
Recuerda enlazar también `/politica-de-privacidad`.

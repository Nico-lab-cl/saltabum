# Prompt para Claude Design — Sistema de diseño Saltabum

> Copia todo lo que está bajo la línea en Claude Design. Adjunta también `docs/investigacion-negocio.md`
> y el logo actual (como referencia de lo que NO queremos repetir).
> Antes de pegarlo, completa los campos marcados con [ ].

---

## Rol y objetivo

Actúa como director/a de arte y diseñador/a de sistemas de marca senior. Vas a crear **desde cero la identidad y el
sistema de diseño completo de Saltabum**, una empresa chilena de **arriendo de juegos inflables y entretenciones
para cumpleaños y eventos** en el Gran Valparaíso. El sistema tiene que funcionar en la web (landing en Astro +
Tailwind v4), en publicidad de Meta y Google, en WhatsApp, en Google Maps y en el mundo físico (vehículo, poleras,
etiquetas en los equipos).

Trabaja por fases y **muéstrame cada fase para aprobación antes de pasar a la siguiente**.

## 1. El negocio

- **Qué hace**: arrienda juegos inflables (castillos, combos con tobogán, toboganes acuáticos, plaza blanda para
  bebés, piscina de pelotas) y entretenciones complementarias (taca-taca, cama elástica, máquinas arcade) por
  bloques de 4 horas, con despacho, montaje y retiro incluidos.
- **Dónde**: Viña del Mar, Valparaíso, Concón, Quilpué, Villa Alemana (y Limache/Olmué). Base de operaciones: [comuna].
- **Precio de referencia**: inflable tradicional $40.000–$60.000 CLP por 4 horas; acuáticos y grandes
  $85.000–$120.000.
- **Cómo vende**: el cliente llega por Google o Instagram, mira la web en el celular y **cierra por WhatsApp**.
  La velocidad y la claridad lo son todo.
- **Clientes**:
  1. _Mamá que busca calidad y estética_ (ABC1/C1b, Concón, Reñaca): quiere un evento armónico, limpio, puntual
     y "fotografiable", con colores neutros o pastel.
  2. _Papá o mamá que busca valor_ (C2/C3, Quilpué, Villa Alemana, Curauma): quiere combos que resuelvan el
     cumpleaños completo sin sorpresas de precio.
  3. _Encargado institucional_ (colegios, empresas, municipios): necesita seriedad, seguridad, factura y capacidad.
     Quien decide son madres y padres de 25 a 45 años con hijos de 1 a 12 años, casi siempre **desde el celular**.

## 2. El problema del mercado (y nuestra oportunidad)

La competencia local se ve igual: logos de clip-art con castillos y niños ilustrados, letras de arcoíris con
biselado 3D, catálogos en PDF, precios escondidos y fotos de fábrica. Los padres desconfían de la **higiene**, la
**puntualidad** y el **estado de los juegos**, y odian los **cobros sorpresa** de despacho.

**Saltabum tiene que ser la opción que da confianza sin perder la alegría.** El posicionamiento es:
"la diversión de siempre, con la seriedad que nadie más ofrece": precios a la vista, equipos sanitizados,
montaje seguro y puntual, y respuesta inmediata.

## 3. Concepto de marca

- **Nombre**: _Salta + Bum_. Es pura onomatopeya: el impulso y el impacto del salto, el rebote, el "¡bum!" de la
  risa. Explota ese momento como idea central (rebote, elasticidad, aire, volumen inflado).
- **Personalidad**: alegre, enérgica, cercana, **ordenada y confiable**. Es juguetona, pero no infantil ni caótica.
  Si fuera una persona, sería la tía que organiza el mejor cumpleaños y además llega puntual.
- **Tono de voz**: español de Chile, tuteo, frases cortas y claras, con humor liviano. Siempre concreta: precios,
  comunas, horarios. Escribe 3 ejemplos de titulares y 3 de mensajes de WhatsApp.
- **Descriptor**: "Juegos inflables y entretenciones". Va como bajada y no forma parte del logotipo principal.

## 4. Lo que NO queremos (el logo actual)

El logo actual es una ilustración recargada: castillo, tres niños, taca-taca, piscina de pelotas y salpicaduras,
con cada letra de un color distinto y efecto 3D. No sirve porque:

- es ilegible en tamaños pequeños (favicon, avatar de WhatsApp, bordado);
- el nombre compite con el dibujo y la paleta de arcoíris no deja un color de marca;
- se ve genérico, igual a la competencia y a una imagen generada por IA;
- no se puede convertir en sistema.

Evita: niños ilustrados en el logo, castillos de clip-art, arcoíris letra por letra, biselados, brillos 3D,
degradados chillones y estrellitas de relleno.

## 5. Fase 1 — Logo (3 rutas)

Propón **3 rutas conceptuales distintas**, cada una con su razonamiento, en versión a color, una tinta y negativo:

- Wordmark protagonista, redondeado y "inflado", con algún detalle propio (por ejemplo, la "u" como arco
  inflable, un acento o punto que rebota, o la tensión de "Salta" contra la explosión de "Bum").
- Un **isotipo/símbolo** independiente que funcione solo a 16 px (favicon), en un círculo (avatar de WhatsApp e
  Instagram) y como sello en los equipos.
- Versiones horizontal, apilada y solo símbolo. Zona de protección y tamaño mínimo.
- Prueba cada ruta en: favicon, avatar circular, polera bordada a 1 color, costado de una camioneta, sticker
  sobre vinilo de un inflable y portada de Instagram.

## 6. Fase 2 — Fundamentos (tokens)

- **Color**: un color primario con mucha energía y un secundario que lo equilibre, más neutros cálidos (no gris
  frío) y colores funcionales (éxito, alerta, error). Además, una **sub-paleta "Línea Pastel / Primera Infancia"**
  (neutros, moca, rosa empolvado, salvia) para el segmento estético, que conviva con la paleta principal.
  Todos los textos deben cumplir **WCAG AA**. Entrega claro y oscuro.
- **Tipografía** (Google Fonts, máximo 2 familias, soporte completo de ñ y tildes): una display redondeada, amable
  y con volumen para titulares, y una sans muy legible para texto y precios. Define la escala tipográfica mobile
  y desktop.
- **Forma**: radios generosos ("inflados"), sombras suaves con volumen y bordes. Define el espaciado (base de
  4 px), la grilla y los breakpoints (mobile-first desde 360 px).
- **Movimiento**: micro-interacciones de "rebote" (squash and stretch suave) en botones y tarjetas, respetando
  `prefers-reduced-motion`.
- **Iconografía**: un set propio, redondeado y de trazo consistente, para: edad recomendada, medidas, superficie
  requerida, consumo eléctrico, tiempo de montaje, despacho por comuna, sanitizado, anclaje seguro, puntualidad,
  lluvia/reprogramación, abono, factura, WhatsApp, teléfono, calendario y combos.
- **Fotografía**: la dirección de arte prioriza **fotos reales** en patios y salones de la zona, niños jugando
  (sin caras reconocibles en piezas públicas), el proceso de montaje y la limpieza. Nada de renders de fábrica.
  Define el tratamiento: luz natural, encuadres y un overlay de marca opcional.
- **Ilustración/gráficos de apoyo**: formas orgánicas, "nubes de aire", trazos de rebote. Deben ser sobrios y
  reutilizables como patrón.

## 7. Fase 3 — Componentes web

Diseña cada componente en mobile y desktop, con sus estados (hover, focus, activo, deshabilitado, cargando,
error):

- **Header** con logo, sellos de confianza (Puntualidad, Equipos sanitizados) y botón WhatsApp siempre visible.
- **Sticky bottom bar móvil**: WhatsApp (principal) + Llamar.
- **Botones**: primario, secundario, WhatsApp y texto.
- **Chips de filtro**: edad (1–4, 5–9, 10+), tipo de juego y tamaño de patio.
- **Tarjeta de producto**: foto real, nombre, edad, medidas, superficie, "desde $XX.XXX · 4 horas", badge
  (Nuevo / Línea Pastel / Acuático / Más pedido) y CTA "Consultar disponibilidad".
- **Ficha de producto** con galería, íconos técnicos y CTA a WhatsApp con mensaje prellenado.
- **Selector de comuna / calculadora de despacho**: "Despacho gratis" o "+$5.000".
- **Tarjeta de combo** con el ahorro destacado.
- **Bloque de confianza**: sanitización, anclaje certificado, puntualidad y reprogramación por lluvia.
- **Reseñas** de Google (estrellas, nombre, comuna, texto).
- **FAQ** en acordeón.
- **Formulario de contacto**: nombre, teléfono, email, mensaje y campos extra; estados idle, enviando, éxito y error.
- **Banner de cookies**, **footer** y **sección B2B** ("Colegios y empresas").

## 8. Fase 4 — Landing page

Diseña la landing mobile-first y su versión desktop, con este orden:

1. Hero: propuesta de valor + "desde $XX.XXX" + CTA a WhatsApp + prueba social (estrellas de Google).
2. Barra de confianza (4 sellos).
3. Catálogo destacado con filtros por edad.
4. Combos.
5. Cómo funciona (eliges → reservas por WhatsApp → montamos → disfrutas → retiramos).
6. Comunas y despacho.
7. Línea Pastel / Primera Infancia.
8. Reseñas.
9. Colegios y empresas.
10. FAQ (lluvia, abono, electricidad < $2.000 por evento, espacio requerido, anclaje).
11. Formulario + WhatsApp.
12. Footer (política de privacidad y "Configurar cookies").

## 9. Fase 5 — Aplicaciones

- Instagram: post 1:1 y 4:5, portada de Reel, historia 9:16 y destacados.
- Anuncios Meta (1:1, 4:5, 9:16) y Google Display: 3 plantillas, una de confianza, una de combo y una de temporada
  de verano/acuáticos.
- Foto de perfil y portada de catálogo de WhatsApp Business; portada de Google Business.
- Vehículo (rotulado lateral y trasero), polera/polerón del equipo de montaje y credencial.
- **Etiqueta para cada equipo**: logo, número de serie, fecha de última sanitización y QR.
- Cotización y comprobante de reserva (PDF A4 simple).

## 10. Restricciones técnicas (muy importantes)

- El sitio está en **Astro 7 + Tailwind CSS v4**. Entrega los tokens como CSS listo para pegar en
  `src/styles/global.css` dentro de `@theme { ... }` (colores, fuentes, radios, sombras, espaciados).
- Los componentes van como archivos `.astro` en `src/design/` (`sections/`, `components/`, `pages/Home.astro`).
- **Respeta estos contratos del código, que ya funcionan** (tracking y envío de leads):
  - Links a WhatsApp: usa `<WhatsAppLink placement="hero">` de `@/components/core/WhatsAppLink.astro`, o un `<a>`
    con `data-track="whatsapp"` y `data-track-placement="..."`.
  - Formulario: `<form data-lead-form="contacto">` con campos `nombre`, `telefono`, `email`, `mensaje`,
    `extra.*`, el componente `<Turnstile />` de `@/components/core/Turnstile.astro`, el campo oculto
    `<input name="website" hidden tabindex="-1" autocomplete="off">` y un `<p data-lead-message>`. El form recibe
    `data-state="idle|sending|success|error"` para los estilos.
  - Cookies: cualquier elemento con `data-consent-open` reabre el banner, que puedes rediseñar manteniendo
    `data-consent-banner`, `data-consent-accept` y `data-consent-reject`.
- Rendimiento: íconos en SVG inline, imágenes WebP/AVIF, nada de librerías JS pesadas y animaciones solo con CSS.
- Accesibilidad: contraste AA, foco visible, áreas táctiles de 44 px como mínimo y textos alternativos.

## 11. Entregables finales

1. Brandbook resumido: concepto, logo y usos, color, tipografía, iconos, fotografía y voz.
2. Tokens en CSS (`@theme`) y en JSON.
3. Librería de componentes y landing (mobile y desktop).
4. Archivos de logo: SVG (color, 1 tinta, negativo, isotipo) y PNG para redes, más el favicon SVG.
5. Plantillas de aplicaciones.

Empieza por la **Fase 1**: muéstrame las 3 rutas de logo con su concepto y las pruebas de uso.

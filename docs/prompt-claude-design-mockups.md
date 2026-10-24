# Prompt para Claude Design — Mockups UI del sitio saltabum.cl

> Pégalo en Claude Design con el sistema de diseño **"Saltabum y Entretenciones"** seleccionado.
> Antes de pegarlo, completa los campos entre [ ]. Lo más importante es **qué ruta de logo quedó**.

---

## Rol y objetivo

Actúa como diseñador/a UI/UX senior especializado/a en sitios de conversión mobile-first. Diseña los **mockups
de alta fidelidad del sitio saltabum.cl** usando **exclusivamente el sistema de diseño "Saltabum y
Entretenciones"**: sus tokens de color, la tipografía Fredoka + Figtree, los radios, el espaciado, la voz y las
reglas de "Multicolor, con orden". No inventes colores ni fuentes nuevas. Si te falta un token (sombras, más
pasos de espaciado, estados), propónlo siguiendo la lógica del sistema y anótalo como **"token nuevo
propuesto"** para agregarlo después.

- **Logo**: usa la **[Ruta 1 — Castillo saltarín / Ruta 2 — Insignia de cumpleaños]**: horizontal en el header,
  isotipo en espacios chicos y negativo sobre `noche`.

Trabaja por etapas y **muéstrame cada una para aprobación antes de seguir**.

## El objetivo del sitio (lo que tiene que lograr cada pantalla)

Saltabum arrienda juegos inflables y entretenciones por bloques de 4 horas, con despacho, montaje y retiro
incluidos. Base en Valparaíso; cobertura en Viña del Mar, Valparaíso, Concón, Quilpué y Villa Alemana (más
Limache y Olmué).

**La conversión es una sola: que el papá o la mamá abra WhatsApp con el juego, la comuna y la fecha ya
escritos.** La segunda es el formulario de contacto. Todo el diseño empuja hacia eso.

Lo que dice la investigación de mercado (respétalo):

- Más del 60–85 % llega **desde el celular**, muchas veces desde un anuncio de Google o Instagram, y decide en
  segundos. **Diseña primero en 390 px**; el desktop viene después.
- La competencia esconde los precios y obliga a descargar PDFs. Nosotros mostramos **el precio en todas las
  tarjetas** ("desde $40.000 · 4 horas") y **el despacho por comuna** antes de que pregunten.
- Los padres desconfían de la **higiene, la puntualidad y el estado de los juegos**. Las señales de confianza
  van en el **primer scroll**: sanitizado, montaje seguro con anclaje, puntualidad y reprogramación si llueve.
- Las **fotos reales** (juego instalado en un patio, niños jugando, montaje y limpieza) generan un 42 % más de
  confianza que los renders. Usa placeholders de foto claramente marcados ("FOTO REAL: castillo instalado en
  patio") y nunca renders de fábrica ni stock genérico.
- Los niños de 1 a 12 años son el centro de la marca: alegría, color y rebote. **El servicio se comunica como
  un adulto**: claro, con números, sin letra chica.

## Etapa 1 — Landing page (home), mobile 390 px y desktop 1440 px

Orden de secciones:

1. **Header**: logo, sellos mini ("Sanitizado", "Puntual"), botón WhatsApp. En mobile, header compacto y menú.
2. **Hero**: titular de la voz de marca (por ejemplo, «¡A saltar se ha dicho!»), bajada con precio «Inflables
   desde $40.000 por 4 horas, con despacho, montaje y retiro», CTA principal **«Consultar disponibilidad por
   WhatsApp»**, CTA secundario «Ver juegos», prueba social («★ 4,9 en Google · +[N] cumpleaños») y foto real
   grande. Usa el multicolor en formas y pelotas, no en el texto.
3. **Barra de confianza**: 4 sellos con ícono y una línea: Equipos sanitizados · Anclaje seguro · Llegamos
   puntuales · ¿Llueve? Reprogramamos sin perder tu abono.
4. **Catálogo destacado**: chips de filtro por edad (1–4, 5–9, 10+), tipo (castillos, toboganes, acuáticos,
   plaza blanda, entretenciones) y tamaño de patio. **Tarjeta de producto**: foto, nombre, edad, medidas, espacio
   requerido, precio «desde $XX.XXX · 4 horas», badge (Más pedido / Línea Pastel / Acuático / Nuevo) y botón
   «Consultar». En mobile: carrusel horizontal o grilla de 1 columna; en desktop, 3 o 4 columnas.
5. **Combos**: 2 o 3 combos (por ejemplo, Castillo + Taca-taca, Inflable + Cama elástica + Arcade), con el
   ahorro destacado.
6. **Cómo funciona**, en 4 pasos: Eliges el juego → Reservas por WhatsApp con abono de $10.000 → Llegamos,
   montamos y anclamos → Disfrutan 4 horas y retiramos.
7. **Despacho por comuna**: selector de comuna con el resultado («Despacho gratis» o «+$5.000»).
   Datos: [Valparaíso: gratis · Viña del Mar: gratis · Concón: +$5.000 · Quilpué: +$5.000 · Villa Alemana:
   +$5.000 · Limache/Olmué: a convenir], por confirmar.
8. **Línea Pastel / Primera Infancia**: banda en `moca`, `rosa-empolvado` y `salvia` para la mamá que busca un
   evento fotografiable (plaza blanda y piscina de pelotas en tonos neutros). Aquí el multicolor se apaga.
9. **Reseñas** de Google: tarjetas con estrellas, nombre, comuna y texto, con link a «Ver todas en Google».
10. **Colegios y empresas**: banda más sobria con capacidad, monitores, anclaje certificado y **factura**, y un CTA
    «Cotizar evento».
11. **Preguntas frecuentes** en acordeón: ¿Qué pasa si llueve? · ¿Cuánto es el abono? · ¿Cuánta luz consume?
    (menos de $2.000 por evento) · ¿Cuánto espacio necesito? · ¿Cómo se ancla? · ¿Cuánto demora el montaje?
    (10–15 min) · ¿Emiten factura?
12. **Contacto**: formulario (nombre, teléfono, email, comuna, fecha del evento, mensaje) junto a la alternativa
    de WhatsApp. Muestra los estados del formulario: normal, enviando, éxito y error.
13. **Footer**: logo en negativo sobre `noche`, comunas, contacto, redes, «Política de privacidad» y «Configurar
    cookies».

Elementos globales:

- **Barra fija inferior en mobile** (sticky bottom bar): «WhatsApp» (principal, ancho) y «Llamar». Siempre
  visible; no debe tapar contenido importante.
- **Banner de cookies** (aceptar / rechazar) en estilo de la marca, discreto, abajo.
- Microinteracciones de **rebote** (squash and stretch) en botones y tarjetas: indícalas con notas, respetando
  `prefers-reduced-motion`.

## Etapa 2 — Páginas internas (mobile y desktop)

1. **Catálogo completo** con filtros (edad, tipo, tamaño de patio, temporada) y orden por precio.
2. **Ficha de producto**: galería de fotos reales; precio del bloque de 4 horas; íconos de edad, medidas, espacio
   requerido, consumo eléctrico, tiempo de montaje y capacidad; selector de comuna y fecha que **arma el mensaje
   de WhatsApp** («Hola, quiero consultar la disponibilidad del [juego] para [comuna] el [fecha]. Vengo de
   saltabum.cl»); «También te puede gustar» y combos que lo incluyen.
3. **Colegios y empresas (B2B)**: casos, capacidad, requisitos y formulario de cotización.
4. **Preguntas frecuentes y políticas**: lluvia, abono, pagos, seguridad y limpieza.
5. **404** con humor de marca y botón de vuelta, y **página de "¡Gracias!"** después del formulario.

## Etapa 3 — Hoja de componentes (lo que faltó de la Fase 3 del sistema)

Saca de los mockups una hoja con cada componente y sus estados (default, hover, focus visible, activo,
deshabilitado, cargando, error), en mobile y desktop: botones (principal `rojo-texto`, secundario, WhatsApp,
texto), chips de filtro, tarjeta de producto, tarjeta de combo, sello de confianza, tarjeta de reseña, acordeón,
inputs, select de comuna, selector de fecha, banner de cookies, sticky bar, header y footer. Agrega el set de
íconos redondeados con el contorno `noche`: edad, medidas, espacio, electricidad, tiempo, despacho, sanitizado,
anclaje, puntual, lluvia, abono, factura, WhatsApp, teléfono, calendario y combo.

## Reglas que no se rompen

- **Accesibilidad**: los colores de marca (`rojo`, `sol`, `verde`, `azul`, `morado`, `naranja`, `rosa`,
  `celeste`) nunca van como texto chico. Para texto usa `noche`, `noche-suave`, `rojo-texto`, `azul-texto` y
  `morado-texto`. Contraste AA, foco visible y áreas táctiles de 44 px como mínimo.
- **Un color manda por sección**; los demás solo en detalles (pelotas, chips, subrayados).
- **Formato**: precios `$40.000`, horas `10:00`, comunas con nombre completo; español de Chile, tuteo.
- **Rendimiento**: íconos SVG, nada de video automático pesado en el hero, fotos pensadas en WebP y sin
  carruseles automáticos.
- **Implementación**: el sitio se construye en **Astro + Tailwind v4**, así que diseña con componentes
  reutilizables, sin efectos que solo funcionen en Figma. Ya existen en el código y deben respetarse:
  - el **link a WhatsApp** dispara el tracking de conversión (todo botón de WhatsApp es el mismo componente con
    una posición: hero, header, sticky, ficha…);
  - el **formulario** usa los campos `nombre`, `telefono`, `email`, `mensaje` y extras (`comuna`, `fecha`), lleva
    un mensaje de estado bajo el botón;
  - el **banner de cookies** tiene botones Aceptar y Rechazar y se reabre desde el footer.

## Entregables por etapa

1. Mockups mobile (390 px) y desktop (1440 px) de cada pantalla.
2. Notas de interacción: estados, animaciones y comportamiento de la sticky bar y del selector de comuna.
3. Lista de **tokens nuevos propuestos** (sombras, espaciados, estados) para sumarlos al sistema.
4. Al final, el **handoff**: por cada sección, los componentes usados, los tokens y los textos definitivos, listo
   para pasarlo a código.

Empieza por la **Etapa 1: la landing en mobile 390 px**.

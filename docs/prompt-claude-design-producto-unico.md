# Prompt para Claude Design — Landing de un solo producto, con imágenes generadas con IA

> Pégalo en Claude Design con el sistema de diseño **"Saltabum y Entretenciones"** seleccionado y **adjunta la
> foto real** `src/design/assets/megatobogan-arcoiris.webp`. Antes de pegarlo, completa los campos entre [ ].

---

## Rol y objetivo

Actúa como diseñador/a UI/UX senior especializado/a en landings de conversión mobile-first. Vas a **rediseñar la
landing actual de saltabum.cl**, que ya está construida, usando **exclusivamente el sistema de diseño "Saltabum y
Entretenciones"** (tokens de color, Fredoka + Figtree, radios, sombras planas con contorno `noche`, rebote). No
inventes colores ni fuentes. Si te falta un token, propónlo y anótalo como **"token nuevo propuesto"**.

Hay dos cambios de fondo respecto del diseño anterior:

1. **Saltabum hoy arrienda un solo juego: el Megatobogán Arcoíris.** La landing actual está pensada como catálogo
   de varios productos y por eso se ve vacía. Hay que convertirla en una **landing de producto único**.
2. **Las imágenes que faltan se van a generar con IA**, tomando la foto real adjunta como referencia obligatoria.

Trabaja por etapas y **muéstrame cada una para aprobación antes de seguir**.

## El producto (lo único que se vende)

- **Megatobogán Arcoíris**: inflable rojo, amarillo, azul y verde, con tobogán, túneles y arcos.
- Edad: 3 a 12 años. Base: 7,5 × 7,5 m. Alto: 3,5 m. Espacio libre necesario: [8,5 × 8,5 m].
- Precio: **$[XX.XXX] por 4 horas**, con despacho, montaje, anclaje y retiro incluidos.
- Abono de $10.000 para reservar. Si llueve, se reprograma sin perder el abono.
- Montaje en 10 a 15 minutos. Necesita un enchufe a menos de 15 m. Consumo: menos de $2.000 por evento.
- Despacho: Valparaíso y Viña del Mar gratis · Concón, Quilpué y Villa Alemana +$5.000 · Limache y Olmué a
  convenir.

**La conversión es una sola: que el papá o la mamá abra WhatsApp con la comuna y la fecha ya escritas.** La
segunda es el formulario de contacto.

## Lo que hay que sacar o rehacer

| Sección actual           | Qué hacer                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Catálogo "Elige su juego" | Eliminar los filtros por edad y tipo y la columna "Más juegos". Pasa a ser la **ficha del producto**. |
| Combos                   | **Eliminar** (taca-taca, cama elástica y arcade no existen).                                          |
| Línea Pastel             | **Eliminar** (plaza blanda y piscina de pelotas no existen).                                          |
| Hero                     | Cambiar "Inflables desde…" y "Ver juegos y precios" por textos en singular sobre el Megatobogán.      |
| Colegios y empresas      | Mantener, pero hablando de un juego: capacidad de niños por turno, anclaje, factura.                  |
| Header y footer          | Quitar del menú los enlaces a secciones eliminadas.                                                   |

Ningún texto puede sugerir que hay más juegos: nada de "catálogo", "juegos", "combos" ni "elige".

## Nueva estructura de la landing

Diseña primero en **390 px**; después en **1440 px**.

1. **Header**: logo, sellos mini, botón WhatsApp.
2. **Hero**: titular de marca, bajada con el precio real y lo que incluye, CTA principal «Consultar disponibilidad
   por WhatsApp», CTA secundario «Ver medidas y precio», sellos de confianza e imagen principal.
3. **Barra de confianza**: Sanitizado · Anclado al piso · Puntual · ¿Llueve? Reprogramamos.
4. **Ficha del Megatobogán** (reemplaza al catálogo): galería de 4 a 6 imágenes, datos (edad, base, alto, espacio
   libre, enchufe, montaje), precio grande y botón de WhatsApp. Es la sección más importante después del hero.
5. **¿Cabe en mi patio?**: esquema simple con las medidas del juego y el espacio libre, visto desde arriba, y una
   imagen del juego en un patio de casa. Resuelve la duda que más frena la reserva.
6. **Cómo funciona**: los 4 pasos actuales con el chat de WhatsApp, cada uno con su imagen.
7. **Despacho por comuna**: el selector actual.
8. **Momentos**: franja de imágenes de ambiente (niños saltando, tobogán, montaje, limpieza).
9. **Reseñas** de Google.
10. **Colegios y empresas**.
11. **Preguntas frecuentes**.
12. **Contacto** con formulario y WhatsApp.
13. **Footer** y **barra fija inferior** en mobile.

## Espacio y ritmo (el problema a resolver)

La página actual se siente con mucho aire porque falta contenido, no porque falten adornos. Resuélvelo así:

- **No rellenes con decoración.** Cada espacio se ocupa con imagen del producto, un dato o una respuesta a una duda.
- En desktop, **Reseñas y Preguntas no pueden quedar en una columna angosta** al centro: usa dos o tres columnas,
  o acompaña el acordeón con una imagen o una tarjeta de contacto al lado.
- Alterna secciones de imagen a sangre con secciones de texto, y mantén un solo color dominante por sección.
- Ninguna sección debe verse vacía si falta un dato: diseña también el estado sin reseñas.

## Imágenes generadas con IA

Para cada espacio de imagen entrega la imagen generada o, si no puedes generarla, **el prompt listo para usar**,
con su proporción y su texto alternativo.

**Reglas de fidelidad (no se rompen):**

- Usa siempre la **foto real adjunta como referencia**. El juego debe ser **el mismo**: mismos colores, misma
  forma, tobogán, túneles y arcos, y un tamaño creíble para 7,5 × 7,5 m y 3,5 m de alto. Si una imagen muestra un
  inflable distinto, se descarta.
- **No inventes otros juegos ni accesorios** que Saltabum no arrienda (camas elásticas, taca-taca, piscinas).
- Escenarios **chilenos y creíbles**: patio de casa con pasto, cerro o costa de la Región de Valparaíso, patio de
  colegio, luz de día. Nada de mansiones ni parques temáticos.
- Niños de 3 a 12 años y adultos **que no se parezcan a ninguna persona real**. Manos, caras y proporciones sin
  errores.
- Estilo fotográfico natural, como tomado con un buen celular. Sin texto, logos ni marcas de agua dentro de la
  imagen.
- La etiqueta **«Foto real · nuestro juego» solo va sobre la foto real**. Las imágenes generadas llevan, a lo más,
  «Imagen referencial» en chico.
- La **foto real se mantiene** como imagen principal de la ficha del producto.

**Lista de imágenes a producir:**

| #   | Dónde            | Qué muestra                                                           | Proporción          |
| --- | ---------------- | --------------------------------------------------------------------- | ------------------- |
| 1   | Hero             | El juego instalado en un patio con pasto, niños saltando, día soleado | 4:5 y 16:9          |
| 2   | Ficha            | Vista frontal completa del juego, sin gente                           | 1:1                 |
| 3   | Ficha            | Detalle del tobogán con un niño bajando                               | 1:1                 |
| 4   | Ficha            | Detalle de los túneles y arcos                                        | 1:1                 |
| 5   | ¿Cabe en mi patio? | El juego en un patio de casa mediano, con la casa de fondo como escala | 3:2                 |
| 6   | Cómo funciona    | Dos personas del equipo montando y anclando el juego                  | 4:3                 |
| 7   | Cómo funciona    | Una persona limpiando y sanitizando la superficie del juego           | 4:3                 |
| 8   | Momentos         | Cumpleaños en el patio: mesa, globos y el juego al fondo              | 3:2                 |
| 9   | Colegios         | El juego en un patio de colegio con varios niños haciendo fila        | 3:2                 |
| 10  | Compartir        | Imagen para redes y buscadores                                        | 1200 × 630 px       |

**Video (opcional, uno solo):** un loop de 6 a 8 segundos del juego con niños saltando, para el hero en desktop.
Sin sonido, con imagen de portada, sin reproducción automática en mobile y respetando `prefers-reduced-motion`.
Si no aporta, déjalo fuera.

## Datos reales que no se inventan

Deja estos campos marcados con [ ] y **no los completes con valores de ejemplo**: precio, espacio libre, nota y
cantidad de reseñas de Google, número de cumpleaños realizados, capacidad de niños por turno y los textos de las
reseñas. Si no hay reseñas todavía, la sección muestra el estado vacío con un enlace a Google.

## Reglas que no se rompen

- **Accesibilidad**: los colores de marca nunca van como texto chico; para texto usa `noche`, `noche-suave`,
  `rojo-texto`, `azul-texto` y `morado-texto`. Contraste AA, foco visible y áreas táctiles de 44 px.
- **Formato**: precios `$40.000`, horas `10:00`, comunas con nombre completo; español de Chile, tuteo.
- **Rendimiento**: imágenes en WebP con carga diferida bajo el primer scroll, la del hero con prioridad, ningún
  carrusel automático y un peso total de imágenes en el primer scroll bajo 200 KB.
- **Implementación** (Astro + Tailwind v4, todo dentro de `src/design/`): no agregues lógica de tracking. Ya
  existen y se respetan:
  - los **botones de WhatsApp** usan el componente existente con su posición (`hero`, `ficha`, `sticky`…) o llevan
    `data-track="whatsapp"` y `data-track-placement`;
  - el **formulario** es `<form data-lead-form="contacto">` con los campos `nombre`, `telefono`, `email`, `mensaje`
    y extras (`extra.comuna`, `extra.fecha`), el campo oculto `website` y
    el mensaje de estado `data-lead-message`;
  - el enlace **«Configurar cookies»** del footer lleva `data-consent-open`.

## Entregables por etapa

1. **Etapa 1**: landing en mobile 390 px con la nueva estructura y los espacios de imagen marcados.
2. **Etapa 2**: landing en desktop 1440 px, con Reseñas y Preguntas resueltas a lo ancho.
3. **Etapa 3**: las 10 imágenes (o sus prompts), con proporción y texto alternativo.
4. **Etapa 4**: handoff por sección con componentes, tokens, textos definitivos y la lista de secciones y
   componentes que se eliminan del código (`Combos`, `LineaPastel`, filtros y "Más juegos" de `Catalogo`).

Empieza por la **Etapa 1: la landing en mobile 390 px**.

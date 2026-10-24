// Rutas, metas y contenido de las páginas SEO (pillar y cluster).
// Base: docs/seo/investigacion-palabras-clave.md. Títulos y subtítulos sin «.», «;» ni «:».
import { DESDE, DESDE_HORAS, HORA_EXTRA, PRODUCTO } from "./data";

export const RUTAS = {
  inicio: "/",
  inflables: "/inflables/",
  megatobogan: "/inflables/megatobogan-arcoiris/",
  cumpleanos: "/arriendo-juegos-inflables-cumpleanos/",
  precios: "/precios-arriendo-juegos-inflables/",
  eventos: "/arriendo-inflables-eventos-empresas/",
  preguntas: "/preguntas-frecuentes/",
  reservar: "/#reservar",
  /** Página a la que lleva el QR: el modelo 3D con el botón para verlo con la cámara del celular. */
  verEnTuEspacio: "/ver-en-tu-espacio/",
} as const;

export const NAV = [
  { href: RUTAS.inflables, label: "Inflables" },
  { href: RUTAS.cumpleanos, label: "Cumpleaños" },
  { href: RUTAS.eventos, label: "Empresas y eventos" },
  { href: RUTAS.precios, label: "Precios" },
  { href: RUTAS.reservar, label: "Reservar" },
  { href: RUTAS.preguntas, label: "Preguntas" },
];

export interface Pregunta {
  q: string;
  a: string;
}

export interface ComunaSeo {
  slug: string;
  nombre: string;
  /** Nombre corto para títulos (ej. «Limache y Olmué»). */
  titulo: string;
  despacho: string;
  despachoDetalle: string;
  sectores: string[];
  intro: string;
  patios: string;
  preguntas: Pregunta[];
  meta: { title: string; description: string };
}

const base = `${DESDE} por ${DESDE_HORAS}`;

export const COMUNAS_SEO: ComunaSeo[] = [
  {
    slug: "quilpue",
    nombre: "Quilpué",
    titulo: "Quilpué",
    despacho: "+$5.000",
    despachoDetalle: "Despacho a Quilpué por $5.000, con montaje, anclaje y retiro incluidos",
    sectores: ["El Belloto", "Paso Hondo", "Los Pinos", "Valencia", "Belloto Norte", "Centro de Quilpué"],
    intro:
      "Llevamos el Megatobogán Arcoíris a cumpleaños, colegios y eventos en todo Quilpué. Llegamos, lo montamos en 30 minutos, lo anclamos al piso y lo retiramos al terminar",
    patios:
      "Muchos patios de Quilpué tienen pasto y buen espacio, ideal para un inflable grande. Si el patio es de cemento, lo anclamos con sacos de lastre",
    preguntas: [
      { q: "¿Cuánto cuesta arrendar un juego inflable en Quilpué?", a: `El Megatobogán Arcoíris cuesta desde ${base}, más $5.000 de despacho a Quilpué. Montaje, anclaje y retiro están incluidos.` },
      { q: "¿Llegan a El Belloto y Paso Hondo?", a: "Sí, despachamos a todo Quilpué, incluidos El Belloto, Paso Hondo, Los Pinos y Valencia." },
      { q: "¿Puedo reservar para el mismo día en Quilpué?", a: "Las reservas se hacen desde el día siguiente, así coordinamos bien el despacho y el horario." },
    ],
    meta: {
      title: "Juegos inflables en Quilpué con despacho",
      description: `Arriendo de juegos inflables en Quilpué desde ${base}. Despacho a El Belloto, Paso Hondo y todo Quilpué con montaje, anclaje y retiro incluidos.`,
    },
  },
  {
    slug: "vina-del-mar",
    nombre: "Viña del Mar",
    titulo: "Viña del Mar",
    despacho: "Gratis",
    despachoDetalle: "Despacho gratis en Viña del Mar, con montaje, anclaje y retiro incluidos",
    sectores: ["Reñaca", "Jardín del Mar", "Forestal", "Miraflores", "Gómez Carreño", "Recreo", "Chorrillos", "Achupallas"],
    intro:
      "Arrienda el Megatobogán Arcoíris para tu cumpleaños o evento en Viña del Mar con despacho gratis. Llegamos antes de la hora, lo dejamos anclado y lo retiramos al terminar",
    patios:
      "En Viña del Mar hay patios de todos los tamaños, de Reñaca a Forestal. Revisa las medidas y prueba el inflable en tu patio con el modelo 3D antes de reservar",
    preguntas: [
      { q: "¿Cuánto cuesta el arriendo de juegos inflables en Viña del Mar?", a: `Desde ${base}, con despacho gratis en Viña del Mar. Cada hora adicional cuesta ${HORA_EXTRA}.` },
      { q: "¿Despachan a Reñaca y Jardín del Mar?", a: "Sí, el despacho es gratis en toda Viña del Mar, incluidos Reñaca, Jardín del Mar, Forestal, Miraflores, Gómez Carreño y Recreo." },
      { q: "¿Hay juegos inflables económicos en Viña del Mar?", a: `Nuestro precio parte en ${DESDE} por ${DESDE_HORAS} con todo incluido y sin costo de despacho en Viña del Mar.` },
    ],
    meta: {
      title: "Juegos inflables Viña del Mar · Despacho gratis",
      description: `Arriendo de juegos inflables en Viña del Mar desde ${base} con despacho gratis a Reñaca, Jardín del Mar y toda la comuna, montaje incluido.`,
    },
  },
  {
    slug: "valparaiso",
    nombre: "Valparaíso",
    titulo: "Valparaíso",
    despacho: "Gratis",
    despachoDetalle: "Despacho gratis en Valparaíso, nuestra base, con montaje, anclaje y retiro incluidos",
    sectores: ["Curauma", "Placilla", "Playa Ancha", "Cerro Alegre", "Rodelillo"],
    intro:
      "Valparaíso es nuestra base. Arrienda el Megatobogán Arcoíris con despacho gratis en Curauma, Placilla, Playa Ancha y los cerros, con montaje y anclaje seguro incluidos",
    patios:
      "En los cerros los espacios planos son más escasos. Por eso te pedimos una foto del lugar y revisamos contigo el acceso y el espacio libre antes de confirmar",
    preguntas: [
      { q: "¿Arriendan juegos inflables en Curauma y Placilla?", a: "Sí, despachamos gratis a Curauma, Placilla y todo Valparaíso." },
      { q: "¿Se puede instalar en un patio de cemento en los cerros?", a: "Sí, en piso duro anclamos el inflable con sacos de lastre. Mándanos una foto del lugar para revisar el espacio y el acceso." },
      { q: "¿Cuánto cuesta en Valparaíso?", a: `Desde ${base} con despacho gratis. Cada hora adicional cuesta ${HORA_EXTRA}.` },
    ],
    meta: {
      title: "Juegos inflables en Valparaíso y Curauma",
      description: `Arriendo de juegos inflables en Valparaíso desde ${base}. Despacho gratis a Curauma, Placilla y los cerros, con montaje, anclaje y retiro.`,
    },
  },
  {
    slug: "villa-alemana",
    nombre: "Villa Alemana",
    titulo: "Villa Alemana",
    despacho: "+$5.000",
    despachoDetalle: "Despacho a Villa Alemana por $5.000, con montaje, anclaje y retiro incluidos",
    sectores: ["Peñablanca", "Centro de Villa Alemana"],
    intro:
      "Arrienda el Megatobogán Arcoíris para cumpleaños y eventos en Villa Alemana. Lo llevamos, lo montamos en minutos y lo dejamos anclado para que los niños jueguen tranquilos",
    patios:
      "Los patios con pasto de Villa Alemana y Peñablanca son perfectos para un inflable grande. Revisa que tengas el espacio libre necesario",
    preguntas: [
      { q: "¿Cuánto vale arrendar un juego inflable en Villa Alemana?", a: `Desde ${base}, más $5.000 de despacho a Villa Alemana. Montaje, anclaje y retiro incluidos.` },
      { q: "¿Llegan a Peñablanca?", a: "Sí, despachamos a todo Villa Alemana, incluida Peñablanca." },
    ],
    meta: {
      title: "Juegos inflables en Villa Alemana · Arriendo",
      description: `Arriendo de juegos inflables en Villa Alemana y Peñablanca desde ${base}. Montaje, anclaje y retiro incluidos, reserva en línea.`,
    },
  },
  {
    slug: "concon",
    nombre: "Concón",
    titulo: "Concón",
    despacho: "+$5.000",
    despachoDetalle: "Despacho a Concón por $5.000, con montaje, anclaje y retiro incluidos",
    sectores: ["Costa de Montemar", "Bosques de Montemar", "Higuerillas", "Centro de Concón"],
    intro:
      "Llevamos el Megatobogán Arcoíris a cumpleaños y eventos en Concón, de Costa de Montemar a Higuerillas, con montaje, anclaje seguro y retiro incluidos",
    patios:
      "Cerca de la costa el viento puede subir en la tarde. Siempre anclamos el inflable y, si el viento se vuelve peligroso, lo desinflamos por seguridad",
    preguntas: [
      { q: "¿Arriendan inflables en Costa de Montemar?", a: "Sí, despachamos a todo Concón, incluidos Costa de Montemar, Bosques de Montemar e Higuerillas." },
      { q: "¿Qué pasa si hay mucho viento en Concón?", a: "El inflable siempre queda anclado. Si el viento supera un nivel seguro, lo desinflamos y retomamos cuando baje." },
      { q: "¿Cuánto cuesta en Concón?", a: `Desde ${base}, más $5.000 de despacho a Concón.` },
    ],
    meta: {
      title: "Juegos inflables en Concón · Arriendo con montaje",
      description: `Arriendo de juegos inflables en Concón desde ${base}. Despacho a Costa de Montemar y toda la comuna con anclaje seguro y retiro incluidos.`,
    },
  },
  {
    slug: "limache-olmue",
    nombre: "Limache y Olmué",
    titulo: "Limache y Olmué",
    despacho: "+$7.000",
    despachoDetalle: "Despacho a Limache y Olmué por $7.000",
    sectores: ["Limache", "San Francisco de Limache", "Limache Viejo", "Olmué", "Granizo"],
    intro:
      "También llevamos el Megatobogán Arcoíris a Limache y Olmué. Ideal para cumpleaños en parcelas y patios grandes, con montaje, anclaje y retiro incluidos",
    patios:
      "Las parcelas de Limache y Olmué suelen tener mucho espacio con pasto, perfecto para un inflable de 7,5 × 7,5 metros. Solo necesitas un enchufe a menos de 15 m",
    preguntas: [
      { q: "¿Cuánto cuesta el despacho a Limache u Olmué?", a: "El despacho a Limache y Olmué cuesta $7.000." },
      { q: "¿Se puede instalar en una parcela?", a: "Sí, en pasto lo anclamos con estacas. Solo necesitamos un enchufe a menos de 15 m." },
    ],
    meta: {
      title: "Juegos inflables en Limache y Olmué · Arriendo",
      description: `Arriendo de juegos inflables en Limache y Olmué desde ${base}. Ideal para parcelas, con montaje, anclaje y retiro incluidos.`,
    },
  },
];

/** Preguntas frecuentes completas (página /preguntas-frecuentes/). Respuestas directas, pensadas para buscadores e IA. */
export const PREGUNTAS_FRECUENTES: { tema: string; preguntas: Pregunta[] }[] = [
  {
    tema: "Precios y reservas",
    preguntas: [
      { q: "¿Qué precio tienen los juegos inflables en arriendo?", a: `En Saltabum el arriendo parte en ${DESDE} por ${DESDE_HORAS}, con montaje, anclaje y retiro incluidos. Cada hora adicional cuesta ${HORA_EXTRA}.` },
      { q: "¿Cuánto es el abono para reservar?", a: "Reservas la hora con un abono de $20.000, que se descuenta del total del arriendo. El saldo se paga el día del evento." },
      { q: "¿Cuánto cuesta el despacho?", a: "Es gratis en Valparaíso y Viña del Mar, cuesta $5.000 a Concón, Quilpué y Villa Alemana, $7.000 a Limache y Olmué, y $10.000 a Casablanca y Quintay." },
      { q: "¿Cómo reservo un juego inflable?", a: "Elige el día y el horario en el calendario de la web o escríbenos por WhatsApp. Te confirmamos y coordinamos el abono." },
      { q: "¿Puedo reservar para el mismo día?", a: "No, las reservas se hacen desde el día siguiente para coordinar bien el despacho y el montaje." },
      { q: "¿Emiten factura?", a: "Sí, emitimos factura para empresas, colegios, municipalidades, juntas de vecinos y particulares que la necesiten." },
    ],
  },
  {
    tema: "Seguridad, clima y montaje",
    preguntas: [
      { q: "¿Los juegos inflables se pueden volar con el viento?", a: "Un inflable bien anclado no se vuela. Siempre lo fijamos al piso con estacas en pasto o sacos de lastre en cemento, y si el viento sube a un nivel peligroso lo desinflamos." },
      { q: "¿Qué pasa si llueve?", a: "Reprogramamos a otra fecha disponible sin perder el abono. Avísanos apenas veas el pronóstico." },
      { q: "¿Cuánto demora el montaje?", a: "Unos 30 minutos. Llegamos antes de la hora de inicio." },
      { q: "¿Los juegos están limpios?", a: "Sí, limpiamos y sanitizamos el inflable antes de cada arriendo." },
      { q: "¿Se necesita un adulto supervisando?", a: "Sí, siempre debe haber un adulto a cargo mientras los niños juegan. Te explicamos las reglas de uso al montar." },
    ],
  },
  {
    tema: "Espacio, luz y edades",
    preguntas: [
      { q: "¿Cuánto espacio necesita el Megatobogán?", a: `Mide ${PRODUCTO.base} y ${PRODUCTO.alto} de alto. Necesita ${PRODUCTO.espacioLibre} libres, sin ramas ni techos encima.` },
      { q: "¿Cuánta luz consume un inflable?", a: "Menos de $2.000 por evento. Solo necesitamos un enchufe a menos de 15 m." },
      { q: "¿Para qué edades es el juego inflable?", a: `El Megatobogán Arcoíris es para niños de ${PRODUCTO.edad}.` },
      { q: "¿Se puede instalar en cemento o pasto?", a: "En ambos. En pasto usamos estacas y en piso duro sacos de lastre." },
    ],
  },
];

/** Preguntas propias de cada pillar (visibles en la página y en su schema FAQPage). */
export const PREGUNTAS_PAGINA: Record<"megatobogan" | "cumpleanos" | "precios" | "eventos", Pregunta[]> = {
  megatobogan: [
    { q: "¿Cuánto mide el Megatobogán Arcoíris?", a: `Mide ${PRODUCTO.base} de base y ${PRODUCTO.alto} de alto. Necesita ${PRODUCTO.espacioLibre} libres.` },
    { q: "¿Para qué edades es?", a: `Para niños de ${PRODUCTO.edad}.` },
    { q: "¿Cuánto cuesta arrendarlo?", a: `Desde ${DESDE} por ${DESDE_HORAS}. Cada hora adicional cuesta ${HORA_EXTRA}.` },
    { q: "¿Puedo ver si cabe en mi patio?", a: "Sí, con el modelo 3D de esta página puedes girarlo y, desde el celular, ponerlo en tu patio a tamaño real con la cámara." },
  ],
  cumpleanos: [
    { q: "¿Con cuánta anticipación conviene reservar para un cumpleaños?", a: "Lo ideal es reservar 2 a 4 semanas antes, sobre todo para fines de semana. Puedes reservar desde el día siguiente si hay horario libre." },
    { q: "¿Cuántas horas dura el arriendo?", a: `El bloque base es de ${DESDE_HORAS} y puedes sumar horas adicionales por ${HORA_EXTRA} cada una.` },
    { q: "¿Qué pasa si llueve el día del cumpleaños?", a: "Reprogramamos a otra fecha disponible sin perder el abono." },
    { q: "¿Necesito estar presente durante el montaje?", a: "Sí, un adulto debe recibirnos, indicar dónde va el inflable y el enchufe, y supervisar a los niños mientras juegan." },
  ],
  precios: [
    { q: "¿Cuánto cuesta arrendar un juego inflable?", a: `Desde ${DESDE} por ${DESDE_HORAS} con montaje, anclaje y retiro incluidos.` },
    { q: "¿Cuánto vale la hora adicional?", a: `Cada hora adicional cuesta ${HORA_EXTRA}.` },
    { q: "¿El despacho tiene costo?", a: "Es gratis en Valparaíso y Viña del Mar, cuesta $5.000 a Concón, Quilpué y Villa Alemana, $7.000 a Limache y Olmué, y $10.000 a Casablanca y Quintay." },
    { q: "¿Hay costos ocultos?", a: "No, el precio incluye montaje, anclaje y retiro. Solo pones el enchufe, que consume menos de $2.000 por evento." },
  ],
  eventos: [
    { q: "¿Emiten factura y aceptan orden de compra?", a: "Sí, emitimos factura y trabajamos con orden de compra para empresas, colegios y municipalidades." },
    { q: "¿Pueden ir a eventos en canchas deportivas?", a: "Sí, instalamos el inflable en canchas de fútbol, tenis o pádel y en plazas, con anclaje según el tipo de piso." },
    { q: "¿Cuántos niños pueden jugar a la vez?", a: "Organizamos turnos según la edad de los niños para que el juego sea seguro y todos alcancen a saltar." },
    { q: "¿Pueden arrendar por más horas para un evento largo?", a: `Sí, el bloque base es de ${DESDE_HORAS} y cada hora adicional cuesta ${HORA_EXTRA}.` },
  ],
};

/** Meta título (≤ 60) y descripción (≤ 160) de cada página. */
export const METAS = {
  inflables: {
    title: "Arriendo de juegos inflables en la V Región",
    description: `Catálogo de juegos inflables en arriendo para cumpleaños y eventos en la Región de Valparaíso desde ${DESDE} por ${DESDE_HORAS}, con montaje y retiro.`,
  },
  megatobogan: {
    title: "Arriendo tobogán inflable · Megatobogán Arcoíris",
    description: `Arriendo del Megatobogán Arcoíris, tobogán inflable de ${PRODUCTO.base} para niños de ${PRODUCTO.edad}. Desde ${DESDE} por ${DESDE_HORAS}, míralo en 3D.`,
  },
  cumpleanos: {
    title: "Arriendo de juegos inflables para cumpleaños",
    description: `Arriendo de juegos para cumpleaños en Viña del Mar, Valparaíso y la V Región desde ${DESDE} por ${DESDE_HORAS}. Montaje, anclaje y retiro incluidos.`,
  },
  precios: {
    title: "Precios de arriendo de juegos inflables",
    description: `Valor del arriendo de juegos inflables desde ${DESDE} por ${DESDE_HORAS}, hora adicional ${HORA_EXTRA} y despacho por comuna en la V Región. Sin letra chica.`,
  },
  eventos: {
    title: "Juegos inflables para eventos y empresas",
    description: "Arriendo de juegos inflables para empresas, colegios, municipios, juntas de vecinos y canchas en la V Región, con factura y orden de compra.",
  },
  preguntas: {
    title: "Preguntas frecuentes de arriendo de inflables",
    description: "Precios, reservas, seguridad con viento y lluvia, espacio, luz y edades, respuestas claras sobre el arriendo de juegos inflables en la V Región.",
  },
};

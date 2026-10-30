// Catálogo de inflables con su ficha técnica (datos de las fichas en PDF de cada juego).
// Cada inflable tiene su página en /inflables/<slug>/ y su tarjeta en /inflables/. El `id` es el mismo de la agenda.
import type { ImageMetadata } from "astro";
import megaFrente from "./assets/megatobogan-real-frente.jpg";
import megaTobogan from "./assets/megatobogan-real-tobogan.jpg";
import megaTrasera from "./assets/megatobogan-real-trasera.jpg";
import megaCostado from "./assets/megatobogan-real-costado.jpg";
import pirataFrente from "./assets/castillo-pirata-frente.jpg";
import pirataInterior from "./assets/castillo-pirata-interior.jpg";
import pirataTobogan from "./assets/castillo-pirata-tobogan.jpg";
import pirataTrasera from "./assets/castillo-pirata-trasera.jpg";
import f1Frente from "./assets/castillo-formula-1-frente.jpg";
import f1Interior from "./assets/castillo-formula-1-interior.jpg";
import f1Tobogan from "./assets/castillo-formula-1-tobogan.jpg";
import f1Volante from "./assets/castillo-formula-1-volante.jpg";
import { DESDE_HORAS, HORA_EXTRA, MODELO_3D, PRECIO_NORMAL, PRODUCTO } from "./data";
import { METAS, PREGUNTAS_PAGINA, RUTAS, type Pregunta } from "./seo";

/** Solo fotos reales del juego (fotos y capturas de nuestros videos). `pos` elige qué parte se ve en un marco horizontal. */
export type Foto = { src: ImageMetadata; alt: string; pos?: string };

export type Inflable = {
  id: "megatobogan" | "castillo-pirata" | "castillo-formula-1";
  ruta: string;
  nombre: string;
  /** Nombre corto para botones y filtros. */
  corto: string;
  /** Ícono del filtro rápido (galería y carrusel del inicio). */
  icono: "tobogan" | "pirata" | "carrera";
  /** Tipo corto para etiquetas y tarjetas. */
  tipo: string;
  /** Categoría tal como sale en la ficha técnica. */
  categoria: string;
  /** Título de la página, con la palabra clave. `destacado` va en amarillo. */
  titulo: string;
  destacado: string;
  /** Una línea que describe el juego (sin punto final). */
  resumen: string;
  medidas: { largo: number; ancho: number; alto: number };
  /** Metros libres que pide por cada lado. */
  seguridad: number;
  capacidad: number;
  edad: { desde: number; hasta: number };
  caracteristicas: string[];
  superficies: string[];
  /** Precio del bloque base en pesos. */
  precio: number;
  precioNormal?: number;
  /** Ficha técnica original para descargar. */
  pdf?: string;
  /** Modelo 3D a escala real (scripts/generar-modelo-3d.mjs y generar-modelo-castillos.mjs). /modelos se guarda 7 días en caché: al cambiarlo, súbele la versión. */
  modelo: string;
  /** Ángulo inicial del visor 3D (camera-orbit de model-viewer). */
  camara?: string;
  fotos: Foto[];
  meta: { title: string; description: string };
  preguntas: Pregunta[];
};

const SUPERFICIES = ["Pasto", "Cemento", "Piso interior"];

/** Normas de uso, iguales para todos los juegos. */
export const NORMAS = [
  "No comer ni beber dentro del juego.",
  "No entrar con zapatos.",
  "Mantenerlo lejos de asados, fogatas u otras fuentes de calor.",
  "Respetar la edad recomendada.",
  "No pasar la capacidad máxima.",
  "Siempre con un adulto responsable mirando.",
];

export const metros = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });
export const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;
export const medidas = (i: Inflable) => `${metros(i.medidas.largo)} × ${metros(i.medidas.ancho)} × ${metros(i.medidas.alto)} m`;
export const base = (i: Inflable) => `${metros(i.medidas.largo)} × ${metros(i.medidas.ancho)} m`;
/** Superficie total que necesita, con el área de seguridad por lado. */
export const espacio = (i: Inflable) => ({ largo: i.medidas.largo + 2 * i.seguridad, ancho: i.medidas.ancho + 2 * i.seguridad });
export const espacioTexto = (i: Inflable) => {
  const e = espacio(i);
  return `${metros(e.largo)} × ${metros(e.ancho)} m`;
};
export const edadTexto = (i: Inflable) => `${i.edad.desde} a ${i.edad.hasta} años`;

/** Parte final de la ruta del inflable («castillo-pirata»), la misma en su página de realidad aumentada. */
export const slug = (i: Inflable) => i.ruta.split("/").filter(Boolean).pop()!;
/** Página para el celular con el modelo 3D y el botón para verlo con la cámara, a donde lleva el QR del inflable. */
export const verEnTuEspacio = (i: Inflable) => `${RUTAS.verEnTuEspacio}${slug(i)}/`;
export const CAMARA = "30deg 74deg 100%";
// Los castillos se ven mejor desde el lado de la entrada, con la cara del personaje y las manos.
const CAMARA_CASTILLO = "55deg 74deg 100%";

const castilloPreguntas = (nombre: string, i: Omit<Inflable, "preguntas">): Pregunta[] => [
  {
    q: `¿Cuánto mide el ${nombre}?`,
    a: `Mide ${metros(i.medidas.largo)} m de largo, ${metros(i.medidas.ancho)} m de ancho y ${metros(i.medidas.alto)} m de alto. Con el metro de seguridad por lado necesita ${espacioTexto(i as Inflable)} libres.`,
  },
  { q: "¿Cuántos niños pueden jugar a la vez?", a: `Hasta ${i.capacidad} niños, de ${i.edad.desde} a ${i.edad.hasta} años.` },
  { q: "¿Cuánto cuesta arrendarlo?", a: `${pesos(i.precio)} por ${DESDE_HORAS}, con despacho, montaje y retiro. Cada hora adicional cuesta ${HORA_EXTRA}.` },
  { q: "¿Se puede armar dentro de un salón?", a: `Sí, va en pasto, cemento o piso interior. Como mide ${metros(i.medidas.alto)} m de alto, el techo tiene que ser más alto que eso.` },
];

const pirata: Omit<Inflable, "preguntas"> = {
  id: "castillo-pirata",
  ruta: RUTAS.castilloPirata,
  icono: "pirata",
  modelo: "/modelos/castillo-pirata-v2.glb",
  camara: CAMARA_CASTILLO,
  nombre: "Castillo Pirata",
  corto: "Pirata",
  tipo: "Castillo temático",
  categoria: "Juego inflable tipo castillo",
  titulo: "Arriendo del Castillo Pirata, castillo inflable con tobogán",
  destacado: "Castillo Pirata",
  resumen: "Con el capitán pirata mirando desde arriba, tobogán, zona de salto y obstáculos",
  medidas: { largo: 6, ancho: 4, alto: 5 },
  seguridad: 1,
  capacidad: 10,
  edad: { desde: 4, hasta: 10 },
  caracteristicas: ["Tobogán inflable", "Zona de salto", "Obstáculos inflables"],
  superficies: SUPERFICIES,
  precio: 49990,
  pdf: "/fichas/ficha-tecnica-castillo-pirata.pdf",
  fotos: [
    { src: pirataFrente, alt: "Castillo Pirata armado en la calle, con el capitán, el garfio, el aro de básquetbol y la malla" },
    { src: pirataInterior, alt: "Interior del Castillo Pirata con el capitán asomado, la zona de salto y los obstáculos", pos: "50% 52%" },
    { src: pirataTobogan, alt: "Tobogán amarillo del Castillo Pirata con sus bordes a rayas", pos: "50% 55%" },
    { src: pirataTrasera, alt: "Castillo Pirata visto de lado, con las botas, el garfio y la malla de protección", pos: "50% 52%" },
  ],
  meta: {
    title: "Arriendo castillo inflable Pirata · Saltabum",
    description: "Castillo inflable Pirata con tobogán y obstáculos para 10 niños de 4 a 10 años. $49.990 por 3 horas con despacho, montaje y retiro en la V Región.",
  },
};

const formula1: Omit<Inflable, "preguntas"> = {
  id: "castillo-formula-1",
  ruta: RUTAS.castilloFormula1,
  icono: "carrera",
  modelo: "/modelos/castillo-formula-1-v2.glb",
  camara: CAMARA_CASTILLO,
  nombre: "Castillo Fórmula 1",
  corto: "Fórmula 1",
  tipo: "Castillo temático",
  categoria: "Juego inflable tipo castillo",
  titulo: "Arriendo del Castillo Fórmula 1, castillo inflable de auto de carrera",
  destacado: "Castillo Fórmula 1",
  resumen: "Un auto de carrera con piloto, volante gigante, tobogán, zona de salto y obstáculos",
  medidas: { largo: 6, ancho: 4, alto: 5 },
  seguridad: 1,
  capacidad: 10,
  edad: { desde: 4, hasta: 10 },
  caracteristicas: ["Tobogán inflable", "Zona de salto", "Obstáculos inflables"],
  superficies: SUPERFICIES,
  precio: 49990,
  pdf: "/fichas/ficha-tecnica-castillo-formula-1.pdf",
  fotos: [
    { src: f1Frente, alt: "Castillo Fórmula 1 armado en la calle, con el piloto de casco azul, el volante gigante y las ruedas" },
    { src: f1Volante, alt: "Frente del Castillo Fórmula 1 con las manos del piloto sobre el volante y la entrada con malla", pos: "50% 40%" },
    { src: f1Interior, alt: "Interior del Castillo Fórmula 1 con la zona de salto verde y los obstáculos", pos: "50% 60%" },
    { src: f1Tobogan, alt: "Salida del tobogán amarillo del Castillo Fórmula 1", pos: "50% 62%" },
  ],
  meta: {
    title: "Arriendo castillo inflable Fórmula 1 · Saltabum",
    description: "Castillo inflable Fórmula 1, un auto de carrera con tobogán para 10 niños de 4 a 10 años. $49.990 por 3 horas con despacho, montaje y retiro en la V Región.",
  },
};

export const INFLABLES: Inflable[] = [
  {
    id: "megatobogan",
    ruta: RUTAS.megatobogan,
    icono: "tobogan",
    modelo: MODELO_3D,
    nombre: PRODUCTO.nombre,
    corto: "Megatobogán",
    tipo: "Tobogán inflable",
    categoria: "Juego inflable tipo tobogán",
    titulo: `Arriendo del ${PRODUCTO.nombre}, tobogán inflable grande`,
    destacado: PRODUCTO.nombre,
    resumen: "Tobogán doble con zona de salto, escalada, obstáculos y túneles",
    medidas: { largo: 7.5, ancho: 7.5, alto: 3.5 },
    seguridad: 1,
    capacidad: 12,
    edad: { desde: 3, hasta: 12 },
    caracteristicas: ["Tobogán inflable", "Zona de salto", "Área de escalada", "Obstáculos inflables", "Túneles de paso"],
    superficies: SUPERFICIES,
    precio: Number(PRODUCTO.precio.replace(/\D/g, "")),
    precioNormal: Number(PRECIO_NORMAL.replace(/\D/g, "")),
    pdf: "/fichas/ficha-tecnica-megatobogan-arcoiris.pdf",
    fotos: [
      { src: megaFrente, alt: `${PRODUCTO.nombre} de frente, con la pista del tobogán, el arco verde y los túneles`, pos: "50% 30%" },
      { src: megaTobogan, alt: `Costado del ${PRODUCTO.nombre} con las dos pistas de tobogán y el túnel redondo`, pos: "50% 40%" },
      { src: megaTrasera, alt: `Parte trasera del ${PRODUCTO.nombre} con la entrada para trepar`, pos: "50% 48%" },
      { src: megaCostado, alt: `${PRODUCTO.nombre} armado en la calle, visto de lado con su soplador`, pos: "50% 47%" },
    ],
    meta: METAS.megatobogan,
    preguntas: PREGUNTAS_PAGINA.megatobogan,
  },
  { ...pirata, preguntas: castilloPreguntas(pirata.nombre, pirata) },
  { ...formula1, preguntas: castilloPreguntas(formula1.nombre, formula1) },
];

export const inflable = (id: Inflable["id"]) => INFLABLES.find((i) => i.id === id)!;

// Contenido de la landing. Lo que va entre [ ] está por confirmar con Saltabum.

export const PRODUCTO = {
  nombre: "Megatobogán Arcoíris", // provisional
  edad: "3 a 12 años",
  base: "7,5 × 7,5 m",
  alto: "3,5 m",
  espacioLibre: "8,5 × 8,5 m",
  precio: "$69.990",
};

// Precio base de los inflables y su bloque de horas. Hoy rige la promoción ($69.990) sobre el precio normal.
export const DESDE = "$69.990";
/** Precio normal por el mismo bloque, se muestra tachado junto a la promoción. */
export const PRECIO_NORMAL = "$100.000";
export const DESDE_HORAS = "3 horas";
/** Valor de cada hora adicional sobre el bloque base. */
export const HORA_EXTRA = "$10.000";
/** Modelo 3D a escala real (scripts/generar-modelo-3d.mjs). Al cambiarlo, súbele la versión al nombre: /modelos se guarda 7 días en caché. */
/** Juegos que se pueden reservar en la agenda (precio del bloque base en pesos). El Megatobogán es el primero de varios. */
export const PRODUCTOS = [{ id: "megatobogan", nombre: PRODUCTO.nombre, precio: Number(DESDE.replace(/\D/g, "")) }] as const;
/** Abono para reservar, en pesos. */
export const ABONO = 10000;

export const MODELO_3D = "/modelos/megatobogan-v7.glb";

export type Comuna = {
  nombre: string;
  zonas: string;
  precio: string;
  titulo: string;
  tono: "gratis" | "pago" | "convenir";
  /** Valor del despacho en pesos (lo usa la agenda para calcular el total). */
  despacho: number;
};

// Ordenadas por la costa, de norte a sur y hacia el interior.
export const COMUNAS: Comuna[] = [
  { nombre: "Concón", zonas: "Costa de Montemar e Higuerillas", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago", despacho: 5000 },
  { nombre: "Viña del Mar", zonas: "Reñaca, Jardín del Mar, Forestal", precio: "Gratis", titulo: "Despacho gratis", tono: "gratis", despacho: 0 },
  { nombre: "Valparaíso", zonas: "Nuestra base, Curauma y Placilla", precio: "Gratis", titulo: "Despacho gratis", tono: "gratis", despacho: 0 },
  { nombre: "Quilpué", zonas: "Todo Quilpué", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago", despacho: 5000 },
  { nombre: "Villa Alemana", zonas: "Toda Villa Alemana", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago", despacho: 5000 },
  { nombre: "Limache / Olmué", zonas: "Todo Limache y Olmué", precio: "+$7.000", titulo: "+$7.000 de despacho", tono: "pago", despacho: 7000 },
];

export const TONO_BG: Record<Comuna["tono"], string> = {
  gratis: "bg-verde",
  pago: "bg-sol",
  convenir: "bg-celeste",
};

export function mensajeWhatsapp(juego: string, comuna?: string, fecha?: string): string {
  const donde = comuna ? ` para ${comuna}` : "";
  const cuando = fecha ? ` ${fecha}` : "";
  return `Hola, quiero consultar la disponibilidad del ${juego}${donde}${cuando}. Vengo de saltabum.cl`;
}

export const CHAT = [
  {
    paso: 1,
    yo: true,
    titulo: "Nos escribes con tu comuna y fecha",
    texto: mensajeWhatsapp(PRODUCTO.nombre, "Concón", "el sábado 14"),
    hora: "19:42",
  },
  {
    paso: 2,
    yo: false,
    titulo: "Reservas con $10.000",
    texto:
      "¡Hola! Sí, el sábado 14 lo tenemos libre. Despacho a Concón +$5.000, montaje y retiro incluidos. ¿Te lo reservo con $10.000 de abono?",
    hora: "19:44",
  },
  {
    paso: 3,
    yo: false,
    titulo: "Llegamos, montamos y anclamos",
    texto:
      "Vamos en camino. Llegamos entre 10:00 y 10:15. Necesitamos un enchufe a menos de 15 m y el patio despejado.",
    hora: "Sáb 09:40",
  },
  {
    paso: 4,
    yo: false,
    titulo: "3 horas de saltos y retiramos",
    texto: "Pasamos a retirar a las 14:15. ¡Gracias por saltar con nosotros!",
    hora: "Sáb 13:50",
  },
];

export const FAQS = [
  {
    q: "¿Qué pasa si llueve?",
    a: "Reprogramamos a otra fecha disponible sin perder el abono. Avísanos apenas veas el pronóstico.",
  },
  { q: "¿Cuánto es el abono?", a: "$10.000 para reservar la fecha. El resto se paga el día del evento." },
  { q: "¿Cuánta luz consume?", a: "Menos de $2.000 por evento. Necesitamos un enchufe a menos de 15 m." },
  {
    q: "¿Cuánto espacio necesito?",
    a: `El ${PRODUCTO.nombre} mide ${PRODUCTO.base} y ${PRODUCTO.alto} de alto; necesita ${PRODUCTO.espacioLibre} libres.`,
  },
  {
    q: "¿Cómo se ancla?",
    a: "[Estacas en pasto o sacos de lastre en piso duro]. Nunca dejamos el juego sin anclar.",
  },
  { q: "¿Cuánto demora el montaje?", a: "Unos 30 minutos. Llegamos antes de la hora de inicio." },
  { q: "¿Emiten factura?", a: "Sí, para municipalidades, juntas de vecinos, colegios, empresas y particulares." },
];

export const RESENAS = [
  { nombre: "[Nombre]", comuna: "Concón", texto: "[Reseña real de Google sobre puntualidad y limpieza.]" },
  { nombre: "[Nombre]", comuna: "Quilpué", texto: "[Reseña real de Google sobre el montaje y los niños.]" },
  {
    nombre: "[Nombre]",
    comuna: "Viña del Mar",
    texto: "[Reseña real de Google sobre la reprogramación por lluvia.]",
  },
];

export const OTROS_JUEGOS = [
  { nombre: "[Castillo saltarín]", meta: "[2–8] años · [4 × 4 m]", precio: "desde $40.000", foto: "castillo en patio" },
  { nombre: "[Acuático]", meta: "[5–12] años · [8 × 3 m]", precio: "desde $[XX.XXX]", foto: "acuático en uso" },
  { nombre: "[Cama elástica]", meta: "[4–12] años · [3 m]", precio: "desde $[XX.XXX]", foto: "cama elástica" },
];

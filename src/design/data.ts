// Contenido de la landing. Lo que va entre [ ] está por confirmar con Saltabum.

export const PRODUCTO = {
  nombre: "Megatobogán Arcoíris", // provisional
  edad: "3 a 12 años",
  base: "7,5 × 7,5 m",
  alto: "3,5 m",
  espacioLibre: "[8,5 × 8,5 m]",
  precio: "$[XX.XXX]",
};

// Precio base de los inflables (bloque de 4 horas).
export const DESDE = "$40.000";

export type Comuna = {
  nombre: string;
  zonas: string;
  precio: string;
  titulo: string;
  tono: "gratis" | "pago" | "convenir";
};

// Ordenadas por la costa, de norte a sur y hacia el interior.
export const COMUNAS: Comuna[] = [
  { nombre: "Concón", zonas: "Reñaca y Costa de Montemar", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago" },
  { nombre: "Viña del Mar", zonas: "Centro, Jardín del Mar, Forestal", precio: "Gratis", titulo: "Despacho gratis", tono: "gratis" },
  { nombre: "Valparaíso", zonas: "Nuestra base, Curauma y Placilla", precio: "Gratis", titulo: "Despacho gratis", tono: "gratis" },
  { nombre: "Quilpué", zonas: "Todo Quilpué", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago" },
  { nombre: "Villa Alemana", zonas: "Toda Villa Alemana", precio: "+$5.000", titulo: "+$5.000 de despacho", tono: "pago" },
  { nombre: "Limache / Olmué", zonas: "Te lo cotizamos al tiro", precio: "A convenir", titulo: "Despacho a convenir", tono: "convenir" },
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
    titulo: "4 horas de saltos y retiramos",
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
  { q: "¿Cuánto demora el montaje?", a: "Entre 10 y 15 minutos. Llegamos antes de la hora de inicio." },
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

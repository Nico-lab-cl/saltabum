// Datos generales del sitio. Edita aquí textos globales y SEO por defecto.
export const SITE = {
  name: "Saltabum",
  url: "https://saltabum.cl",
  locale: "es_CL",
  lang: "es-CL",
  defaultTitle: "Saltabum · Arriendo de juegos inflables en Valparaíso",
  defaultDescription:
    "Arriendo de juegos inflables en la Región de Valparaíso desde $40.000 por 3 horas, con montaje, anclaje y retiro. Cumpleaños, empresas, colegios y municipios.",
  defaultOgImage: "/og-default.jpg",
  // Mensaje prellenado al abrir WhatsApp desde el sitio
  whatsappDefaultMessage: "¡Hola Saltabum! Quiero más información.",
  // Datos del responsable para la política de privacidad (Ley 19.628 / Ley 21.719)
  legal: {
    razonSocial: "TODO: Razón social",
    rut: "TODO: RUT",
    direccion: "TODO: Dirección",
    emailPrivacidad: "TODO: privacidad@saltabum.cl",
  },
} as const;

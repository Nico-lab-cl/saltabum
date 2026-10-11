// Datos generales del sitio. Edita aquí textos globales y SEO por defecto.
export const SITE = {
  name: "Saltabum",
  url: "https://saltabum.cl",
  locale: "es_CL",
  lang: "es-CL",
  defaultTitle: "Saltabum",
  defaultDescription: "TODO: descripción de Saltabum para buscadores (150-160 caracteres).",
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

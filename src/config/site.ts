// Datos generales del sitio. Edita aquí textos globales y SEO por defecto.
export const SITE = {
  name: "Saltabum",
  legalName: "Saltabum y Entretenciones",
  businessDescription:
    "Arriendo de juegos inflables para cumpleaños, empresas, colegios, municipios y eventos deportivos en la Región de Valparaíso, con despacho, montaje y retiro incluidos.",
  comunas: ["Valparaíso", "Viña del Mar", "Concón", "Quilpué", "Villa Alemana", "Limache", "Olmué"],
  url: "https://saltabum.cl",
  locale: "es_CL",
  email: "contacto@saltabum.cl",
  telefono: "+56 9 6344 4133",
  telefonoE164: "+56963444133",
  // Perfiles en redes (footer y sameAs del JSON-LD)
  redes: [
    { nombre: "Instagram", url: "https://www.instagram.com/saltabum/" },
    { nombre: "Facebook", url: "https://www.facebook.com/people/Saltabum/61595570129262/" },
    { nombre: "TikTok", url: "https://www.tiktok.com/@saltabum" },
  ],
  lang: "es-CL",
  defaultTitle: "Saltabum · Arriendo de juegos inflables en Valparaíso",
  defaultDescription:
    "Arriendo de juegos inflables en la Región de Valparaíso desde $49.990 por 3 horas, con despacho, montaje y retiro. Cumpleaños, empresas, colegios y municipios.",
  defaultOgImage: "/og-saltabum-v2.jpg",
  defaultOgImageAlt: "Saltabum y Entretenciones, arriendo de juegos inflables en la Región de Valparaíso desde $69.990",
  // Mensaje prellenado al abrir WhatsApp desde el sitio
  whatsappDefaultMessage: "¡Hola Saltabum! Quiero más información.",
  // Datos del responsable para la política de privacidad (Ley 19.628 / Ley 21.719)
  legal: {
    razonSocial: "TODO: Razón social",
    rut: "TODO: RUT",
    direccion: "TODO: Dirección",
    emailPrivacidad: "contacto@saltabum.cl",
  },
} as const;

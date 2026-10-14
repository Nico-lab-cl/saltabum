// Nodos schema.org reutilizables para las páginas (se pasan a BaseLayout como `jsonLd`).
import { SITE } from "@/config/site";

const abs = (ruta: string) => new URL(ruta, SITE.url).href;

export function migasJsonLd(migas: { nombre: string; href: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: migas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      item: abs(m.href),
    })),
  };
}

/** FAQPage con las preguntas visibles de la página. Las respuestas con datos pendientes ([…]) se omiten. */
export function preguntasJsonLd(ruta: string, preguntas: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${abs(ruta)}#preguntas`,
    mainEntity: preguntas
      .filter((p) => !p.a.includes("["))
      .map((p) => ({ "@type": "Question", name: p.q, acceptedAnswer: { "@type": "Answer", text: p.a } })),
  };
}

export function servicioJsonLd(opts: {
  ruta: string;
  nombre: string;
  descripcion: string;
  precio: number;
  zonas?: string[];
}) {
  return {
    "@type": "Service",
    "@id": `${abs(opts.ruta)}#servicio`,
    name: opts.nombre,
    serviceType: "Arriendo de juegos inflables para eventos",
    description: opts.descripcion,
    provider: { "@id": `${SITE.url}/#negocio` },
    areaServed: (opts.zonas ?? SITE.comunas).map((name) => ({ "@type": "City", name })),
    offers: { "@type": "Offer", priceCurrency: "CLP", price: opts.precio, availability: "https://schema.org/InStock" },
  };
}

export function productoJsonLd(opts: {
  ruta: string;
  nombre: string;
  descripcion: string;
  imagenes: string[];
  precio: number;
}) {
  return {
    "@type": "Product",
    "@id": `${abs(opts.ruta)}#producto`,
    name: opts.nombre,
    description: opts.descripcion,
    image: opts.imagenes.map(abs),
    brand: { "@type": "Brand", name: SITE.name },
    category: "Arriendo de juegos inflables",
    offers: {
      "@type": "Offer",
      url: abs(opts.ruta),
      priceCurrency: "CLP",
      price: opts.precio,
      availability: "https://schema.org/InStock",
      businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
      seller: { "@id": `${SITE.url}/#negocio` },
    },
  };
}

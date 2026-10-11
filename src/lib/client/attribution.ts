// Guarda UTMs y click IDs (gclid, fbclid, msclkid...) de la primera página de la visita
// para adjuntarlos al lead aunque el usuario navegue antes de convertir.

const KEY = "sb_attribution";
const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
] as const;

export type Attribution = Partial<Record<(typeof PARAMS)[number], string>> & {
  landing_page?: string;
  referrer?: string;
};

export function captureAttribution(): void {
  try {
    const url = new URL(location.href);
    const found: Attribution = {};
    for (const p of PARAMS) {
      const v = url.searchParams.get(p);
      if (v) found[p] = v.slice(0, 500);
    }
    // Solo sobrescribe si llega con parámetros de campaña nuevos (last-click)
    if (Object.keys(found).length > 0 || !sessionStorage.getItem(KEY)) {
      found.landing_page = location.href.slice(0, 1000);
      found.referrer = document.referrer.slice(0, 1000) || undefined;
      sessionStorage.setItem(KEY, JSON.stringify(found));
    }
  } catch {
    /* sin storage: se omite la atribución */
  }
}

export function getAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

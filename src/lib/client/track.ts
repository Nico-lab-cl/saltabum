// Disparo unificado de conversiones a Meta Pixel, Google Ads, GA4 y Clarity.
import {
  PUBLIC_GOOGLE_ADS_ID,
  PUBLIC_GOOGLE_ADS_LEAD_LABEL,
  PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL,
} from "astro:env/client";
import { getAttribution } from "./attribution";
import { hasMarketingConsent } from "./consent";

export type ConversionType = "lead" | "whatsapp";

interface TrackOptions {
  /** Mismo ID que se envía a la Conversions API para que Meta deduplique. */
  eventId?: string;
  /** Datos para Enhanced Conversions de Google Ads (se hashean en el navegador por gtag). */
  userData?: { email?: string; phone_number?: string };
  /** Datos extra del evento (ej. { form: "contacto" }). */
  params?: Record<string, string | number>;
}

const META_EVENT: Record<ConversionType, string> = { lead: "Lead", whatsapp: "Contact" };
const GA4_EVENT: Record<ConversionType, string> = { lead: "generate_lead", whatsapp: "whatsapp_click" };
const ADS_LABEL: Record<ConversionType, string | undefined> = {
  lead: PUBLIC_GOOGLE_ADS_LEAD_LABEL,
  whatsapp: PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL,
};

export function newEventId(): string {
  return crypto.randomUUID();
}

export function trackConversion(type: ConversionType, opts: TrackOptions = {}): string {
  const eventId = opts.eventId ?? newEventId();
  const params = opts.params ?? {};

  // Meta Pixel
  window.fbq?.("track", META_EVENT[type], params, { eventID: eventId });

  // Meta Conversions API para WhatsApp (los leads ya los reporta su propio endpoint).
  // sendBeacon sobrevive a que el clic abra WhatsApp y la página se descargue.
  if (type === "whatsapp" && hasMarketingConsent()) {
    const body = JSON.stringify({
      event_name: "Contact",
      event_id: eventId,
      page_url: location.href.slice(0, 1000),
      placement: typeof params.placement === "string" ? params.placement.slice(0, 60) : undefined,
      fbclid: getAttribution().fbclid,
    });
    navigator.sendBeacon?.("/api/evento", new Blob([body], { type: "application/json" }));
  }

  // Google Ads + GA4
  if (window.gtag) {
    if (opts.userData) window.gtag("set", "user_data", opts.userData);
    const label = ADS_LABEL[type];
    if (PUBLIC_GOOGLE_ADS_ID && label) {
      window.gtag("event", "conversion", {
        send_to: `${PUBLIC_GOOGLE_ADS_ID}/${label}`,
        transaction_id: eventId,
      });
    }
    window.gtag("event", GA4_EVENT[type], { ...params, event_id: eventId });
  }

  // Microsoft Clarity: etiqueta la sesión para filtrar grabaciones que convirtieron
  window.clarity?.("event", GA4_EVENT[type]);

  return eventId;
}

/**
 * Delegación global: cualquier elemento con `data-track="whatsapp"` (los botones/links que
 * genere Claude Design) dispara la conversión de WhatsApp al hacer clic.
 */
export function bindDeclarativeTracking(): void {
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const type = el.dataset.track;
      if (type === "whatsapp") {
        trackConversion("whatsapp", { params: { placement: el.dataset.trackPlacement ?? "unknown" } });
      }
    },
    { capture: true },
  );
}

/// <reference types="astro/client" />

interface Window {
  dataLayer: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  clarity?: (...args: unknown[]) => void;
  turnstile?: { reset: (widget?: string | HTMLElement) => void };
}

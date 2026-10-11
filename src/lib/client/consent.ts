// Consentimiento de cookies (opt-in). Se guarda en localStorage y se propaga a
// Google (Consent Mode v2), Meta Pixel y Microsoft Clarity.

export type ConsentState = "granted" | "denied";
export const CONSENT_KEY = "sb_consent";
export const CONSENT_EVENT = "sb:consent";

export function getConsent(): ConsentState | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(state: ConsentState): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* modo privado: el consentimiento vale solo para esta página */
  }
  applyConsent(state);
  document.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function applyConsent(state: ConsentState): void {
  window.gtag?.("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
  window.fbq?.("consent", state === "granted" ? "grant" : "revoke");
  window.clarity?.("consentv2", { ad_Storage: state, analytics_Storage: state });
}

export function hasMarketingConsent(): boolean {
  return getConsent() === "granted";
}

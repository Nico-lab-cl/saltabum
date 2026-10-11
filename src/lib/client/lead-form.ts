// Conecta cualquier <form data-lead-form> al endpoint /api/lead.
//
// Contrato para el diseño (Claude Design solo tiene que respetar esto):
//   <form data-lead-form="contacto">          ← el valor es el nombre del formulario
//     <input name="nombre" required>
//     <input name="telefono" type="tel">
//     <input name="email" type="email">
//     <textarea name="mensaje"></textarea>
//     <input name="extra.personas">           ← cualquier campo extra con prefijo "extra."
//     <Turnstile />                            ← componente antispam
//     <button type="submit">Enviar</button>
//     <p data-lead-message></p>                ← (opcional) aquí se muestra éxito/error
//   </form>
//
// Estados para estilos: el form recibe data-state="idle|sending|success|error".
// Eventos: "lead:success" y "lead:error" (detail con el detalle) en el <form>.
import { getAttribution } from "./attribution";
import { hasMarketingConsent } from "./consent";
import { newEventId, trackConversion } from "./track";

const MESSAGES = {
  success: "¡Gracias! Te contactaremos pronto.",
  error: "No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp.",
};

export function bindLeadForms(): void {
  document.querySelectorAll<HTMLFormElement>("form[data-lead-form]").forEach((form) => {
    form.dataset.state = "idle";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void submitLead(form);
    });
  });
}

async function submitLead(form: HTMLFormElement): Promise<void> {
  if (form.dataset.state === "sending") return;
  setState(form, "sending");

  const data = new FormData(form);
  const extra: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (key.startsWith("extra.") && typeof value === "string") extra[key.slice(6)] = value;
  }
  const str = (k: string) => {
    const v = data.get(k);
    return typeof v === "string" ? v : undefined;
  };

  const eventId = newEventId();
  const consent = hasMarketingConsent();
  const payload = {
    nombre: str("nombre") ?? "",
    telefono: str("telefono"),
    email: str("email"),
    mensaje: str("mensaje"),
    extra: Object.keys(extra).length ? extra : undefined,
    event_id: eventId,
    form_name: form.dataset.leadForm || "contacto",
    page_url: location.href,
    consent,
    attribution: getAttribution(),
    turnstile_token: str("cf-turnstile-response"),
    website: str("website"),
  };

  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

    trackConversion("lead", {
      eventId,
      params: { form: payload.form_name },
      userData: consent
        ? { email: payload.email, phone_number: normalizePhone(payload.telefono) }
        : undefined,
    });
    setState(form, "success", MESSAGES.success);
    form.reset();
    form.dispatchEvent(new CustomEvent("lead:success", { detail: { eventId } }));
  } catch (err) {
    setState(form, "error", MESSAGES.error);
    form.dispatchEvent(new CustomEvent("lead:error", { detail: { error: String(err) } }));
  } finally {
    window.turnstile?.reset(form.querySelector<HTMLElement>(".cf-turnstile") ?? undefined);
  }
}

function setState(form: HTMLFormElement, state: string, message?: string): void {
  form.dataset.state = state;
  const el = form.querySelector<HTMLElement>("[data-lead-message]");
  if (el && message !== undefined) el.textContent = message;
}

/** Formato E.164 para Google Enhanced Conversions (asume Chile si no trae código de país). */
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9) return `+56${digits}`;
  return digits ? `+${digits}` : undefined;
}

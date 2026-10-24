// Meta Conversions API: envía los eventos desde el servidor con el mismo event_id que el
// Pixel del navegador, para que Meta los deduplique y recupere conversiones bloqueadas.
import { sha256Hex } from "./crypto";

const GRAPH_VERSION = "v23.0"; // Revisar cada ~1 año: https://developers.facebook.com/docs/graph-api/changelog

export type MetaEventName = "Lead" | "Contact" | "Purchase";

/** Dónde ocurrió la conversión. "chat": venta cerrada por WhatsApp (pago confirmado en el panel). */
export type MetaActionSource = "website" | "chat";

interface MetaEvent {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  eventName: MetaEventName;
  eventId: string;
  actionSource?: MetaActionSource;
  /** Comuna del cliente (se envía normalizada y con hash). */
  city?: string;
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  customData?: Record<string, string | number>;
}

const norm = (v: string) => v.trim().toLowerCase();

/** Teléfono en dígitos con código de país (asume Chile, +56). */
function normPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 9 ? `56${digits}` : digits;
}

export async function sendMetaEvent(e: MetaEvent): Promise<void> {
  const user_data: Record<string, unknown> = {
    country: [await sha256Hex("cl")],
    client_ip_address: e.ip,
    client_user_agent: e.userAgent,
    fbp: e.fbp,
    fbc: e.fbc,
  };
  if (e.email) user_data.em = [await sha256Hex(norm(e.email))];
  if (e.phone) user_data.ph = [await sha256Hex(normPhone(e.phone))];
  if (e.firstName) user_data.fn = [await sha256Hex(norm(e.firstName.split(/\s+/)[0] ?? ""))];
  if (e.lastName) user_data.ln = [await sha256Hex(norm(e.lastName))];
  if (e.city) {
    const ciudad = norm(e.city).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    if (ciudad) user_data.ct = [await sha256Hex(ciudad)];
  }

  const body = {
    data: [
      {
        event_name: e.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: e.actionSource ?? "website",
        event_source_url: e.eventSourceUrl,
        user_data,
        ...(e.customData ? { custom_data: e.customData } : {}),
      },
    ],
    ...(e.testEventCode ? { test_event_code: e.testEventCode } : {}),
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${e.pixelId}/events?access_token=${encodeURIComponent(e.accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Meta CAPI ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Construye _fbc a partir de fbclid si la cookie aún no existe. */
export function buildFbc(cookieFbc: string | undefined, fbclid: string | undefined): string | undefined {
  if (cookieFbc) return cookieFbc;
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined;
}

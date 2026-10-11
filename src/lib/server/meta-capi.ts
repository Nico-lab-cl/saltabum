// Meta Conversions API: envía el Lead desde el servidor con el mismo event_id que el
// Pixel del navegador, para que Meta lo deduplique y recupere conversiones bloqueadas.
import { sha256Hex } from "./crypto";

const GRAPH_VERSION = "v23.0"; // Revisar cada ~1 año: https://developers.facebook.com/docs/graph-api/changelog

interface MetaLeadEvent {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  eventId: string;
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}

const norm = (v: string) => v.trim().toLowerCase();

/** Teléfono en dígitos con código de país (asume Chile, +56). */
function normPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 9 ? `56${digits}` : digits;
}

export async function sendMetaLead(e: MetaLeadEvent): Promise<void> {
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

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        event_source_url: e.eventSourceUrl,
        user_data,
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

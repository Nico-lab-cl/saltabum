// Envío de leads al CRM propio. El formato definitivo se acordará con el CRM;
// por ahora se envía un JSON estable y versionado (`schema_version`).
//
// Seguridad: cada request lleva
//   X-Saltabum-Timestamp: <unix segundos>
//   X-Saltabum-Signature: sha256=<HMAC-SHA256(secret, `${timestamp}.${body}`)>
// El CRM debe recalcular la firma y rechazar timestamps de más de 5 minutos.
import { hmacSha256Hex } from "./crypto";

export interface CrmLeadPayload {
  schema_version: 1;
  id: string;
  created_at: string;
  source: "saltabum.cl";
  form_name: string;
  contact: { nombre: string; telefono?: string; email?: string; mensaje?: string };
  extra?: Record<string, string>;
  attribution: Record<string, string>;
  context: { page_url?: string; ip?: string; country?: string; user_agent?: string; consent: boolean };
}

export async function sendToCrm(
  url: string,
  secret: string | undefined,
  payload: CrmLeadPayload,
): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-saltabum-timestamp": timestamp,
    "idempotency-key": payload.id,
  };
  if (secret)
    headers["x-saltabum-signature"] = `sha256=${await hmacSha256Hex(secret, `${timestamp}.${body}`)}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`CRM respondió ${res.status}`);
}

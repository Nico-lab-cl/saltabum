// Cliente de la agenda de reservas: lee los horarios tomados y envía la reserva a /api/reservas.
// La conversión se registra con trackConversion("lead") y el mismo event_id que recibe el CRM.
import type { Ocupado, ReservaInput } from "@/lib/reservas";
import { getAttribution } from "./attribution";
import { hasMarketingConsent } from "./consent";
import { newEventId, trackConversion } from "./track";

export interface Disponibilidad {
  desde: string;
  hasta: string;
  /** Horarios tomados (reservas y bloqueos), en minutos. */
  ocupados: Ocupado[];
}

export async function cargarDisponibilidad(): Promise<Disponibilidad> {
  const res = await fetch("/api/disponibilidad", { headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    desde?: string;
    hasta?: string;
    ocupados?: Ocupado[];
  };
  if (!res.ok || !body.ok || !body.desde || !body.hasta) throw new Error("disponibilidad");
  return { desde: body.desde, hasta: body.hasta, ocupados: body.ocupados ?? [] };
}

export type DatosReserva = Pick<
  ReservaInput,
  | "fecha"
  | "producto"
  | "inicio"
  | "horas"
  | "nombre"
  | "apellido"
  | "email"
  | "telefono"
  | "empresa"
  | "comuna"
  | "direccion"
  | "depto"
  | "ciudad"
  | "region"
  | "mensaje"
  | "website"
>;

export type ResultadoReserva = { ok: true } | { ok: false; error: string };

export async function enviarReserva(datos: DatosReserva): Promise<ResultadoReserva> {
  const eventId = newEventId();
  const consent = hasMarketingConsent();
  try {
    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...datos,
        event_id: eventId,
        page_url: location.href,
        consent,
        attribution: getAttribution(),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? `http_${res.status}` };

    trackConversion("lead", {
      eventId,
      params: { form: "reserva" },
      userData: consent ? { phone_number: normalizarTelefono(datos.telefono), email: datos.email || undefined } : undefined,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "red" };
  }
}

function normalizarTelefono(tel?: string): string | undefined {
  const digitos = tel?.replace(/\D/g, "");
  if (!digitos) return undefined;
  return digitos.startsWith("56") ? `+${digitos}` : `+56${digitos}`;
}

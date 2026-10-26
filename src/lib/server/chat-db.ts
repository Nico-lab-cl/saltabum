// Cuántos mensajes recibe el chat con IA por día (tabla «chat_uso» en la misma D1 de reservas), para que nadie
// pueda gastar los créditos de la API. No se guarda la IP ni lo que se escribe: solo una huella diaria y el conteo.
import { baseReservas } from "@/lib/server/reservas-db";

const ESQUEMA = `CREATE TABLE IF NOT EXISTS chat_uso (
  dia TEXT NOT NULL,
  visitante TEXT NOT NULL,
  mensajes INTEGER NOT NULL,
  PRIMARY KEY (dia, visitante)
)`;

let tablaLista = false;

/**
 * Suma un mensaje y dice si cabe en los límites del día: por visitante y en total.
 * El conteo se hace antes de llamar a la IA, así un mensaje rechazado no gasta créditos.
 */
export async function contarMensaje(dia: string, visitante: string, maxVisitante: number, maxDia: number): Promise<"ok" | "visitante" | "dia"> {
  const db = await baseReservas();
  if (!tablaLista) {
    await db.prepare(ESQUEMA).run();
    tablaLista = true;
  }
  const total = await db.prepare("SELECT COALESCE(SUM(mensajes), 0) AS n FROM chat_uso WHERE dia = ?").bind(dia).first<{ n: number }>();
  if ((total?.n ?? 0) >= maxDia) return "dia";
  const fila = await db
    .prepare(
      `INSERT INTO chat_uso (dia, visitante, mensajes) VALUES (?, ?, 1)
       ON CONFLICT (dia, visitante) DO UPDATE SET mensajes = mensajes + 1
       RETURNING mensajes`,
    )
    .bind(dia, visitante)
    .first<{ mensajes: number }>();
  return (fila?.mensajes ?? 0) > maxVisitante ? "visitante" : "ok";
}

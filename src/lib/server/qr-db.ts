// Escaneos de los códigos QR impresos (tabla «qr_escaneos» en la misma D1 de reservas).
// Se cuentan en el servidor, así que incluyen a quienes no aceptan cookies (GA4 solo los ve con consentimiento).
// No se guarda la IP: solo la campaña, la ciudad aproximada que entrega Cloudflare y el tipo de celular.
import { baseReservas } from "@/lib/server/reservas-db";

const ESQUEMA = `CREATE TABLE IF NOT EXISTS qr_escaneos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL,
  ciudad TEXT,
  dispositivo TEXT,
  creado TEXT NOT NULL
)`;

let tablaLista: Promise<unknown> | undefined;

async function baseQr() {
  const db = await baseReservas();
  tablaLista ??= db.prepare(ESQUEMA).run();
  await tablaLista;
  return db;
}

export async function registrarEscaneo(codigo: string, ciudad: string | null, dispositivo: string): Promise<void> {
  const db = await baseQr();
  await db
    .prepare("INSERT INTO qr_escaneos (codigo, ciudad, dispositivo, creado) VALUES (?, ?, ?, ?)")
    .bind(codigo, ciudad, dispositivo, new Date().toISOString())
    .run();
}

export interface ResumenQr {
  codigo: string;
  total: number;
  ultimos7: number;
  ultimo: string;
}

/** Escaneos por código: total, últimos 7 días y fecha del último. */
export async function resumenEscaneos(): Promise<ResumenQr[]> {
  const db = await baseQr();
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT codigo, COUNT(*) AS total, SUM(creado >= ?) AS ultimos7, MAX(creado) AS ultimo
       FROM qr_escaneos GROUP BY codigo ORDER BY total DESC`,
    )
    .bind(hace7)
    .all<ResumenQr>();
  return results;
}

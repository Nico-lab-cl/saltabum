// Escaneos de los códigos QR impresos (tabla «qr_escaneos» en la misma D1 de reservas).
// Se cuentan en el servidor, así que incluyen a quienes no aceptan cookies (GA4 solo los ve con consentimiento).
// No se guarda la IP: la ubicación es la aproximada que entrega Cloudflare según la red (ciudad, no GPS) y
// «visitante» es un hash de IP + navegador que cambia cada día, solo para contar personas distintas.
import { baseReservas } from "@/lib/server/reservas-db";

const ESQUEMA = `CREATE TABLE IF NOT EXISTS qr_escaneos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL,
  ciudad TEXT,
  dispositivo TEXT,
  creado TEXT NOT NULL
)`;

// Columnas agregadas después (ALTER TABLE falla si ya existen, y se ignora).
const COLUMNAS_NUEVAS = [
  "region TEXT",
  "pais TEXT",
  "lat REAL",
  "lon REAL",
  "operador TEXT",
  "so TEXT",
  "modelo TEXT",
  "navegador TEXT",
  "idioma TEXT",
  "visitante TEXT",
];

export interface Escaneo {
  codigo: string;
  ciudad: string | null;
  region: string | null;
  pais: string | null;
  lat: number | null;
  lon: number | null;
  operador: string | null;
  dispositivo: string;
  so: string | null;
  modelo: string | null;
  navegador: string | null;
  idioma: string | null;
  visitante: string | null;
}

export interface FilaEscaneo extends Escaneo {
  id: number;
  creado: string;
}

// Bandera y no promesa compartida (ver baseReservas).
let tablaLista = false;

async function baseQr() {
  const db = await baseReservas();
  if (!tablaLista) {
    await db.prepare(ESQUEMA).run();
    await db.prepare("CREATE INDEX IF NOT EXISTS qr_escaneos_creado ON qr_escaneos (creado)").run();
    for (const c of COLUMNAS_NUEVAS) await db.prepare(`ALTER TABLE qr_escaneos ADD COLUMN ${c}`).run().catch(() => undefined);
    tablaLista = true;
  }
  return db;
}

/**
 * Guarda un escaneo. `conPistas` indica que Chrome ya mandó las client hints: la primera vez Chrome repite la
 * visita para mandarlas (Critical-CH), y esa repetición completa el escaneo recién guardado en vez de contarlo
 * dos veces. En los computadores el modelo llega vacío y se guarda como "" para no volver a completarlo.
 */
export async function registrarEscaneo(e: Escaneo, conPistas = false): Promise<void> {
  const db = await baseQr();
  const ahora = new Date();

  if (conPistas && e.visitante) {
    const hace = new Date(ahora.getTime() - 15_000).toISOString();
    const res = await db
      .prepare(
        `UPDATE qr_escaneos SET modelo = ?, so = ? WHERE id = (
           SELECT id FROM qr_escaneos WHERE visitante = ? AND codigo = ? AND modelo IS NULL AND creado >= ?
           ORDER BY id DESC LIMIT 1)`,
      )
      .bind(e.modelo ?? "", e.so, e.visitante, e.codigo, hace)
      .run();
    if (Number(res.meta.changes ?? 0) > 0) return;
  }

  await db
    .prepare(
      `INSERT INTO qr_escaneos (codigo, ciudad, region, pais, lat, lon, operador, dispositivo, so, modelo, navegador, idioma, visitante, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      e.codigo,
      e.ciudad,
      e.region,
      e.pais,
      e.lat,
      e.lon,
      e.operador,
      e.dispositivo,
      e.so,
      e.modelo,
      e.navegador,
      e.idioma,
      e.visitante,
      ahora.toISOString(),
    )
    .run();
}

/** Escaneos desde una fecha (ISO), del más nuevo al más antiguo. El panel los agrupa en el navegador. */
export async function listarEscaneos(desde: string, limite = 5000): Promise<FilaEscaneo[]> {
  const db = await baseQr();
  const { results } = await db
    .prepare(
      `SELECT id, codigo, ciudad, region, pais, lat, lon, operador, dispositivo, so, modelo, navegador, idioma, visitante, creado
       FROM qr_escaneos WHERE creado >= ? ORDER BY id DESC LIMIT ?`,
    )
    .bind(desde, limite)
    .all<FilaEscaneo>();
  return results;
}

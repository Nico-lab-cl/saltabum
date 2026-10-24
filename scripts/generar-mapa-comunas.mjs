// Genera src/design/mapa-comunas.ts: el contorno de cada comuna de la Región de Valparaíso (continental) como
// trazados SVG, para el mapa de «Zona de despacho».
//
// Uso:  node scripts/generar-mapa-comunas.mjs [archivo-overpass.json]
// Sin archivo, descarga los límites desde OpenStreetMap (Overpass). Datos © colaboradores de OpenStreetMap (ODbL),
// por eso el mapa lleva la atribución.
import { readFile, writeFile } from "node:fs/promises";

const REGION_OSM = 198847; // relación «Región de Valparaíso»
const ISLAS = new Set(["Juan Fernández", "Isla de Pascua"]);
/** Todo lo que quede al oeste de esta longitud es isla oceánica. */
const LON_MIN = -72.5;
/** Escala de la proyección: unidades SVG por grado de latitud. */
const K = 600;
/** Latitud de referencia (centro de la región) para corregir el ancho de los grados de longitud. */
const LAT0 = -32.9;
/** Tolerancia de simplificación (unidades SVG) cerca de la zona de despacho y lejos de ella. */
const TOL_CERCA = 0.18;
const TOL_LEJOS = 0.7;
/** Comunas que se dibujan con más detalle porque se ven en grande en el mapa. */
const CERCA = new Set([
  "Concón", "Viña del Mar", "Valparaíso", "Quilpué", "Villa Alemana", "Limache", "Olmué", "Quintero", "Puchuncaví",
  "Quillota", "La Cruz", "Hijuelas", "Casablanca", "Nogales", "La Calera", "Algarrobo",
]);
/** Ajustes a mano de dónde va el nombre (coordenadas del mapa), si el centro calculado choca con otro nombre. */
const ETIQUETAS = {
  // En el cuerpo principal queda pegado a «Villa Alemana»; va en el sector norte de la comuna.
  Limache: [251, 581],
};

async function cargar(archivo) {
  if (archivo) return JSON.parse(await readFile(archivo, "utf8"));
  const q = `[out:json][timeout:180];area(${3600000000 + REGION_OSM})->.r;rel(area.r)["boundary"="administrative"]["admin_level"="8"];out geom;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "saltabum.cl generar-mapa-comunas", Accept: "application/json" },
    body: new URLSearchParams({ data: q }),
  });
  if (!r.ok) throw new Error(`Overpass respondió ${r.status}`);
  return r.json();
}

const proyectar = ({ lon, lat }) => [lon * Math.cos((LAT0 * Math.PI) / 180) * K, -lat * K];

/** Une los tramos (ways) de una relación en anillos cerrados. */
function anillos(tramos) {
  const pendientes = tramos.map((t) => t.slice());
  const igual = (a, b) => a[0] === b[0] && a[1] === b[1];
  const salida = [];
  while (pendientes.length) {
    const anillo = pendientes.shift();
    let cerrado = igual(anillo[0], anillo.at(-1));
    while (!cerrado) {
      const fin = anillo.at(-1);
      const i = pendientes.findIndex((t) => igual(t[0], fin) || igual(t.at(-1), fin));
      if (i < 0) break; // anillo abierto: se cierra igual
      const t = pendientes.splice(i, 1)[0];
      anillo.push(...(igual(t[0], fin) ? t : t.reverse()).slice(1));
      cerrado = igual(anillo[0], anillo.at(-1));
    }
    salida.push(anillo);
  }
  return salida;
}

/** Douglas–Peucker iterativo. */
function simplificar(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  const n = pts.length - 1;
  keep[0] = keep[n] = 1;
  // Anillo cerrado: se parte en el punto más lejano al inicio para que DP tenga un segmento con largo.
  let lejos = 1;
  for (let i = 1; i < n; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[lejos][0] - pts[0][0], pts[lejos][1] - pts[0][1])) lejos = i;
  keep[lejos] = 1;
  const pila = [[0, lejos], [lejos, n]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) [max, idx] = [d, i];
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      pila.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const area = (r) => r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2;

/** ¿El punto está dentro? (par-impar, así los huecos quedan fuera). */
function dentro([px, py], rings) {
  let adentro = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) adentro = !adentro;
    }
  return adentro;
}

function distanciaBorde([px, py], rings) {
  let min = Infinity;
  for (const r of rings)
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      min = Math.min(min, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
  return min;
}

/** Centro visual para el nombre: el punto interior más lejos de los bordes (búsqueda en grilla, refinada dos veces). */
function centroVisual(rings) {
  const pts = rings.flat();
  let [x1, y1, x2, y2] = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  let mejor = [(x1 + x2) / 2, (y1 + y2) / 2];
  let mejorD = -1;
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const paso = Math.max(x2 - x1, y2 - y1) / 40;
    for (let x = x1; x <= x2; x += paso)
      for (let y = y1; y <= y2; y += paso) {
        if (!dentro([x, y], rings)) continue;
        const d = distanciaBorde([x, y], rings);
        if (d > mejorD) [mejor, mejorD] = [[x, y], d];
      }
    [x1, y1, x2, y2] = [mejor[0] - paso * 2, mejor[1] - paso * 2, mejor[0] + paso * 2, mejor[1] + paso * 2];
  }
  return mejor;
}

/** Trazado SVG con comandos relativos y un decimal. */
function trazado(rings, ox, oy) {
  const r1 = (n) => Math.round(n * 10) / 10;
  const num = (n) => { const s = String(r1(n)); return s.replace(/^(-?)0\./, "$1."); };
  let d = "";
  for (const ring of rings) {
    let [px, py] = [r1(ring[0][0] - ox), r1(ring[0][1] - oy)];
    d += `M${num(px)} ${num(py)}`;
    let seg = "";
    for (const [x, y] of ring.slice(1, -1)) {
      const [ax, ay] = [r1(x - ox), r1(y - oy)];
      const [dx, dy] = [r1(ax - px), r1(ay - py)];
      if (!dx && !dy) continue;
      const sx = num(dx), sy = num(dy);
      seg += (seg ? (sx.startsWith("-") ? "" : " ") : "l") + sx + (sy.startsWith("-") ? "" : " ") + sy;
      [px, py] = [ax, ay];
    }
    d += seg + "z";
  }
  return d;
}

const osm = await cargar(process.argv[2]);
const comunas = osm.elements
  .filter((e) => e.type === "relation" && !ISLAS.has(e.tags.name))
  .map((e) => {
    const tramos = (rol) => e.members.filter((m) => m.type === "way" && m.role === rol && m.geometry).map((m) => m.geometry.map(proyectar));
    // Fuera las islas oceánicas (las Desventuradas son parte de la comuna de Valparaíso): solo el continente.
    const externos = anillos(tramos("outer")).filter((r) => r.length > 3 && r.every(([x]) => x > LON_MIN * Math.cos((LAT0 * Math.PI) / 180) * K));
    const internos = anillos(tramos("inner")).filter((r) => r.length > 3);
    return { nombre: e.tags.name, externos, internos };
  })
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// Origen en la esquina superior izquierda de la región.
const todos = comunas.flatMap((c) => c.externos.flat());
const minX = Math.min(...todos.map((p) => p[0]));
const minY = Math.min(...todos.map((p) => p[1]));
const maxX = Math.max(...todos.map((p) => p[0]));
const maxY = Math.max(...todos.map((p) => p[1]));

const salida = comunas.map((c) => {
  const tol = CERCA.has(c.nombre) ? TOL_CERCA : TOL_LEJOS;
  const rings = [...c.externos, ...c.internos]
    .map((r) => simplificar(r, tol))
    .filter((r) => r.length > 3 && Math.abs(area(r)) > tol * tol * 4);
  const fijo = ETIQUETAS[c.nombre];
  const [cx, cy] = fijo ? [fijo[0] + minX, fijo[1] + minY] : centroVisual(rings);
  const pts = rings.flat();
  const caja = [Math.min(...pts.map((p) => p[0])) - minX, Math.min(...pts.map((p) => p[1])) - minY, Math.max(...pts.map((p) => p[0])) - minX, Math.max(...pts.map((p) => p[1])) - minY].map(Math.round);
  return { nombre: c.nombre, d: trazado(rings, minX, minY), x: Math.round(cx - minX), y: Math.round(cy - minY), caja };
});

const ancho = Math.ceil(maxX - minX);
const alto = Math.ceil(maxY - minY);
/** lon/lat → coordenadas del mapa, para ubicar puntos sueltos (la base, por ejemplo). */
const punto = (lon, lat) => { const [x, y] = proyectar({ lon, lat }); return [Math.round(x - minX), Math.round(y - minY)]; };

const ts = `// Generado por scripts/generar-mapa-comunas.mjs. No editar a mano.
// Límites comunales de la Región de Valparaíso (continental). Datos © colaboradores de OpenStreetMap (ODbL).
export const MAPA_ANCHO = ${ancho};
export const MAPA_ALTO = ${alto};
/** Para ubicar puntos: lon/lat → x/y del mapa. */
export const MAPA_PROYECCION = { k: ${K}, lat0: ${LAT0}, minX: ${minX.toFixed(3)}, minY: ${minY.toFixed(3)} };

export interface ComunaMapa {
  nombre: string;
  /** Trazado SVG del contorno. */
  d: string;
  /** Dónde va el nombre. */
  x: number;
  y: number;
  /** Recuadro [x1, y1, x2, y2] que ocupa la comuna. */
  caja: [number, number, number, number];
}

export const COMUNAS_MAPA: ComunaMapa[] = ${JSON.stringify(salida, null, 0).replace(/\},\{/g, "},\n  {").replace(/^\[/, "[\n  ").replace(/\]$/, ",\n]")};
`;

await writeFile(new URL("../src/design/mapa-comunas.ts", import.meta.url), ts);
console.log(`${salida.length} comunas, ${ancho}×${alto}, ${(ts.length / 1024).toFixed(1)} kB. Valparaíso (base): ${punto(-71.62, -33.05)}`);

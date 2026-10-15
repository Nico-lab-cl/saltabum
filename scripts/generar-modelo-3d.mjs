// Genera public/modelos/megatobogan-v3.glb: el Megatobogán Arcoíris armado por código a partir de las fotos reales.
// Es un modelo simplificado (tubos y bloques redondeados) con la distribución, los colores y las medidas reales,
// pensado para reemplazarse por un escaneo cuando exista.
//
// Ejes: x a la derecha, y hacia arriba, z hacia la cámara (el frente del juego). Unidades en metros.
// Planta de 7,5 × 7,5 m y 3,5 m de alto:
//   · izquierda, de adelante hacia atrás: módulo largo de obstáculos (franjas azul, amarillo, rojo y tubo verde arriba)
//   · centro atrás: torre con techo de malla naranja y arco amarillo
//   · centro adelante: tobogán amarillo con paredes escalonadas rojas y amarillas, arco verde arriba
//   · derecha adelante: zona de salto con piso azul y pared roja con túneles redondos
//   · derecha atrás: rampa amarilla para subir a la torre
//
// Uso: node scripts/generar-modelo-3d.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// El exportador usa FileReader para armar el binario; en Node se reemplaza por Blob.arrayBuffer().
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString("base64")}`;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
};

// Colores de la lona, sacados de las fotos.
const COLOR = {
  rojo: "#c4202f",
  amarillo: "#f7c51e",
  verde: "#3cad3a",
  azul: "#2d6cc0",
  naranja: "#f2741c",
  hueco: "#4a1520",
};
const piezas = Object.fromEntries(Object.keys(COLOR).map((k) => [k, []]));

function poner(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")).setPosition(x, y, z));
  piezas[color].push(geo.index ? geo.toNonIndexed() : geo);
}

// Bloque redondeado: ancho (x), alto (y), fondo (z), centrado en (x, y, z).
function bloque(color, w, h, d, pos, r = 0.16) {
  const radio = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  poner(new RoundedBoxGeometry(w, h, d, 2, radio), color, pos);
}

// Bloque entre dos alturas (y0 → y1) para apilar franjas.
function franja(color, x0, x1, y0, y1, z0, z1, r) {
  bloque(color, x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, r);
}

// Tubo recto entre dos puntos.
function tubo(color, a, b, radio) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const largo = va.distanceTo(vb);
  const geo = new THREE.CapsuleGeometry(radio, Math.max(0.01, largo - radio * 2), 4, 16);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  geo.applyQuaternion(q);
  const m = va.add(vb).multiplyScalar(0.5);
  geo.translate(m.x, m.y, m.z);
  piezas[color].push(geo.index ? geo.toNonIndexed() : geo);
}

// Arco (media dona) parado, abierto hacia abajo. ry gira el plano del arco.
function arco(color, R, grosor, pos, ry = 0) {
  poner(new THREE.TorusGeometry(R, grosor, 14, 40, Math.PI), color, { ...pos, ry });
}

// Túnel redondo en una pared: aro amarillo y hueco oscuro.
function tunel(pos, ry = 0, R = 0.4) {
  poner(new THREE.TorusGeometry(R, 0.11, 12, 32), "amarillo", { ...pos, ry });
  poner(new THREE.CircleGeometry(R - 0.02, 32), "hueco", { ...pos, ry });
}

// Cuña (rampa maciza) bajo una superficie inclinada: triángulo en el plano z-y extruido a lo ancho en x.
function cuna(color, x0, x1, zAlto, zBajo, yBase, yAlto) {
  const forma = new THREE.Shape();
  forma.moveTo(zAlto, yBase);
  forma.lineTo(zBajo, yBase);
  forma.lineTo(zAlto, yAlto);
  forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: x1 - x0, bevelEnabled: false });
  // El shape queda en x-y con extrusión en z: se lleva a z-y con extrusión en x.
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  piezas[color].push(geo.index ? geo.toNonIndexed() : geo);
}

// Pared inclinada que sigue la pendiente del tobogán.
function paredInclinada(color, x, ancho, alto, zA, yA, zB, yB) {
  const dz = zB - zA, dy = yB - yA;
  const largo = Math.hypot(dz, dy);
  const ang = Math.atan2(-dy, dz);
  bloque(color, ancho, alto, largo, { x, y: (yA + yB) / 2 + alto / 2, z: (zA + zB) / 2, rx: ang }, 0.18);
}

// ── 1. Módulo de obstáculos (izquierda) ─────────────────────────────────────────────
{
  const x0 = -3.75, x1 = -1.5, z0 = -3.75, z1 = 3.0, e = 0.56; // e = grosor de pared
  franja("azul", x0, x1, 0, 0.45, z0, z1, 0.2);
  const capas = [
    ["amarillo", 0.45, 0.9],
    ["rojo", 0.9, 1.38],
  ];
  for (const [color, y0, y1] of capas) {
    franja(color, x0, x0 + e, y0, y1, z0, z1, 0.18); // costado exterior
    franja(color, x1 - e, x1, y0, y1, z0, z1, 0.18); // costado hacia el tobogán
    // Frente y fondo con ventana en la franja roja.
    const gap = color === "rojo" ? 0.95 : 0;
    const xm = (x0 + x1) / 2;
    for (const [za, zb] of [[z1 - e, z1], [z0, z0 + e]]) {
      if (gap) {
        franja(color, x0, xm - gap / 2, y0, y1, za, zb, 0.16);
        franja(color, xm + gap / 2, x1, y0, y1, za, zb, 0.16);
      } else franja(color, x0, x1, y0, y1, za, zb, 0.16);
    }
  }
  // Tubo verde arriba, alrededor de todo el módulo.
  const yv = 1.7, rv = 0.32, xi = x0 + rv, xd = x1 - rv, zf = z1 - rv, zt = z0 + rv;
  tubo("verde", [xi, yv, zt], [xi, yv, zf], rv);
  tubo("verde", [xd, yv, zt], [xd, yv, zf], rv);
  tubo("verde", [xi, yv, zf], [xd, yv, zf], rv);
  tubo("verde", [xi, yv, zt], [xd, yv, zt], rv);
  // Obstáculos rayados rojo y verde adentro.
  for (const z of [1.4, -0.4, -2.2]) {
    for (let i = 0; i < 5; i++) {
      poner(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 20), i % 2 ? "verde" : "rojo", { x: (x0 + x1) / 2, y: 0.56 + i * 0.22, z });
    }
  }
}

// ── 2. Torre (centro atrás) ────────────────────────────────────────────────────────
const torre = { x0: -1.5, x1: 1.8, z0: -3.75, z1: -0.75, piso: 2.0 };
{
  const { x0, x1, z0, z1, piso } = torre;
  franja("azul", x0, x1, 0, 0.45, z0, z1, 0.2);
  // Cuerpo en franjas horizontales hasta el piso de la torre.
  const bandas = ["amarillo", "rojo", "amarillo", "rojo"];
  const alto = (piso - 0.45) / bandas.length;
  bandas.forEach((c, i) => franja(c, x0 + 0.05, x1 - 0.05, 0.45 + i * alto, 0.45 + (i + 1) * alto, z0 + 0.05, z1 - 0.05, 0.14));
  // Parapetos rojos arriba (atrás y a los lados), con ventana en el costado izquierdo.
  const e = 0.4, h1 = piso + 0.85;
  franja("rojo", x0, x1, piso, h1, z0, z0 + e, 0.16);
  franja("rojo", x1 - e, x1, piso, h1, z0, z1, 0.16);
  franja("rojo", x0, x0 + e, piso, h1, z0, z0 + 0.9, 0.16);
  franja("rojo", x0, x0 + e, piso, h1, z1 - 0.9, z1, 0.16);
  franja("amarillo", x0, x0 + e, piso, piso + 0.25, z0 + 0.9, z1 - 0.9, 0.1);
  // Techo: arco amarillo atrás y malla naranja hasta el arco verde del tobogán.
  const xc = (x0 + x1) / 2;
  arco("amarillo", 1.25, 0.25, { x: xc, y: piso, z: z0 + 0.35 });
  const malla = new THREE.CylinderGeometry(1.2, 1.2, z1 - z0 - 0.5, 32, 1, true, -Math.PI / 2, Math.PI);
  poner(malla, "naranja", { x: xc, y: piso, z: (z0 + z1) / 2, rx: -Math.PI / 2 });
}

// ── 3. Tobogán (centro adelante) ───────────────────────────────────────────────────
{
  const xc = (torre.x0 + torre.x1) / 2, pista = 1.3, eIn = 0.3, eOut = 0.45;
  const zTop = torre.z1, yTop = torre.piso, zPie = 2.9, yPie = 0.45, zFin = 3.75;
  const xa = xc - pista / 2, xb = xc + pista / 2;
  const ancho0 = xa - eIn - eOut, ancho1 = xb + eIn + eOut;
  // Cuerpo rojo macizo bajo la pista y pista amarilla.
  cuna("rojo", ancho0, ancho1, zTop, zPie, 0, yTop);
  franja("rojo", ancho0, ancho1, 0, yPie, zTop, zFin, 0.18);
  paredInclinada("amarillo", xc, pista, 0.1, zTop, yTop, zPie, yPie);
  franja("amarillo", xa, xb, yPie, yPie + 0.1, zPie - 0.1, zFin - 0.05, 0.05);
  // Paredes escalonadas: amarilla por dentro (más baja) y roja por fuera (más alta).
  for (const lado of [-1, 1]) {
    const xIn = lado < 0 ? xa - eIn / 2 : xb + eIn / 2;
    const xOut = lado < 0 ? xa - eIn - eOut / 2 : xb + eIn + eOut / 2;
    paredInclinada("amarillo", xIn, eIn, 0.7, zTop, yTop, zPie, yPie);
    paredInclinada("rojo", xOut, eOut, 1.0, zTop, yTop, zPie, yPie);
    franja("amarillo", xIn - eIn / 2, xIn + eIn / 2, yPie, yPie + 0.6, zPie - 0.2, zFin, 0.14);
    franja("rojo", xOut - eOut / 2, xOut + eOut / 2, yPie, yPie + 0.85, zPie - 0.2, zFin, 0.18);
    // Pilares rojos altos arriba del tobogán.
    bloque("rojo", 0.6, 1.25, 0.6, { x: xOut, y: yTop + 0.62, z: zTop + 0.2 }, 0.26);
  }
  // Arco verde sobre la entrada del tobogán.
  arco("verde", 1.0, 0.3, { x: xc, y: yTop + 0.1, z: zTop + 0.1 });
}

// ── 4. Zona de salto (derecha adelante) ────────────────────────────────────────────
{
  const x0 = 1.9, x1 = 3.75, z0 = torre.z1, z1 = 3.75, piso = 0.5;
  franja("azul", x0, x1, 0, piso, z0, z1, 0.22);
  tubo("azul", [x0 + 0.25, piso + 0.18, z1 - 0.25], [x1 - 0.25, piso + 0.18, z1 - 0.25], 0.24); // cojín delantero
  // Pared del fondo (contra la torre) y pared exterior, rojas con franja amarilla arriba.
  franja("rojo", x0, x1, piso, 2.1, z0, z0 + 0.4, 0.18);
  franja("amarillo", x0, x1, 2.1, 2.45, z0, z0 + 0.4, 0.16);
  franja("rojo", x1 - 0.4, x1, piso, 1.6, z0, z1 - 0.6, 0.18);
  franja("amarillo", x1 - 0.4, x1, 1.6, 1.9, z0, z1 - 0.6, 0.14);
  tunel({ x: (x0 + x1) / 2, y: 1.25, z: z0 + 0.42 });
  tunel({ x: x1 - 0.42, y: 1.05, z: 0.9 }, -Math.PI / 2, 0.36);
}

// ── 5. Rampa para subir a la torre (derecha atrás) ─────────────────────────────────
{
  const z0 = -3.75, z1 = torre.z1, xAlto = torre.x1, xBajo = 3.75, yBase = 0.45, yAlto = torre.piso;
  franja("azul", xAlto, xBajo, 0, yBase, z0, z1, 0.2);
  // Cuña de la rampa (sube de derecha a izquierda), girada para que su largo vaya en x.
  const forma = new THREE.Shape();
  forma.moveTo(xBajo, yBase);
  forma.lineTo(xAlto, yBase);
  forma.lineTo(xAlto, yAlto);
  forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: z1 - z0 - 0.9, bevelEnabled: false });
  geo.translate(0, 0, z0 + 0.45);
  piezas.amarillo.push(geo.index ? geo.toNonIndexed() : geo);
  // Barandas rojas a cada lado de la rampa.
  for (const z of [z0 + 0.25, z1 - 0.25]) {
    const largo = Math.hypot(xBajo - xAlto, yAlto - yBase), ang = Math.atan2(yAlto - yBase, xBajo - xAlto);
    bloque("rojo", largo - 0.35, 0.6, 0.4, { x: (xAlto + xBajo) / 2, y: (yBase + yAlto) / 2 + 0.3, z, rz: -ang }, 0.18);
  }
  // Escalones azules para trepar.
  for (let i = 1; i <= 4; i++) {
    const t = i / 5, x = xBajo - (xBajo - xAlto) * t, y = yBase + (yAlto - yBase) * t;
    tubo("azul", [x, y + 0.08, z0 + 0.6], [x, y + 0.08, z1 - 0.6], 0.08);
  }
}

// ── Escena y exportación ───────────────────────────────────────────────────────────
const escena = new THREE.Scene();
for (const [nombre, lista] of Object.entries(piezas)) {
  if (!lista.length) continue;
  // Sin textura no hacen falta coordenadas UV; al soldar vértices repetidos el archivo pesa mucho menos.
  for (const g of lista) g.deleteAttribute("uv");
  const geo = mergeVertices(mergeGeometries(lista), 1e-4);
  geo.computeBoundingBox();
  const mat = new THREE.MeshStandardMaterial({
    name: nombre,
    color: new THREE.Color(COLOR[nombre]),
    roughness: nombre === "naranja" ? 0.8 : 0.42,
    metalness: 0,
    side: nombre === "naranja" || nombre === "hueco" ? THREE.DoubleSide : THREE.FrontSide,
    transparent: nombre === "naranja",
    opacity: nombre === "naranja" ? 0.88 : 1,
  });
  const malla = new THREE.Mesh(geo, mat);
  malla.name = nombre;
  escena.add(malla);
}

const caja = new THREE.Box3().setFromObject(escena);
const tam = caja.getSize(new THREE.Vector3());
const triangulos = escena.children.reduce((n, m) => n + m.geometry.index.count / 3, 0);

new GLTFExporter().parse(
  escena,
  (glb) => {
    mkdirSync("public/modelos", { recursive: true });
    writeFileSync("public/modelos/megatobogan-v3.glb", Buffer.from(glb));
    console.log(
      `megatobogan-v3.glb · ${(glb.byteLength / 1024).toFixed(0)} KB · ${Math.round(triangulos)} triángulos · ` +
        `${tam.x.toFixed(2)} × ${tam.z.toFixed(2)} m de base, ${tam.y.toFixed(2)} m de alto`,
    );
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true },
);

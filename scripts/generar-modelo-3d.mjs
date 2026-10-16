// Genera public/modelos/megatobogan-v5.glb: el Megatobogán Arcoíris armado por código a partir del video real
// (vuelta completa al juego inflado). Es un modelo simplificado, de tubos y bloques redondeados, con la distribución,
// los colores y las medidas reales, pensado para reemplazarse por un escaneo cuando exista.
//
// Ejes: x a la derecha, y hacia arriba, z hacia la cámara (el frente del juego, donde baja el tobogán principal).
// Unidades en metros. Planta de 7,5 × 7,5 m y 3,5 m de alto:
//   · zona de obstáculos en «L»: detrás de la torre y por el costado izquierdo hasta la entrada del frente,
//     con tubo verde solo en las dos caras de afuera; adentro, pilares rayados, cilindros rojos y tubos verdes.
//     Desde la rama del fondo, la rampa amarilla con manillas negras sube a la torre
//   · al medio: la torre, con la lona de torre de castillo (paredes rojas, franja amarilla y almenas)
//   · al frente: tobogán principal, corto y empinado, con paredes escalonadas rojas y amarillas,
//     pilares rojos, arco verde grande y techo de malla rojo anaranjada
//   · a la derecha: tobogán largo que baja hacia ese lado, con arco amarillo y malla naranja
//   · túneles bajos (forma de cerradura) bajo los toboganes, hacia la zona de salto azul de adelante a la derecha
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

// Colores de la lona, sacados del video.
const COLOR = {
  rojo: "#c41f40",
  amarillo: "#f6be1a",
  verde: "#45b33d",
  azul: "#2f6cc0",
  malla: "#ec5a22",
  naranja: "#f39a1e",
  hueco: "#4a1520",
  negro: "#24242a",
  cartel: "#f2ede4",
};
const piezas = Object.fromEntries(Object.keys(COLOR).map((k) => [k, []]));

// Destino actual de las piezas; un «grupo» las junta aparte para moverlas en bloque.
let destino = piezas;
function agregar(color, geo) {
  if (geo.index) geo = geo.toNonIndexed();
  destino[color].push(geo);
}
function grupo(matriz, dibujar) {
  const antes = destino;
  destino = Object.fromEntries(Object.keys(COLOR).map((k) => [k, []]));
  dibujar();
  for (const [color, lista] of Object.entries(destino)) for (const g of lista) antes[color].push(g.applyMatrix4(matriz));
  destino = antes;
}

function poner(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")).setPosition(x, y, z));
  agregar(color, geo);
}

// Bloque redondeado: ancho (x), alto (y), fondo (z), centrado en (x, y, z).
function bloque(color, w, h, d, pos, r = 0.16) {
  const radio = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  poner(new RoundedBoxGeometry(w, h, d, 2, radio), color, pos);
}

// Bloque entre dos coordenadas por eje, para apilar franjas.
function franja(color, x0, x1, y0, y1, z0, z1, r) {
  bloque(color, x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, r);
}

// Tubo recto entre dos puntos.
function tubo(color, a, b, radio) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const geo = new THREE.CapsuleGeometry(radio, Math.max(0.01, va.distanceTo(vb) - radio * 2), 4, 16);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  const m = va.add(vb).multiplyScalar(0.5);
  geo.translate(m.x, m.y, m.z);
  agregar(color, geo);
}

// Arco (media dona) parado y abierto hacia abajo, en el plano x-y. ry gira el plano.
function arco(color, R, grosor, pos, ry = 0) {
  poner(new THREE.TorusGeometry(R, grosor, 14, 40, Math.PI), color, { ...pos, ry });
}

// Techo de malla: medio cilindro hueco con eje en z, de radio R y largo L, centrado en pos.
function techo(color, R, L, pos) {
  poner(new THREE.CylinderGeometry(R, R, L, 32, 1, true, -Math.PI / 2, Math.PI), color, { ...pos, rx: -Math.PI / 2 });
}

// Túnel bajo, en forma de cerradura, en una pared que mira hacia +z (ry la gira): aro amarillo, hueco oscuro
// y la abertura que baja hasta el piso.
function tunel(pos, R = 0.4, ry = 0) {
  poner(new THREE.TorusGeometry(R, 0.11, 12, 32), "amarillo", { ...pos, ry });
  poner(new THREE.CircleGeometry(R - 0.02, 32), "hueco", { ...pos, ry });
  const alto = pos.y - BASE;
  const ranura = new THREE.PlaneGeometry(R * 1.1, alto);
  ranura.translate(0, -alto / 2, 0.001);
  poner(ranura, "hueco", { ...pos, ry });
}

// Pieza maciza a partir de un polígono en el plano z-y (puntos [z, y]), extruida en x de x0 a x1.
function perfil(color, x0, x1, puntos) {
  const forma = new THREE.Shape();
  puntos.forEach(([z, y], i) => (i ? forma.lineTo(z, y) : forma.moveTo(z, y)));
  forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: x1 - x0, bevelEnabled: false });
  // El shape queda en x-y con extrusión en z: se lleva a z-y con extrusión en x.
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  agregar(color, geo);
}

// Barra inclinada entre (zA, yA) y (zB, yB), con su base apoyada en esa línea.
function inclinada(color, x, ancho, alto, zA, yA, zB, yB, r = 0.18) {
  const largo = Math.hypot(zB - zA, yB - yA);
  const ang = Math.atan2(-(yB - yA), zB - zA);
  const nx = Math.sin(-ang), ny = Math.cos(ang); // normal de la pendiente
  bloque(color, ancho, alto, largo, { x, y: (yA + yB) / 2 + (alto / 2) * ny, z: (zA + zB) / 2 + (alto / 2) * nx, rx: ang }, r);
}

// Tobogán en coordenadas locales: pista centrada en x = 0, arriba en z = 0 (altura yTop), baja hacia +z
// hasta z = largo (altura yPie) y sigue plano hasta z = largo + llegada.
function tobogan({ pista, largo, llegada, yTop, yPie, arcoColor, mallaColor, paredAlta = 0, arcoGrande = false }) {
  const eIn = 0.32, eOut = 0.48, fin = largo + llegada;
  const xa = -pista / 2, xb = pista / 2, x0 = xa - eIn - eOut, x1 = xb + eIn + eOut;
  // Cuerpo rojo macizo bajo la pista y pista amarilla encima.
  perfil("rojo", x0, x1, [[0, 0], [largo, 0], [largo, yPie], [0, yTop]]);
  franja("rojo", x0, x1, 0, yPie, largo - 0.2, fin, 0.2);
  inclinada("amarillo", 0, pista, 0.1, 0, yTop, largo, yPie, 0.05);
  franja("amarillo", xa, xb, yPie, yPie + 0.1, largo - 0.1, fin - 0.05, 0.05);
  for (const lado of [-1, 1]) {
    const xIn = lado * (pista / 2 + eIn / 2), xOut = lado * (pista / 2 + eIn + eOut / 2);
    // Pared escalonada: amarilla por dentro (más baja) y roja por fuera (más alta), que se cierra abajo.
    inclinada("amarillo", xIn, eIn, 0.75, 0, yTop, largo, yPie);
    franja("amarillo", xIn - eIn / 2, xIn + eIn / 2, yPie, yPie + 0.55, largo - 0.25, fin, 0.14);
    if (lado === paredAlta) {
      // Pared alta desde el suelo, con el borde siguiendo la pendiente (aquí van los túneles).
      perfil("rojo", xOut - eOut / 2, xOut + eOut / 2, [[0, 0], [fin, 0], [fin, yPie + 0.9], [largo, yPie + 1.05], [0, yTop + 1.05]]);
    } else {
      inclinada("rojo", xOut, eOut, 1.05, 0, yTop, largo, yPie);
      franja("rojo", xOut - eOut / 2, xOut + eOut / 2, yPie, yPie + 0.85, largo - 0.25, fin, 0.18);
    }
    // Pilares rojos altos arriba.
    bloque("rojo", 0.62, 1.3, 0.62, { x: xOut, y: yTop + 0.65, z: 0.15 }, 0.27);
  }
  // Arco y techo de malla sobre la entrada.
  // El arco verde del tobogán principal es grande y grueso, y domina el frente del juego.
  const R = pista / 2 + eIn + (arcoGrande ? 0.2 : 0.05), g = arcoGrande ? 0.42 : 0.3, yArco = arcoGrande ? yTop - 0.19 : yTop + 0.02;
  arco(arcoColor, R, g, { x: 0, y: yArco, z: 0.05 });
  techo(mallaColor, R - 0.2, 1.5, { x: 0, y: yArco, z: -0.75 });
  return { ancho: x1 - x0, fin };
}

// ── Medidas generales ──────────────────────────────────────────────────────────────
const MIN = -3.75, MAX = 3.75, PISO = 2.0, BASE = 0.45;
// Torre al medio: entre la zona de obstáculos (detrás y a la izquierda) y los dos toboganes.
const TORRE = { x0: -1.75, x1: 1.05, z0: -2.25, z1: -0.6 };
const XC = (TORRE.x0 + TORRE.x1) / 2;

// ── 1. Torre ───────────────────────────────────────────────────────────────────────
{
  const { x0, x1, z0, z1 } = TORRE;
  franja("azul", x0, x1, 0, BASE, z0, z1, 0.2);
  const bandas = ["amarillo", "rojo", "amarillo", "rojo"];
  const alto = (PISO - BASE) / bandas.length;
  bandas.forEach((c, i) => franja(c, x0 + 0.05, x1 - 0.05, BASE + i * alto, BASE + (i + 1) * alto, z0 + 0.05, z1 - 0.05, 0.14));
  // Lona de torre de castillo arriba: paredes rojas con franja amarilla y almenas, abiertas hacia los toboganes
  // y con la entrada de la rampa atrás.
  const e = 0.36, h = PISO + 0.95;
  const rampa = { x0: XC - 0.75, x1: XC + 0.75 };
  const muros = [
    [x0, x0 + e, z0, z1], // costado izquierdo
    [x0, rampa.x0, z0, z0 + e], // atrás, a la izquierda de la rampa
    [rampa.x1, x1 - 0.9, z0, z0 + e], // atrás, a la derecha de la rampa
  ];
  for (const [a, b, c, d] of muros) {
    franja("rojo", a, b, PISO, h - 0.25, c, d, 0.14);
    franja("amarillo", a, b, h - 0.25, h, c, d, 0.1);
  }
  // Almenas en las esquinas y a lo largo del costado.
  for (const [x, z] of [[x0 + e / 2, z0 + e / 2], [x0 + e / 2, (z0 + z1) / 2], [x0 + e / 2, z1 - e / 2], [rampa.x0 - 0.2, z0 + e / 2], [rampa.x1 + 0.2, z0 + e / 2]]) {
    bloque("rojo", 0.36, 0.34, 0.36, { x, y: h + 0.17, z }, 0.08);
  }
}

// ── 2. Tobogán principal (al frente) ───────────────────────────────────────────────
grupo(new THREE.Matrix4().makeTranslation(XC, 0, TORRE.z1), () =>
  tobogan({ pista: 1.5, largo: 3.45, llegada: MAX - TORRE.z1 - 3.45, yTop: PISO, yPie: BASE, arcoColor: "verde", mallaColor: "malla", arcoGrande: true }),
);
// Túnel bajo el tobogán principal, en su costado derecho, hacia la zona de salto.
const XDER = XC + 0.75 + 0.32 + 0.48;
tunel({ x: XDER + 0.005, y: BASE + 0.45, z: 0.5 }, 0.38, Math.PI / 2);

// ── 3. Tobogán largo (baja hacia la derecha) ───────────────────────────────────────
// Girado 90°: su eje local z pasa a ser x. Arranca en el costado derecho de la torre.
// Su costado del frente (lado local −x) es una pared alta, con túneles bajos que pasan por debajo del tobogán.
const ANCHO2 = 1.2 + 2 * (0.32 + 0.48);
const ZC2 = (TORRE.z0 + TORRE.z1) / 2 - 0.3;
{
  const largo = MAX - TORRE.x1 - 0.55;
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(TORRE.x1, 0, ZC2);
  grupo(m, () =>
    tobogan({ pista: 1.2, largo, llegada: 0.55, yTop: PISO, yPie: BASE, arcoColor: "amarillo", mallaColor: "naranja", paredAlta: -1 }),
  );
  const zCara = ZC2 + ANCHO2 / 2 + 0.005;
  tunel({ x: TORRE.x1 + 0.95, y: BASE + 0.45, z: zCara }, 0.38);
  tunel({ x: TORRE.x1 + 2.0, y: BASE + 0.4, z: zCara }, 0.34);
}

// ── 4. Zona de salto (derecha adelante) ────────────────────────────────────────────
{
  const x0 = XDER, x1 = MAX, z0 = ZC2 + ANCHO2 / 2, z1 = 2.7;
  franja("azul", x0, x1, 0, 0.5, z0, z1, 0.22);
  tubo("azul", [x0 + 0.3, 0.68, z1 - 0.26], [x1 - 0.26, 0.68, z1 - 0.26], 0.26); // cojín del frente
  tubo("azul", [x1 - 0.26, 0.68, z0 + 0.3], [x1 - 0.26, 0.68, z1 - 0.26], 0.26); // cojín del costado
  // Cartel de reglas de seguridad en el cojín del frente.
  poner(new THREE.PlaneGeometry(1.1, 0.32), "cartel", { x: (x0 + x1) / 2, y: 0.66, z: z1 + 0.005 });
}

// ── 5. Zona de obstáculos en «L»: detrás de la torre y por el costado izquierdo ─────
// El tubo verde va solo por las dos caras de afuera (el fondo y el costado izquierdo).
{
  const L = { x0: MIN, xIzq: TORRE.x0, xFondo: TORRE.x1, z0: MIN, zFondo: TORRE.z0, z1: 2.6 };
  const e = 0.5, rv = 0.32, yv = 1.7;
  // Piso azul de las dos ramas.
  franja("azul", L.x0, L.xFondo, 0, BASE, L.z0, L.zFondo, 0.2); // rama del fondo
  franja("azul", L.x0, L.xIzq, 0, BASE, L.zFondo - 0.2, L.z1, 0.2); // rama izquierda
  for (const [color, y0, y1] of [["amarillo", BASE, 0.92], ["rojo", 0.92, 1.4]]) {
    franja(color, L.x0, L.x0 + e, y0, y1, L.z0, L.z1, 0.18); // cara de afuera izquierda
    franja(color, L.x0, L.xFondo, y0, y1, L.z0, L.z0 + e, 0.18); // cara de afuera del fondo
    franja(color, L.xFondo - e, L.xFondo, y0, y1, L.z0, L.zFondo, 0.16); // cierre del fondo, a la derecha
    franja(color, L.xIzq - e * 0.8, L.xIzq, y0, y1, TORRE.z1, L.z1, 0.16); // cara interior, junto al tobogán
    // Frente de la rama izquierda, con la entrada (ventana en la franja roja).
    const xm = (L.x0 + L.xIzq) / 2, gap = color === "rojo" ? 0.85 : 0;
    if (gap) {
      franja(color, L.x0, xm - gap / 2, y0, y1, L.z1 - e, L.z1, 0.16);
      franja(color, xm + gap / 2, L.xIzq, y0, y1, L.z1 - e, L.z1, 0.16);
    } else franja(color, L.x0, L.xIzq, y0, y1, L.z1 - e, L.z1, 0.16);
  }
  // Tubo verde en «L» sobre las dos caras de afuera.
  tubo("verde", [L.x0 + rv, yv, L.z1 - rv], [L.x0 + rv, yv, L.z0 + rv], rv);
  tubo("verde", [L.x0 + rv, yv, L.z0 + rv], [L.xFondo - rv, yv, L.z0 + rv], rv);

  // Obstáculos: pilares rayados (rojo, amarillo y verde), cilindros rojos parados y tubos verdes inclinados.
  const rayado = (x, z) =>
    ["rojo", "amarillo", "verde", "rojo", "amarillo", "verde"].forEach((c, i) =>
      poner(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 20), c, { x, y: BASE + 0.09 + i * 0.18, z }),
    );
  const cilindro = (x, z) => poner(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 20), "rojo", { x, y: BASE + 0.45, z });
  // Rama del fondo, donde llega la rampa.
  rayado(-3.0, -2.95);
  rayado(-2.35, -3.1);
  cilindro(0.55, -2.8);
  tubo("verde", [-1.95, BASE + 0.2, -3.25], [-1.35, BASE + 0.95, -2.7], 0.2);
  // Rama izquierda, hacia la entrada del frente.
  rayado(-2.8, -1.1);
  cilindro(-2.3, 0.2);
  tubo("verde", [-3.1, BASE + 0.25, 1.6], [-2.3, BASE + 0.95, 1.0], 0.2);
  rayado(-2.55, 2.0);

  // Rampa amarilla con manillas negras: sube desde el fondo hasta la torre (hacia el frente).
  const r0 = XC - 0.75, r1 = XC + 0.75, zBaja = -3.55, zAlta = TORRE.z0;
  perfil("amarillo", r0, r1, [[zBaja, BASE], [zAlta, BASE], [zAlta, PISO]]);
  const ang = Math.atan2(PISO - BASE, zAlta - zBaja);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4, z = zBaja + (zAlta - zBaja) * t, y = BASE + (PISO - BASE) * t;
    for (const x of [XC - 0.35, XC + 0.35]) bloque("negro", 0.07, 0.06, 0.4, { x, y: y + 0.06, z, rx: -ang }, 0.03);
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
  const translucida = nombre === "malla" || nombre === "naranja";
  const mat = new THREE.MeshStandardMaterial({
    name: nombre,
    color: new THREE.Color(COLOR[nombre]),
    roughness: translucida ? 0.85 : 0.4,
    metalness: 0,
    side: translucida || nombre === "hueco" ? THREE.DoubleSide : THREE.FrontSide,
    transparent: translucida,
    opacity: translucida ? 0.9 : 1,
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
    writeFileSync("public/modelos/megatobogan-v5.glb", Buffer.from(glb));
    console.log(
      `megatobogan-v5.glb · ${(glb.byteLength / 1024).toFixed(0)} KB · ${Math.round(triangulos)} triángulos · ` +
        `${tam.x.toFixed(2)} × ${tam.z.toFixed(2)} m de base, ${tam.y.toFixed(2)} m de alto · ` +
        `x ${caja.min.x.toFixed(2)}…${caja.max.x.toFixed(2)}, z ${caja.min.z.toFixed(2)}…${caja.max.z.toFixed(2)}`,
    );
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true },
);

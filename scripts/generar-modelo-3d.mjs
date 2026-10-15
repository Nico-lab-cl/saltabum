// Genera public/modelos/megatobogan-v4.glb: el Megatobogán Arcoíris armado por código a partir del video real
// (vuelta completa al juego inflado). Es un modelo simplificado, de tubos y bloques redondeados, con la distribución,
// los colores y las medidas reales, pensado para reemplazarse por un escaneo cuando exista.
//
// Ejes: x a la derecha, y hacia arriba, z hacia la cámara (el frente del juego, donde baja el tobogán principal).
// Unidades en metros. Planta de 7,5 × 7,5 m y 3,5 m de alto:
//   · izquierda: módulo largo de obstáculos (franjas azul, amarillo, rojo y tubo verde arriba), con pilares rayados,
//     un tubo verde y un cilindro rojo adentro; al fondo, la rampa amarilla con manillas negras que sube a la torre
//   · centro atrás: torre (plataforma a 2 m)
//   · centro adelante: tobogán principal, corto y empinado, con paredes escalonadas rojas y amarillas,
//     pilares rojos, arco verde y techo de malla rojo anaranjada
//   · derecha atrás: tobogán largo que baja hacia la derecha, con arco amarillo y techo de malla naranja;
//     su costado del frente es una pared roja alta con túneles redondos de borde amarillo
//   · derecha adelante: zona de salto con piso azul delante de esa pared
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

// Túnel redondo en una pared que mira hacia +z: aro amarillo y hueco oscuro.
function tunel(pos, R = 0.4, ry = 0) {
  poner(new THREE.TorusGeometry(R, 0.11, 12, 32), "amarillo", { ...pos, ry });
  poner(new THREE.CircleGeometry(R - 0.02, 32), "hueco", { ...pos, ry });
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
const MOD = { x0: MIN, x1: -1.75 }; // módulo de obstáculos
const TORRE = { x0: -1.75, x1: 1.05, z0: MIN, z1: -0.6 };

// ── 1. Torre ───────────────────────────────────────────────────────────────────────
{
  const { x0, x1, z0, z1 } = TORRE;
  franja("azul", x0, x1, 0, BASE, z0, z1, 0.2);
  const bandas = ["amarillo", "rojo", "amarillo", "rojo"];
  const alto = (PISO - BASE) / bandas.length;
  bandas.forEach((c, i) => franja(c, x0 + 0.05, x1 - 0.05, BASE + i * alto, BASE + (i + 1) * alto, z0 + 0.05, z1 - 0.05, 0.14));
  // Parapeto rojo atrás con franja amarilla.
  franja("rojo", x0, x1 - 1.2, PISO, PISO + 0.8, z0, z0 + 0.42, 0.16);
  franja("amarillo", x0, x1 - 1.2, PISO + 0.8, PISO + 1.05, z0, z0 + 0.42, 0.12);
}

// ── 2. Tobogán principal (al frente) ───────────────────────────────────────────────
const XC = (TORRE.x0 + TORRE.x1) / 2;
grupo(new THREE.Matrix4().makeTranslation(XC, 0, TORRE.z1), () =>
  tobogan({ pista: 1.5, largo: 3.45, llegada: MAX - TORRE.z1 - 3.45, yTop: PISO, yPie: BASE, arcoColor: "verde", mallaColor: "malla", arcoGrande: true }),
);

// ── 3. Tobogán largo (baja hacia la derecha) ───────────────────────────────────────
// Girado 90°: su eje local z pasa a ser x. Su costado del frente (lado local −x) es la pared alta con túneles.
const ANCHO2 = 1.2 + 2 * (0.32 + 0.48);
const ZC2 = MIN + ANCHO2 / 2 + 0.08; // 8 cm de margen: las piezas redondeadas inclinadas sobresalen un poco
{
  const largo = MAX - TORRE.x1 - 0.55;
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(TORRE.x1, 0, ZC2);
  grupo(m, () =>
    tobogan({ pista: 1.2, largo, llegada: 0.55, yTop: PISO, yPie: BASE, arcoColor: "amarillo", mallaColor: "naranja", paredAlta: -1 }),
  );
  // Túneles en la cara del frente de la pared alta.
  const zCara = ZC2 + ANCHO2 / 2 + 0.005;
  tunel({ x: TORRE.x1 + 0.85, y: 1.35, z: zCara }, 0.4);
  tunel({ x: TORRE.x1 + 1.95, y: 0.95, z: zCara }, 0.34);
}

// ── 4. Zona de salto (derecha adelante) ────────────────────────────────────────────
{
  const x0 = TORRE.x1, x1 = MAX, z0 = ZC2 + ANCHO2 / 2, z1 = 2.7;
  franja("azul", x0, x1, 0, 0.5, z0, z1, 0.22);
  tubo("azul", [x0 + 0.3, 0.68, z1 - 0.26], [x1 - 0.26, 0.68, z1 - 0.26], 0.26); // cojín del frente
  tubo("azul", [x1 - 0.26, 0.68, z0 + 0.3], [x1 - 0.26, 0.68, z1 - 0.26], 0.26); // cojín del costado
  // Cartel de reglas de seguridad en el cojín del frente.
  poner(new THREE.PlaneGeometry(1.1, 0.32), "cartel", { x: (x0 + x1) / 2, y: 0.66, z: z1 + 0.005 });
}

// ── 5. Módulo de obstáculos (izquierda) ────────────────────────────────────────────
{
  const { x0, x1 } = MOD, z0 = MIN, z1 = 2.6, e = 0.5, xm = (x0 + x1) / 2;
  franja("azul", x0, x1, 0, BASE, z0, z1, 0.2);
  for (const [color, y0, y1] of [["amarillo", BASE, 0.92], ["rojo", 0.92, 1.4]]) {
    franja(color, x0, x0 + e, y0, y1, z0, z1, 0.18); // costado exterior
    franja(color, x1 - e, x1, y0, y1, -1.9, z1, 0.18); // costado hacia el tobogán (atrás se abre a la rampa)
    // Frente y fondo, con ventana en la franja roja.
    const gap = color === "rojo" ? 0.85 : 0;
    for (const [za, zb] of [[z1 - e, z1], [z0, z0 + e]]) {
      if (gap) {
        franja(color, x0, xm - gap / 2, y0, y1, za, zb, 0.16);
        franja(color, xm + gap / 2, x1, y0, y1, za, zb, 0.16);
      } else franja(color, x0, x1, y0, y1, za, zb, 0.16);
    }
  }
  // Tubo verde grueso arriba, alrededor del módulo.
  const yv = 1.7, rv = 0.32, xi = x0 + rv, xd = x1 - rv, zf = z1 - rv, zt = z0 + rv;
  tubo("verde", [xi, yv, zt], [xi, yv, zf], rv);
  tubo("verde", [xd, yv, -1.9], [xd, yv, zf], rv);
  tubo("verde", [xi, yv, zf], [xd, yv, zf], rv);
  tubo("verde", [xi, yv, zt], [xd, yv, zt], rv);
  // Obstáculos: pilares rayados (rojo, amarillo y verde), un tubo verde inclinado y un cilindro rojo.
  for (const [x, z] of [[xm - 0.4, 0.2], [xm + 0.35, -0.6]]) {
    ["rojo", "amarillo", "verde", "rojo", "amarillo", "verde"].forEach((c, i) =>
      poner(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 20), c, { x, y: BASE + 0.09 + i * 0.18, z }),
    );
  }
  tubo("verde", [xm - 0.5, BASE + 0.25, 1.9], [xm + 0.5, BASE + 0.95, 1.2], 0.2);
  poner(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 20), "rojo", { x: xm + 0.45, y: BASE + 0.45, z: 1.7 });
  // Rampa amarilla con manillas negras: sube desde el fondo del módulo hasta la torre (hacia +x).
  const r0 = -3.45, r1 = -2.05;
  const forma = new THREE.Shape();
  forma.moveTo(x0 + 0.5, BASE);
  forma.lineTo(x1, BASE);
  forma.lineTo(x1, PISO);
  forma.closePath();
  const rampa = new THREE.ExtrudeGeometry(forma, { depth: r1 - r0, bevelEnabled: false });
  rampa.translate(0, 0, r0);
  agregar("amarillo", rampa);
  const largo = Math.hypot(x1 - x0 - 0.5, PISO - BASE), ang = Math.atan2(PISO - BASE, x1 - x0 - 0.5);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4, x = x0 + 0.5 + (x1 - x0 - 0.5) * t, y = BASE + (PISO - BASE) * t;
    bloque("negro", 0.12, 0.06, 0.5, { x, y: y + 0.05, z: (r0 + r1) / 2, rz: ang }, 0.03);
  }
  void largo;
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
    writeFileSync("public/modelos/megatobogan-v4.glb", Buffer.from(glb));
    console.log(
      `megatobogan-v4.glb · ${(glb.byteLength / 1024).toFixed(0)} KB · ${Math.round(triangulos)} triángulos · ` +
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

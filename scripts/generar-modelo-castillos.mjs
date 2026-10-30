// Genera public/modelos/castillo-pirata-v2.glb y public/modelos/castillo-formula-1-v2.glb: los dos castillos armados
// por código a partir de las fotos y los videos reales (Downloads/IMG_2755.MP4 y IMG_2754.MP4). Son modelos
// simplificados de bloques y tubos redondeados, con las medidas de la ficha técnica (6 × 4 m de base y 5 m de alto)
// y el espacio libre de 8 × 6 m marcado en el suelo, pensados para reemplazarse por un escaneo cuando exista.
//
// Los dos castillos son el mismo juego con otro personaje, que está «recostado» sobre el inflable:
//   · la cabeza va arriba del extremo del tobogán y mira hacia la entrada
//   · los brazos son las vigas de arriba de los dos costados largos y terminan en las manos, sobre la entrada
//     (el piloto toma un volante gigante; el pirata tiene un cuchillo en una mano y el garfio en la otra)
//   · los pies quedan en el suelo, a cada lado de la entrada, con la punta hacia arriba
//   · adentro: piso verde con obstáculos y, al fondo, la escalada amarilla que sube al tobogán, que sale por un arco
//     del extremo y baja hasta el colchón de llegada
//
// Ejes: x a lo largo (6 m; la entrada hacia +x y el tobogán hacia −x), y hacia arriba, z hacia la cámara (el costado
// largo del aro de básquetbol). Unidades en metros.
//
// Uso: node scripts/generar-modelo-castillos.mjs

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

const LARGO = 6;
const ANCHO = 4;
const SEGURIDAD = 1;

/** Arma un modelo: `dibujar` recibe las herramientas y pinta con los colores de `colores`. */
function modelo(colores, dibujar) {
  const piezas = Object.fromEntries(Object.keys(colores).map((k) => [k, []]));
  const agregar = (color, geo) => {
    if (!piezas[color]) throw new Error(`Color sin definir: ${color}`);
    piezas[color].push(geo.index ? geo.toNonIndexed() : geo);
  };
  const poner = (geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = [1, 1, 1], orden = "XYZ" } = {}) => {
    geo.scale(...s);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, orden)).setPosition(x, y, z));
    agregar(color, geo);
  };
  const h = {
    poner,
    /** Bloque redondeado entre coordenadas por eje. */
    caja(color, x0, x1, y0, y1, z0, z1, r = 0.14) {
      const w = x1 - x0, alto = y1 - y0, d = z1 - z0;
      const radio = Math.min(r, w / 2 - 0.005, alto / 2 - 0.005, d / 2 - 0.005);
      poner(new RoundedBoxGeometry(w, alto, d, 2, Math.max(0.004, radio)), color, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
    },
    /** Bloque redondeado de tamaño dado, centrado y girado. */
    bloque(color, [w, alto, d], pos, r = 0.12) {
      const radio = Math.min(r, w / 2 - 0.005, alto / 2 - 0.005, d / 2 - 0.005);
      poner(new RoundedBoxGeometry(w, alto, d, 2, Math.max(0.004, radio)), color, pos);
    },
    /** Tubo (cápsula) recto entre dos puntos. */
    tubo(color, a, b, radio) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const geo = new THREE.CapsuleGeometry(radio, Math.max(0.01, va.distanceTo(vb) - radio * 2), 4, 16);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      const m = va.add(vb).multiplyScalar(0.5);
      geo.translate(m.x, m.y, m.z);
      agregar(color, geo);
    },
    /** Cilindro (sin tapas redondas) entre dos puntos. */
    cilindro(color, a, b, r0, r1 = r0, segs = 28) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const geo = new THREE.CylinderGeometry(r1, r0, va.distanceTo(vb), segs);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      const m = va.add(vb).multiplyScalar(0.5);
      geo.translate(m.x, m.y, m.z);
      agregar(color, geo);
    },
    esfera(color, r, pos, s) {
      poner(new THREE.SphereGeometry(r, 28, 18), color, { ...pos, s });
    },
    dona(color, R, grosor, pos, arco = Math.PI * 2) {
      poner(new THREE.TorusGeometry(R, grosor, 12, 40, arco), color, pos);
    },
    /** Tubo que sigue una curva cerrada (volante, aros). */
    curva(color, curva, grosor, cerrada = true) {
      agregar(color, new THREE.TubeGeometry(curva, 72, grosor, 14, cerrada));
    },
    /** Panel de malla (translúcido) en un plano: `eje` "z" mira a ±z y "x" mira a ±x. */
    malla(a0, a1, y0, y1, fijo, eje = "z") {
      const g = new THREE.PlaneGeometry(a1 - a0, y1 - y0);
      if (eje === "z") poner(g, "malla", { x: (a0 + a1) / 2, y: (y0 + y1) / 2, z: fijo });
      else poner(g, "malla", { x: fijo, y: (y0 + y1) / 2, z: (a0 + a1) / 2, ry: Math.PI / 2 });
    },
    /** Figura plana extruida en z (cuchillo, letras), con bisel para que se vea inflada. */
    extruir(color, forma, grosor, pos, bisel = 0.03) {
      const g = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 14 });
      g.translate(0, 0, -grosor / 2);
      poner(g, color, pos);
    },
  };
  dibujar(h);

  // Espacio libre (8 × 6 m) translúcido con borde blanco y una flecha amarilla donde baja el tobogán (−x).
  const EL = LARGO + 2 * SEGURIDAD, EA = ANCHO + 2 * SEGURIDAD, y = 0.01, b = 0.1;
  poner(new THREE.PlaneGeometry(EL, EA), "espacio", { y, rx: -Math.PI / 2 });
  for (const [x, z, w, d] of [[0, -EA / 2 + b / 2, EL, b], [0, EA / 2 - b / 2, EL, b], [-EL / 2 + b / 2, 0, b, EA], [EL / 2 - b / 2, 0, b, EA]]) {
    poner(new THREE.PlaneGeometry(w, d), "borde", { x, y: y + 0.002, z, rx: -Math.PI / 2 });
  }
  const flecha = (e) => {
    const f = new THREE.Shape();
    f.moveTo(-0.2 * e, 0);
    f.lineTo(0.2 * e, 0);
    f.lineTo(0.2 * e, 0.4);
    f.lineTo(0.42 * e, 0.4);
    f.lineTo(0, 0.4 + 0.42 * e);
    f.lineTo(-0.42 * e, 0.4);
    f.lineTo(-0.2 * e, 0.4);
    f.closePath();
    return new THREE.ShapeGeometry(f);
  };
  // La forma apunta a +y; acostada en el suelo y girada para que apunte a −x.
  const contorno = flecha(1.18);
  contorno.translate(0, -0.06, 0);
  poner(contorno, "noche", { x: -LARGO / 2 - 0.08, y: y + 0.004, rx: -Math.PI / 2, rz: Math.PI / 2, orden: "XZY" });
  poner(flecha(1), "amarillo", { x: -LARGO / 2 - 0.08, y: y + 0.006, rx: -Math.PI / 2, rz: Math.PI / 2, orden: "XZY" });

  const escena = new THREE.Scene();
  for (const [nombre, lista] of Object.entries(piezas)) {
    if (!lista.length) continue;
    for (const g of lista) g.deleteAttribute("uv");
    const geo = mergeVertices(mergeGeometries(lista), 1e-4);
    const translucida = nombre === "malla" || nombre === "espacio";
    const mat = new THREE.MeshStandardMaterial({
      name: nombre,
      color: new THREE.Color(colores[nombre]),
      roughness: translucida ? 0.9 : nombre === "plata" ? 0.3 : 0.5,
      metalness: nombre === "plata" ? 0.35 : 0,
      side: THREE.DoubleSide,
      transparent: translucida,
      opacity: nombre === "espacio" ? 0.3 : translucida ? 0.5 : 1,
    });
    const m = new THREE.Mesh(geo, mat);
    m.name = nombre;
    escena.add(m);
  }
  return escena;
}

function exportar(escena, archivo) {
  const caja = new THREE.Box3().setFromObject(escena);
  const tam = caja.getSize(new THREE.Vector3());
  return new Promise((ok, mal) =>
    new GLTFExporter().parse(
      escena,
      (glb) => {
        mkdirSync("public/modelos", { recursive: true });
        writeFileSync(`public/modelos/${archivo}`, Buffer.from(glb));
        console.log(`${archivo} · ${(glb.byteLength / 1024).toFixed(0)} KB · ${tam.x.toFixed(2)} × ${tam.z.toFixed(2)} m (con espacio libre), ${tam.y.toFixed(2)} m de alto`);
        ok();
      },
      mal,
      { binary: true },
    ),
  );
}

/** Silueta de cápsula (lados rectos y puntas redondas) de ancho `w` y alto `alto`, apoyada en y = 0. */
function estadio(w, alto) {
  const r = w / 2, f = new THREE.Shape();
  f.moveTo(-r, r);
  f.absarc(0, r, r, Math.PI, 0, false);
  f.lineTo(r, alto - r);
  f.absarc(0, alto - r, r, 0, Math.PI, false);
  f.lineTo(-r, r);
  return f;
}

/** Rectángulo de esquinas muy redondas (superelipse) en el plano yz, para el volante. */
class Superelipse extends THREE.Curve {
  constructor(x, y, medioAncho, medioAlto, n = 3.2) {
    super();
    Object.assign(this, { x, y, medioAncho, medioAlto, n });
  }
  getPoint(t, destino = new THREE.Vector3()) {
    const a = t * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / this.n;
    return destino.set(this.x, this.y + this.medioAlto * Math.sign(s) * Math.abs(s) ** e, this.medioAncho * Math.sign(c) * Math.abs(c) ** e);
  }
}

// ── Medidas comunes de los dos castillos ────────────────────────────────────────
const XT = -1.9; // extremo del tobogán (cuerpo)
const XE = 2.3; // extremo de la entrada (cuerpo)
const ZL = ANCHO / 2; // costados largos en ±2
const BASE = 0.45; // alto del colchón de la base
const MURO = 2.6; // alto de las mallas
const BRAZO_Y = 2.98, BRAZO_R = 0.4, BRAZO_Z = ZL - 0.38; // brazos (vigas de arriba de los costados)
const MANO_X = 2.62; // manos sobre la entrada

/**
 * Lo que comparten los dos castillos: base, piso, pilares, mallas, muro de la entrada con el escalón de las
 * normas, escalada y tobogán, aro de básquetbol y pies. `c` trae el color de cada parte.
 */
function cuerpo(h, c) {
  // Base y piso con pistas
  h.caja(c.base, XT, XE, 0, BASE, -ZL, ZL, 0.22);
  h.caja(c.piso, XT + 0.3, XE - 0.4, BASE - 0.04, BASE + 0.07, -ZL + 0.32, ZL - 0.32, 0.05);
  for (const z of [-0.55, 0.55]) h.caja(c.pisoLinea, XT + 0.4, XE - 0.5, BASE + 0.06, BASE + 0.085, z - 0.02, z + 0.02, 0.01);

  // Entrada (+x): pilares de esquina anchos, muro con dos ventanas de malla y la cortina al medio, viga de arriba
  for (const sz of [1, -1]) h.caja(c.pilarEntrada, XE - 0.85, XE, BASE - 0.05, MURO + 0.15, sz > 0 ? ZL - 0.62 : -ZL, sz > 0 ? ZL : -ZL + 0.62, 0.2);
  h.caja(c.pilarEntrada, XE - 0.32, XE, BASE - 0.05, 1.05, -ZL + 0.6, ZL - 0.6, 0.14);
  h.caja(c.pilarEntrada, XE - 0.32, XE, MURO - 0.05, MURO + 0.45, -ZL + 0.3, ZL - 0.3, 0.2);
  h.caja(c.pilarEntrada, XE - 0.3, XE - 0.02, 1.0, MURO, -0.13, 0.13, 0.06);
  for (const sz of [1, -1]) {
    h.caja(c.pilarEntrada, XE - 0.3, XE - 0.02, 1.0, MURO, sz * (ZL - 0.66) - 0.06, sz * (ZL - 0.66) + 0.06, 0.04);
    h.malla(sz > 0 ? 0.13 : -ZL + 0.72, sz > 0 ? ZL - 0.72 : -0.13, 1.05, MURO - 0.02, XE - 0.16, "x");
  }
  // Escalón de la entrada, con el letrero blanco de normas por fuera
  h.caja(c.escalon, XE, XE + 0.5, 0, 0.42, -0.95, 0.95, 0.16);
  h.caja("blanco", XE + 0.49, XE + 0.52, 0.1, 0.33, -0.55, 0.55, 0.02);

  // Costados largos: muro bajo y malla entre el pilar de la entrada y el del tobogán
  const xm0 = XT + 0.7, xm1 = XE - 0.85;
  for (const sz of [1, -1]) {
    const z0 = sz > 0 ? ZL - 0.24 : -ZL, z1 = sz > 0 ? ZL : -ZL + 0.24;
    h.caja(c.muroBajo, xm0, xm1, BASE - 0.05, c.altoMuroBajo, z0, z1, 0.1);
    h.malla(xm0 + 0.02, xm1 - 0.02, c.altoMuroBajo - 0.02, MURO + 0.1, sz * (ZL - 0.12));
  }

  // Escalada amarilla al fondo (mira hacia la entrada), con manilla azul y dos topes, y la plataforma de arriba
  const xs = XT + 1.05; // cara de la escalada
  h.caja(c.plataforma, XT + 0.2, xs, BASE, 1.75, -1.0, 1.0, 0.16);
  h.caja("amarillo", xs - 0.12, xs + 0.06, BASE + 0.05, 1.55, -0.62, 0.62, 0.1);
  h.caja("azul", xs + 0.04, xs + 0.1, 1.15, 1.32, -0.3, 0.3, 0.05);
  for (const sz of [1, -1]) {
    h.cilindro(c.tope, [xs - 0.05, BASE, sz * 0.82], [xs - 0.05, 1.75, sz * 0.82], 0.2);
    h.esfera(c.topePunta, 0.2, { x: xs - 0.05, y: 1.75, z: sz * 0.82 }, [1, 0.8, 1]);
  }

  // Extremo del tobogán (−x): pilares, arco y techo
  c.pilaresTobogan(h);
  h.caja(c.techo, XT - 0.02, XT + 1.2, MURO + 0.02, MURO + 0.42, -ZL + 0.25, ZL - 0.25, 0.18);

  // Tobogán: sale por el arco del extremo y baja hasta el colchón de llegada
  const xa = XT + 0.25, xb = -LARGO / 2 + 0.55, alto = 1.75, piso = 0.38;
  const cuna = new THREE.Shape();
  cuna.moveTo(xa, 0);
  cuna.lineTo(xa, alto);
  cuna.lineTo(xb, piso);
  cuna.lineTo(xb, 0);
  cuna.closePath();
  h.extruir(c.toboganBase, cuna, 1.3, { y: 0.08 }, 0.08);
  const largo = Math.hypot(xa - xb, alto - piso), ang = Math.atan2(alto - piso, xa - xb);
  h.bloque("amarillo", [largo, 0.06, 1.12], { x: (xa + xb) / 2, y: (alto + piso) / 2 + 0.2, z: 0, rz: ang }, 0.03);
  for (const sz of [1, -1]) {
    h.tubo(c.baranda, [xa + 0.1, alto + 0.42, sz * 0.72], [xb + 0.12, piso + 0.36, sz * 0.72], 0.2);
    h.cilindro(c.baranda, [xa + 0.1, BASE, sz * 0.72], [xa + 0.1, alto + 0.42, sz * 0.72], 0.2);
  }
  h.caja(c.llegada, -LARGO / 2, xb + 0.4, 0, piso, -0.8, 0.8, 0.14);

  // Aro de básquetbol en el pilar de la entrada que da al frente
  h.caja(c.pilarEntrada, XE - 0.85, XE - 0.72, 1.55, 2.25, ZL - 0.05, ZL + 0.3, 0.04);
  h.dona(c.aro, 0.24, 0.05, { x: XE - 0.92, y: 1.95, z: ZL + 0.16, rx: Math.PI / 2 });
  h.cilindro("red", [XE - 0.92, 1.55, ZL + 0.16], [XE - 0.92, 1.95, ZL + 0.16], 0.15, 0.24, 18);
}

/** Pie con la punta hacia arriba, a cada lado de la entrada. `pintar` pone los detalles de cada personaje. */
function pies(h, pintar) {
  for (const sz of [1, -1]) {
    const z = sz * 1.3;
    pintar(h, z);
  }
}

const INCLINACION = 0.22; // cuánto se inclina la punta del pie hacia afuera

/** Punta del pie, parada y redondeada, con la suela hacia afuera (+x) y, si hay, la huella al centro. */
function pieArriba(h, z, color, suela, huella) {
  const giro = (dx) => ({ x: XE + 0.42 + dx * Math.cos(INCLINACION), y: 0.12 - dx * Math.sin(INCLINACION), z, ry: Math.PI / 2, rz: -INCLINACION, orden: "ZYX" });
  h.extruir(color, estadio(0.68, 1.3), 0.34, giro(0), 0.1);
  h.extruir(suela, estadio(0.74, 1.4), 0.06, { ...giro(0.25), y: giro(0.25).y - 0.03 }, 0.04);
  if (huella) h.extruir(huella, estadio(0.46, 1.08), 0.05, { ...giro(0.3), y: giro(0.3).y + 0.12 }, 0.03);
}

// ── Castillo Pirata ──────────────────────────────────────────────────────────────
// Cuerpo gris con mallas negras, base azul y piso verde; columnas a rayas rojas y blancas en el extremo del
// tobogán, con techo crema y viga con franja roja. El capitán (cara crema, barba y bigote negros, sombrero negro
// con calavera) mira hacia la entrada; sus brazos crema con franja roja y puño negro son las vigas de arriba. La
// mano del frente empuña un cuchillo con la hoja hacia arriba y la del fondo es el garfio. Botas cafés en el suelo.
const pirata = modelo(
  {
    azul: "#2a7fd6", verde: "#5cc63c", verdeOscuro: "#3c9e2a", gris: "#b9bdc4", blanco: "#f3eee4", crema: "#eadcc4", piel: "#f1dcc2",
    rojo: "#c8232e", negro: "#1f2025", cafe: "#6e3b22", cafeOscuro: "#4a2716", amarillo: "#f6c51c", plata: "#aeb3bb", red: "#ffffff",
    malla: "#23262e", espacio: "#ffffff", borde: "#ffffff", noche: "#1f2a5c",
  },
  (h) => {
    cuerpo(h, {
      base: "azul", piso: "verde", pisoLinea: "verdeOscuro", pilarEntrada: "gris", escalon: "azul", muroBajo: "azul", altoMuroBajo: BASE + 0.2,
      plataforma: "rojo", tope: "rojo", topePunta: "blanco", techo: "crema", toboganBase: "rojo", baranda: "blanco", llegada: "rojo", aro: "gris",
      pilaresTobogan(h) {
        // Columnas redondas a rayas, y viga crema con franja roja sobre el arco del tobogán
        for (const sz of [1, -1]) {
          const z = sz * (ZL - 0.4), x = XT + 0.4, r = 0.4, n = 8, y0 = BASE - 0.05, y1 = MURO + 0.35;
          for (let i = 0; i < n; i++) {
            const a = y0 + ((y1 - y0) / n) * i, b = y0 + ((y1 - y0) / n) * (i + 1);
            h.cilindro(i % 2 ? "blanco" : "rojo", [x, a, z], [x, b, z], r);
          }
          h.esfera("rojo", r, { x, y: y1, z }, [1, 0.55, 1]);
        }
        h.caja("crema", XT, XT + 0.75, MURO - 0.3, MURO + 0.45, -ZL + 0.45, ZL - 0.45, 0.22);
        h.caja("rojo", XT + 0.0, XT + 0.76, MURO - 0.05, MURO + 0.18, -ZL + 0.5, ZL - 0.5, 0.06);
      },
    });

    // Adentro: cilindro rojo y aro rojo con blanco
    h.cilindro("rojo", [0.75, BASE, 0.85], [0.75, BASE + 1.25, 0.85], 0.22);
    h.esfera("rojo", 0.22, { x: 0.75, y: BASE + 1.25, z: 0.85 }, [1, 0.5, 1]);
    h.dona("blanco", 0.45, 0.17, { x: -0.2, y: BASE + 0.62, z: -0.55, ry: Math.PI / 2 });
    h.dona("rojo", 0.45, 0.06, { x: -0.2 + 0.0, y: BASE + 0.62, z: -0.55 - 0.15, ry: Math.PI / 2 });
    h.dona("rojo", 0.45, 0.06, { x: -0.2, y: BASE + 0.62, z: -0.55 + 0.15, ry: Math.PI / 2 });

    // Brazos: manga crema con franja roja cerca del hombro y puño negro ancho cerca de la mano
    for (const sz of [1, -1]) {
      const z = sz * BRAZO_Z;
      h.tubo("crema", [XT + 0.2, BRAZO_Y, z], [1.25, BRAZO_Y, z], BRAZO_R);
      h.cilindro("rojo", [-0.75, BRAZO_Y, z], [-0.35, BRAZO_Y, z], BRAZO_R + 0.02);
      h.cilindro("rojo", [-1.35, BRAZO_Y, z], [-1.05, BRAZO_Y, z], BRAZO_R + 0.02);
      h.tubo("negro", [0.9, BRAZO_Y, z], [MANO_X - 0.55, BRAZO_Y, z], BRAZO_R + 0.1);
      h.dona("negro", BRAZO_R + 0.05, 0.08, { x: MANO_X - 0.55, y: BRAZO_Y, z, ry: Math.PI / 2 });
    }

    // Mano del frente: puño crema que empuña el cuchillo (mango negro, guarda negra y hoja gris hacia arriba)
    const zf = BRAZO_Z;
    h.bloque("piel", [0.8, 0.85, 0.8], { x: MANO_X, y: BRAZO_Y + 0.05, z: zf }, 0.3);
    for (let i = 0; i < 4; i++) h.tubo("piel", [MANO_X + 0.36, BRAZO_Y - 0.28 + i * 0.2, zf - 0.32], [MANO_X + 0.36, BRAZO_Y - 0.28 + i * 0.2, zf + 0.32], 0.12);
    h.tubo("piel", [MANO_X + 0.05, BRAZO_Y + 0.42, zf + 0.42], [MANO_X + 0.38, BRAZO_Y + 0.3, zf + 0.42], 0.13);
    h.cilindro("negro", [MANO_X + 0.12, BRAZO_Y - 1.0, zf], [MANO_X + 0.12, BRAZO_Y + 0.65, zf], 0.15);
    h.esfera("negro", 0.17, { x: MANO_X + 0.12, y: BRAZO_Y - 1.0, z: zf });
    h.bloque("negro", [0.3, 0.16, 0.8], { x: MANO_X + 0.12, y: BRAZO_Y + 0.68, z: zf }, 0.07);
    const hoja = new THREE.Shape();
    hoja.moveTo(-0.24, 0);
    hoja.lineTo(0.24, 0);
    hoja.quadraticCurveTo(0.26, 0.7, 0.04, 1.35);
    hoja.lineTo(0, 1.42);
    hoja.quadraticCurveTo(-0.2, 0.75, -0.24, 0);
    h.extruir("plata", hoja, 0.12, { x: MANO_X + 0.12, y: BRAZO_Y + 0.74, z: zf, ry: Math.PI / 2, s: [1, 0.8, 1] }, 0.04);

    // Mano del fondo: muñón gris con el garfio, que se curva hacia arriba y hacia afuera
    const zg = -BRAZO_Z;
    h.cilindro("plata", [MANO_X - 0.55, BRAZO_Y, zg], [MANO_X + 0.2, BRAZO_Y + 0.05, zg], 0.38, 0.3);
    h.esfera("plata", 0.3, { x: MANO_X + 0.2, y: BRAZO_Y + 0.05, z: zg }, [0.5, 1, 1]);
    h.tubo("plata", [MANO_X + 0.2, BRAZO_Y + 0.05, zg], [MANO_X + 0.42, BRAZO_Y + 0.35, zg], 0.1);
    h.dona("plata", 0.33, 0.09, { x: MANO_X + 0.72, y: BRAZO_Y + 0.42, z: zg }, Math.PI * 1.05);
    h.poner(new THREE.ConeGeometry(0.09, 0.3, 16), "plata", { x: MANO_X + 1.05, y: BRAZO_Y + 0.3, z: zg, rz: Math.PI });

    // Capitán: mira hacia la entrada (+x), sentado sobre la viga del tobogán
    const cx = XT + 0.45, cy = MURO + 1.2;
    h.esfera("piel", 0.82, { x: cx, y: cy, z: 0 }, [0.95, 1.05, 1]);
    h.esfera("negro", 0.8, { x: cx - 0.2, y: cy + 0.04, z: 0 }, [0.88, 1, 1.02]);
    // Barba negra que tapa la mandíbula, bigote y nariz
    h.esfera("negro", 0.66, { x: cx + 0.22, y: cy - 0.42, z: 0 }, [0.75, 0.75, 1.08]);
    h.esfera("piel", 0.2, { x: cx + 0.8, y: cy - 0.02, z: 0 }, [0.9, 1, 1]);
    for (const sz of [1, -1]) {
      h.tubo("negro", [cx + 0.78, cy - 0.2, sz * 0.05], [cx + 0.6, cy - 0.12, sz * 0.5], 0.1);
      h.esfera("negro", 0.11, { x: cx + 0.55, y: cy - 0.06, z: sz * 0.54 });
    }
    // Ojo negro, parche del otro lado y la marca roja en la mejilla
    h.esfera("negro", 0.1, { x: cx + 0.72, y: cy + 0.25, z: 0.28 }, [0.4, 1.2, 1]);
    h.tubo("negro", [cx + 0.7, cy + 0.42, 0.14], [cx + 0.66, cy + 0.44, 0.44], 0.035);
    h.esfera("negro", 0.17, { x: cx + 0.68, y: cy + 0.25, z: -0.3 }, [0.35, 1, 1]);
    h.dona("rojo", 0.1, 0.025, { x: cx + 0.62, y: cy + 0.02, z: -0.5, ry: Math.PI / 2 - 0.6 }, Math.PI * 1.5);
    // Pañuelo rojo con pintas blancas y sombrero negro de ala levantada, con calavera y huesos al frente
    h.dona("rojo", 0.76, 0.1, { x: cx, y: cy + 0.5, z: 0, rx: Math.PI / 2 });
    for (let i = -3; i <= 3; i++) h.esfera("blanco", 0.04, { x: cx + 0.86 * Math.cos(i * 0.22), y: cy + 0.5, z: 0.86 * Math.sin(i * 0.22) });
    h.poner(new THREE.CylinderGeometry(0.66, 0.78, 0.42, 40), "negro", { x: cx - 0.02, y: cy + 0.78, z: 0 });
    h.esfera("negro", 0.66, { x: cx - 0.02, y: cy + 0.98, z: 0 }, [1, 0.3, 1]);
    h.poner(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 40), "negro", { x: cx, y: cy + 0.6, z: 0, s: [1, 1, 1.18] });
    h.poner(new THREE.CylinderGeometry(1.0, 0.84, 0.5, 40, 1, true), "negro", { x: cx, y: cy + 0.84, z: 0, s: [1, 1, 1.18] });
    h.dona("negro", 1.0, 0.045, { x: cx, y: cy + 1.09, z: 0, rx: Math.PI / 2, s: [1, 1.18, 1] });
    h.esfera("blanco", 0.17, { x: cx + 0.99, y: cy + 0.86, z: 0 }, [0.45, 1, 1.05]);
    for (const sz of [1, -1]) {
      h.esfera("negro", 0.045, { x: cx + 1.06, y: cy + 0.88, z: sz * 0.065 }, [0.4, 1, 1]);
      h.tubo("blanco", [cx + 0.95, cy + 0.64, sz * 0.22], [cx + 0.97, cy + 1.06, -sz * 0.22], 0.035);
    }

    // Botas cafés con la punta hacia arriba y suela oscura
    pies(h, (h, z) => {
      h.bloque("cafe", [0.62, 0.48, 0.62], { x: XE + 0.3, y: 0.24, z }, 0.22);
      pieArriba(h, z, "cafe", "cafeOscuro");
    });
  },
);

// ── Castillo Fórmula 1 ───────────────────────────────────────────────────────────
// Cuerpo naranjo con malla, pilares grises en la entrada, base naranja con franjas amarillas y piso verde con
// obstáculos verdes; el extremo del tobogán es un gran arco naranjo, y el tobogán amarillo tiene barandas naranjas y
// base verde. El piloto (casco azul con franja blanca, cara amarilla con antiparras y bigote) mira hacia la entrada;
// sus brazos naranjos (el buzo) son las vigas de arriba y sus guantes amarillos toman un volante negro gigante sobre
// la entrada. Zapatillas amarillas, grises y negras a cada lado del escalón verde.
const formula1 = modelo(
  {
    naranja: "#ea4e1c", naranjaOscuro: "#c93f12", amarillo: "#f8c51d", guante: "#f2bf3b", gris: "#b4b8bf", negro: "#1d1e23", verde: "#4cc531",
    verdeOscuro: "#38a024", azul: "#2160cf", rojo: "#c8232e", blanco: "#f4f1ea", red: "#ffffff", malla: "#23262e", espacio: "#ffffff", borde: "#ffffff", noche: "#1f2a5c",
  },
  (h) => {
    cuerpo(h, {
      base: "naranja", piso: "verde", pisoLinea: "verdeOscuro", pilarEntrada: "gris", escalon: "verde", muroBajo: "naranja", altoMuroBajo: BASE + 0.35,
      plataforma: "naranja", tope: "verde", topePunta: "naranja", techo: "naranja", toboganBase: "verde", baranda: "naranja", llegada: "verde", aro: "gris",
      pilaresTobogan(h) {
        // Gran arco naranjo: dos pilares anchos y la viga gruesa de arriba
        for (const sz of [1, -1]) h.caja("naranja", XT, XT + 0.7, BASE - 0.05, MURO + 0.3, sz > 0 ? ZL - 0.85 : -ZL, sz > 0 ? ZL : -ZL + 0.85, 0.24);
        h.caja("naranja", XT, XT + 0.7, MURO - 0.55, MURO + 0.5, -ZL + 0.3, ZL - 0.3, 0.26);
        // Panel a cuadros de carrera en el pilar del frente
        for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
          h.caja((i + j) % 2 ? "negro" : "blanco", XT + 0.18 + j * 0.17, XT + 0.35 + j * 0.17, 0.9 + i * 0.17, 1.07 + i * 0.17, ZL - 0.01, ZL + 0.02, 0.004);
        }
      },
    });
    // Franjas amarillas en la base, por los dos costados largos y la entrada
    for (const sz of [1, -1]) {
      for (const y of [0.17, 0.27]) h.caja("amarillo", XT + 0.15, XE - 0.15, y, y + 0.055, sz > 0 ? ZL - 0.01 : -ZL - 0.01, sz > 0 ? ZL + 0.01 : -ZL + 0.01, 0.01);
    }

    // Adentro: pilar verde con punta celeste y bloque verde redondeado
    h.cilindro("verde", [0.85, BASE, 0.8], [0.85, BASE + 1.2, 0.8], 0.2);
    h.esfera("azul", 0.2, { x: 0.85, y: BASE + 1.2, z: 0.8 }, [1, 0.45, 1]);
    h.bloque("verde", [0.42, 1.05, 0.9], { x: -0.2, y: BASE + 0.52, z: -0.5 }, 0.2);

    // Brazos naranjos (buzo de carrera) con franja amarilla y logo verde, y puño del guante
    for (const sz of [1, -1]) {
      const z = sz * BRAZO_Z;
      h.tubo("naranja", [XT + 0.2, BRAZO_Y, z], [MANO_X - 0.35, BRAZO_Y, z], BRAZO_R);
      h.tubo("amarillo", [XT + 0.5, BRAZO_Y - 0.26, z + sz * 0.31], [MANO_X - 0.7, BRAZO_Y - 0.26, z + sz * 0.31], 0.035);
      h.dona("guante", BRAZO_R + 0.02, 0.1, { x: MANO_X - 0.5, y: BRAZO_Y, z, ry: Math.PI / 2 });
      h.esfera("blanco", 0.25, { x: 0.3, y: BRAZO_Y + 0.05, z: z + sz * 0.33 }, [1, 1, 0.25]);
      h.esfera("verde", 0.21, { x: 0.3, y: BRAZO_Y + 0.05, z: z + sz * 0.36 }, [1, 1, 0.25]);
      // Letras «GB» en negro
      h.caja("negro", -0.75, -0.62, BRAZO_Y - 0.17, BRAZO_Y + 0.2, z + sz * 0.37, z + sz * 0.41, 0.02);
      h.caja("negro", -0.4, -0.1, BRAZO_Y - 0.17, BRAZO_Y + 0.2, z + sz * 0.37, z + sz * 0.41, 0.06);
    }

    // Volante negro gigante, de pie sobre la entrada, con las dos manos amarillas
    const vx = MANO_X + 0.25, vy = BRAZO_Y + 0.2, va = BRAZO_Z, vh = 1.12;
    h.curva("negro", new Superelipse(vx, vy, va, vh, 3), 0.24);
    for (const sz of [1, -1]) {
      const z = sz * va;
      h.bloque("guante", [0.85, 0.95, 0.75], { x: MANO_X - 0.05, y: vy, z: z - sz * 0.15 }, 0.32);
      for (let i = 0; i < 4; i++) h.tubo("guante", [MANO_X - 0.3, vy - 0.33 + i * 0.22, z + sz * 0.3], [vx + 0.25, vy - 0.33 + i * 0.22, z + sz * 0.3], 0.13);
      h.tubo("guante", [MANO_X - 0.15, vy + 0.45, z - sz * 0.05], [vx + 0.15, vy + 0.4, z + sz * 0.05], 0.14);
    }

    // Piloto: casco azul con franja blanca y orejeras, cara amarilla con antiparras, bigote y mentón
    const cx = XT + 0.4, cy = MURO + 1.32;
    h.esfera("azul", 0.88, { x: cx - 0.05, y: cy + 0.18, z: 0 }, [1, 1, 1.02]);
    h.dona("blanco", 0.86, 0.05, { x: cx - 0.05, y: cy + 0.18, z: 0, ry: Math.PI / 2, rz: 0 }, Math.PI);
    for (const sz of [1, -1]) h.poner(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 30), "azul", { x: cx + 0.05, y: cy - 0.1, z: sz * 0.82, rx: Math.PI / 2 });
    h.esfera("amarillo", 0.66, { x: cx + 0.32, y: cy - 0.22, z: 0 }, [0.85, 1.05, 0.95]);
    h.esfera("amarillo", 0.42, { x: cx + 0.38, y: cy - 0.82, z: 0 }, [0.95, 0.8, 1.1]);
    // Antiparras: marco negro y dos lentes crema con pupila negra
    h.bloque("negro", [0.2, 0.42, 1.16], { x: cx + 0.82, y: cy + 0.1, z: 0 }, 0.18);
    for (const sz of [1, -1]) {
      h.esfera("blanco", 0.17, { x: cx + 0.93, y: cy + 0.1, z: sz * 0.26 }, [0.45, 1, 1]);
      h.esfera("negro", 0.07, { x: cx + 1.0, y: cy + 0.08, z: sz * 0.24 }, [0.5, 1, 1]);
      h.tubo("negro", [cx + 0.9, cy - 0.33, sz * 0.03], [cx + 0.78, cy - 0.25, sz * 0.38], 0.08);
    }
    h.esfera("amarillo", 0.14, { x: cx + 0.92, y: cy - 0.15, z: 0 });

    // Zapatillas: amarillas con franjas negras y suela gris y negra, con la punta hacia arriba
    pies(h, (h, z) => {
      h.bloque("amarillo", [0.62, 0.48, 0.62], { x: XE + 0.3, y: 0.24, z }, 0.22);
      pieArriba(h, z, "amarillo", "gris", "negro");
      // Franjas negras a los costados de la zapatilla
      for (const dy of [0.55, 0.78]) for (const sz of [1, -1]) {
        h.bloque("negro", [0.4, 0.07, 0.02], { x: XE + 0.5 + dy * Math.sin(INCLINACION), y: dy, z: z + sz * 0.37, rz: -INCLINACION }, 0.01);
      }
    });
  },
);

await exportar(pirata, "castillo-pirata-v2.glb");
await exportar(formula1, "castillo-formula-1-v2.glb");

// Genera public/modelos/castillo-pirata-v1.glb y public/modelos/castillo-formula-1-v1.glb: los dos castillos armados
// por código a partir de las fotos y los videos reales (Downloads/IMG_2755.MP4 y IMG_2754.MP4). Son modelos
// simplificados de bloques y tubos redondeados, con las medidas de la ficha técnica (6 × 4 m de base y 5 m de alto)
// y el espacio libre de 8 × 6 m marcado en el suelo, pensados para reemplazarse por un escaneo cuando exista.
//
// Ejes: x a lo largo (6 m), y hacia arriba, z hacia la cámara (el costado largo con la malla y el aro de básquetbol).
// El personaje (capitán pirata o piloto) va arriba al fondo; sus brazos cruzan el techo hacia el extremo izquierdo,
// donde está el garfio o el volante. A la derecha, la salida del tobogán.
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
const BASE = 0.45; // alto del colchón de la base

/** Arma un modelo: `dibujar` recibe las herramientas y pinta con los colores de `colores`. */
function modelo(colores, dibujar) {
  const piezas = Object.fromEntries(Object.keys(colores).map((k) => [k, []]));
  const agregar = (color, geo) => {
    if (!piezas[color]) throw new Error(`Color sin definir: ${color}`);
    piezas[color].push(geo.index ? geo.toNonIndexed() : geo);
  };
  const poner = (geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = [1, 1, 1] } = {}) => {
    geo.scale(...s);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")).setPosition(x, y, z));
    agregar(color, geo);
  };
  const h = {
    poner,
    /** Bloque redondeado entre coordenadas por eje. */
    caja(color, x0, x1, y0, y1, z0, z1, r = 0.14) {
      const w = x1 - x0, alto = y1 - y0, d = z1 - z0;
      const radio = Math.min(r, w / 2 - 0.01, alto / 2 - 0.01, d / 2 - 0.01);
      poner(new RoundedBoxGeometry(w, alto, d, 2, Math.max(0.005, radio)), color, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
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
    /** Columna vertical con franjas alternadas (de abajo hacia arriba). */
    columna(colores2, x, z, y0, y1, radio, franjas = 6) {
      const paso = (y1 - y0) / franjas;
      for (let i = 0; i < franjas; i++) {
        poner(new THREE.CylinderGeometry(radio, radio, paso, 24), colores2[i % colores2.length], { x, y: y0 + paso * (i + 0.5), z });
      }
      poner(new THREE.SphereGeometry(radio, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), colores2[(franjas - 1) % colores2.length], { x, y: y1, z });
    },
    esfera(color, r, pos, s) {
      poner(new THREE.SphereGeometry(r, 32, 20), color, { ...pos, s });
    },
    dona(color, R, grosor, pos) {
      poner(new THREE.TorusGeometry(R, grosor, 14, 36), color, pos);
    },
    /** Panel de malla (plano translúcido) en un costado que mira hacia ±z o ±x. */
    malla(x0, x1, y0, y1, z, ry = 0) {
      poner(new THREE.PlaneGeometry(x1 - x0, y1 - y0), "malla", { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, ry });
    },
  };
  dibujar(h);

  // Espacio libre (8 × 6 m) translúcido con borde blanco y una flecha amarilla al frente.
  const EL = LARGO + 2 * SEGURIDAD, EA = ANCHO + 2 * SEGURIDAD, y = 0.01, b = 0.1;
  poner(new THREE.PlaneGeometry(EL, EA), "espacio", { y, rx: -Math.PI / 2 });
  for (const [x, z, w, d] of [[0, -EA / 2 + b / 2, EL, b], [0, EA / 2 - b / 2, EL, b], [-EL / 2 + b / 2, 0, b, EA], [EL / 2 - b / 2, 0, b, EA]]) {
    poner(new THREE.PlaneGeometry(w, d), "borde", { x, y: y + 0.002, z, rx: -Math.PI / 2 });
  }
  const flecha = (e) => {
    const f = new THREE.Shape();
    f.moveTo(-0.2 * e, 0);
    f.lineTo(0.2 * e, 0);
    f.lineTo(0.2 * e, 0.45);
    f.lineTo(0.42 * e, 0.45);
    f.lineTo(0, 0.45 + 0.45 * e);
    f.lineTo(-0.42 * e, 0.45);
    f.lineTo(-0.2 * e, 0.45);
    f.closePath();
    return new THREE.ShapeGeometry(f);
  };
  const contorno = flecha(1.18);
  contorno.translate(0, -0.06, 0);
  poner(contorno, "noche", { y: y + 0.004, z: ANCHO / 2 + 0.12, rx: Math.PI / 2 });
  poner(flecha(1), "amarillo", { y: y + 0.006, z: ANCHO / 2 + 0.12, rx: Math.PI / 2 });

  const escena = new THREE.Scene();
  for (const [nombre, lista] of Object.entries(piezas)) {
    if (!lista.length) continue;
    for (const g of lista) g.deleteAttribute("uv");
    const geo = mergeVertices(mergeGeometries(lista), 1e-4);
    const translucida = nombre === "malla" || nombre === "espacio";
    const mat = new THREE.MeshStandardMaterial({
      name: nombre,
      color: new THREE.Color(colores[nombre]),
      roughness: translucida ? 0.9 : 0.42,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: translucida,
      opacity: nombre === "espacio" ? 0.3 : translucida ? 0.55 : 1,
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

const X0 = -LARGO / 2, X1 = LARGO / 2, Z0 = -ANCHO / 2, Z1 = ANCHO / 2;
const ALTO_MURO = 2.7;

// ── Castillo Pirata ──────────────────────────────────────────────────────────────
// Cuerpo gris con malla, base azul y piso verde; columnas a rayas rojas y blancas a la derecha; el capitán
// (cara crema, barba y sombrero negros con calavera) arriba al fondo; su brazo blanco y negro cruza el techo
// hasta la mano con el garfio a la izquierda, y sus botas cafés quedan en el suelo de ese lado.
const pirata = modelo(
  {
    azul: "#2f7fd0", verde: "#59c23c", gris: "#c9ccd2", blanco: "#f4f1ea", rojo: "#d42a2f", negro: "#23242a",
    crema: "#f2dcc0", cafe: "#6b3b22", amarillo: "#f6c21c", plata: "#b7bcc4", malla: "#2b2f3a", naranja: "#f08a24",
    espacio: "#ffffff", borde: "#ffffff", noche: "#1f2a5c",
  },
  (h) => {
    const xi = X0 + 0.7; // el cuerpo empieza después de las botas
    // Base y piso
    h.caja("azul", xi, X1, 0, BASE, Z0, Z1, 0.2);
    h.caja("verde", xi + 0.25, X1 - 0.35, BASE - 0.02, BASE + 0.06, Z0 + 0.3, Z1 - 0.3, 0.04);
    // Muro del fondo y muro bajo del frente
    h.caja("gris", xi, X1 - 0.6, BASE, ALTO_MURO, Z0, Z0 + 0.35, 0.16);
    h.caja("gris", xi + 0.6, X1 - 0.6, BASE, BASE + 0.9, Z1 - 0.3, Z1, 0.14);
    h.malla(xi + 0.6, X1 - 0.6, BASE + 0.9, ALTO_MURO - 0.1, Z1 - 0.15);
    // Costado izquierdo: columnas grises y malla
    h.caja("gris", xi, xi + 0.6, BASE, ALTO_MURO + 0.1, Z1 - 0.7, Z1, 0.2);
    h.caja("gris", xi, xi + 0.35, BASE, ALTO_MURO, Z0, Z1 - 0.7, 0.14);
    h.malla(Z0 + 0.4, Z1 - 0.75, BASE + 0.8, ALTO_MURO - 0.1, xi + 0.18, Math.PI / 2);
    // Costado derecho: columnas a rayas rojas y blancas
    h.columna(["rojo", "blanco"], X1 - 0.35, Z1 - 0.35, BASE, ALTO_MURO + 0.2, 0.34, 8);
    h.columna(["rojo", "blanco"], X1 - 0.35, Z0 + 0.35, BASE, ALTO_MURO + 0.2, 0.34, 8);
    h.caja("blanco", X1 - 0.5, X1 - 0.2, ALTO_MURO - 0.2, ALTO_MURO + 0.15, Z0 + 0.35, Z1 - 0.35, 0.12);
    for (let i = 0; i < 4; i++) {
      const z = Z0 + 0.7 + i * 0.68;
      h.caja("rojo", X1 - 0.52, X1 - 0.18, ALTO_MURO - 0.21, ALTO_MURO + 0.16, z, z + 0.3, 0.1);
    }
    // Aro de básquetbol en la columna izquierda del frente
    h.caja("blanco", xi + 0.62, xi + 0.66, 1.75, 2.2, Z1 - 0.62, Z1 - 0.12, 0.01);
    h.dona("naranja", 0.2, 0.03, { x: xi + 0.88, y: 1.85, z: Z1 - 0.37, rx: Math.PI / 2 });
    // Brazo sobre el techo: manga blanca con franja roja, puño negro, mano crema con garfio
    h.tubo("blanco", [X1 - 0.8, ALTO_MURO + 0.35, Z1 - 0.25], [xi + 0.6, ALTO_MURO + 0.35, Z1 - 0.25], 0.38);
    h.tubo("negro", [xi + 1.5, ALTO_MURO + 0.35, Z1 - 0.25], [xi + 2.4, ALTO_MURO + 0.35, Z1 - 0.25], 0.4);
    h.tubo("rojo", [X1 - 1.3, ALTO_MURO + 0.35, Z1 - 0.25], [X1 - 1.0, ALTO_MURO + 0.35, Z1 - 0.25], 0.4);
    h.esfera("crema", 0.42, { x: xi + 0.2, y: ALTO_MURO + 0.3, z: Z1 - 0.25 }, [1.15, 0.9, 1]);
    h.tubo("negro", [xi + 0.1, ALTO_MURO - 0.6, Z1 - 0.25], [xi + 0.1, ALTO_MURO + 0.1, Z1 - 0.25], 0.13);
    h.poner(new THREE.TorusGeometry(0.32, 0.07, 10, 24, Math.PI * 1.3), "plata", { x: xi - 0.05, y: ALTO_MURO + 0.95, z: Z1 - 0.25, rz: -0.4 });
    // Brazo del fondo (más bajo, casi oculto)
    h.tubo("blanco", [X1 - 1.4, ALTO_MURO + 0.25, Z0 + 0.25], [xi + 0.9, ALTO_MURO + 0.25, Z0 + 0.25], 0.32);
    // Capitán: cara, barba, bigote, parche, sombrero con calavera
    const cx = 0.6, cz = Z0 + 0.35, cy = ALTO_MURO + 1.2;
    h.esfera("crema", 0.78, { x: cx, y: cy, z: cz }, [1, 1.12, 0.95]);
    h.esfera("negro", 0.62, { x: cx, y: cy - 0.42, z: cz + 0.22 }, [1.05, 0.7, 0.75]);
    h.tubo("negro", [cx - 0.36, cy - 0.05, cz + 0.72], [cx + 0.36, cy - 0.05, cz + 0.72], 0.09);
    h.esfera("negro", 0.13, { x: cx - 0.3, y: cy + 0.25, z: cz + 0.68 }, [1, 1, 0.4]);
    h.esfera("rojo", 0.08, { x: cx + 0.55, y: cy - 0.05, z: cz + 0.45 }, [1, 1, 0.5]);
    h.poner(new THREE.CylinderGeometry(0.62, 0.8, 0.55, 28), "negro", { x: cx, y: cy + 0.85, z: cz });
    h.poner(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 32), "negro", { x: cx, y: cy + 0.6, z: cz, s: [1.2, 1, 0.8] });
    h.tubo("rojo", [cx - 0.75, cy + 0.66, cz + 0.45], [cx + 0.75, cy + 0.66, cz + 0.45], 0.06);
    h.esfera("blanco", 0.16, { x: cx, y: cy + 0.9, z: cz + 0.62 }, [1, 1.1, 0.4]);
    // Botas cafés en el suelo, a la izquierda
    for (const z of [Z1 - 0.9, Z1 - 2.2]) {
      h.caja("cafe", X0, X0 + 0.75, 0, 0.45, z - 0.45, z + 0.45, 0.2);
      h.caja("cafe", X0 + 0.2, X0 + 0.75, 0.4, 1.35, z - 0.35, z + 0.35, 0.22);
      h.caja("negro", X0 + 0.18, X0 + 0.77, 1.05, 1.2, z - 0.37, z + 0.37, 0.06);
    }
    // Adentro: tobogán amarillo con bordes a rayas desde una plataforma al fondo, y obstáculos de dona
    h.caja("gris", X1 - 2.3, X1 - 0.7, BASE, 1.75, Z0 + 0.35, Z0 + 1.3, 0.16);
    h.poner(new THREE.BoxGeometry(1.0, 0.12, 2.0), "amarillo", { x: X1 - 1.5, y: 1.1, z: Z0 + 2.25, rx: 0.56 });
    for (const dx of [-0.6, 0.6]) {
      h.poner(new RoundedBoxGeometry(0.22, 0.35, 2.1, 2, 0.08), "blanco", { x: X1 - 1.5 + dx, y: 1.25, z: Z0 + 2.25, rx: 0.56 });
      h.poner(new RoundedBoxGeometry(0.24, 0.1, 2.1, 2, 0.04), "rojo", { x: X1 - 1.5 + dx, y: 1.45, z: Z0 + 2.2, rx: 0.56 });
    }
    for (const [x, z] of [[-0.9, 0.2], [0.2, -0.3]]) {
      h.dona("blanco", 0.42, 0.17, { x, y: BASE + 0.6, z, ry: Math.PI / 2 });
      h.dona("rojo", 0.42, 0.175, { x, y: BASE + 0.6, z, ry: Math.PI / 2, s: [1, 1, 0.35] });
    }
    h.poner(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 20), "rojo", { x: -0.2, y: BASE + 0.55, z: 0.8 });
  },
);

// ── Castillo Fórmula 1 ───────────────────────────────────────────────────────────
// Cuerpo naranjo con franjas amarillas y malla gris; el piloto (casco azul, cara amarilla con antiparras) arriba al
// fondo; sus manos amarillas toman un volante negro gigante en el extremo izquierdo, delante de dos ruedas
// negras, grises y amarillas. A la derecha, panel a cuadros de carrera y la salida del tobogán con base verde.
const formula1 = modelo(
  {
    naranja: "#ec4f1c", amarillo: "#f6c21c", gris: "#a7abb3", negro: "#23242a", verde: "#4cc23c", azul: "#2459c9",
    blanco: "#f4f1ea", malla: "#2b2f3a", espacio: "#ffffff", borde: "#ffffff", noche: "#1f2a5c",
  },
  (h) => {
    const xi = X0 + 0.9; // el cuerpo empieza después de las ruedas
    const xf = X1 - 1.0; // y termina antes de la salida del tobogán
    h.caja("naranja", xi, xf, 0, BASE, Z0, Z1, 0.2);
    h.caja("amarillo", xi + 0.1, xf - 0.1, BASE - 0.15, BASE - 0.05, Z1 - 0.06, Z1 + 0.01, 0.02);
    h.caja("verde", xi + 0.3, xf - 0.3, BASE - 0.02, BASE + 0.06, Z0 + 0.3, Z1 - 0.3, 0.04);
    // Muros: fondo naranjo, frente gris con malla, columnas grises a la izquierda y naranjas a la derecha
    h.caja("naranja", xi, xf, BASE, ALTO_MURO, Z0, Z0 + 0.35, 0.16);
    h.caja("gris", xi + 0.6, xf - 0.5, BASE, BASE + 0.8, Z1 - 0.3, Z1, 0.14);
    h.malla(xi + 0.6, xf - 0.5, BASE + 0.8, ALTO_MURO - 0.2, Z1 - 0.15);
    h.caja("gris", xi, xi + 0.6, BASE, ALTO_MURO, Z1 - 0.7, Z1, 0.2);
    h.caja("gris", xi, xi + 0.35, BASE, ALTO_MURO, Z0, Z1 - 0.7, 0.14);
    h.malla(Z0 + 0.4, Z1 - 0.75, BASE + 0.8, ALTO_MURO - 0.2, xi + 0.18, Math.PI / 2);
    h.caja("naranja", xf - 0.5, xf, BASE, ALTO_MURO, Z1 - 0.6, Z1, 0.18);
    h.caja("naranja", xf - 0.5, xf, BASE, ALTO_MURO, Z0, Z0 + 0.6, 0.18);
    // Viga del techo naranja con franja amarilla y el número «GB» en negro
    h.caja("naranja", xi, xf, ALTO_MURO - 0.1, ALTO_MURO + 0.55, Z1 - 0.55, Z1, 0.22);
    h.caja("amarillo", xi + 0.2, xf - 0.2, ALTO_MURO + 0.05, ALTO_MURO + 0.15, Z1 + 0.0, Z1 + 0.02, 0.01);
    h.caja("negro", 0.2, 0.32, ALTO_MURO + 0.2, ALTO_MURO + 0.5, Z1 - 0.01, Z1 + 0.02, 0.01);
    h.caja("negro", 0.5, 0.95, ALTO_MURO + 0.2, ALTO_MURO + 0.5, Z1 - 0.01, Z1 + 0.02, 0.02);
    h.dona("blanco", 0.17, 0.035, { x: -0.6, y: ALTO_MURO + 0.33, z: Z1 + 0.01 });
    h.esfera("verde", 0.17, { x: -0.6, y: ALTO_MURO + 0.33, z: Z1 + 0.0 }, [1, 1, 0.15]);
    // Panel a cuadros de carrera en la columna derecha del frente
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      h.caja((i + j) % 2 ? "negro" : "blanco", xf - 0.45 + j * 0.2, xf - 0.25 + j * 0.2, 1.0 + i * 0.2, 1.2 + i * 0.2, Z1 + 0.0, Z1 + 0.03, 0.005);
    }
    // Aro de básquetbol
    h.caja("blanco", xi + 0.62, xi + 0.66, 1.75, 2.2, Z1 - 0.62, Z1 - 0.12, 0.01);
    h.dona("gris", 0.2, 0.03, { x: xi + 0.88, y: 1.85, z: Z1 - 0.37, rx: Math.PI / 2 });
    // Piloto: casco azul, cara amarilla, antiparras y bigote negros
    const cx = 0.4, cz = Z0 + 0.4, cy = ALTO_MURO + 1.15;
    h.esfera("amarillo", 0.62, { x: cx, y: cy - 0.15, z: cz + 0.12 }, [1, 1.05, 0.95]);
    h.poner(new THREE.SphereGeometry(0.82, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), "azul", { x: cx, y: cy + 0.05, z: cz });
    h.esfera("azul", 0.3, { x: cx - 0.72, y: cy - 0.1, z: cz }, [0.5, 1, 1]);
    h.esfera("azul", 0.3, { x: cx + 0.72, y: cy - 0.1, z: cz }, [0.5, 1, 1]);
    h.tubo("negro", [cx - 0.42, cy + 0.08, cz + 0.62], [cx + 0.42, cy + 0.08, cz + 0.62], 0.1);
    h.esfera("amarillo", 0.12, { x: cx - 0.22, y: cy + 0.08, z: cz + 0.7 }, [1, 1, 0.4]);
    h.esfera("amarillo", 0.12, { x: cx + 0.22, y: cy + 0.08, z: cz + 0.7 }, [1, 1, 0.4]);
    h.tubo("negro", [cx - 0.25, cy - 0.32, cz + 0.68], [cx + 0.25, cy - 0.32, cz + 0.68], 0.07);
    // Brazos amarillos sobre el techo hasta el volante
    h.tubo("amarillo", [cx - 0.3, ALTO_MURO + 0.75, Z1 - 0.3], [xi + 0.3, ALTO_MURO + 0.85, Z1 - 0.3], 0.42);
    h.tubo("amarillo", [cx - 0.3, ALTO_MURO + 0.65, Z0 + 0.8], [xi + 0.3, ALTO_MURO + 0.85, Z0 + 1.2], 0.38);
    // Volante negro gigante, de pie en el extremo izquierdo, con las dos manos amarillas
    const vx = X0 + 0.55, vy = 2.6;
    h.dona("negro", 1.05, 0.2, { x: vx, y: vy, z: 0, ry: Math.PI / 2 });
    h.caja("negro", vx - 0.12, vx + 0.12, vy - 0.15, vy + 0.15, -0.9, 0.9, 0.08);
    h.caja("negro", vx - 0.12, vx + 0.12, vy - 1.0, vy, -0.12, 0.12, 0.06);
    h.esfera("amarillo", 0.4, { x: vx + 0.15, y: vy + 0.55, z: 0.9 }, [1, 1.1, 1.2]);
    h.esfera("amarillo", 0.4, { x: vx + 0.15, y: vy + 0.55, z: -0.9 }, [1, 1.1, 1.2]);
    // Ruedas delanteras: neumático negro con flancos grises y llanta amarilla
    for (const z of [Z1 - 0.55, Z0 + 0.55]) {
      h.caja("negro", X0, X0 + 0.95, 0, 1.25, z - 0.38, z + 0.38, 0.38);
      h.caja("gris", X0 + 0.08, X0 + 0.87, 0.08, 1.17, z - 0.41, z + 0.41, 0.3);
      h.caja("amarillo", X0 + 0.22, X0 + 0.73, 0.25, 1.0, z - 0.43, z + 0.43, 0.2);
      h.caja("negro", X0 + 0.22, X0 + 0.73, 0.55, 0.7, z - 0.44, z + 0.44, 0.04);
    }
    // Adentro: obstáculos verdes
    for (const [x, z] of [[-0.8, 0.3], [0.1, -0.4], [0.9, 0.5]]) {
      h.poner(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 20), "verde", { x, y: BASE + 0.6, z });
      h.esfera("verde", 0.22, { x, y: BASE + 1.2, z });
    }
    // Tobogán: rampa amarilla con barandas naranjas y salida verde, a la derecha
    h.caja("naranja", xf - 0.6, xf, BASE, 1.9, -0.75, 0.75, 0.16);
    h.poner(new THREE.BoxGeometry(1.75, 0.12, 1.1), "amarillo", { x: xf + 0.62, y: 1.1, z: 0, rz: -0.72 });
    for (const dz of [-0.62, 0.62]) {
      h.poner(new RoundedBoxGeometry(1.85, 0.4, 0.22, 2, 0.1), "naranja", { x: xf + 0.62, y: 1.28, z: dz, rz: -0.72 });
    }
    h.caja("verde", xf + 0.2, X1, 0, 0.32, -0.75, 0.75, 0.14);
  },
);

await exportar(pirata, "castillo-pirata-v1.glb");
await exportar(formula1, "castillo-formula-1-v1.glb");

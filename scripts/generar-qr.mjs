// Genera el código QR impreso de Saltabum con la paleta y el logotipo oficial (sin castillo).
// El QR apunta a saltabum.cl/qr (o /qr/<campaña>), que cuenta el escaneo y redirige al inicio con UTM.
// Uso (desde la raíz del proyecto):
//   node scripts/generar-qr.mjs              → https://saltabum.cl/qr        (campaña «general»)
//   node scripts/generar-qr.mjs volante      → https://saltabum.cl/qr/volante
// Salida en docs/qr/<campaña>/: tarjeta (SVG, PNG, PDF) y QR suelto (SVG, PNG).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const campana = (process.argv[2] ?? "general").toLowerCase();
if (!/^[a-z0-9-]{1,40}$/.test(campana)) throw new Error("La campaña solo puede tener minúsculas, números y guiones");
const URL_QR = campana === "general" ? "https://saltabum.cl/qr" : `https://saltabum.cl/qr/${campana}`;
const OUT = path.join(ROOT, "docs", "qr", campana);
fs.mkdirSync(OUT, { recursive: true });

const C = {
  noche: "#1F2A5C",
  crema: "#FFF6EA",
  blanco: "#FFFFFF",
  // Ojos del QR con los tonos «-texto» del sitio: más oscuros que los del logo, para que se lea bien impreso.
  ojos: ["#C9361A", "#1F6FC2", "#7046D6"],
  // Orden fijo de las letras del logotipo.
  letras: ["#F0462D", "#FFC23A", "#2DB866", "#2F8FEA", "#8E5BE8", "#FF8A1F", "#FF6FAE", "#7FD3F7"],
};

/** Inserta un SVG del logo dentro de otro, en la caja indicada. */
function anidar(archivo, x, y, ancho, alto) {
  const svg = fs.readFileSync(path.join(ROOT, "saltabum_logo", "SVG", archivo), "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const cuerpo = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>.*?<\/title>/, "");
  return `<svg x="${x}" y="${y}" width="${ancho}" height="${alto}" viewBox="${viewBox}">${cuerpo}</svg>`;
}

// ---------- QR: puntos redondos, ojos de colores y el monograma al centro ----------
// Corrección de errores H (30 %): permite tapar el centro con el monograma sin que deje de leerse.
const qr = QRCode.create(URL_QR, { errorCorrectionLevel: "H" });
const n = qr.modules.size;
const MARGEN = 4; // zona silenciosa en módulos
const total = n + MARGEN * 2;
const centro = n / 2;
const radioLogo = n * 0.15; // ~7 % del área, bajo el límite que tolera el nivel H

const enOjo = (f, c) => (f < 7 && c < 7) || (f < 7 && c >= n - 7) || (f >= n - 7 && c < 7);
const enLogo = (f, c) => Math.hypot(f + 0.5 - centro, c + 0.5 - centro) < radioLogo + 0.6;

let puntos = "";
for (let f = 0; f < n; f++) {
  for (let c = 0; c < n; c++) {
    if (!qr.modules.get(f, c) || enOjo(f, c) || enLogo(f, c)) continue;
    puntos += `<circle cx="${c + MARGEN + 0.5}" cy="${f + MARGEN + 0.5}" r="0.5"/>`;
  }
}

const ojo = (f, c, color) => {
  const x = c + MARGEN;
  const y = f + MARGEN;
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="${color}" stroke-width="1"/>
    <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${C.noche}"/>`;
};

const lado = radioLogo * 2;
const qrInterior = `
  <rect width="${total}" height="${total}" fill="${C.blanco}"/>
  <g fill="${C.noche}">${puntos}</g>
  ${ojo(0, 0, C.ojos[0])}${ojo(0, n - 7, C.ojos[1])}${ojo(n - 7, 0, C.ojos[2])}
  ${anidar("saltabum-monograma-color.svg", MARGEN + centro - radioLogo, MARGEN + centro - radioLogo, lado, lado)}`;

const qrSuelto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="Código QR de Saltabum, ${URL_QR}">${qrInterior}</svg>`;
fs.writeFileSync(path.join(OUT, `qr-saltabum-${campana}.svg`), qrSuelto);
await sharp(Buffer.from(qrSuelto), { density: 2400 / total * 72 / 1 })
  .resize(2400, 2400)
  .png()
  .toFile(path.join(OUT, `qr-saltabum-${campana}.png`));

// ---------- Tarjeta: logotipo, QR sobre placa blanca, llamado y franja arcoíris ----------
const W = 1200;
const H = 1650;
const qrLado = 860;
const qrX = (W - qrLado) / 2;
const qrY = 400;
const franja = C.letras.map((color, i) => `<rect x="${(W / 8) * i}" y="${H - 56}" width="${W / 8 + 1}" height="56" fill="${color}"/>`).join("");

const tarjeta = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Escanea y reserva tu inflable en saltabum.cl">
  <defs><clipPath id="borde"><rect width="${W}" height="${H}" rx="64"/></clipPath></defs>
  <g clip-path="url(#borde)">
    <rect width="${W}" height="${H}" fill="${C.crema}"/>
    ${franja}
  </g>
  ${anidar("saltabum-logotipo-color.svg", (W - 820) / 2, 70, 820, 296)}
  <rect x="${qrX - 6}" y="${qrY - 6}" width="${qrLado + 12}" height="${qrLado + 12}" rx="56" fill="${C.blanco}" stroke="${C.noche}" stroke-width="10"/>
  <svg x="${qrX + 20}" y="${qrY + 20}" width="${qrLado - 40}" height="${qrLado - 40}" viewBox="0 0 ${total} ${total}">${qrInterior.replace(`<rect width="${total}" height="${total}" fill="${C.blanco}"/>`, "")}</svg>
  <text x="${W / 2}" y="${qrY + qrLado + 130}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="92" fill="${C.noche}">Escanea y reserva</text>
  <text x="${W / 2}" y="${qrY + qrLado + 210}" text-anchor="middle" font-family="Figtree, sans-serif" font-weight="800" font-size="54" fill="#C9361A">saltabum.cl</text>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="60" fill="none" stroke="${C.noche}" stroke-width="10"/>
</svg>`;
fs.writeFileSync(path.join(OUT, `tarjeta-qr-saltabum-${campana}.svg`), tarjeta);

// PNG y PDF con Edge headless, para que tome Fredoka y Figtree desde Google Fonts.
const html = path.join(OUT, "_tarjeta.html");
fs.writeFileSync(
  html,
  `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Figtree:wght@800&display=block" rel="stylesheet">
  <style>@page{size:${W / 10}mm ${H / 10}mm;margin:0}html,body{margin:0;background:transparent}svg{display:block;width:${W / 10}mm;height:${H / 10}mm}</style>
  </head><body>${tarjeta}</body></html>`,
);
const url = "file:///" + html.replace(/\\/g, "/");
const edge = (args) => execFileSync(EDGE, ["--headless", "--disable-gpu", "--virtual-time-budget=8000", ...args, url], { stdio: "ignore", timeout: 90000 });
edge(["--no-pdf-header-footer", `--print-to-pdf=${path.join(OUT, `tarjeta-qr-saltabum-${campana}.pdf`)}`]);

const htmlPng = path.join(OUT, "_tarjeta-png.html");
fs.writeFileSync(
  htmlPng,
  fs.readFileSync(html, "utf8").replace(/svg\{display:block;width:[^}]+\}/, `svg{display:block;width:${W * 2}px;height:${H * 2}px}`).replace("<body>", '<body style="width:2400px">'),
);
const pngTmp = path.join(OUT, "_tarjeta.png");
execFileSync(EDGE, ["--headless", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000", `--window-size=${W * 2},${H * 2}`, "--default-background-color=00000000", `--screenshot=${pngTmp}`, "file:///" + htmlPng.replace(/\\/g, "/")], { stdio: "ignore", timeout: 90000 });
// En Windows, Edge a veces termina antes de escribir el archivo: se espera hasta que aparezca.
for (let i = 0; i < 60 && !fs.existsSync(pngTmp); i++) await new Promise((r) => setTimeout(r, 500));
await new Promise((r) => setTimeout(r, 500));
await sharp(pngTmp).flatten({ background: C.blanco }).png().toFile(path.join(OUT, `tarjeta-qr-saltabum-${campana}.png`));
for (const f of [html, htmlPng, pngTmp]) fs.rmSync(f);

console.log(`QR ${URL_QR} (versión ${qr.version}, ${n}×${n}) → ${path.relative(ROOT, OUT)}`);

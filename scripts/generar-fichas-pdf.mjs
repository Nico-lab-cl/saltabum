// Genera public/fichas/ficha-tecnica-<inflable>.pdf (A4 vertical, 2 páginas) imprimiendo /fichas-pdf/<inflable>/
// con Edge en modo headless. Los datos salen de src/design/inflables.ts, así el PDF nunca queda desactualizado.
//
// Uso: con el sitio corriendo (npm run dev), node scripts/generar-fichas-pdf.mjs [url-base]
//      url-base por defecto: http://localhost:4321

import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:4321";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const INFLABLES = ["megatobogan-arcoiris", "castillo-pirata", "castillo-formula-1"];

mkdirSync("public/fichas", { recursive: true });
for (const slug of INFLABLES) {
  const salida = path.resolve(`public/fichas/ficha-tecnica-${slug}.pdf`);
  execFileSync(EDGE, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--virtual-time-budget=15000",
    `--print-to-pdf=${salida}`,
    `${BASE}/fichas-pdf/${slug}/`,
  ], { stdio: "ignore" });
  console.log(`${path.basename(salida)} · ${(statSync(salida).size / 1024).toFixed(0)} KB`);
}

// Panel de escaneos del QR (mapa con Leaflet). Se importa solo desde PanelQr.astro cuando el panel está en la página,
// así Leaflet y este código nunca se mezclan con los scripts del sitio público.
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

type Escaneo = {
  id: number;
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
  creado: string;
};

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const seccion = $("[data-qr-panel]");
const selCampana = $<HTMLSelectElement>("[data-qr-campana]");
const selDias = $<HTMLSelectElement>("[data-qr-dias]");
const ZONA = "America/Santiago";
const diaChile = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaChile = (iso: string) =>
  Number(new Date(iso).toLocaleString("en-US", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" }));
const fechaHora = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONA,
});

let todos: Escaneo[] = [];
let mapa: L.Map | undefined;
let capa: L.LayerGroup | undefined;

// Cloudflare entrega la razón social de la red: se muestra la marca que la gente conoce.
const MARCAS: [RegExp, string][] = [
  [/entel/i, "Entel"],
  [/telefonica|movistar/i, "Movistar"],
  [/claro|telmex/i, "Claro"],
  [/wom|nextel/i, "WOM"],
  [/vtr/i, "VTR"],
  [/pacifico cable|mundo/i, "Mundo"],
  [/gtd|telsur/i, "GTD"],
];
const compania = (e: Escaneo) =>
  e.operador ? (MARCAS.find(([re]) => re.test(e.operador!))?.[1] ?? e.operador) : "Sin dato";
const lugar = (e: Escaneo) => [e.ciudad, e.region].filter(Boolean).join(", ") || "Sin dato";
const equipo = (e: Escaneo) =>
  e.modelo ||
  (e.dispositivo === "ios"
    ? "iPhone"
    : e.dispositivo === "android"
      ? "Android (sin modelo)"
      : e.dispositivo === "ipad"
        ? "iPad"
        : "Computador u otro");
const valor: Record<string, (e: Escaneo) => string> = {
  ciudad: (e) => e.ciudad || "Sin dato",
  equipo,
  so: (e) => e.so || "Sin dato",
  navegador: (e) => e.navegador || "Sin dato",
  operador: compania,
  codigo: (e) => e.codigo,
};

function contar<T>(lista: T[], clave: (x: T) => string) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

/** Barras verticales de una sola serie; el valor y la etiqueta salen en el tooltip nativo. */
function barras(caja: HTMLElement, datos: [string, number][]) {
  const max = Math.max(1, ...datos.map(([, n]) => n));
  caja.replaceChildren(
    ...datos.map(([etiqueta, n]) => {
      const col = document.createElement("div");
      col.className = "group relative flex h-full flex-1 items-end";
      col.title = `${etiqueta}: ${n} ${n === 1 ? "escaneo" : "escaneos"}`;
      const barra = document.createElement("div");
      barra.className = "bg-azul-texto group-hover:bg-noche w-full rounded-t-[4px]";
      barra.style.height = n ? `${Math.max(4, (n / max) * 100)}%` : "0";
      col.append(barra);
      return col;
    }),
  );
}

function ranking(lista: HTMLElement, datos: [string, number][], total: number) {
  if (!datos.length)
    return lista.replaceChildren(
      Object.assign(document.createElement("li"), {
        textContent: "Sin escaneos",
        className: "text-noche-suave",
      }),
    );
  lista.replaceChildren(
    ...datos.slice(0, 8).map(([nombre, n]) => {
      const li = document.createElement("li");
      li.className = "flex flex-col gap-1";
      const fila = document.createElement("div");
      fila.className = "flex justify-between gap-3";
      fila.append(
        Object.assign(document.createElement("span"), {
          textContent: nombre,
          className: "truncate font-bold",
        }),
      );
      fila.append(
        Object.assign(document.createElement("span"), {
          textContent: `${n} · ${Math.round((n / total) * 100)} %`,
          className: "text-noche-suave shrink-0",
        }),
      );
      const pista = document.createElement("div");
      pista.className = "bg-arena h-2 rounded-full";
      const relleno = document.createElement("div");
      relleno.className = "bg-azul-texto h-2 rounded-full";
      relleno.style.width = `${(n / datos[0][1]) * 100}%`;
      pista.append(relleno);
      li.append(fila, pista);
      return li;
    }),
  );
}

function dibujarMapa(lista: Escaneo[]) {
  if (!mapa) {
    mapa = L.map($("[data-qr-mapa]"), { scrollWheelZoom: false }).setView([-33.05, -71.5], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      // El panel no manda referer (no-referrer), pero el servidor de mapas lo exige: solo el dominio, sin la ruta.
      referrerPolicy: "strict-origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }
  capa!.clearLayers();
  const puntos = new Map<string, { lat: number; lon: number; lugar: string; n: number }>();
  for (const e of lista) {
    if (e.lat == null || e.lon == null) continue;
    const k = `${e.lat.toFixed(2)},${e.lon.toFixed(2)}`;
    const p = puntos.get(k) ?? { lat: e.lat, lon: e.lon, lugar: lugar(e), n: 0 };
    p.n++;
    puntos.set(k, p);
  }
  const max = Math.max(1, ...[...puntos.values()].map((p) => p.n));
  for (const p of puntos.values()) {
    L.circleMarker([p.lat, p.lon], {
      radius: 7 + Math.sqrt(p.n / max) * 13,
      color: "#ffffff",
      weight: 2,
      fillColor: "#c9361a",
      fillOpacity: 0.75,
    })
      .bindTooltip(
        `<strong>${p.lugar.replace(/</g, "&lt;")}</strong><br>${p.n} ${p.n === 1 ? "escaneo" : "escaneos"}`,
      )
      .addTo(capa!);
  }
  if (puntos.size)
    mapa.fitBounds(L.latLngBounds([...puntos.values()].map((p) => [p.lat, p.lon])).pad(0.4), {
      maxZoom: 11,
    });
  // El mapa se crea con la sección oculta: hay que recalcular su tamaño al mostrarla.
  setTimeout(() => mapa!.invalidateSize(), 50);
}

function celda(texto: string, clase = "") {
  const td = document.createElement("td");
  td.className = `p-3 ${clase}`;
  td.textContent = texto;
  return td;
}

function filtrados() {
  return selCampana.value ? todos.filter((e) => e.codigo === selCampana.value) : todos;
}

function dibujar() {
  const lista = filtrados();
  const dias = Number(selDias.value);
  const hoy = diaChile(new Date().toISOString());

  $("[data-qr-kpi=escaneos]").textContent = String(lista.length);
  $("[data-qr-kpi=personas]").textContent = String(
    new Set(lista.map((e) => e.visitante ?? `id${e.id}`)).size,
  );
  $("[data-qr-kpi=hoy]").textContent = String(lista.filter((e) => diaChile(e.creado) === hoy).length);
  $("[data-qr-kpi=ciudades]").textContent = String(
    new Set(lista.map((e) => e.ciudad).filter(Boolean)).size,
  );

  // Por día (o por mes en el último año), con los días sin escaneos en cero.
  const porMes = dias > 90;
  $("[data-qr-titulo-dias]").textContent = porMes ? "Escaneos por mes" : "Escaneos por día";
  const cuenta = new Map(
    contar(lista, (e) => (porMes ? diaChile(e.creado).slice(0, 7) : diaChile(e.creado))),
  );
  const serie: [string, number][] = [];
  const etiqueta = (k: string) =>
    new Date(`${porMes ? `${k}-01` : k}T12:00:00Z`).toLocaleDateString(
      "es-CL",
      porMes
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" },
    );
  if (porMes) {
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const k = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      serie.push([etiqueta(k), cuenta.get(k) ?? 0]);
    }
  } else {
    for (let i = dias - 1; i >= 0; i--) {
      const k = diaChile(new Date(Date.now() - i * 864e5).toISOString());
      serie.push([etiqueta(k), cuenta.get(k) ?? 0]);
    }
  }
  barras($("[data-qr-dias-barras]"), serie);
  $("[data-qr-dias-ejes]").replaceChildren(
    ...[serie[0], serie[Math.floor(serie.length / 2)], serie.at(-1)!].map(([t]) =>
      Object.assign(document.createElement("span"), { textContent: t }),
    ),
  );

  const horas = Array.from({ length: 24 }, () => 0);
  for (const e of lista) horas[horaChile(e.creado)]++;
  barras(
    $("[data-qr-horas]"),
    horas.map((n, h) => [`${String(h).padStart(2, "0")}:00 a ${String(h).padStart(2, "0")}:59`, n]),
  );

  for (const clave of Object.keys(valor))
    ranking($(`[data-qr-ranking=${clave}]`), contar(lista, valor[clave]), lista.length);

  dibujarMapa(lista);

  $("[data-qr-filas]").replaceChildren(
    ...(lista.length
      ? lista.slice(0, 300).map((e) => {
          const tr = document.createElement("tr");
          tr.className = "border-noche/10 border-t";
          tr.append(
            celda(fechaHora.format(new Date(e.creado)), "whitespace-nowrap"),
            celda(e.codigo),
            celda(lugar(e)),
            celda(equipo(e)),
            celda(e.so ?? ""),
            celda(e.navegador ?? ""),
            celda(e.operador ? compania(e) : ""),
            celda(e.visitante?.slice(0, 6) ?? "", "font-mono text-xs"),
          );
          return tr;
        })
      : [
          Object.assign(document.createElement("tr"), {
            innerHTML: '<td class="p-3" colspan="8">Todavía no hay escaneos en este período</td>',
          }),
        ]),
  );
}

async function cargar() {
  const res = await fetch(`/api/admin/qr?dias=${selDias.value}`, {
    credentials: "same-origin",
    headers: { "x-saltabum-admin": "1" },
  });
  if (!res.ok) return;
  todos = ((await res.json()) as { escaneos: Escaneo[] }).escaneos;
  const elegida = selCampana.value;
  const campanas = [...new Set(todos.map((e) => e.codigo))].sort();
  selCampana.replaceChildren(
    new Option("Todas", ""),
    ...campanas.map((c) => new Option(c, c, false, c === elegida)),
  );
  seccion.hidden = false;
  dibujar();
}

// El empaquetador comparte este archivo con el visor 3D de la web: fuera del panel no hay nada que enganchar.
if (seccion) iniciar();
function iniciar() {
  selDias.addEventListener("change", () => void cargar());
  selCampana.addEventListener("change", dibujar);

  $("[data-qr-csv]").addEventListener("click", () => {
    const cols = [
      "creado",
      "codigo",
      "ciudad",
      "region",
      "pais",
      "lat",
      "lon",
      "operador",
      "dispositivo",
      "so",
      "modelo",
      "navegador",
      "idioma",
      "visitante",
    ] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      cols.join(","),
      ...filtrados().map((e) =>
        cols.map((c) => esc(c === "creado" ? fechaHora.format(new Date(e.creado)) : e[c])).join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `escaneos-qr-saltabum-${diaChile(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.addEventListener("panel:listo", () => void cargar());
  // El mapa se dibuja con la pestaña oculta: al mostrarla hay que recalcular su tamaño.
  document.addEventListener("panel:pestana", (e) => {
    if ((e as CustomEvent<string>).detail === "qr" && mapa) setTimeout(() => mapa!.invalidateSize(), 50);
  });
  document.addEventListener("panel:cerrado", () => {
    seccion.hidden = true;
    todos = [];
  });
}

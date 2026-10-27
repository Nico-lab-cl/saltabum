// Galería de la ficha: la miniatura elegida pasa a la foto grande, y al tocar la foto grande se abre en pantalla
// completa (con flechas entre las fotos de ese inflable, cerrar con la X, tocando afuera o con Esc).
// Se puede llamar varias veces (cada galería se activa una sola vez), así sirve en la página de un inflable y en el
// carrusel del inicio.
type Foto = { src: string; srcset: string; alt: string };

let visor: HTMLDialogElement | undefined;
let fotos: Foto[] = [];
let actual = 0;

const BOTON =
  "border-noche bg-blanco text-noche flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 shadow-[0_3px_0_var(--color-noche)] disabled:opacity-40";
const FLECHA = (giro = "") =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="${giro}"><path d="M9 6l6 6-6 6"/></svg>`;

/** Crea (una vez) el visor de fotos en pantalla completa. */
function crearVisor(): HTMLDialogElement {
  const d = document.createElement("dialog");
  d.setAttribute("aria-label", "Foto en grande");
  d.className =
    "m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-crema backdrop:bg-[rgb(20_26_58/0.92)] open:flex flex-col items-center justify-center gap-3 px-3 py-4";
  d.innerHTML = `
    <button type="button" data-visor-cerrar aria-label="Cerrar foto" class="${BOTON} absolute top-4 right-4 z-10">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <img data-visor-foto alt="" class="border-crema max-h-[78dvh] max-w-full rounded-[20px] border-2 object-contain" />
    <p data-visor-texto class="max-w-[640px] text-center text-sm leading-5 font-semibold"></p>
    <div class="flex items-center gap-4">
      <button type="button" data-visor-anterior aria-label="Foto anterior" class="${BOTON}">${FLECHA("transform: rotate(180deg)")}</button>
      <span data-visor-cuenta class="min-w-[52px] text-center font-extrabold"></span>
      <button type="button" data-visor-siguiente aria-label="Foto siguiente" class="${BOTON}">${FLECHA()}</button>
    </div>`;
  document.body.append(d);
  d.querySelector("[data-visor-cerrar]")?.addEventListener("click", () => d.close());
  d.querySelector("[data-visor-anterior]")?.addEventListener("click", () => mostrar(actual - 1));
  d.querySelector("[data-visor-siguiente]")?.addEventListener("click", () => mostrar(actual + 1));
  // Tocar el fondo (fuera de la foto y los botones) cierra.
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") mostrar(actual + 1);
    if (e.key === "ArrowLeft") mostrar(actual - 1);
  });
  d.addEventListener("close", () => document.documentElement.style.removeProperty("overflow"));
  return d;
}

function mostrar(n: number) {
  if (!visor || !fotos.length) return;
  actual = Math.max(0, Math.min(fotos.length - 1, n));
  const f = fotos[actual];
  const img = visor.querySelector<HTMLImageElement>("[data-visor-foto]");
  if (img) {
    img.srcset = f.srcset;
    img.sizes = "100vw";
    img.src = f.src;
    img.alt = f.alt;
  }
  const texto = visor.querySelector<HTMLElement>("[data-visor-texto]");
  if (texto) texto.textContent = f.alt;
  const cuenta = visor.querySelector<HTMLElement>("[data-visor-cuenta]");
  if (cuenta) cuenta.textContent = `${actual + 1} / ${fotos.length}`;
  const ant = visor.querySelector<HTMLButtonElement>("[data-visor-anterior]");
  const sig = visor.querySelector<HTMLButtonElement>("[data-visor-siguiente]");
  if (ant) ant.disabled = actual === 0;
  if (sig) sig.disabled = actual === fotos.length - 1;
}

function abrir(lista: Foto[], desde: number) {
  visor ??= crearVisor();
  fotos = lista;
  mostrar(desde);
  document.documentElement.style.overflow = "hidden";
  visor.showModal();
}

export function activarGalerias() {
  document.querySelectorAll<HTMLElement>("[data-galeria]:not([data-galeria-lista])").forEach((marco) => {
    marco.setAttribute("data-galeria-lista", "");
    const grande = marco.querySelector<HTMLImageElement>("[data-galeria-principal]");
    const minis = [...(marco.parentElement?.querySelectorAll<HTMLButtonElement>("[data-galeria-mini]") ?? [])];
    if (!grande) return;
    let elegida = 0;
    minis.forEach((b, n) => {
      b.addEventListener("click", () => {
        elegida = n;
        grande.srcset = b.dataset.srcset ?? "";
        grande.src = b.dataset.src ?? grande.src;
        grande.alt = b.dataset.alt ?? "";
        grande.style.objectPosition = b.dataset.pos ?? "";
        minis.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
    });
    marco.querySelector("[data-galeria-ampliar]")?.addEventListener("click", () => {
      const lista = minis.length
        ? minis.map((b) => ({ src: b.dataset.src ?? "", srcset: b.dataset.srcset ?? "", alt: b.dataset.alt ?? "" }))
        : [{ src: grande.src, srcset: grande.srcset, alt: grande.alt }];
      abrir(lista, elegida);
    });
  });
}

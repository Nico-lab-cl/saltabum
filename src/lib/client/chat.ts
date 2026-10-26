// Lógica de la burbuja del chat (src/design/components/ChatIA.astro): abrir y cerrar, enviar mensajes a /api/chat
// y mostrar las respuestas. Cada navegador tiene su conversación (id al azar), que el equipo ve en /admin. Si una
// persona del equipo toma el control, sus respuestas llegan revisando /api/chat cada pocos segundos.
// Lo ya mostrado se guarda en sessionStorage para seguir la conversación al cambiar de página.
import { trackConversion } from "./track";
import { whatsappUrl } from "@/lib/whatsapp";

type Rol = "cliente" | "ia" | "equipo" | "sistema";

interface Mensaje {
  /** Id en el servidor (los avisos locales de error no tienen). */
  id?: number;
  rol: Rol;
  texto: string;
}

interface Estado {
  conversacion: string;
  mensajes: Mensaje[];
  modo: "ia" | "humano";
  whatsapp?: string;
  abierto?: boolean;
}

const CLAVE = "sb_chat_v2";
const AVISO_ERROR = "Ups, no pude responder ahora. ¿Seguimos por WhatsApp? Te atendemos altiro.";
const AVISO_LIMITE = "Llegamos al máximo de mensajes por hoy en este chat. Sigamos por WhatsApp 😊";
const AVISO_EQUIPO = "Le avisamos al equipo, te responden aquí mismo en un ratito 🙌";
/** Cada cuánto se revisan mensajes nuevos del equipo: con el chat abierto y cerrado. */
const REVISAR_ABIERTO = 5_000;
const REVISAR_CERRADO = 30_000;

function leer(): Estado {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (raw) return JSON.parse(raw) as Estado;
  } catch {
    // sin almacenamiento: la conversación vive solo en esta página
  }
  return { conversacion: crypto.randomUUID(), mensajes: [], modo: "ia" };
}

function guardar(e: Estado): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // ignorar
  }
}

export function bindChat(): void {
  const raiz = document.querySelector<HTMLElement>("[data-chat]");
  if (!raiz) return;
  const panel = raiz.querySelector<HTMLElement>("[data-chat-panel]")!;
  const lista = raiz.querySelector<HTMLElement>("[data-chat-lista]")!;
  const form = raiz.querySelector<HTMLFormElement>("[data-chat-form]")!;
  const campo = form.querySelector<HTMLTextAreaElement>("textarea[name=texto]")!;
  const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const escribiendo = raiz.querySelector<HTMLElement>("[data-chat-escribiendo]")!;
  const wa = raiz.querySelector<HTMLAnchorElement>("[data-chat-whatsapp]")!;
  const pendientes = raiz.querySelector<HTMLElement>("[data-chat-pendientes]");

  const estado = leer();
  const vistos = new Set(estado.mensajes.map((m) => m.id).filter((id): id is number => id !== undefined));
  let sinLeer = 0;

  const pintar = (m: Mensaje) => {
    const plantilla = raiz.querySelector<HTMLTemplateElement>(`template[data-chat-plantilla="${m.rol}"]`);
    if (!plantilla) return;
    const nodo = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const texto = nodo.matches("[data-chat-texto]") ? nodo : nodo.querySelector<HTMLElement>("[data-chat-texto]")!;
    texto.textContent = m.texto;
    lista.append(nodo);
    lista.scrollTop = lista.scrollHeight;
  };

  const agregar = (m: Mensaje) => {
    if (m.id !== undefined) {
      if (vistos.has(m.id)) return;
      vistos.add(m.id);
    }
    estado.mensajes.push(m);
    guardar(estado);
    pintar(m);
  };

  const mostrarWhatsapp = (mensaje?: string) => {
    if (!mensaje) return;
    wa.href = whatsappUrl(mensaje);
    wa.hidden = false;
  };

  const marcarSinLeer = (n: number) => {
    sinLeer = n;
    if (!pendientes) return;
    pendientes.textContent = String(n);
    pendientes.hidden = n === 0;
  };

  const abrir = (abierto: boolean) => {
    raiz.toggleAttribute("data-abierto", abierto);
    panel.hidden = !abierto;
    estado.abierto = abierto;
    guardar(estado);
    if (abierto) {
      marcarSinLeer(0);
      lista.scrollTop = lista.scrollHeight;
      if (window.matchMedia("(min-width: 640px)").matches) campo.focus();
      void revisar();
    }
  };

  estado.mensajes.forEach(pintar);
  mostrarWhatsapp(estado.whatsapp);
  if (estado.abierto) abrir(true);

  raiz.querySelector("[data-chat-abrir]")?.addEventListener("click", () => abrir(true));
  raiz.querySelector("[data-chat-cerrar]")?.addEventListener("click", () => abrir(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) abrir(false);
  });

  // El cuadro crece con el texto; Enter envía y Shift+Enter hace salto de línea.
  campo.addEventListener("input", () => {
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight}px`;
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  let enviando = false;

  /** Trae lo nuevo del servidor: respuestas del equipo, avisos y cambios de quién atiende. */
  async function revisar() {
    if (enviando || !vistos.size) return;
    try {
      const res = await fetch(`/api/chat?conversacion=${estado.conversacion}&desde=${Math.max(...vistos)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { modo?: "ia" | "humano"; mensajes?: { id: number; rol: Rol; texto: string }[] };
      if (data.modo) estado.modo = data.modo;
      const nuevos = (data.mensajes ?? []).filter((m) => !vistos.has(m.id) && m.rol !== "cliente");
      nuevos.forEach((m) => agregar({ id: m.id, rol: m.rol, texto: m.texto }));
      (data.mensajes ?? []).forEach((m) => vistos.add(m.id));
      if (nuevos.length && panel.hidden) marcarSinLeer(sinLeer + nuevos.length);
      guardar(estado);
    } catch {
      // sin conexión: se reintenta en la próxima vuelta
    }
  }
  let ultimaRevision = 0;
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const cada = panel.hidden ? REVISAR_CERRADO : REVISAR_ABIERTO;
    if (Date.now() - ultimaRevision < cada) return;
    ultimaRevision = Date.now();
    void revisar();
  }, 2_500);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto || enviando) return;
    enviando = true;
    boton.disabled = true;
    campo.value = "";
    campo.style.height = "auto";

    const propio: Mensaje = { rol: "cliente", texto };
    estado.mensajes.push(propio);
    guardar(estado);
    pintar(propio);
    if (estado.modo === "ia") escribiendo.hidden = false;
    lista.scrollTop = lista.scrollHeight;

    let respuesta: Mensaje | null = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversacion: estado.conversacion, texto, page_url: location.href.slice(0, 1000) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        modo?: "ia" | "humano";
        ids?: number[];
        texto?: string;
        whatsapp?: string;
        reserva?: boolean;
        error?: string;
      };
      const [idPropio, idRespuesta] = data.ids ?? [];
      if (idPropio !== undefined) {
        propio.id = idPropio;
        vistos.add(idPropio);
      }
      if (data.modo) estado.modo = data.modo;
      if (data.ok && data.modo === "humano") {
        // Atiende una persona: la respuesta llega después. Se avisa una sola vez por tramo.
        const anterior = estado.mensajes.findLast((m) => m.rol !== "cliente");
        if (anterior?.rol !== "equipo" && anterior?.texto !== AVISO_EQUIPO) respuesta = { rol: "sistema", texto: AVISO_EQUIPO };
      } else if (data.ok && data.texto) {
        respuesta = { id: idRespuesta, rol: "ia", texto: data.texto };
        if (data.whatsapp) estado.whatsapp = data.whatsapp;
        if (data.reserva) trackConversion("lead", { params: { form: "chat" } });
      } else {
        respuesta = { rol: "ia", texto: data.error === "limite" ? AVISO_LIMITE : AVISO_ERROR };
        estado.whatsapp ??= `Hola, vengo del chat de saltabum.cl. ${texto}`.slice(0, 600);
      }
    } catch {
      respuesta = { rol: "ia", texto: AVISO_ERROR };
      estado.whatsapp ??= `Hola, vengo del chat de saltabum.cl. ${texto}`.slice(0, 600);
    }

    escribiendo.hidden = true;
    if (respuesta) agregar(respuesta);
    guardar(estado);
    mostrarWhatsapp(estado.whatsapp);
    enviando = false;
    boton.disabled = false;
  });
}

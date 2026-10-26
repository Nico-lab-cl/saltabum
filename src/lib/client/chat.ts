// Lógica de la burbuja del chat con IA (src/design/components/ChatIA.astro): abrir y cerrar, enviar mensajes a
// /api/chat y mostrar las respuestas. La conversación se guarda en sessionStorage para seguirla al cambiar de página.
import { trackConversion } from "./track";
import { whatsappUrl } from "@/lib/whatsapp";

interface Mensaje {
  rol: "cliente" | "ia";
  texto: string;
}

interface Estado {
  mensajes: Mensaje[];
  whatsapp?: string;
  abierto?: boolean;
}

const CLAVE = "sb_chat";
const AVISO_ERROR = "Ups, no pude responder ahora. ¿Seguimos por WhatsApp? Te atendemos altiro.";
const AVISO_LIMITE = "Llegamos al máximo de mensajes por hoy en este chat. Sigamos por WhatsApp 😊";

function leer(): Estado {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (raw) return JSON.parse(raw) as Estado;
  } catch {
    // sin almacenamiento: la conversación vive solo en esta página
  }
  return { mensajes: [] };
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

  const estado = leer();

  const pintar = (m: Mensaje) => {
    const plantilla = raiz.querySelector<HTMLTemplateElement>(`template[data-chat-plantilla="${m.rol}"]`);
    if (!plantilla) return;
    const nodo = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const texto = nodo.matches("[data-chat-texto]") ? nodo : nodo.querySelector<HTMLElement>("[data-chat-texto]")!;
    texto.textContent = m.texto;
    lista.append(nodo);
    lista.scrollTop = lista.scrollHeight;
  };

  const mostrarWhatsapp = (mensaje?: string) => {
    if (!mensaje) return;
    wa.href = whatsappUrl(mensaje);
    wa.hidden = false;
  };

  const abrir = (abierto: boolean) => {
    raiz.toggleAttribute("data-abierto", abierto);
    panel.hidden = !abierto;
    estado.abierto = abierto;
    guardar(estado);
    if (abierto) {
      lista.scrollTop = lista.scrollHeight;
      if (window.matchMedia("(min-width: 640px)").matches) campo.focus();
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
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto || enviando) return;
    enviando = true;
    boton.disabled = true;
    campo.value = "";
    campo.style.height = "auto";

    const nuevo: Mensaje = { rol: "cliente", texto };
    estado.mensajes.push(nuevo);
    guardar(estado);
    pintar(nuevo);
    escribiendo.hidden = false;
    lista.scrollTop = lista.scrollHeight;

    let respuesta: Mensaje;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensajes: estado.mensajes.slice(-40), page_url: location.href.slice(0, 1000) }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; texto?: string; whatsapp?: string; reserva?: boolean; error?: string };
      if (data.ok && data.texto) {
        respuesta = { rol: "ia", texto: data.texto };
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
    estado.mensajes.push(respuesta);
    guardar(estado);
    pintar(respuesta);
    mostrarWhatsapp(estado.whatsapp);
    enviando = false;
    boton.disabled = false;
  });
}

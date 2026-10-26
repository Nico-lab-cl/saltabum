// Lógica de la burbuja del chat (src/design/components/ChatIA.astro): pedir nombre, correo y teléfono antes de
// chatear, enviar mensajes a /api/chat y mostrar las respuestas. Cada navegador tiene su conversación (id al azar),
// que el equipo ve en /admin. Si una persona del equipo toma el control, sus respuestas llegan revisando /api/chat
// cada pocos segundos. Las respuestas aparecen con «escribiendo…» y en partes, como en WhatsApp.
// Lo ya mostrado se guarda en sessionStorage para seguir la conversación al cambiar de página.
import { getAttribution } from "./attribution";
import { trackConversion } from "./track";
import { whatsappUrl } from "@/lib/whatsapp";

type Rol = "cliente" | "ia" | "equipo" | "sistema";

interface Mensaje {
  /** Id en el servidor (los avisos locales no tienen). */
  id?: number;
  rol: Rol;
  texto: string;
}

interface Estado {
  conversacion: string;
  mensajes: Mensaje[];
  modo: "ia" | "humano";
  /** Nombre de pila, cuando ya dejó sus datos en el formulario previo. */
  contacto?: string;
  whatsapp?: string;
  abierto?: boolean;
}

const CLAVE = "sb_chat_v3";
const AVISO_ERROR = "Ups, no pude responder ahora. ¿Seguimos por WhatsApp? Te atendemos altiro.";
const AVISO_LIMITE = "Llegamos al máximo de mensajes por hoy en este chat. Sigamos por WhatsApp 😊";
const AVISO_EQUIPO = "Le avisamos al equipo, te responden aquí mismo en un ratito 🙌";
/** Cada cuánto se revisan mensajes nuevos del equipo: con el chat abierto y cerrado. */
const REVISAR_ABIERTO = 5_000;
const REVISAR_CERRADO = 30_000;

/** Cuánto «escribe» antes de mostrar un mensaje, según su largo (milisegundos). */
const tiempoEscribiendo = (texto: string) => Math.min(4_500, Math.max(900, 350 + texto.length * 28));
/** Una respuesta con líneas en blanco se muestra como varios mensajes seguidos. */
const partes = (texto: string) => texto.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const contacto = raiz.querySelector<HTMLFormElement>("[data-chat-contacto]")!;
  const errorContacto = raiz.querySelector<HTMLElement>("[data-chat-contacto-error]")!;
  const pie = raiz.querySelector<HTMLElement>("[data-chat-pie]");
  const escribiendo = raiz.querySelector<HTMLElement>("[data-chat-escribiendo]")!;
  const wa = raiz.querySelector<HTMLAnchorElement>("[data-chat-whatsapp]")!;
  const pendientes = raiz.querySelector<HTMLElement>("[data-chat-pendientes]");

  const estado = leer();
  const vistos = new Set(estado.mensajes.map((m) => m.id).filter((id): id is number => id !== undefined));
  let sinLeer = 0;

  const burbuja = (rol: Rol, texto: string) => {
    const plantilla = raiz.querySelector<HTMLTemplateElement>(`template[data-chat-plantilla="${rol}"]`);
    if (!plantilla) return;
    const nodo = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const caja = nodo.matches("[data-chat-texto]") ? nodo : nodo.querySelector<HTMLElement>("[data-chat-texto]")!;
    caja.textContent = texto;
    lista.append(nodo);
    lista.scrollTop = lista.scrollHeight;
  };
  /** Pinta un mensaje de una vez (al recargar la página). */
  const pintar = (m: Mensaje) => (m.rol === "ia" || m.rol === "equipo" ? partes(m.texto).forEach((t) => burbuja(m.rol, t)) : burbuja(m.rol, m.texto));

  /** Muestra un mensaje nuevo con «escribiendo…» antes de cada parte. `yaEspero` descuenta lo que tardó el servidor. */
  async function mostrar(m: Mensaje, yaEspero = 0) {
    if (m.id !== undefined) {
      if (vistos.has(m.id)) return;
      vistos.add(m.id);
    }
    estado.mensajes.push(m);
    guardar(estado);
    if (m.rol !== "ia" && m.rol !== "equipo") return burbuja(m.rol, m.texto);
    for (const [i, t] of partes(m.texto).entries()) {
      escribiendo.hidden = false;
      lista.scrollTop = lista.scrollHeight;
      await esperar(Math.max(0, tiempoEscribiendo(t) - (i === 0 ? yaEspero : 0)));
      escribiendo.hidden = true;
      burbuja(m.rol, t);
    }
  }

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

  /** Con los datos ya dados se chatea; si no, se muestra el formulario previo. */
  const actualizarFormularios = () => {
    contacto.hidden = !!estado.contacto;
    form.hidden = !estado.contacto;
    if (pie) pie.hidden = !estado.contacto;
  };

  const abrir = (abierto: boolean) => {
    raiz.toggleAttribute("data-abierto", abierto);
    panel.hidden = !abierto;
    estado.abierto = abierto;
    guardar(estado);
    if (abierto) {
      marcarSinLeer(0);
      lista.scrollTop = lista.scrollHeight;
      if (window.matchMedia("(min-width: 640px)").matches) (estado.contacto ? campo : contacto.querySelector("input"))?.focus();
      void revisar();
    }
  };

  estado.mensajes.forEach(pintar);
  mostrarWhatsapp(estado.whatsapp);
  actualizarFormularios();
  if (estado.abierto) abrir(true);

  raiz.querySelector("[data-chat-abrir]")?.addEventListener("click", () => abrir(true));
  raiz.querySelector("[data-chat-cerrar]")?.addEventListener("click", () => abrir(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) abrir(false);
  });

  // ── Formulario previo: nombre, correo y teléfono ─────────────────────────
  contacto.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(contacto)) as Record<string, string>;
    const nombre = (datos.nombre ?? "").trim();
    const email = (datos.email ?? "").trim();
    const telefono = (datos.telefono ?? "").trim();
    if (nombre.length < 2) return void (errorContacto.textContent = "Escribe tu nombre");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return void (errorContacto.textContent = "Revisa tu correo");
    if (telefono.replace(/\D/g, "").length < 8) return void (errorContacto.textContent = "Revisa tu teléfono");
    errorContacto.textContent = "";
    const enviar = contacto.querySelector<HTMLButtonElement>("button")!;
    enviar.disabled = true;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accion: "contacto",
        conversacion: estado.conversacion,
        nombre,
        email,
        telefono,
        attribution: getAttribution(),
        page_url: location.href.slice(0, 1000),
      }),
    }).catch(() => null);
    enviar.disabled = false;
    if (!res?.ok) return void (errorContacto.textContent = "No pudimos guardar tus datos, inténtalo de nuevo");
    trackConversion("lead", { params: { form: "chat" }, userData: { email, phone_number: telefono } });
    estado.contacto = nombre.split(/\s+/)[0];
    actualizarFormularios();
    campo.focus();
    await mostrar({ rol: "ia", texto: `Perfecto, ${estado.contacto}. Cuéntame, ¿para qué fecha y en qué comuna es el evento?` });
  });

  // ── Mensajes ───────────────────────────────────────────────────────────
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
      (data.mensajes ?? []).filter((m) => m.rol === "cliente").forEach((m) => vistos.add(m.id));
      if (nuevos.length && panel.hidden) marcarSinLeer(sinLeer + nuevos.length);
      for (const m of nuevos) await mostrar({ id: m.id, rol: m.rol, texto: m.texto });
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
    burbuja("cliente", texto);
    const inicio = Date.now();
    // Una pausa breve antes de «escribiendo…», como cuando alguien lee el mensaje.
    const mostrarEscribiendo = setTimeout(() => {
      if (estado.modo === "ia") escribiendo.hidden = false;
      lista.scrollTop = lista.scrollHeight;
    }, 600);

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
        error?: string;
      };
      const [idPropio, idRespuesta] = data.ids ?? [];
      if (idPropio !== undefined) {
        propio.id = idPropio;
        vistos.add(idPropio);
      }
      if (data.modo) estado.modo = data.modo;
      if (data.error === "sin_contacto") {
        // La conversación no tiene los datos (ej. se borró): se vuelven a pedir.
        estado.contacto = undefined;
        actualizarFormularios();
      } else if (data.ok && data.modo === "humano") {
        // Atiende una persona: la respuesta llega después. Se avisa una sola vez por tramo.
        const anterior = estado.mensajes.findLast((m) => m.rol !== "cliente");
        if (anterior?.rol !== "equipo" && anterior?.texto !== AVISO_EQUIPO) respuesta = { rol: "sistema", texto: AVISO_EQUIPO };
      } else if (data.ok && data.texto) {
        respuesta = { id: idRespuesta, rol: "ia", texto: data.texto };
        if (data.whatsapp) estado.whatsapp = data.whatsapp;
      } else {
        respuesta = { rol: "ia", texto: data.error === "limite" ? AVISO_LIMITE : AVISO_ERROR };
        estado.whatsapp ??= `Hola, vengo del chat de saltabum.cl. ${texto}`.slice(0, 600);
      }
    } catch {
      respuesta = { rol: "ia", texto: AVISO_ERROR };
      estado.whatsapp ??= `Hola, vengo del chat de saltabum.cl. ${texto}`.slice(0, 600);
    }

    clearTimeout(mostrarEscribiendo);
    if (respuesta) await mostrar(respuesta, Date.now() - inicio);
    escribiendo.hidden = true;
    guardar(estado);
    mostrarWhatsapp(estado.whatsapp);
    enviando = false;
    boton.disabled = false;
  });
}

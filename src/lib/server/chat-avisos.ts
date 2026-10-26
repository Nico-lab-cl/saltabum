// Avisos del chat de la web al grupo de WhatsApp del equipo, enviados desde el número de Saltabum (Evolution API).
// Se avisa cuando la IA deja una reserva, cuando pide ayuda de una persona y cuando un cliente escribe en una
// conversación que atiende el equipo. Si Evolution no está configurado o falla, el chat sigue funcionando igual.
import { WHATSAPP_GRUPO_AVISOS } from "astro:env/server";
import { enviarTexto, evolutionConfigurado } from "@/lib/server/evolution";

/** Grupo del equipo (id de Evolution, termina en @g.us). */
const grupo = () => WHATSAPP_GRUPO_AVISOS || "120363431771387091@g.us";

/** Enlace a la conversación en el panel. */
export const enlacePanel = (conversacion: string) => `https://saltabum.cl/admin#chatweb=${conversacion}`;

export async function avisarGrupo(texto: string): Promise<void> {
  if (!evolutionConfigurado()) return;
  await enviarTexto(grupo(), texto.slice(0, 3500)).catch((err) => console.error("[chat] aviso al grupo:", String(err)));
}

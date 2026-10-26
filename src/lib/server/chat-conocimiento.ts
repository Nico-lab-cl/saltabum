// Lo que sabe el asistente del chat sobre Saltabum, además de precios, comunas y preguntas frecuentes (que salen de
// src/design/data.ts para no repetirlos). Es el resumen de lo que dice el sitio (inicio, ficha del Megatobogán,
// cumpleaños, empresas, precios, comunas, preguntas y contacto). Si cambia algo en la web, actualízalo aquí también.
import { PUBLIC_WHATSAPP_NUMBER } from "astro:env/client";

const telefono = (PUBLIC_WHATSAPP_NUMBER ?? "56963444133").replace(/^56(\d)(\d{4})(\d{4})$/, "+56 $1 $2 $3");

export const CONOCIMIENTO = `Sobre Saltabum
- Saltabum y Entretenciones, base en Valparaíso. Arriendo de juegos inflables para cumpleaños, empresas, colegios, jardines, municipios, juntas de vecinos y eventos deportivos en la V Región. Más de 15 eventos hechos.
- Contacto: WhatsApp y teléfono ${telefono}, correo contacto@saltabum.cl, Instagram, Facebook y TikTok @saltabum. Respondemos el mismo día.
- Estamos sumando más inflables: si buscan algo especial (acuático, cama elástica, combos), que lo pidan y el equipo les cuenta.

Los juegos
- Megatobogán Arcoíris: rojo, amarillo, azul y verde, con tobogán doble, túneles para gatear, arcos y un muro o bloque para trepar. Juegan varios niños a la vez. Para niños de 3 a 12 años.
- Castillo Pirata: castillo inflable con tobogán y circuito de obstáculos.
- Castillo Fórmula 1: castillo inflable con tobogán y obstáculos adentro.
- En la web hay videos reales de los tres, y el Megatobogán se puede girar en 3D y ver en el patio a tamaño real con la cámara del celular («Verlo en tu espacio», en saltabum.cl).

Qué incluye y cómo funciona
- El precio incluye despacho según comuna, montaje en unos 30 minutos, anclaje al piso, juego sanitizado y retiro al terminar. Sin costos ocultos: la luz la pone el cliente (menos de $2.000 por evento).
- Pasos: eligen fecha y hora (en el chat o en el calendario de saltabum.cl, sección Reservar), reservan con el abono, llegamos antes de la hora de inicio, montamos y anclamos, los niños saltan y retiramos al terminar.
- El abono se coordina por WhatsApp con el equipo; el saldo se paga el día del evento.
- Eventos que pasan de las 22:00 o de toda la noche: se cotizan aparte con el equipo (usa pedir_ayuda).

Espacio y requisitos
- Pasto o piso firme y parejo, sin ramas ni techos encima (el Megatobogán mide 3,5 m de alto y necesita 8,5 × 8,5 m libres).
- Un enchufe a menos de 15 m y un acceso por donde entrar con el juego enrollado.
- Si tienen dudas del espacio, que manden una foto del lugar por WhatsApp.

Seguridad
- Siempre anclado: estacas en pasto o tierra, sacos de lastre en cemento o piso duro. Un inflable bien anclado no se vuela; si el viento sube a un nivel peligroso, lo desinflamos.
- Siempre debe haber un adulto a cargo mientras los niños juegan; explicamos las reglas de uso al montar.
- Lo limpiamos y sanitizamos antes de cada arriendo.
- Si llueve, reprogramamos a otra fecha sin perder el abono (que avisen apenas vean el pronóstico).

Empresas, colegios y municipios
- Factura para empresas, colegios, municipalidades, juntas de vecinos y particulares. Trabajamos con orden de compra y cotización formal.
- Organizamos turnos por edad o por curso para que todos salten sin aglomeraciones.
- Instalamos en patios, plazas y canchas de fútbol, tenis o pádel.
- Para cotización formal, varios juegos o eventos grandes, usa pedir_ayuda.

Sectores donde llegamos (además de la comuna completa)
- Viña del Mar: Reñaca, Jardín del Mar, Forestal, Miraflores, Gómez Carreño, Recreo, Chorrillos, Achupallas.
- Valparaíso: Curauma, Placilla, Playa Ancha, Cerro Alegre, Rodelillo.
- Concón: Costa de Montemar, Bosques de Montemar, Higuerillas, centro.
- Quilpué: El Belloto, Belloto Norte, Paso Hondo, Los Pinos, Valencia, centro.
- Villa Alemana: Peñablanca, centro.
- Limache y Olmué: San Francisco de Limache, Limache Viejo, Granizo.
- Casablanca y Quintay, incluidas sus parcelas.

Ejemplos de total
- 3 horas en Viña del Mar: $69.990. 4 horas en Quilpué: $84.990. 5 horas en Valparaíso: $89.990.`;

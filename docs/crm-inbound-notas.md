# Notas de NotebookLM (estudio CRM inbound para Saltabum)

## Cuaderno «CRM y desarollo MKT» (47 fuentes: HubSpot docs/API/Academy, Meta CAPI, Evolution, n8n, crm-alimin)
- Lifecycle: Suscriptor (clic anuncio/WA/chat) → Lead (nombre + wa_id) → MQL (form Meta o interés explícito al chat IA) → SQL (fecha+comuna+tipo evento, pide cotización) → Oportunidad (cotización enviada/procesando reserva) → Cliente (pagó) → Evangelizador (recurrente, buena encuesta post evento).
- Propiedades: datos contacto, comuna; atribución (canal, form_id, ad_id, created_time); evento (fecha, inflable, superficie pasto/radier, dirección); comercial (etapa, score, estado, asesor).
- Pipeline kanban: Nuevo → Disponibilidad verificada → Cotización enviada → Reserva pendiente de pago → Ganado (pago confirmado, bloquea agenda) / Perdido (motivo: sin disponibilidad, fuera de zona, presupuesto).
- Scoring: +15 form Meta, +20 dio comuna y fecha, +10 respondió <1 h, +25 pidió cotización/reserva; −10 sin respuesta 48 h, −50 fuera de zona; umbral 50 → SQL + aviso al vendedor.
- Tareas: alertas si lead calificado no contactado en X tiempo (fuga de leads), gestión móvil.
- Automatizaciones: webhooks Meta leadgen, IA 24/7 en WA y web, agendamiento, CAPI con conversiones del CRM (Conversion Leads).
- Métricas: conversión por canal, tiempo de primera respuesta, CPL y CPA, tasa de cierre y motivos de pérdida, CSAT/NPS post servicio.

## Cuaderno «Apuntes certificación MKT de contenidos en HubSpot» (44 fuentes)
- Inbound: Atraer (contenido, SEO, redes) → Interactuar (compra fácil, conversación personalizada) → Deleitar (post venta, promotores). Flywheel: cliente al centro; fuerza = buen servicio y respuesta rápida; fricción = proceso complejo, mala atención, falta de info.
- CRM inbound: buyer persona, buyer's journey (Reconocimiento → Consideración → Decisión), lifecycle Suscriptor→Lead→MQL→SQL→Oportunidad→Cliente→Evangelista, lead nurturing por comportamiento o tiempo, deleite con NPS/CSAT y soporte proactivo.
- Persona Saltabum: «Mamá/Papá planificador de la V Región», ~34 años; dolor: inflable sucio, atrasado, roto o que no quepa en el patio. Instagram para descubrir, WhatsApp para cotizar y cerrar.
- Contenido por etapa: Reconocimiento = reel/carrusel «checklist cumpleaños en casa»; Consideración = guía de medidas según patio/parcela, limpieza y seguridad; Decisión = catálogo con fotos reales, testimonios de padres, cotizador de fechas.
- MQL = dio fecha, comuna y edad del niño; SQL = disponibilidad ok + tiene espacio y presupuesto; Oportunidad = cotización + datos de abono; Cliente = abono pagado; Evangelista = etiqueta a @saltabum / reseña.
- Secuencias WA: cotización sin cerrar 24 h («fecha con alta demanda, aún guardo el inflable»); 48 h antes del evento (protocolo de montaje: superficie plana, enchufe); CSAT 24 h después (puntualidad y limpieza 1 a 5); si 5★ → pedir reseña Google / etiqueta IG con descuento; reactivación 11 meses después (cumpleaños del niño del año siguiente, fecha garantizada).
- (Ojo: el cuaderno inventó 50 % de abono y 45 min de montaje; en Saltabum el montaje es 30 min y el abono es el del código ABONO.)

## Cuaderno «Industria juegos inflables» (65 fuentes)
- Anticipación: cumpleaños 15–30 días antes, más flujo de última hora 3–7 días; B2B (colegios, municipios, empresas) 6–12 meses.
- Temporada alta sep → ene/feb (Fiestas Patrias, fin de año escolar, kermesses, Navidad de empresas, verano): 60–80 % del ingreso. Baja may–ago: −60/70 % residencial → indoor, colegios, centros comunitarios.
- Recompra anual ligada al cumpleaños del hijo. En operadores consolidados 62 % del ingreso viene de B2B, adicionales y recurrentes.
- Objeciones: costos ocultos de despacho (precio claro por comuna), seguridad/viento (anclaje, ASTM F2374), higiene, cuenta de luz (~$200/h), «se desinfla si se corta la luz» (tarda minutos), espacio y enchufe 220 V a <15 m.
- Segmentos: B2C padres 25–45 con hijos 1–12; premium Concón/Viña Norte (estética, puntualidad) vs. valor Quilpué/Villa Alemana (combos). B2B: colegios y jardines, empresas/RR.HH. (factura, monitores, certificaciones), municipalidades.
- Prácticas: regla de los 5 minutos (cotizan con 2–3 proveedores; responder <5 min cierra >60 %); software tipo Rentopian/LendControl: inventario sin doble reserva, IA conectada a disponibilidad, cotización visual y contrato/waiver; reseña en Google al retirar el juego (+42 % conversión al mostrarlas); recordatorio anual del cumpleaños con descuento; referidos; imán de refrigerador.

## Cuaderno «Email marketing» (96 fuentes)
- Secuencias rentables: bienvenida (1–3 correos cada 2–3 días); cotización abandonada (1º a las 2–24 h, 2º a los 3 días); post compra (confirmación inmediata, consejos al día 1, upsell a las 2 semanas); reseña 24–48 h después del servicio; cumpleaños/aniversario (1–2 antes de la fecha); win-back a los 60–90 días sin interacción.
- Benchmarks: entrega >95 %, rebote <2 %, spam <0,1 %, apertura 21,5–28 %, CTR >2 %, CTOR 3–11 %, baja ~0,08 %; negocio: ingreso por envío.
- Segmentación: RFM (recencia, frecuencia, valor, VIP top 10 %), comportamiento/intención, etapa (frío cotizó sin reservar, alta intención, primer arriendo, frecuente, inactivo). Con base chica no sobresegmentar: solo Particulares vs. Institucionales.
- Atribución ABO: Adquisición (entrega/apertura), Comportamiento (UTM, landing), Resultados (macro = reserva, micro = contacto por WhatsApp).
- Para inflables: pedir el correo justificándolo (comprobante, catálogo PDF, ficha técnica); 4 secuencias clave: cotización sin cerrar 24–48 h, confirmación + logística pre evento, post evento con encuesta + reseña + cupón para un amigo, ciclo anual a los 11 meses («se acerca el cumpleaños de [hijo]»), la de mayor ROI del rubro. Baja frecuencia, alta relevancia.

## Cuaderno «Director de marketing» (15 fuentes)
- KPIs del embudo: CPL y CAC por canal; conversión por etapa (tráfico→lead, lead→cotización con disponibilidad, cotización→reserva pagada); tiempo de primera respuesta (38 % abandona si no hay respuesta rápida; ideal <1 h en mensajería); ROAS/ROI; LTV, tasa de repetición, NPS, referidos.
- Tablero operativo semanal (alcance, CTR, CPC, mensajes por canal) y directivo mensual (CPL, costo por reserva, ventas $, ROI).
- Ritmo: lunes 30 min (eventos del finde, comentarios de clientes, costo por reserva); revisión mensual con A/B; mejora continua.
- SLA marketing–ventas: MQL = dio fecha, comuna y tipo de evento; SQL = fecha disponible + presupuesto + listo para pagar abono. Ventas responde <15 min en semana y <30 min el finde, con catálogo, ficha y datos de abono, y registra todo en el CRM.
- Meta de conversión chat → reserva con abono: 15–25 %. Umbral de alerta: costo por conversación > ~$2.500 → cambiar creativo.
- Presupuesto sugerido: 70 % Meta a WhatsApp (padres 25–45, 10–15 km), 10 % Google búsqueda por comuna, 20 % retención (recordatorio a los 11 meses). Contenido 80/20 valor/oferta.

## Cuaderno «Marketing inmobiliario» (55 fuentes, prácticas de seguimiento de leads)
- Responder en <2 min (o al instante con IA); asignar el lead automáticamente; aprovechar la ventana de 72 h gratis de Click-to-WhatsApp de Meta.
- Bot de calificación: 3–4 preguntas filtro antes de pasar a una persona.
- Cadencia de goteo: día 0 info clave (precio «desde», video); día 1 beneficios; día 3 objeciones; día 5 valor/oferta; día 7 última llamada. Después de cada interacción, próximo paso en 24–48 h.
- Ficha 360 (todo el historial en un solo contacto), tareas y recordatorios con fecha, avisos de interacción para detectar leads calientes.
- Motivo de pérdida obligatorio (presupuesto, fuera de cobertura, sin respuesta); marcar spam/datos falsos como descalificado.
- Leads fríos: remarketing a los 15–90 días con testimonios; nutrición de 21–45 días; contenido 80/20.
- Pipeline kanban, varios pipelines por línea o tipo de cliente. Métricas: costo por mensaje/CPL, tasa de agendamiento, cierre. Enviar conversiones offline (CAPI con fbclid) cuando el lead se califica o cierra.
- Errores: responder lento, no usar CRM (chats sueltos), un solo intento, saturar al equipo con leads sin filtrar, optimizar por CPL barato sin mirar cierres, anuncios gastados.

## Cuaderno «UX Design for Conversion and Error Recovery» (73 fuentes)
- Panel móvil: una columna ordenada por prioridad operativa (pendientes arriba), divulgación progresiva (tarjeta resumen, detalle al tocar), avisos tipo toast y modales solo para decisiones críticas, errores en tono positivo que dicen cómo resolver.
- Formulario cliente: caída fuerte entre 5 y 7 campos; multipaso con barra de progreso +14–21 %; autocompletado +18 % en móvil; validación al salir del campo +5–13 %; botón en primera persona («Obtener mi cotización») en vez de «Enviar»; un solo botón principal de alto contraste; microcopia que quita dudas junto al botón («Sin compromiso», «Respuesta en menos de X»).

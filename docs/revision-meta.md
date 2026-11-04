# Revisión de la app «Saltabum Chats» en Meta (App Review)

App ID 1118833020998052 · portafolio Saltabum (1359973600533354) · página Saltabum (1359897103874337) · Instagram @saltabum.

## Por qué hace falta

Sin la revisión, la app tiene **acceso estándar**: Sali solo responde a personas con rol en la app (hoy, Nicolas). Además,
Meta no envía los comentarios de Instagram. Con **acceso avanzado** responde a cualquier cliente por Messenger e
Instagram, y también responde los comentarios de Instagram.

## Antes de enviar (lo hace el dueño de la cuenta)

1. **Hacerse «proveedor de tecnología»** (Tech Provider). Meta lo pide al agregar el primer permiso a la revisión. No se
   puede deshacer, pero no cambia nada de lo que ya funciona: solo agrega la verificación del negocio y la revisión.
2. **Verificar el negocio** Saltabum en Business Suite → Configuración → Centro de seguridad → Verificación del negocio.
   Pide RUT, razón social, dirección, teléfono y un documento: e-RUT del SII, una boleta de servicios básicos o un
   certificado de inicio de actividades a nombre del negocio, y un dominio o correo que lo confirme (saltabum.cl).
3. **Ícono de la app** (1024×1024) en Configuración de la app → Información básica: usar el logotipo «Saltabum».
4. **Grabar el video** (guion abajo) con la pantalla del computador o del celular, en inglés o con subtítulos en
   inglés. Meta acepta un solo video para varios permisos si se ven todos.

## Permisos que se piden (acceso avanzado)

Para cada uno, Meta pregunta «cómo usará la app este permiso» y pide el video. Textos listos para pegar (en inglés,
que es lo que leen los revisores):

### pages_messaging

> Saltabum is a small inflatable-rental business in Valparaíso, Chile. Our app "Saltabum Chats" receives the messages
> that customers send to our own Facebook Page and replies automatically with our assistant "Sali": it answers
> questions about prices, availability and delivery, sends our product catalog (PDF) when asked, and creates a booking
> request in our own booking system. Our team can take over any conversation from our admin panel at saltabum.cl/admin
> and reply as a human. We only message people who wrote to us first, always within the 24-hour window, and we never
> send promotional messages.

### instagram_basic

> We use instagram_basic to identify our own Instagram professional account (@saltabum), which is connected to our
> Facebook Page, and to show the username of the customers who message or comment on our account in our admin panel.

### instagram_manage_messages

> Customers send Direct Messages to our Instagram account @saltabum asking for prices and availability of our
> inflatable rentals. Our app receives these messages through the webhook and our assistant "Sali" replies with the
> information the customer asked for, sends our catalog images and creates a booking request. Our team sees every
> conversation in our admin panel and can take over at any time. We only reply to people who messaged us first.

### instagram_manage_comments

> When someone comments on a post or reel of our Instagram account @saltabum asking for information (for example
> "price?" or "do you deliver to Viña?"), our app reads the comment, replies publicly with a short message ("We sent you
> the details by DM 📩") and sends one private reply to that comment opening a conversation. Comments that are
> compliments or spam are ignored, and complaints are forwarded to our team instead of being answered automatically.

### pages_read_user_content

> We read the comments that people leave on the posts of our own Facebook Page so our assistant can detect customers
> asking for prices or availability and answer them (public reply + one private reply). Facebook sends the comment
> webhook without the text, so we read the comment by its ID to know what the customer asked.

### pages_manage_engagement

> We use this permission to publish a short public reply under the comments of customers who ask for information on
> our own Facebook Page posts ("We sent you the details by private message 📩"), so other people see that the customer
> was answered.

### pages_read_engagement

> Needed together with the permissions above to read the comments, posts and basic profile data (name) of the people
> who interact with our own Facebook Page, so our team knows who they are talking to.

### pages_manage_metadata

> We use it to subscribe our own Facebook Page to our app's webhooks (messages, message_echoes and feed), so we
> receive new messages and comments in real time.

### Business Asset User Profile Access

> We use it to show the name of the person who writes to our Page or Instagram account in our admin panel and in the
> greeting of our assistant ("Thanks, Nicolas 😊").

## Instrucciones para el revisor («Test instructions»)

> 1. Send a message to our Facebook Page "Saltabum" (facebook.com/saltabum) or to our Instagram account @saltabum, for
>    example "How much is the inflatable slide?". Our assistant "Sali" answers in Spanish within a few seconds.
> 2. Reply with your name and ask for the catalog ("dame el catálogo"). Sali sends the catalog (PDF on Messenger,
>    images on Instagram).
> 3. Comment "precio?" on any post of the Page or of @saltabum. Sali replies publicly under the comment and sends you
>    a private message.
> 4. Our team sees and can take over every conversation at https://saltabum.cl/admin (tab "Chats"). Test credentials
>    for the admin panel are provided below if needed.

(Si piden acceso al panel, crear un usuario de prueba en /admin y ponerlo en el campo de credenciales de Meta.)

## Guion del video (2 a 3 minutos)

Grabar la pantalla del computador con dos ventanas: Facebook/Instagram de una cuenta de prueba y saltabum.cl/admin.
Mostrar en este orden, con subtítulos o texto en inglés que digan qué se está viendo:

1. **Inicio de sesión** con la cuenta de Facebook del administrador y la app «Saltabum Chats» conectada a la página
   (Configuración de Messenger API → Generar identificadores), para mostrar el flujo de permisos.
2. **Messenger**: escribir «hola, cuánto sale el tobogán?» a la página → Sali responde → pedir el catálogo → llega el
   PDF. *(pages_messaging, Business Asset User Profile Access)*
3. **Instagram**: lo mismo por DM a @saltabum → llegan las imágenes del catálogo. *(instagram_basic,
   instagram_manage_messages)*
4. **Comentario en Facebook**: comentar «precio?» en una publicación → aparece la respuesta pública → llega el mensaje
   privado. *(pages_read_user_content, pages_read_engagement, pages_manage_engagement, pages_manage_metadata)*
5. **Comentario en Instagram**: lo mismo en un reel de @saltabum. *(instagram_manage_comments)*
6. **Panel /admin → Chats**: mostrar las conversaciones, el botón «Tomar el control» respondiendo como persona, y el
   interruptor «Responder comentarios».

El paso 5 solo se puede grabar después de la aprobación si Meta no envía los comentarios de Instagram en modo
estándar: en ese caso, mostrar el paso 4 y explicar en el texto que en Instagram funciona igual.

# Redes sociales de Saltabum

Estado al 19 de octubre de 2026 y lo que falta para lanzar Facebook e Instagram.
Todo el material está en esta carpeta. Las imágenes son fotos reales del Megatobogán Arcoíris y diseño hecho por código, sin imágenes generadas con IA.

## Cuentas

| | Facebook | Instagram |
|---|---|---|
| Cuenta | [Saltabum](https://www.facebook.com/profile.php?id=61595570129262) | [@saltabum](https://www.instagram.com/saltabum/) |
| Foto de perfil | ✅ Logotipo Saltabum | ❌ Falta subir `exportes/perfil/perfil-logotipo-1080.jpg` |
| Portada | ✅ `exportes/perfil/portada-facebook-1640x624.jpg` | No aplica |
| Nombre | Saltabum | ✅ Saltabum y Entretenciones |
| Presentación | ✅ Promo $69.990 por 3 horas | ✅ Promo, montaje, despacho y saltabum.cl |
| Categoría | ✅ Venta y alquiler de artículos para fiestas | ✅ Venta y alquiler de artículos para fiestas |
| Contacto | ✅ Web, teléfono, correo saltabum0@gmail.com y WhatsApp | ✅ WhatsApp, teléfono y correo |
| Botón | ✅ WhatsApp +56 9 6344 4133 | ✅ Contacto (se ve en la app) |
| Enlace web | ✅ saltabum.cl | ❌ Falta, solo se agrega desde la app del celular |
| Publicaciones | ❌ Ninguna | ❌ Ninguna |
| Destacadas | No aplica | ❌ Ninguna |

Instagram está conectado a la página en Meta Business Suite, así que cada publicación sale en las dos redes a la vez.

## Material listo

- `maqueta-instagram/`: la maqueta del perfil (también publicada en https://claude.ai/artifact/UGwQqHGmtdUChvVQhRdRpL).
- `exportes/publicaciones/`: 15 imágenes de 1080 × 1350 para las 9 publicaciones. Hay 6 del juego y 3 carruseles fijados de 3 láminas cada uno.
- `exportes/historias/`: 21 historias de 1080 × 1920. El número inicial es la destacada: 1 Reservar, 2 Precios, 3 Comunas, 4 Inflables, 5 Instituciones, 6 Clientes, 7 Seguridad, 8 Preguntas.
- `exportes/portadas-destacadas/`: las 8 portadas de las destacadas, cada una sobre foto real con anillo blanco e ícono.
- `exportes/perfil/`: la foto de perfil con el logotipo y la portada de Facebook.
- `exportes/calendario.md`: el orden de publicación y el texto de cada publicación.
- `exportes/encargo-publicar.md`: el encargo para que Claude publique todo con Claude in Chrome.

## Lo que falta

1. **Publicar las 9 publicaciones** en Facebook e Instagram, en el orden de `calendario.md`, y fijar los 3 carruseles en Instagram (despacho, luego visualiza y al final promo, para que la promo quede primera).
2. **Subir la foto de perfil de Instagram.**
3. **Agregar el enlace saltabum.cl** en Instagram, desde la app del celular.
4. **Crear las 8 historias destacadas**, desde el celular: subir las historias de cada grupo, guardarlas en su destacada y ponerle su portada.

Los puntos 1 y 2 los hace Claude con el encargo de `exportes/encargo-publicar.md`, usando la cuenta nicolas.cab.v@gmail.com, porque con la cuenta de Duoc la extensión de Chrome no conecta. El navegador integrado de la app tampoco sirve para esto, porque no sube archivos.

## Ojo

- Al pegar un texto con saltabum.cl en Facebook aparece sola la vista previa del enlace. Hay que quitarla, porque muestra la imagen vieja de la web, que está hecha con IA y dice «Desde $40.000». Esa imagen (`public/og-default.jpg`) todavía está pendiente de reemplazo en la web.
- En la página de Facebook se ve la dirección Carampangue 229, Valparaíso, y el horario dice «Siempre abierto». Conviene revisar si se oculta la dirección y si el horario se deja de 09:00 a 22:00.
- Las publicaciones nuevas siguen el ritmo de la maqueta: martes, jueves y sábados a las 19:30.

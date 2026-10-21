// Crea un usuario para el panel /admin: pide usuario y contraseña (sin mostrarla), calcula la huella PBKDF2 y genera
// el secreto del código de verificación (TOTP) para Google Authenticator, Microsoft Authenticator o 1Password.
// Uso:  node scripts/admin-usuario.mjs
// Imprime la línea que va en el secreto ADMIN_USUARIOS (una línea por persona) y la clave para la app.
// La contraseña nunca se guarda ni se imprime.
import { webcrypto as crypto } from "node:crypto";
import readline from "node:readline";

const ITERACIONES = 100_000; // máximo de PBKDF2 en Cloudflare Workers
const MINIMO = 12;

function preguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => {
        if (s.includes(texto)) rl.output.write(s);
        else if (!s.includes("\n")) rl.output.write("*".repeat(s.length));
      };
    }
    rl.question(texto, (r) => {
      rl.close();
      if (oculto) process.stdout.write("\n");
      resolve(r);
    });
  });
}

function base32(bytes) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alfabeto[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

const b64 = (u8) => Buffer.from(u8).toString("base64");

const usuario = (await preguntar("Usuario (ej. nicolas): ")).trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) {
  console.error("El usuario debe tener entre 3 y 32 caracteres: letras sin tilde, números, punto, guion o guion bajo.");
  process.exit(1);
}
const clave = await preguntar(`Contraseña (mínimo ${MINIMO} caracteres): `, true);
if (clave.length < MINIMO) {
  console.error(`La contraseña debe tener al menos ${MINIMO} caracteres. Una frase larga es lo más seguro.`);
  process.exit(1);
}
if ((await preguntar("Repite la contraseña: ", true)) !== clave) {
  console.error("Las contraseñas no coinciden.");
  process.exit(1);
}

const sal = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
const huella = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: ITERACIONES }, key, 256));
const totp = base32(crypto.getRandomValues(new Uint8Array(20)));

const linea = `${usuario}:pbkdf2$${ITERACIONES}$${b64(sal)}$${b64(huella)}:${totp}`;
const uri = `otpauth://totp/Saltabum:${encodeURIComponent(usuario)}?secret=${totp}&issuer=Saltabum&algorithm=SHA1&digits=6&period=30`;

console.log(`
1) Agrega esta línea al secreto ADMIN_USUARIOS (una línea por persona):

${linea}

2) En tu app de códigos (Google Authenticator, Microsoft Authenticator o 1Password) toca «Agregar» →
   «Ingresar clave de configuración» y escribe:
     Cuenta: Saltabum ${usuario}
     Clave:  ${totp.match(/.{1,4}/g).join(" ")}
     Tipo:   basada en tiempo

   O abre este enlace en el celular si tu app lo acepta:
   ${uri}

Guarda la clave del paso 2 en un lugar seguro: si pierdes el celular, la necesitas para volver a entrar.
`);

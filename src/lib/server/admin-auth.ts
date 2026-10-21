// Seguridad del panel /admin: se entra solo con contraseña (huella PBKDF2), con segundo factor TOTP opcional por
// usuario, sesiones en D1 con cookie __Host- HttpOnly/Secure/SameSite=Strict, límite de intentos y auditoría.
//
// Secreto ADMIN_USUARIOS (uno por línea o separados por coma):  nombre:pbkdf2$100000$<sal>$<huella>[:<totp-base32>]
// La línea se genera en la misma página /admin mientras el panel no está configurado (o con scripts/admin-usuario.mjs).
import type { AstroCookies } from "astro";
import { ADMIN_USUARIOS } from "astro:env/server";
import { baseReservas } from "./reservas-db";
import { sha256Hex } from "./crypto";

export const COOKIE = "__Host-sb_admin";
const SESION_INACTIVA_MS = 2 * 3600 * 1000; // 2 h sin uso
const SESION_MAXIMA_MS = 12 * 3600 * 1000; // 12 h en total
const FALLOS_POR_IP = 5; // en 15 minutos
const VENTANA_IP_MS = 15 * 60 * 1000;
const FALLOS_POR_USUARIO = 10; // en 1 hora
const VENTANA_USUARIO_MS = 3600 * 1000;
const ITERACIONES = 100_000; // máximo que permite PBKDF2 en Cloudflare Workers

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Compara en tiempo constante. */
function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ---------- Usuarios ----------

interface Usuario {
  nombre: string;
  iteraciones: number;
  sal: Uint8Array;
  huella: Uint8Array;
  totp: string | null;
}

function usuarios(): Usuario[] {
  if (!ADMIN_USUARIOS) return [];
  return ADMIN_USUARIOS.split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((linea) => {
      const [nombre, hash, totp] = linea.split(":");
      const partes = hash?.split("$");
      if (!nombre || partes?.length !== 4 || partes[0] !== "pbkdf2") return [];
      return [{ nombre: nombre.toLowerCase(), iteraciones: Number(partes[1]), sal: deB64(partes[2]!), huella: deB64(partes[3]!), totp: totp || null }];
    });
}

export const panelConfigurado = () => usuarios().length > 0;

async function pbkdf2(clave: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteraciones }, key, 256));
}

// ---------- TOTP (RFC 6238, 30 s, 6 dígitos, SHA-1) ----------

function base32(s: string): Uint8Array {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

async function codigoTotp(secreto: string, contador: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", base32(secreto) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, BigInt(contador));
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1]! & 0x0f;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

/** Devuelve el contador del código válido (ventana de ±30 s) o null. */
async function verificarTotp(secreto: string, codigo: string): Promise<number | null> {
  if (!/^\d{6}$/.test(codigo)) return null;
  const actual = Math.floor(Date.now() / 30_000);
  for (const c of [actual, actual - 1, actual + 1]) {
    if (iguales(enc.encode(await codigoTotp(secreto, c)), enc.encode(codigo))) return c;
  }
  return null;
}

// ---------- Tablas ----------

let tablas: Promise<unknown> | undefined;
async function db() {
  const d = await baseReservas();
  tablas ??= d.batch([
    d.prepare(`CREATE TABLE IF NOT EXISTS admin_sesiones (
      id_hash TEXT PRIMARY KEY, usuario TEXT NOT NULL, creado INTEGER NOT NULL, ultimo INTEGER NOT NULL, ip_hash TEXT, ua_hash TEXT)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS admin_intentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT, ip_hash TEXT, ok INTEGER NOT NULL, creado INTEGER NOT NULL)`),
    d.prepare("CREATE INDEX IF NOT EXISTS admin_intentos_creado ON admin_intentos (creado)"),
    d.prepare(`CREATE TABLE IF NOT EXISTS admin_totp (usuario TEXT PRIMARY KEY, contador INTEGER NOT NULL)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS admin_auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT, creado TEXT NOT NULL, usuario TEXT, accion TEXT NOT NULL, detalle TEXT, ip_hash TEXT)`),
  ]);
  await tablas;
  return d;
}

const huellaIp = (request: Request) => sha256Hex(`admin:${request.headers.get("cf-connecting-ip") ?? "local"}`);

export async function auditar(request: Request, usuario: string | null, accion: string, detalle?: string): Promise<void> {
  const d = await db();
  await d
    .prepare("INSERT INTO admin_auditoria (creado, usuario, accion, detalle, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(new Date().toISOString(), usuario, accion, detalle ?? null, await huellaIp(request))
    .run();
}

// ---------- Defensa CSRF ----------

/** Solo pedidos del mismo sitio y hechos por el panel (encabezado propio que un formulario ajeno no puede poner). */
export function mismoOrigen(request: Request): boolean {
  const origin = request.headers.get("origin");
  const propio = new URL(request.url).origin;
  if (request.method !== "GET" && origin !== propio) return false;
  if (origin && origin !== propio) return false;
  return request.headers.get("x-saltabum-admin") === "1";
}

// ---------- Ingreso ----------

export type ResultadoIngreso = { ok: true; usuario: string } | { ok: false; motivo: "credenciales" | "bloqueado" | "codigo" };

/** Clave del límite por cuenta: como se entra solo con contraseña, todos los intentos cuentan para el panel. */
const CUENTA = "panel";

export async function ingresar(request: Request, cookies: AstroCookies, clave: string, codigo = ""): Promise<ResultadoIngreso> {
  const d = await db();
  const ipHash = await huellaIp(request);
  const nombre = CUENTA;
  const ahora = Date.now();

  // Limpieza de intentos viejos y freno a la fuerza bruta.
  await d.prepare("DELETE FROM admin_intentos WHERE creado < ?").bind(ahora - 24 * 3600 * 1000).run();
  const fallos = await d
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM admin_intentos WHERE ok = 0 AND ip_hash = ? AND creado > ?) AS ip,
        (SELECT COUNT(*) FROM admin_intentos WHERE ok = 0 AND usuario = ? AND creado > ?) AS usuario`,
    )
    .bind(ipHash, ahora - VENTANA_IP_MS, nombre, ahora - VENTANA_USUARIO_MS)
    .first<{ ip: number; usuario: number }>();
  if ((fallos?.ip ?? 0) >= FALLOS_POR_IP || (fallos?.usuario ?? 0) >= FALLOS_POR_USUARIO) {
    await auditar(request, nombre, "ingreso_bloqueado");
    return { ok: false, motivo: "bloqueado" };
  }

  // Se compara contra todas las cuentas (siempre el mismo trabajo, así el tiempo no revela nada).
  let u: Usuario | undefined;
  for (const x of usuarios()) {
    if (iguales(await pbkdf2(clave, x.sal, x.iteraciones), x.huella)) u ??= x;
  }
  // Cuenta con segundo factor: con la contraseña correcta se pide el código (sin contarlo como fallo).
  if (u?.totp && !codigo.trim()) return { ok: false, motivo: "codigo" };
  const contador = u?.totp ? await verificarTotp(u.totp, codigo.trim()) : null;

  let ok = !!u && (!u.totp || contador !== null);
  if (ok && u?.totp && contador !== null) {
    // Un código TOTP sirve una sola vez.
    const previo = await d.prepare("SELECT contador FROM admin_totp WHERE usuario = ?").bind(u.nombre).first<{ contador: number }>();
    if (previo && contador <= previo.contador) ok = false;
    else await d.prepare("INSERT INTO admin_totp (usuario, contador) VALUES (?, ?) ON CONFLICT(usuario) DO UPDATE SET contador = excluded.contador").bind(u.nombre, contador).run();
  }

  await d.prepare("INSERT INTO admin_intentos (usuario, ip_hash, ok, creado) VALUES (?, ?, ?, ?)").bind(nombre, ipHash, ok ? 1 : 0, ahora).run();
  if (!ok || !u) {
    await auditar(request, nombre, "ingreso_fallido");
    return { ok: false, motivo: "credenciales" };
  }

  // Sesión nueva: 32 bytes aleatorios en la cookie, en la base solo su huella.
  const id = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
  await d
    .prepare("INSERT INTO admin_sesiones (id_hash, usuario, creado, ultimo, ip_hash, ua_hash) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(await sha256Hex(id), u.nombre, ahora, ahora, ipHash, await sha256Hex(request.headers.get("user-agent") ?? ""))
    .run();
  await d.prepare("DELETE FROM admin_sesiones WHERE ultimo < ? OR creado < ?").bind(ahora - SESION_INACTIVA_MS, ahora - SESION_MAXIMA_MS).run();
  cookies.set(COOKIE, id, { path: "/", httpOnly: true, secure: true, sameSite: "strict", maxAge: SESION_MAXIMA_MS / 1000 });
  await auditar(request, u.nombre, "ingreso");
  return { ok: true, usuario: u.nombre };
}

/** Usuario de la sesión vigente o null. Renueva la marca de actividad. */
export async function sesion(request: Request, cookies: AstroCookies): Promise<string | null> {
  const id = cookies.get(COOKIE)?.value;
  if (!id || id.length > 100 || !panelConfigurado()) return null;
  const d = await db();
  const ahora = Date.now();
  const idHash = await sha256Hex(id);
  const fila = await d
    .prepare("SELECT usuario, creado, ultimo, ua_hash FROM admin_sesiones WHERE id_hash = ?")
    .bind(idHash)
    .first<{ usuario: string; creado: number; ultimo: number; ua_hash: string }>();
  const vencida = !fila || ahora - fila.ultimo > SESION_INACTIVA_MS || ahora - fila.creado > SESION_MAXIMA_MS;
  // La sesión queda atada al navegador que la abrió.
  const otroNavegador = fila && fila.ua_hash !== (await sha256Hex(request.headers.get("user-agent") ?? ""));
  // El usuario pudo ser eliminado de ADMIN_USUARIOS.
  const borrado = fila && !usuarios().some((u) => u.nombre === fila.usuario);
  if (vencida || otroNavegador || borrado) {
    if (fila) await d.prepare("DELETE FROM admin_sesiones WHERE id_hash = ?").bind(idHash).run();
    cookies.delete(COOKIE, { path: "/" });
    return null;
  }
  if (ahora - fila.ultimo > 60_000) await d.prepare("UPDATE admin_sesiones SET ultimo = ? WHERE id_hash = ?").bind(ahora, idHash).run();
  return fila.usuario;
}

export async function salir(request: Request, cookies: AstroCookies): Promise<void> {
  const id = cookies.get(COOKIE)?.value;
  if (id) {
    const d = await db();
    const usuario = await sesion(request, cookies);
    await d.prepare("DELETE FROM admin_sesiones WHERE id_hash = ?").bind(await sha256Hex(id)).run();
    if (usuario) await auditar(request, usuario, "salida");
  }
  cookies.delete(COOKIE, { path: "/" });
}

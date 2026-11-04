# Conecta Instagram y Facebook al chat con IA (ver src/lib/server/redes.ts) sin mostrar las claves en pantalla.
# Pide la «Clave secreta» de la app de Meta «Saltabum Chats» y el token de la página Saltabum, inventa el token de
# verificación del webhook, carga los tres como secretos del Worker en Cloudflare, los deja en .dev.vars y suscribe
# la página a la app (para que Meta mande los mensajes a https://saltabum.cl/api/meta).
# Uso: & .\scripts\cargar-redes.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:NODE_OPTIONS = "--use-system-ca"
# Windows PowerShell 5.1 usa TLS 1.0 por defecto y graph.facebook.com lo rechaza.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Llama a la API de Meta y devuelve la respuesta (también cuando es un error, para mostrar el motivo exacto).
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
function Graph([string]$metodo, [string]$url) {
  $resp = if ($metodo -eq "POST") { $http.PostAsync($url, $null).Result } else { $http.GetAsync($url).Result }
  return ($resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json)
}

function Leer([string]$texto) {
  $segura = Read-Host $texto -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)) -replace '\s', ''
}

$token = Leer "1/2 Pega el token de la página Saltabum (empieza con EA, no se ve al escribir) y presiona Enter"
if (-not $token.StartsWith("EA") -or $token.Length -lt 100) {
  $inicio = if ($token.Length -ge 4) { $token.Substring(0, 4) } else { $token }
  Write-Host "Eso no parece un token de página: tiene $($token.Length) caracteres y empieza con '$inicio' (debe empezar con EA y tener más de 100). No se guardó nada." -ForegroundColor Red
  Write-Host "Vuelve a pulsar Copiar en la ventana del token de Meta y corre el script otra vez." -ForegroundColor Yellow
  exit 1
}
$secreto = Leer "2/2 Ahora copia la Clave secreta de la app (Configuración de la app > Información básica > Mostrar), pégala y presiona Enter"
if ($secreto -notmatch '^[0-9a-fA-F]{32}$') { Write-Host "Eso no parece la clave secreta de una app de Meta (32 letras y números). No se guardó nada." -ForegroundColor Red; exit 1 }

# Suscribe la página Saltabum a la app (sin esto Meta no avisa los mensajes nuevos). También comprueba el token:
# si no es de la página Saltabum, Meta lo rechaza aquí.
$PAGINA = "1359897103874337"
$r = Graph "POST" "https://graph.facebook.com/v23.0/$PAGINA/subscribed_apps?subscribed_fields=messages,message_echoes,feed&access_token=$token"
if ($r.error) { Write-Host "Meta rechazó el token al suscribir la página Saltabum: $($r.error.message). No se guardó nada." -ForegroundColor Red; exit 1 }
Write-Host "Página Saltabum suscrita a la app" -ForegroundColor Green

$verificacion = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

$valores = [ordered]@{ META_APP_SECRET = $secreto; META_PAGE_TOKEN = $token; META_WEBHOOK_TOKEN = $verificacion }
$lineas = @()
if (Test-Path .dev.vars) { $lineas = @(Get-Content .dev.vars | Where-Object { $_ -notmatch '^META_(APP_SECRET|PAGE_TOKEN|WEBHOOK_TOKEN)=' }) }
foreach ($k in $valores.Keys) { $lineas += "$k=$($valores[$k])" }
Set-Content -Path .dev.vars -Value $lineas -Encoding ascii
Write-Host "Guardadas en .dev.vars" -ForegroundColor Green

$ok = $true
foreach ($k in $valores.Keys) {
  $valores[$k] | npx wrangler secret put $k
  if ($LASTEXITCODE -ne 0) { $ok = $false }
}
if ($ok) { Write-Host "Listo: los 3 secretos quedaron en Cloudflare. Ya puedes volver al chat con Claude." -ForegroundColor Green }
else { Write-Host "Algún secreto no se pudo cargar en Cloudflare (revisa el mensaje de arriba)." -ForegroundColor Yellow }

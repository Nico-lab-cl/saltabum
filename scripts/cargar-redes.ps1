# Conecta Instagram y Facebook al chat con IA (ver src/lib/server/redes.ts) sin mostrar las claves en pantalla.
# Pide la «Clave secreta» de la app de Meta «Saltabum Chats» y el token de la página Saltabum, inventa el token de
# verificación del webhook, carga los tres como secretos del Worker en Cloudflare, los deja en .dev.vars y suscribe
# la página a la app (para que Meta mande los mensajes a https://saltabum.cl/api/meta).
# Uso: & .\scripts\cargar-redes.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:NODE_OPTIONS = "--use-system-ca"

function Leer([string]$texto) {
  $segura = Read-Host $texto -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim()
}

$secreto = Leer "Pega la Clave secreta de la app Saltabum Chats (no se ve al escribir) y presiona Enter"
if ($secreto -notmatch '^[0-9a-f]{32}$') { Write-Host "Eso no parece la clave secreta de una app de Meta (32 letras y números). No se guardó nada." -ForegroundColor Red; exit 1 }
$token = Leer "Pega el token de la página Saltabum (no se ve al escribir) y presiona Enter"
if ($token -notmatch '^EA[A-Za-z0-9]{50,}$') { Write-Host "Eso no parece un token de Meta (empieza con EA). No se guardó nada." -ForegroundColor Red; exit 1 }

# El token debe ser de la página (no de una persona) para poder responder.
try {
  $pagina = Invoke-RestMethod "https://graph.facebook.com/v23.0/me?fields=id,name&access_token=$token"
} catch { Write-Host "Meta rechazó el token: $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1 }
Write-Host "Token de: $($pagina.name) ($($pagina.id))" -ForegroundColor Cyan
if ($pagina.name -notmatch 'Saltabum') { Write-Host "Ojo: el token no es de la página Saltabum. No se guardó nada." -ForegroundColor Red; exit 1 }

# Suscribe la página a la app: sin esto Meta no avisa los mensajes nuevos.
try {
  $r = Invoke-RestMethod -Method Post "https://graph.facebook.com/v23.0/$($pagina.id)/subscribed_apps?subscribed_fields=messages,message_echoes&access_token=$token"
  Write-Host "Página suscrita a la app: $($r.success)" -ForegroundColor Green
} catch { Write-Host "No se pudo suscribir la página: $($_.ErrorDetails.Message)" -ForegroundColor Yellow }

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

# Carga la API key del chat con IA (console.anthropic.com) sin mostrarla en pantalla:
# la guarda en .dev.vars (para probar en local) y como secreto ANTHROPIC_API_KEY del Worker en Cloudflare.
# Uso: & .\scripts\cargar-clave-ia.ps1            (pide la clave)
#      & .\scripts\cargar-clave-ia.ps1 -DesdeDevVars (sube a Cloudflare la que ya está en .dev.vars)
param([switch]$DesdeDevVars)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if ($DesdeDevVars) {
  $clave = ((Get-Content .dev.vars | Where-Object { $_ -match '^ANTHROPIC_API_KEY=' } | Select-Object -Last 1) -replace '^ANTHROPIC_API_KEY=', '').Trim()
} else {
  $segura = Read-Host "Pega tu API key de Anthropic (no se ve al escribir) y presiona Enter" -AsSecureString
  $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim()
}
if (-not $clave.StartsWith("sk-ant-")) { Write-Host "Eso no parece una API key de Anthropic (empieza con sk-ant-). No se guardó nada." -ForegroundColor Red; exit 1 }

if (-not $DesdeDevVars) {
  # .dev.vars: reemplaza la línea si ya existía.
  $lineas = @()
  if (Test-Path .dev.vars) { $lineas = @(Get-Content .dev.vars | Where-Object { $_ -notmatch '^ANTHROPIC_API_KEY=' }) }
  $lineas += "ANTHROPIC_API_KEY=$clave"
  Set-Content -Path .dev.vars -Value $lineas -Encoding ascii
  Write-Host "Guardada en .dev.vars" -ForegroundColor Green
}

$clave | npx wrangler secret put ANTHROPIC_API_KEY
if ($LASTEXITCODE -eq 0) { Write-Host "Listo: secreto cargado en Cloudflare. Ya puedes volver al chat con Claude." -ForegroundColor Green }
else { Write-Host "No se pudo cargar en Cloudflare (revisa el mensaje de arriba). En local igual quedó lista." -ForegroundColor Yellow }

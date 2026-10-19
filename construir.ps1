# Construye el instalador de Mis Notas para Windows.
# Uso (en PowerShell, dentro de la carpeta del proyecto):
#   .\construir.ps1            -> instalador y versión portable en dist\
#   .\construir.ps1 -Rapido    -> solo la carpeta dist\win-unpacked (para probar)
param([switch]$Rapido)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Node.js tiene que estar instalado.
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "No encuentro npm. Instala Node.js desde https://nodejs.org y vuelve a probar." -ForegroundColor Red
  exit 1
}

# 2. Si la terminal es la de VS Code, esta variable hace que Electron arranque
#    como Node.js normal y la build falle. Se quita solo para este script.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# 3. Si la app está abierta con "npm start", Windows no deja reinstalar Electron.
$abierta = Get-Process electron -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "$PSScriptRoot\node_modules\*" }
if ($abierta) {
  Write-Host "Mis Notas está abierta desde esta carpeta. Ciérrala y vuelve a lanzar el script." -ForegroundColor Yellow
  exit 1
}

# 4. Instala las dependencias exactas de package-lock.json (Electron y electron-builder).
Write-Host "Instalando dependencias..." -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Arreglo de un fallo conocido: electron-builder descarga unas herramientas
# (winCodeSign) que traen dos enlaces simbólicos de macOS, y Windows no deja
# crearlos sin permisos de administrador ni Modo de desarrollador. Se extraen
# ignorando esos dos enlaces, que en Windows no se usan.
function Preparar-HerramientasWindows {
  $cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
  $destino = Join-Path $cache "winCodeSign-2.6.0"
  if (Test-Path "$destino\rcedit-x64.exe") { return $false } # ya estaban bien
  $paquete = Get-ChildItem $cache -Filter *.7z -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $paquete) { return $false }
  Write-Host "Preparando las herramientas de Windows (fallo conocido de electron-builder)..." -ForegroundColor Yellow
  & "$PSScriptRoot\node_modules\7zip-bin\win\x64\7za.exe" x -bd -y $paquete.FullName "-o$destino" *> $null
  # Se borran los intentos fallidos para que no se acumulen.
  Get-ChildItem $cache | Where-Object Name -ne "winCodeSign-2.6.0" | Remove-Item -Recurse -Force
  return (Test-Path "$destino\rcedit-x64.exe")
}

function Empaquetar {
  # Out-Host: el texto de npm va a la pantalla y la función solo devuelve el código.
  if ($Rapido) { npm run pack | Out-Host } else { npm run dist | Out-Host }
  return $LASTEXITCODE
}

# 5. Empaqueta.
if ($Rapido) { Write-Host "Empaquetando sin instalador..." -ForegroundColor Cyan }
else { Write-Host "Creando instalador y versión portable..." -ForegroundColor Cyan }
$codigo = Empaquetar
if ($codigo -ne 0 -and (Preparar-HerramientasWindows)) {
  Write-Host "Reintentando..." -ForegroundColor Cyan
  $codigo = Empaquetar
}
if ($codigo -ne 0) {
  # Smart App Control (Windows 11) puede bloquear el .exe temporal del desinstalador.
  $sac = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
  if ($sac -eq 1 -and -not $Rapido) {
    Write-Host "`nTienes Smart App Control activado y suele bloquear la creación del instalador." -ForegroundColor Yellow
    Write-Host "Mira 'Problemas conocidos' en BUILD.md: puedes construir en GitHub o usar .\construir.ps1 -Rapido." -ForegroundColor Yellow
  }
  exit $codigo
}

# 6. Enseña lo que se ha creado.
Write-Host "`nListo. Archivos en dist\:" -ForegroundColor Green
Get-ChildItem dist -Filter *.exe -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name)  ($([math]::Round($_.Length / 1MB)) MB)" }
if ($Rapido) { "  win-unpacked\Mis Notas.exe" }

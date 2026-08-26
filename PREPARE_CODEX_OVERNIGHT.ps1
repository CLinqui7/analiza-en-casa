$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 20+ no esta instalado." -ForegroundColor Red
  Write-Host "Instala con: winget install --id OpenJS.NodeJS.LTS -e"
  exit 1
}

npm install
npm run codex:preflight
npm run check
npm run audit:status

Get-Content -Raw "codex/KICKOFF_PROMPT.md" | Set-Clipboard
Write-Host "\nEl prompt maestro quedo copiado al portapapeles." -ForegroundColor Green
Write-Host "Abriendo Codex. Selecciona el repositorio y pega con Ctrl+V." -ForegroundColor Cyan
Start-Process "https://chatgpt.com/codex"

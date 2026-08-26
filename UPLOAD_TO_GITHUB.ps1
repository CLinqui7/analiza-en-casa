$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Need($cmd, $install) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Falta $cmd. Instala con: $install" -ForegroundColor Red
    exit 1
  }
}

function Login-GitHubCorrectAccount {
  gh auth status 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No hay una sesión activa de GitHub CLI. Se abrirá el navegador." -ForegroundColor Yellow
    gh auth login --web --git-protocol https
  }

  $login = (gh api user --jq .login 2>$null).Trim()
  if (-not $login) {
    Write-Host "No se pudo identificar la cuenta autenticada." -ForegroundColor Red
    exit 1
  }

  Write-Host "Cuenta de GitHub activa: $login" -ForegroundColor Cyan
  Write-Host "Confirma que sea TU cuenta y no una credencial anterior como cristyags." -ForegroundColor Yellow
  $answer = Read-Host "¿Continuar con esta cuenta? (S/N)"
  if ($answer -notmatch '^[sS]') {
    gh auth logout --hostname github.com
    gh auth login --web --git-protocol https
    $login = (gh api user --jq .login).Trim()
    Write-Host "Nueva cuenta activa: $login" -ForegroundColor Green
  }
  return $login
}

Need "git" "winget install --id Git.Git -e"
Need "node" "winget install --id OpenJS.NodeJS.LTS -e"
Need "npm" "winget install --id OpenJS.NodeJS.LTS -e"
Need "gh" "winget install --id GitHub.cli -e"

Write-Host "1/7 Verificando cuenta de GitHub" -ForegroundColor Cyan
$login = Login-GitHubCorrectAccount

Write-Host "2/7 Preflight del repositorio" -ForegroundColor Cyan
npm install
npm run codex:preflight
npm run github:preflight
npm run check

if (-not (Test-Path ".git")) {
  Write-Host "3/7 Inicializando Git" -ForegroundColor Cyan
  git init -b main
}

git config user.name | Out-Null
if ($LASTEXITCODE -ne 0) { git config user.name "Carlos Linqui" }
git config user.email | Out-Null
if ($LASTEXITCODE -ne 0) {
  $email = Read-Host "Correo asociado a tu cuenta de GitHub"
  git config user.email $email
}

Write-Host "4/7 Preparando commit" -ForegroundColor Cyan
git add .
$changes = git status --porcelain
if ($changes) {
  git commit -m "chore: baseline completo para auditoria nocturna de Codex"
} else {
  Write-Host "No hay cambios nuevos para commit."
}

$origin = git remote get-url origin 2>$null
if (-not $origin) {
  $repo = Read-Host "Nombre del repositorio (Enter = analiza-en-casa)"
  if (-not $repo) { $repo = "analiza-en-casa" }
  Write-Host "5/7 Creando repositorio PRIVADO en $login y subiendo main" -ForegroundColor Cyan
  gh repo create "$login/$repo" --private --source=. --remote=origin --push
} else {
  Write-Host "5/7 El remoto origin ya existe: $origin" -ForegroundColor Cyan
  git branch -M main
  git push -u origin main
}

Write-Host "6/7 Preparando Codex" -ForegroundColor Cyan
Get-Content -Raw "codex/KICKOFF_PROMPT.md" | Set-Clipboard
Write-Host "El prompt corto de inicio quedó copiado al portapapeles." -ForegroundColor Green

Write-Host "7/7 Listo" -ForegroundColor Green
gh repo view --web
Start-Sleep -Seconds 2
Start-Process "https://chatgpt.com/codex"
Write-Host "En Codex: conecta el repositorio, selecciona main y pega con Ctrl+V." -ForegroundColor Cyan
Write-Host "El prompt maestro completo ya está dentro de codex/PROMPT_OVERNIGHT_MASTER.md." -ForegroundColor Cyan

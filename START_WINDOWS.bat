@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js no esta instalado. Instale Node.js 20 o superior.
  pause
  exit /b 1
)
echo.
echo Iniciando Analiza en Casa...
echo Abra http://localhost:4173 si el navegador no se abre automaticamente.
start "" http://localhost:4173
node scripts\serve.mjs
pause

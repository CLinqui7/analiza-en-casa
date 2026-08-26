@echo off
cd /d "%~dp0"
echo Ejecutando verificaciones locales...
call npm install
call npm run codex:preflight
call npm run audit:status
call npm run check
call npm run audit:verify
if errorlevel 1 (
  echo.
  echo ATENCION: hay auditoria, pruebas o capitulos pendientes. No hagas merge.
) else (
  echo.
  echo Verificaciones locales aprobadas. Revisa igualmente FINAL_REPORT.md y el PR.
)
pause

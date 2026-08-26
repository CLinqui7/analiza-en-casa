@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Raw '%~dp0codex\CONTINUE_OVERNIGHT_PROMPT.md' | Set-Clipboard; Start-Process 'https://chatgpt.com/codex'"
echo Prompt de continuacion copiado. Abre la tarea o crea una nueva sobre la misma rama y pega con Ctrl+V.
pause

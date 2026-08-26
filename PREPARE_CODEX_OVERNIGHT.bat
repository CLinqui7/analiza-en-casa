@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARE_CODEX_OVERNIGHT.ps1"
pause

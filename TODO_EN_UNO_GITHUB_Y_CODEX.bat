@echo off
cd /d "%~dp0"
echo ==============================================================
echo  ANALIZA EN CASA - GITHUB PRIVADO + PREPARACION DE CODEX
echo ==============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPLOAD_TO_GITHUB.ps1"
pause

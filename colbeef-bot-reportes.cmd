@echo off
REM Lanzador interno del bot (no ejecutar manualmente; use iniciar-bot-reportes.bat)
cd /d "%~dp0"
node src/index.js

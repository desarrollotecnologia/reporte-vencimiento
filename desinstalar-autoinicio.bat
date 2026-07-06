@echo off
chcp 65001 >nul
setlocal

set "TASK_NAME=ColbeefBotReportesCava"
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Colbeef Bot Reportes.lnk"

echo.
echo  Desinstalar autoinicio - Bot Reportes Cava
echo.

if exist "%LINK%" (
    del /F /Q "%LINK%"
    echo [OK] Acceso directo de Inicio eliminado.
) else (
    echo [INFO] No habia acceso directo en Inicio.
)

schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if not errorlevel 1 (
    schtasks /Delete /TN "%TASK_NAME%" /F
    echo [OK] Tarea programada eliminada.
) else (
    echo [INFO] No habia tarea programada.
)

call "%~dp0detener-bot-reportes.bat" silent

echo.
echo  Autoinicio desinstalado.
pause

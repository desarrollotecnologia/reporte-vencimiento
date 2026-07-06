@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo  Reiniciando bot de reportes (aplica cambios del codigo)...
echo.

call "%~dp0detener-bot-reportes.bat" silent

REM Si pasan "completo" o hay package.json nuevo, reinstala dependencias
if /i "%~1"=="completo" (
    echo [INFO] Actualizando dependencias npm...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo npm install.
        pause
        exit /b 1
    )
)

call "%~dp0iniciar-bot-reportes.bat" silent

echo.
echo [OK] Reinicio completado. Los cambios ya estan activos.
echo.
pause

@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
set "BOT_DIR=%CD%"
set "INICIAR=%BOT_DIR%\iniciar-bot-oculto.vbs"
set "INICIAR_BAT=%BOT_DIR%\iniciar-bot-reportes.bat"
set "TASK_NAME=ColbeefBotReportesCava"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LINK=%STARTUP%\Colbeef Bot Reportes.lnk"

echo.
echo  Instalar autoinicio - Bot Reportes Cava
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta en el PATH. Instalelo antes de continuar.
    pause
    exit /b 1
)

REM --- 1) Acceso directo en Inicio de Windows (al iniciar sesion) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%LINK%'); $sc.TargetPath = 'wscript.exe'; $sc.Arguments = '\"\"%INICIAR%\"\"'; $sc.WorkingDirectory = '%BOT_DIR%'; $sc.WindowStyle = 7; $sc.Description = 'Bot reportes vencimiento cava Colbeef'; $sc.Save(); Write-Host '[OK] Acceso directo creado en Inicio de Windows (sin ventana visible).'"

REM --- 2) Tarea programada al arrancar el servidor (requiere admin) ---
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [AVISO] Sin permisos de administrador.
    echo         Se instalo solo el acceso directo de Inicio ^(al iniciar sesion^).
    echo.
    echo         Para arrancar al encender el servidor SIN iniciar sesion:
    echo         Clic derecho en este archivo - Ejecutar como administrador
    echo.
    goto :fin
)

schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if not errorlevel 1 schtasks /Delete /TN "%TASK_NAME%" /F >nul

schtasks /Create /TN "%TASK_NAME%" /SC ONSTART /DELAY 0002:00 /TR "wscript.exe \"%INICIAR%\"" /RU "%USERNAME%" /RL HIGHEST /F
if errorlevel 1 (
    echo [AVISO] No se pudo crear tarea ONSTART. El acceso directo de Inicio sigue activo.
) else (
    echo [OK] Tarea programada creada: arranque 2 min despues de encender el servidor.
    echo      Nombre: %TASK_NAME%
)

:fin
echo.
echo  Listo. El bot se iniciara automaticamente.
echo  Para probar ahora: ejecute iniciar-bot-reportes.bat
echo  (o iniciar-bot-oculto.vbs si no quiere ver ninguna ventana)
echo.
pause

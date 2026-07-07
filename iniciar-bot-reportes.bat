@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"
set "BOT_DIR=%CD%"
set "LOG_DIR=%BOT_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\bot-reportes.log"
set "PID_FILE=%LOG_DIR%\bot.pid"
set "LAUNCHER=%BOT_DIR%\colbeef-bot-reportes.cmd"
set "SILENT=%~1"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH del sistema.
    if /i not "%SILENT%"=="silent" pause
    exit /b 1
)

if not exist "%BOT_DIR%\node_modules\" (
    echo [INFO] Instalando dependencias por primera vez...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo npm install.
        if /i not "%SILENT%"=="silent" pause
        exit /b 1
    )
)

call "%~dp0detener-bot-reportes.bat" silent
timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Content -Path '%LOG_FILE%' -Value ''; Add-Content -Path '%LOG_FILE%' -Value '[%date% %time%] ===== Inicio del bot =====' -ErrorAction SilentlyContinue"

if /i not "%SILENT%"=="silent" (
    echo.
    echo  Bot Vencimiento Cava - Colbeef
    echo  Carpeta: %BOT_DIR%
    echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$launcher='%LAUNCHER%'; $log='%LOG_FILE%'; $pidFile='%PID_FILE%';" ^
  "$arg='/c \"'+$launcher+'\" >> \"'+$log+'\" 2>&1';" ^
  "$p=Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WorkingDirectory (Split-Path $launcher) -WindowStyle Hidden -PassThru;" ^
  "Start-Sleep -Seconds 3;" ^
  "$node=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('colbeef-bot-reportes.cmd') -and $_.Name -eq 'cmd.exe' } | Select-Object -First 1;" ^
  "if (-not $node) { $node=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('src\index.js') -and $_.CommandLine.Contains('bot vencimiento') } | Select-Object -First 1 };" ^
  "if ($node) { $node.ProcessId | Out-File -FilePath $pidFile -Encoding ascii -NoNewline; exit 0 } else { exit 1 }"

if errorlevel 1 (
    echo [ERROR] El bot no arranco. Revise: %LOG_FILE%
    if /i not "%SILENT%"=="silent" pause
    exit /b 1
)

echo [OK] Bot iniciado correctamente.
echo      Reporte automatico: 5:59 AM hora Colombia.
echo      Log: %LOG_FILE%
if /i not "%SILENT%"=="silent" (
    echo.
    pause
)

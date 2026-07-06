@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
set "BOT_DIR=%CD%"
set "PID_FILE=%BOT_DIR%\logs\bot.pid"
set "SILENT=%~1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$botDir='%BOT_DIR%'; $pidFile='%PID_FILE%'; $stopped=$false;" ^
  "if (Test-Path $pidFile) { $pid=(Get-Content $pidFile -Raw).Trim(); if ($pid -match '^\d+$') { Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue; $stopped=$true }; Remove-Item $pidFile -Force -ErrorAction SilentlyContinue };" ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('colbeef-bot-reportes.cmd') -or ($_.CommandLine.Contains('bot vencimiento') -and $_.CommandLine.Contains('index.js'))) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped=$true };" ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('bot vencimiento') -and $_.CommandLine.Contains('npm') -and $_.CommandLine.Contains('start') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped=$true };" ^
  "if ($stopped) { exit 2 } else { exit 0 }"

if errorlevel 2 (
    if /i not "%SILENT%"=="silent" echo [OK] Bot detenido.
) else (
    if /i not "%SILENT%"=="silent" echo [INFO] El bot no estaba en ejecucion.
)

if /i not "%SILENT%"=="silent" pause

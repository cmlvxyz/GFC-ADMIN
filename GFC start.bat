@echo off
title GFC - Website + Admin
cd /d "%~dp0"

echo.
echo ============================================
echo   GFC  -  website + admin, sabay sabay
echo ============================================
echo.
echo   Website : http://localhost:3002
echo   Admin   : http://localhost:3003
echo   Server  : http://localhost:4000
echo.
echo   Starting backend, admin and website in one go.
echo   Leave the other window open. Press Ctrl+C there to stop.
echo.

REM GFC_NO_OPEN=1: Vite does not open a browser on its own, so both tabs are
REM opened together below once the servers actually answer.
start "GFC Servers (4000 + 3003 + 3002)" /D "%~dp0" cmd /k "set GFC_NO_OPEN=1 && npm run dev"

echo Waiting for the servers to be ready...

REM Only PowerShell is used to probe and sleep. The plain "curl" and "timeout"
REM names resolve to the Git-for-Windows versions when this file is launched
REM from a bash prompt, which silently breaks the wait loop.
REM 127.0.0.1 is used instead of localhost on purpose: "localhost" can resolve to
REM ::1 first, and the dev servers listen on IPv4 only, so the request hangs.
set /a TRIES=0

:WAIT
set /a TRIES+=1

powershell -NoProfile -Command "try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:3002').StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if errorlevel 1 goto RETRY

powershell -NoProfile -Command "try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:3003').StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if errorlevel 1 goto RETRY

if %TRIES% GTR 90 goto TIMEOUT
goto OPEN

:RETRY
if %TRIES% GTR 90 goto TIMEOUT
powershell -NoProfile -Command "Start-Sleep -Milliseconds 1200"
goto WAIT

:TIMEOUT
echo.
echo   The servers did not answer in time. Read the
echo   "GFC Servers" window for the real reason.
echo.
pause
exit /b 1

:OPEN
echo.
echo   Both servers are up. Opening the website and the admin.
echo.
start "" "http://localhost:3002"
powershell -NoProfile -Command "Start-Sleep -Milliseconds 900"
start "" "http://localhost:3003"

echo.
echo ============================================
echo   Website : http://localhost:3002
echo   Admin   : http://localhost:3003
echo.
echo   Stop: click the "GFC Servers" window and press Ctrl+C.
echo ============================================
echo.

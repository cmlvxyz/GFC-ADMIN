@echo off
title GFC - Start Projects
echo.
echo ============================================
echo   Starting GFC and GFC-ADMIN...
echo ============================================
echo.

start "GFC-ADMIN (server 4000 + admin 3003)" cmd /k "cd /d %~dp0 && set GFC_NO_OPEN=1 && npm run dev"

start "GFC (site 3002)" cmd /k "cd /d C:\Users\abcd\Desktop\GFC && node node_modules\vite\bin\vite.js --port=3002 --host=0.0.0.0"

echo Waiting for servers to start...
timeout /t 8 /nobreak >nul

start "" chrome "http://localhost:3002"
start "" chrome "http://localhost:3003"

echo.
echo Done! Both projects should now open in Chrome.
echo      GFC site  : http://localhost:3002
echo      GFC-ADMIN : http://localhost:3003
echo.
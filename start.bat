@echo off
title Green Lantern (localhost)
rem Starts the Green Lantern frontend on localhost and opens it in your browser.
rem Double-click this file. Close this window (or press Ctrl+C) to stop the server.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org ^(version 22 or newer^), then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages for the first time. This can take a minute...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check your internet connection, then run this file again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Green Lantern on localhost (usually http://localhost:5173).
echo Your browser opens by itself. Close this window to stop the server.
echo.
call npm run dev -- --open
pause

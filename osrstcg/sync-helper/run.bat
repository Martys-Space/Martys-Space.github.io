@echo off
title OSRS TCG Locked Tracker - sync helper
cd /d "%~dp0"
node server.js
echo.
echo The sync helper stopped (or Node.js isn't installed - get it from https://nodejs.org).
pause

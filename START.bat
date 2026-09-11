@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist node_modules npm install
start "Iruka SAGE" cmd /k "node server.js"
timeout /t 2 >nul
start http://localhost:5173

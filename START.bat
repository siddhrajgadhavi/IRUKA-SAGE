@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PYEXE="
where py >nul 2>nul
if not errorlevel 1 set "PYEXE=py -3"
if not defined PYEXE where python >nul 2>nul
if not defined PYEXE if not errorlevel 1 set "PYEXE=python"
if defined PYEXE %PYEXE% -c "import cv2,numpy,pytesseract; import torch" >nul 2>nul
if errorlevel 1 (
  echo SAGE image/OCR dependencies are not ready. Running identity setup...
  call "%~dp0SETUP-IDENTITY.bat"
  if errorlevel 1 exit /b 1
)
if not exist node_modules npm install
start "Iruka SAGE" cmd /k "node server.js"
timeout /t 2 >nul
start http://localhost:5173

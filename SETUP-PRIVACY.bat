@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PYEXE="
where py >nul 2>nul
if not errorlevel 1 set "PYEXE=py"
if not defined PYEXE where python >nul 2>nul && set "PYEXE=python"
if not defined PYEXE for %%P in ("%LocalAppData%\Programs\Python\Python313\python.exe" "%LocalAppData%\Programs\Python\Python312\python.exe" "%LocalAppData%\Programs\Python\Python311\python.exe" "C:\Program Files\Python313\python.exe" "C:\Program Files\Python312\python.exe" "C:\Program Files\Python311\python.exe") do if not defined PYEXE if exist "%%~P" set "PYEXE=%%~P"
if not defined PYEXE (
 echo ERROR: Python 3.11+ not found. Install Python 3 and rerun this file.
 pause
 exit /b 1
)
echo Using Python: !PYEXE!
!PYEXE! --version
if errorlevel 1 goto :pyfail
!PYEXE! -m ensurepip --upgrade
if errorlevel 1 goto :pipfail
!PYEXE! -m pip install --upgrade pip
if errorlevel 1 goto :pipfail
!PYEXE! -m pip install -r requirements-privacy.txt
if errorlevel 1 goto :pipfail
set "TESS="
where tesseract >nul 2>nul && set "TESS=tesseract.exe"
if not defined TESS if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" set "TESS=C:\Program Files\Tesseract-OCR\tesseract.exe"
if not defined TESS if exist "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe" set "TESS=C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
if defined TESS echo Tesseract found: !TESS!
if not defined TESS echo WARNING: Tesseract not found. Install it separately for OCR.
echo.
echo SAGE privacy and image-processing dependencies are ready.
pause
exit /b 0
:pyfail
echo ERROR: Python 3 could not be started.
pause
exit /b 1
:pipfail
echo ERROR: A dependency installation failed. The package manager output above shows which package failed.
pause
exit /b 1

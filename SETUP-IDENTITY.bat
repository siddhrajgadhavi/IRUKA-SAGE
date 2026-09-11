@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo IRUKA SAGE - Aadhaar Card Photo Name Screening
echo ================================================
echo.
where py >nul 2>&1
if %errorlevel%==0 (set "PY=py -3") else (set "PY=python")
%PY% -m pip install --upgrade pip
%PY% -m pip install -r requirements-identity.txt
if %errorlevel% neq 0 (
  echo.
  echo Identity dependencies could not be installed.
  pause
  exit /b 1
)
echo.
echo Identity setup complete.
echo The active flow is local card rectification + OCR only.
echo No Secure QR, DigiLocker, Offline e-KYC or UIDAI signature package is required.
pause

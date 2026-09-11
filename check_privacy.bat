@echo off
%PYEXE% -c "import cv2, numpy, PIL, pytesseract" >nul 2>nul
exit /b %errorlevel%

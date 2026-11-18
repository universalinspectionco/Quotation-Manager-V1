@echo off
setlocal
title UIC Quotation Manager - Desktop Builder
echo ========================================================
echo   Universal Inspection Co. Ltd. (UIC)
echo   Desktop Application Builder
echo ========================================================
echo.

:: Automatically switch to the script's own directory (prevents C:\WINDOWS\system32 error)
cd /d "%~dp0"
echo Current working folder: %CD%
echo.

echo [1/3] Verifying Node.js and npm...
call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Compiling quotation manager application assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Please ensure dependencies are installed via 'npm install'.
    pause
    exit /b 1
)

echo [3/3] Packaging Windows standalone application...
call npx electron-builder --win --x64

echo.
echo ========================================================
echo   Build Complete!
echo   Your standalone Windows application is located in:
echo   release\win-unpacked\UIC Quotation Manager.exe
echo ========================================================
echo.
pause

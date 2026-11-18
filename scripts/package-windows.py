import os
import shutil
import zipfile

def package_windows_dist():
    dist_dir = 'dist'
    package_dir = '/tmp/uic-windows-package'
    output_zip = 'public/downloads/UIC-Quotation-Manager-Windows-Portable.zip'

    if os.path.exists(package_dir):
        shutil.rmtree(package_dir)
    os.makedirs(package_dir, exist_ok=True)

    # 1. Copy dist contents to package directory
    for item in os.listdir(dist_dir):
        s = os.path.join(dist_dir, item)
        d = os.path.join(package_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    # 2. Create the Windows launcher batch file
    launcher_bat = r"""@echo off
setlocal enabledelayedexpansion
title UIC Quotation Manager - Universal Inspection Co. Ltd.

:: Locate HTML file in current folder
set "APP_PATH=%~dp0index.html"

echo Starting Universal Inspection Co. Quotation Manager...
echo.

:: 1. Try Microsoft Edge in dedicated App Window Mode (Default on Windows 10 & 11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_PATH:\=/%" --window-size=1366,860
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_PATH:\=/%" --window-size=1366,860
    exit /b
)

:: 2. Try Google Chrome in dedicated App Window Mode
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%APP_PATH:\=/%" --window-size=1366,860
    exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///%APP_PATH:\=/%" --window-size=1366,860
    exit /b
)

:: 3. Try Brave Browser
if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" --app="file:///%APP_PATH:\=/%" --window-size=1366,860
    exit /b
)

:: 4. Fallback: Launch default browser
start "" "%APP_PATH%"
exit /b
"""
    with open(os.path.join(package_dir, 'Launch-UIC-Quotation-Manager.bat'), 'w', newline='\r\n') as f:
        f.write(launcher_bat)

    # 3. Create Desktop Shortcut Setup batch file
    setup_bat = r"""@echo off
setlocal
title UIC Quotation Manager - Windows Desktop Setup
echo ========================================================
echo   Universal Inspection Co. Ltd. (UIC)
echo   Quotation Manager - Windows Desktop Setup
echo ========================================================
echo.
echo Installing desktop shortcut...

set "SCRIPT_DIR=%~dp0"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\UIC Quotation Manager.lnk"
set "TARGET_BAT=%SCRIPT_DIR%Launch-UIC-Quotation-Manager.bat"
set "ICON_PATH=%SCRIPT_DIR%pwa-512x512.png"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Universal Inspection Co. Quotation & Price Book Manager'; $s.Save()"

echo.
echo [SUCCESS] Desktop shortcut created on your Windows Desktop!
echo.
echo You can now double-click "UIC Quotation Manager" on your Desktop 
echo anytime to launch the application in standalone desktop window mode.
echo.
pause
"""
    with open(os.path.join(package_dir, 'Setup-Windows-Desktop.bat'), 'w', newline='\r\n') as f:
        f.write(setup_bat)

    # 3b. Copy electron scripts and create Electron launcher
    if os.path.exists('electron'):
        os.makedirs(os.path.join(package_dir, 'electron'), exist_ok=True)
        shutil.copy2('electron/main.cjs', os.path.join(package_dir, 'electron', 'main.cjs'))
    
    electron_bat = r"""@echo off
cd /d "%~dp0"
title UIC Quotation Manager (Electron)
echo Starting Universal Inspection Co. Quotation Manager with Electron...
echo.
if exist "%~dp0node_modules\.bin\electron.cmd" (
    "%~dp0node_modules\.bin\electron.cmd" electron/main.cjs
    exit /b
)
npx --yes electron electron/main.cjs
exit /b
"""
    with open(os.path.join(package_dir, 'Run-With-Electron.bat'), 'w', newline='\r\n') as f:
        f.write(electron_bat)

    # 4. Create README
    readme_txt = r"""========================================================================
  UNIVERSAL INSPECTION CO. LTD. (UIC)
  QUOTATION & PRICE BOOK MANAGEMENT SYSTEM
  STANDALONE WINDOWS DESKTOP EDITION
========================================================================

HOW TO USE ON WINDOWS:
------------------------------------------------------------------------
Method A (Direct Launch):
  Simply double-click "Launch-UIC-Quotation-Manager.bat".
  It will automatically launch in a dedicated, borderless desktop app 
  window (no browser address bar, no tabs).

Method B (Install Desktop Shortcut):
  Double-click "Setup-Windows-Desktop.bat".
  This places a permanent "UIC Quotation Manager" shortcut on your 
  Windows Desktop so you can launch it like any standard .exe application.

KEY ADVANTAGES OF THIS STANDALONE EDITION:
------------------------------------------------------------------------
- 100% Offline: Operates completely disconnected from the internet.
- Zero SmartScreen warnings: No Microsoft Defender "Untrusted .exe" blocks.
- Full PDF & Export Engines: Generates corporate Royal Blue PDFs, Excel 
  workbooks (.xlsx), and Word documents (.docx) with embedded UIC letterhead.
- Local Data Persistence: All quotations and company price memories 
  are saved safely on your machine.

For technical assistance:
Universal Inspection Co. Ltd. (UIC) · Jubail, KSA · C.R. 2055011643
"""
    with open(os.path.join(package_dir, 'README-WINDOWS.txt'), 'w', newline='\r\n') as f:
        f.write(readme_txt)

    # 5. Pack into ZIP
    os.makedirs(os.path.dirname(output_zip), exist_ok=True)
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(package_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, package_dir)
                zf.write(abs_path, rel_path)

    zip_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"Successfully created {output_zip} ({zip_size_mb:.2f} MB)")

if __name__ == '__main__':
    package_windows_dist()

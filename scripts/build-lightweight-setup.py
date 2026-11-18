import os
import subprocess
import shutil
import zipfile
import re

def build_installers():
    applet_root = '/app/applet'
    dist_dir = os.path.join(applet_root, 'dist')
    out_dir = os.path.join(applet_root, 'public', 'downloads')
    os.makedirs(out_dir, exist_ok=True)
    
    icon_path = os.path.join(applet_root, 'public', 'app-icon.ico')
    nsis_base = '/root/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n'
    cached_makensis = os.path.join(nsis_base, 'linux', 'makensis')
    makensis_bin = (
        cached_makensis
        if os.path.exists(cached_makensis)
        else (shutil.which('makensis') or '/usr/bin/makensis')
    )
    if not makensis_bin or not os.path.exists(makensis_bin):
        raise FileNotFoundError(
            "makensis binary not found. Install nsis (apt-get install -y nsis)."
        )
    print(f"Using makensis compiler: {makensis_bin}")
    
    # 1. Prepare clean staging directory for application files
    staging_dir = '/tmp/uic-app-staging'
    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir, exist_ok=True)
    
    # Copy essential web app assets (skip any recursive downloads)
    for item in os.listdir(dist_dir):
        if item == 'downloads':
            continue
        src = os.path.join(dist_dir, item)
        dst = os.path.join(staging_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
            
    # Copy icon into staging
    shutil.copy2(icon_path, os.path.join(staging_dir, 'app-icon.ico'))
    
    # Ensure offline vendor libraries are in staging/vendor
    vendor_src = os.path.join(applet_root, 'public', 'vendor')
    vendor_dst = os.path.join(staging_dir, 'vendor')
    if os.path.exists(vendor_src):
        if os.path.exists(vendor_dst):
            shutil.rmtree(vendor_dst)
        shutil.copytree(vendor_src, vendor_dst)
    
    # 2. Patch staging index.html for 100% offline file:// compatibility:
    # Remove 'type="module"' and 'crossorigin' so Chromium does NOT block with CORS origin 'null'
    staging_html_path = os.path.join(staging_dir, 'index.html')
    if os.path.exists(staging_html_path):
        with open(staging_html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        # Convert type="module" crossorigin (or type="module") to classic defer script
        html_content = re.sub(
            r'<script\s+type="module"(?:\s+crossorigin)?\s+src="([^"]+)"\s*></script>',
            r'<script defer src="\1"></script>',
            html_content
        )

        # Strip crossorigin from stylesheet links so file:// never rejects stylesheets
        html_content = re.sub(
            r'<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*/?>',
            r'<link rel="stylesheet" href="\1">',
            html_content
        )

        # Strip service worker registration script for file:// launches
        html_content = re.sub(
            r'<script[^>]+id="vite-plugin-pwa:register-sw"[^>]*></script>',
            '',
            html_content
        )
        
        # Inject standard polyfills for window.global and window.process before any script runs
        poly = '<script>window.global=window;window.process={env:{NODE_ENV:"production"}};</script>'
        if poly not in html_content:
            html_content = html_content.replace('<head>', f'<head>\n    {poly}')
            
        with open(staging_html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print("Patched staging index.html for classic script loading (no file:// CORS block)")
    
    # 3. Build the native Windows GUI Launcher executable (UIC Quotation Manager.exe)
    # Launches Edge or Chrome in app window mode with isolated profile and file access permitted
    launcher_nsi = f"""Unicode True
RequestExecutionLevel user
SilentInstall silent
Icon "{icon_path}"
OutFile "{staging_dir}/UIC Quotation Manager.exe"

Section
  ; Check for Edge (64-bit)
  IfFileExists "$PROGRAMFILES64\\Microsoft\\Edge\\Application\\msedge.exe" edge64
  ; Check for Edge (32-bit)
  IfFileExists "$PROGRAMFILES\\Microsoft\\Edge\\Application\\msedge.exe" edge32
  ; Check for Chrome (64-bit)
  IfFileExists "$PROGRAMFILES64\\Google\\Chrome\\Application\\chrome.exe" chrome64
  ; Check for Chrome (32-bit)
  IfFileExists "$PROGRAMFILES\\Google\\Chrome\\Application\\chrome.exe" chrome32
  ; Check for Brave
  IfFileExists "$PROGRAMFILES\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" brave
  
  ; Fallback: open with default browser
  ExecShell "open" "$EXEDIR\\index.html"
  Quit

edge64:
  Exec '"$PROGRAMFILES64\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///$EXEDIR\\index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="$LOCALAPPDATA\\UICQuotationManager\\Profile"'
  Quit

edge32:
  Exec '"$PROGRAMFILES\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///$EXEDIR\\index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="$LOCALAPPDATA\\UICQuotationManager\\Profile"'
  Quit

chrome64:
  Exec '"$PROGRAMFILES64\\Google\\Chrome\\Application\\chrome.exe" --app="file:///$EXEDIR\\index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="$LOCALAPPDATA\\UICQuotationManager\\Profile"'
  Quit

chrome32:
  Exec '"$PROGRAMFILES\\Google\\Chrome\\Application\\chrome.exe" --app="file:///$EXEDIR\\index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="$LOCALAPPDATA\\UICQuotationManager\\Profile"'
  Quit

brave:
  Exec '"$PROGRAMFILES\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" --app="file:///$EXEDIR\\index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="$LOCALAPPDATA\\UICQuotationManager\\Profile"'
  Quit
SectionEnd
"""
    launcher_script = '/tmp/build_launcher.nsi'
    with open(launcher_script, 'w', encoding='utf-8') as f:
        f.write(launcher_nsi)
        
    print("Compiling native Windows GUI launcher...")
    res = subprocess.run([makensis_bin, launcher_script], capture_output=True, text=True)
    if res.returncode != 0:
        print("Launcher compilation error:", res.stderr)
        raise RuntimeError("Launcher makensis failed")
        
    # Standard batch launcher with dedicated profile and file flags
    with open(os.path.join(staging_dir, 'Launch-UIC-Quotation-Manager.bat'), 'w', newline='\r\n') as f:
        f.write(r"""@echo off
setlocal
cd /d "%~dp0"
title UIC Quotation Manager - Universal Inspection Co. Ltd.

:: 1. Launch with compiled native launcher if available
if exist "%~dp0UIC Quotation Manager.exe" (
    start "" "%~dp0UIC Quotation Manager.exe"
    exit /b
)

:: 2. Launch with Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%~dp0index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="%LOCALAPPDATA%\UICQuotationManager\Profile"
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%~dp0index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="%LOCALAPPDATA%\UICQuotationManager\Profile"
    exit /b
)

:: 3. Launch with Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%~dp0index.html" --window-size=1366,860 --allow-file-access-from-files --user-data-dir="%LOCALAPPDATA%\UICQuotationManager\Profile"
    exit /b
)

:: 4. Fallback default browser
start "" "%~dp0index.html"
exit /b
""")

    # Background local server launcher for 100% web features on any PC
    with open(os.path.join(staging_dir, 'Start-Offline-Server.bat'), 'w', newline='\r\n') as f:
        f.write(r"""@echo off
setlocal
cd /d "%~dp0"
title UIC Quotation Manager - Offline Web Server
echo ========================================================
echo   Universal Inspection Co. Ltd. (UIC)
echo   Quotation Manager - Offline Server Launcher
echo ========================================================
echo.
echo Starting local offline server on http://127.0.0.1:41731 ...
powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -Command "$p=41731;$l=New-Object System.Net.HttpListener;$l.Prefixes.Add('http://127.0.0.1:'+$p+'/');$l.Start();while($l.IsListening){try{$c=$l.GetContext();$r=$c.Request;$s=$c.Response;$u=$r.Url.LocalPath.TrimStart('/');if(!$u){$u='index.html'};$f=Join-Path (Get-Location) $u;if(Test-Path $f){$b=[System.IO.File]::ReadAllBytes($f);$ext=[System.IO.Path]::GetExtension($f).ToLower();$m=switch($ext){'.html'{'text/html; charset=utf-8'}.'js'{'application/javascript; charset=utf-8'}.'css'{'text/css; charset=utf-8'}.'json'{'application/json'}.'png'{'image/png'}.'svg'{'image/svg+xml'}.'ico'{'image/x-icon'}default{'application/octet-stream'}};$s.ContentType=$m;$s.ContentLength64=$b.Length;$s.OutputStream.Write($b,0,$b.Length)}else{$s.StatusCode=404};$s.OutputStream.Close()}catch{}}"
timeout /t 1 /nobreak >nul

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:41731/ --window-size=1366,860
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:41731/ --window-size=1366,860
    exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:41731/ --window-size=1366,860
    exit /b
)
start http://127.0.0.1:41731/
exit /b
""")

    # Desktop shortcut setup script
    with open(os.path.join(staging_dir, 'Setup-Windows-Desktop.bat'), 'w', newline='\r\n') as f:
        f.write(r"""@echo off
setlocal
cd /d "%~dp0"
title UIC Quotation Manager - Desktop Setup
echo Creating Desktop shortcut for Universal Inspection Co. Quotation Manager...
set "TARGET=%~dp0UIC Quotation Manager.exe"
set "SHORTCUT=%USERPROFILE%\Desktop\UIC Quotation Manager.lnk"
set "ICON=%~dp0app-icon.ico"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%ICON%'; $s.Description = 'Universal Inspection Co. Quotation & Price Book Manager'; $s.Save()"

echo.
echo [SUCCESS] Desktop shortcut created successfully on your Windows Desktop!
echo.
pause
""")

    # 4. Build the official Windows Setup Installer (.exe)
    out_setup_exe = os.path.join(out_dir, 'UIC-Quotation-Manager-Setup.exe')
    setup_nsi = f"""Unicode True
SetCompressor /SOLID lzma

!define PRODUCT_NAME "UIC Quotation Manager"
!define PRODUCT_PUBLISHER "Universal Inspection Co. Ltd."
!define PRODUCT_VERSION "2.4.0"
!define PRODUCT_DIR_REGKEY "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\UIC Quotation Manager.exe"
!define PRODUCT_UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{PRODUCT_NAME}}"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "{icon_path}"
!define MUI_UNICON "{icon_path}"

!define MUI_HEADERIMAGE
!define MUI_PAGE_HEADER_TEXT "Universal Inspection Co. Ltd."
!define MUI_PAGE_HEADER_SUBTEXT "Quotation & Price Book Management System"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\\UIC Quotation Manager.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch UIC Quotation Manager now"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Name "${{PRODUCT_NAME}} ${{PRODUCT_VERSION}}"
OutFile "{out_setup_exe}"
InstallDir "$LOCALAPPDATA\\Programs\\UIC Quotation Manager"
InstallDirRegKey HKCU "${{PRODUCT_DIR_REGKEY}}" ""
ShowInstDetails nevershow
ShowUnInstDetails nevershow
RequestExecutionLevel user

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\\assets"
  SetOverwrite on
  File /r "{staging_dir}/*.*"
  
  ; Desktop Shortcut with icon
  CreateShortCut "$DESKTOP\\UIC Quotation Manager.lnk" "$INSTDIR\\UIC Quotation Manager.exe" "" "$INSTDIR\\app-icon.ico" 0
  
  ; Start Menu Shortcut
  CreateDirectory "$SMPROGRAMS\\Universal Inspection Co"
  CreateShortCut "$SMPROGRAMS\\Universal Inspection Co\\UIC Quotation Manager.lnk" "$INSTDIR\\UIC Quotation Manager.exe" "" "$INSTDIR\\app-icon.ico" 0
  CreateShortCut "$SMPROGRAMS\\Universal Inspection Co\\Uninstall UIC Quotation Manager.lnk" "$INSTDIR\\Uninstall.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "${{PRODUCT_DIR_REGKEY}}" "" "$INSTDIR\\UIC Quotation Manager.exe"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "DisplayName" "UIC Quotation Manager (Universal Inspection Co.)"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "DisplayIcon" "$INSTDIR\\app-icon.ico"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "DisplayVersion" "${{PRODUCT_VERSION}}"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "Publisher" "${{PRODUCT_PUBLISHER}}"
SectionEnd

Section Uninstall
  Delete "$DESKTOP\\UIC Quotation Manager.lnk"
  Delete "$SMPROGRAMS\\Universal Inspection Co\\UIC Quotation Manager.lnk"
  Delete "$SMPROGRAMS\\Universal Inspection Co\\Uninstall UIC Quotation Manager.lnk"
  RMDir "$SMPROGRAMS\\Universal Inspection Co"
  
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${{PRODUCT_UNINST_KEY}}"
  DeleteRegKey HKCU "${{PRODUCT_DIR_REGKEY}}"
  SetAutoClose true
SectionEnd
"""
    setup_script = '/tmp/build_setup.nsi'
    with open(setup_script, 'w', encoding='utf-8') as f:
        f.write(setup_nsi)
        
    print("Compiling official Windows Setup Installer (.exe)...")
    res = subprocess.run([makensis_bin, setup_script], capture_output=True, text=True)
    if res.returncode != 0:
        print("Setup compilation error:", res.stderr)
        raise RuntimeError("Setup makensis failed")
        
    setup_size_mb = os.path.getsize(out_setup_exe) / (1024 * 1024)
    print(f"[SUCCESS] Generated Windows Setup: {out_setup_exe} ({setup_size_mb:.2f} MB)")
    
    # 5. Also build the clean Portable ZIP
    out_zip = os.path.join(out_dir, 'UIC-Quotation-Manager-Windows-Portable.zip')
    with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(staging_dir):
            for file in files:
                abs_f = os.path.join(root, file)
                rel_f = os.path.relpath(abs_f, staging_dir)
                zf.write(abs_f, rel_f)
                
    zip_size_mb = os.path.getsize(out_zip) / (1024 * 1024)
    print(f"[SUCCESS] Generated Portable ZIP: {out_zip} ({zip_size_mb:.2f} MB)")
    
    # Copy both to dist/downloads for dev server syncing
    dist_downloads = os.path.join(dist_dir, 'downloads')
    os.makedirs(dist_downloads, exist_ok=True)
    shutil.copy2(out_setup_exe, os.path.join(dist_downloads, 'UIC-Quotation-Manager-Setup.exe'))
    shutil.copy2(out_zip, os.path.join(dist_downloads, 'UIC-Quotation-Manager-Windows-Portable.zip'))

if __name__ == '__main__':
    build_installers()

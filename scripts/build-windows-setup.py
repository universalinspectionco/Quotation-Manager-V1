import os
import subprocess
import shutil

def build_setup_exe():
    applet_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    win_unpacked = '/tmp/test-electron/win-unpacked'
    out_dir = os.path.join(applet_root, 'public', 'downloads')
    os.makedirs(out_dir, exist_ok=True)
    out_exe = os.path.join(out_dir, 'UIC-Quotation-Manager-Setup.exe')
    icon_path = os.path.join(applet_root, 'public', 'app-icon.ico')
    
    # Ensure stubs and modern UI are accessible
    nsis_base = '/root/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n'
    for folder in ['Stubs', 'Plugins', 'Include', 'Contrib']:
        src = os.path.join(nsis_base, folder)
        dst = os.path.join('/app', folder)
        if not os.path.exists(dst) and os.path.exists(src):
            try:
                os.symlink(src, dst)
            except Exception as e:
                print(f"Symlink error: {e}")

    # Generate NSIS script
    nsis_script = f"""Unicode True
SetCompressor /SOLID lzma

!define PRODUCT_NAME "UIC Quotation Manager"
!define PRODUCT_PUBLISHER "Universal Inspection Co. Ltd."
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_DIR_REGKEY "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\UIC Quotation Manager.exe"
!define PRODUCT_UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{PRODUCT_NAME}}"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "{icon_path}"
!define MUI_UNICON "{icon_path}"

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
OutFile "{out_exe}"
InstallDir "$LOCALAPPDATA\\Programs\\UIC Quotation Manager"
InstallDirRegKey HKCU "${{PRODUCT_DIR_REGKEY}}" ""
ShowInstDetails nevershow
ShowUnInstDetails nevershow
RequestExecutionLevel user

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite try
  File /r "{win_unpacked}/*.*"
  
  ; Create Desktop Shortcut
  CreateShortCut "$DESKTOP\\UIC Quotation Manager.lnk" "$INSTDIR\\UIC Quotation Manager.exe" "" "$INSTDIR\\UIC Quotation Manager.exe" 0
  
  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\\Universal Inspection Co"
  CreateShortCut "$SMPROGRAMS\\Universal Inspection Co\\UIC Quotation Manager.lnk" "$INSTDIR\\UIC Quotation Manager.exe" "" "$INSTDIR\\UIC Quotation Manager.exe" 0
  CreateShortCut "$SMPROGRAMS\\Universal Inspection Co\\Uninstall UIC Quotation Manager.lnk" "$INSTDIR\\Uninstall.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "${{PRODUCT_DIR_REGKEY}}" "" "$INSTDIR\\UIC Quotation Manager.exe"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "DisplayName" "$(^Name)"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "${{PRODUCT_UNINST_KEY}}" "DisplayIcon" "$INSTDIR\\UIC Quotation Manager.exe"
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
    script_file = '/tmp/uic_installer.nsi'
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(nsis_script)

    print("Running makensis compiler...")
    makensis_bin = os.path.join(nsis_base, 'linux', 'makensis')
    cmd = [makensis_bin, script_file]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("NSIS error output:")
        print(res.stderr)
        print(res.stdout)
        raise RuntimeError("makensis failed")
    
    size_mb = os.path.getsize(out_exe) / (1024 * 1024)
    print(f"Successfully generated Windows Setup: {out_exe} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    build_setup_exe()

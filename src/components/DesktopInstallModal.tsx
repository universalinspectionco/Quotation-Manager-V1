import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Terminal, 
  FolderArchive, 
  ArrowRight, 
  Laptop, 
  Check, 
  Sparkles,
  Info,
  HelpCircle
} from 'lucide-react';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => Promise<boolean>;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  onInstall,
}) => {
  const [activeTab, setActiveTab] = useState<'exe' | 'pwa' | 'portable' | 'build'>('exe');
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setInstallSuccess(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await onInstall();
    if (success) {
      setInstallSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-base shadow-inner">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Windows Desktop App &amp; Setup</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Universal Inspection Co.
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Official Windows Setup (.exe) installer &amp; offline software package
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('exe')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'exe'
                ? 'border-blue-700 text-blue-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <Laptop className="w-4 h-4 text-blue-700" />
            <span>Windows Setup (.exe) &mdash; [Recommended]</span>
          </button>

          <button
            onClick={() => setActiveTab('portable')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'portable'
                ? 'border-blue-700 text-blue-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-blue-700" />
            <span>Portable ZIP Package</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'pwa'
                ? 'border-blue-700 text-blue-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-700" />
            <span>1-Click Browser App</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          
          {/* TAB 1: Direct Windows Setup (.exe) Installer */}
          {activeTab === 'exe' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/80 border-2 border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-blue-700" />
                  <span>Standalone Windows Setup Installer (.exe) &mdash; All Packages Included</span>
                </div>
                <p className="text-slate-700">
                  This is a complete, standalone Windows Setup file. It includes the entire software package (Node/Chromium runtime, PDF letterhead engine, Excel tools, and databases) pre-bundled into a single standard installer.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium pl-1">
                  <li><b>Standard Software Installation:</b> Double-click to install just like any Windows program.</li>
                  <li><b>Automatic Desktop Shortcut:</b> Automatically creates a permanent <b>UIC Quotation Manager</b> icon on your <b>Windows Desktop</b> and <b>Start Menu</b>.</li>
                  <li><b>Transfer Anywhere:</b> Copy <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-blue-900 font-bold">UIC-Quotation-Manager-Setup.exe</code> to a USB flash drive or send it to any computer.</li>
                  <li><b>100% Offline:</b> Works anywhere with zero internet connection required.</li>
                  <li><b>Zero Commands:</b> No PowerShell, terminal, or Node.js commands needed.</li>
                </ul>
              </div>

              {/* Download Hero Card */}
              <div className="p-5 border-2 border-blue-600 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900 uppercase tracking-wider">
                      Ready to Download
                    </span>
                    <span className="text-xs text-blue-200 font-medium">Windows 11 / 10 / 8 / 7 (64-bit)</span>
                  </div>
                  <h4 className="font-extrabold text-white text-base">
                    UIC Quotation Manager Setup (.exe)
                  </h4>
                  <p className="text-blue-100 text-xs">
                    Full installer with desktop icon, Start menu shortcut, and uninstaller.
                  </p>
                </div>

                <a
                  href="/downloads/UIC-Quotation-Manager-Setup.exe"
                  download="UIC-Quotation-Manager-Setup.exe"
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Download Setup (.exe) &mdash; 4.0 MB</span>
                </a>
              </div>

              {/* 3 Step Guide */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  How to install on any Windows computer:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">1</span>
                      <span>Download or Copy</span>
                    </div>
                    <p className="text-slate-600">
                      Download the updated <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.exe</code> file or copy it to a USB drive to transfer to any computer.
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">2</span>
                      <span>Double-Click &amp; Install</span>
                    </div>
                    <p className="text-slate-600">
                      Double-click <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">UIC-Quotation-Manager-Setup.exe</code> and click Install.
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">3</span>
                      <span>Launch from Desktop</span>
                    </div>
                    <p className="text-slate-600">
                      The shortcut is automatically created on your <b>Desktop</b>. Double-click it anytime to launch!
                    </p>
                  </div>
                </div>

                {/* Helpful Note for Blank Screen Fix */}
                <div className="mt-3 p-3 bg-blue-50/90 border border-blue-200 rounded-lg flex items-start gap-2.5 text-[11px] text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Offline Script &amp; CORS Fix Included: </span>
                    If you experienced a blank screen with a previous build, this updated setup replaces ES module loading with classic offline scripts, bundles all vendor PDF/Excel engines locally, and configures an isolated Windows profile so the app starts instantly.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Standalone Windows Portable Package (.zip) */}
          {activeTab === 'portable' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FolderArchive className="w-4 h-4 text-blue-700" />
                  <span>Offline Portable Package (.zip) &mdash; Run Without Installing</span>
                </div>
                <p className="text-slate-700">
                  If you prefer running directly from a folder without running a setup installer, download this portable package. It includes <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">UIC Quotation Manager.exe</code>, <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">Launch-UIC-Quotation-Manager.bat</code>, and <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">Start-Offline-Server.bat</code>:
                </p>
              </div>

              {/* Download Card */}
              <div className="p-5 border-2 border-slate-200 bg-slate-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Download Portable Package (.zip)
                  </h4>
                  <p className="text-slate-600 mt-0.5">
                    Unpack and run on any machine.
                  </p>
                </div>

                <a
                  href="/downloads/UIC-Quotation-Manager-Windows-Portable.zip"
                  download="UIC-Quotation-Manager-Windows-Portable.zip"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all shrink-0 text-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP (4.3 MB)</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: 1-Click Browser App (PWA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                  <Monitor className="w-4 h-4 text-blue-700" />
                  <span>1-Click Browser App Installation</span>
                </div>
                <p className="text-slate-700">
                  Add the application directly to your desktop through your web browser without downloading installer files:
                </p>
              </div>

              {/* Action Box */}
              <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {isInstalled ? 'App is Already Installed on Windows!' : 'Install to Windows Desktop Now'}
                  </h4>
                  <p className="text-slate-500 mt-0.5">
                    {isInstalled
                      ? 'You are running the standalone desktop version of UIC Quotation Manager.'
                      : 'Click the button below to immediately add the app to your desktop.'}
                  </p>
                </div>

                {!isInstalled && isInstallable ? (
                  <button
                    onClick={handleInstallClick}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all shrink-0 text-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install to Desktop (1-Click)</span>
                  </button>
                ) : isInstalled || installSuccess ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Installed on Windows</span>
                  </div>
                ) : (
                  <div className="text-right text-[11px] text-slate-500 font-medium">
                    Look for the <span className="font-bold text-slate-800">Install icon</span> in your browser's address bar (top right).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PowerShell / Terminal Help */}
          {activeTab === 'build' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-950 font-bold text-sm">
                  <Terminal className="w-4 h-4 text-rose-700" />
                  <span>Fixing the "C:\WINDOWS\system32\package.json" Error</span>
                </div>
                <p className="text-slate-700">
                  If PowerShell shows <code className="bg-white px-1 py-0.5 rounded border border-rose-200 text-rose-900 font-mono text-[11px]">Could not read package.json: no such file or directory, open 'C:\WINDOWS\system32\package.json'</code>:
                </p>
                <p className="text-slate-700 font-semibold">
                  Why this happened: PowerShell was opened in Windows's default system folder (<code className="font-mono">system32</code>) instead of your project folder.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  How to fix it (2 Easy Ways):
                </h4>

                <div className="space-y-3">
                  {/* Solution 1 */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <div className="font-bold text-blue-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">A</span>
                      <span>Method A: Double-Click "Build-Windows-App.bat" (Automatic)</span>
                    </div>
                    <p className="text-slate-600">
                      In the project folder, simply double-click <b>Build-Windows-App.bat</b>. It will automatically detect its own folder and build the standalone Electron executable without needing to type anything in PowerShell!
                    </p>
                  </div>

                  {/* Solution 2 */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <div className="font-bold text-blue-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">B</span>
                      <span>Method B: Open PowerShell in the Project Folder</span>
                    </div>
                    <p className="text-slate-600">
                      1. Open your project folder in <b>File Explorer</b>.<br />
                      2. Hold down the <b>Shift</b> key and <b>Right-Click</b> in any blank space in the folder.<br />
                      3. Click <b>"Open PowerShell window here"</b>.<br />
                      4. Now run:
                    </p>
                    <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                      <p className="text-emerald-400">npm run build</p>
                      <p className="text-emerald-400">npx electron-builder --win --x64</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Info className="w-3.5 h-3.5 text-blue-700" />
            <span>Universal Inspection Co. Ltd. &middot; Jubail, KSA</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

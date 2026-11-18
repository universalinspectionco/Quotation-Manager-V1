import React, { useRef, useEffect, useState } from 'react';
import { 
  PenTool, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Check, 
  FileText, 
  Image as ImageIcon,
  HardDrive,
  Folder,
  FolderOpen,
  FolderCheck,
  Network,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  Download,
  ShieldCheck,
  Sparkles,
  Palette,
  Sliders
} from 'lucide-react';
import { Settings, AppDatabase, AppTheme } from '../types/quotation';
import { getAssetImage, IMG } from '../data/assets';
import { StorageService } from '../services/storage';
import { FileStorageService } from '../services/fileStorageService';
import { THEMES, getTheme, applyTheme } from '../utils/theme';
import { BACKGROUND_PRESETS } from '../utils/backgroundPresets';

interface SettingsViewProps {
  settings: Settings;
  database: AppDatabase;
  onUpdateSettings: (newSettings: Settings) => void;
  onImportFullDatabase: (importedDb: AppDatabase) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  database,
  onUpdateSettings,
  onImportFullDatabase,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef<boolean>(false);
  const [connectedFolderName, setConnectedFolderName] = useState<string>(
    settings.defaultFolderName || ''
  );
  const [testSaveStatus, setTestSaveStatus] = useState<string | null>(null);

  // Check on mount if an active directory handle is already stored
  useEffect(() => {
    FileStorageService.getActiveDirectoryHandle(false).then((handle) => {
      if (handle) {
        setConnectedFolderName(handle.name);
        if (!settings.defaultFolderName) {
          onUpdateSettings({ ...settings, defaultFolderName: handle.name });
        }
      }
    });
  }, []);

  const handleSelectFolder = async () => {
    const res = await FileStorageService.selectDefaultDirectory();
    if (res) {
      setConnectedFolderName(res.name);
      onUpdateSettings({
        ...settings,
        defaultFolderName: res.name,
        defaultStoragePath: settings.defaultStoragePath || res.name,
      });
      alert(`Connected folder: ${res.name}\nFiles will now save directly or open with Windows Save dialog pointing to this folder.`);
    }
  };

  const handleDisconnectFolder = async () => {
    await FileStorageService.disconnectDirectory();
    setConnectedFolderName('');
    onUpdateSettings({
      ...settings,
      defaultFolderName: '',
    });
  };

  const handleTestSave = async () => {
    const testBlob = new Blob(
      [
        `Universal Inspection Co. Ltd. (UIC)\n` +
        `Quotation Storage Configuration Verification Test\n` +
        `Configured Path: ${settings.defaultStoragePath || 'Default'}\n` +
        `Connected Folder: ${connectedFolderName || 'None'}\n` +
        `Save Mode: ${settings.storageSaveMode || 'dialog'}\n` +
        `Timestamp: ${new Date().toLocaleString()}\n`
      ],
      { type: 'text/plain' }
    );
    const filename = `UIC_Storage_Test_${new Date().toISOString().slice(0, 10)}.txt`;
    const res = await FileStorageService.saveFile({
      blob: testBlob,
      filename,
      mimeType: 'text/plain',
      description: 'Text Verification Document',
      extension: '.txt',
      settings,
    });
    setTestSaveStatus(res.message);
    setTimeout(() => setTestSaveStatus(null), 6000);
  };

  const handleExportDatabase = async () => {
    const jsonStr = JSON.stringify(database, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `UIC-Quotation-Database-${new Date().toISOString().slice(0, 10)}.json`;
    const res = await FileStorageService.saveFile({
      blob,
      filename,
      mimeType: 'application/json',
      description: 'JSON Database Backup',
      extension: '.json',
      settings,
    });
    if (res.success) {
      alert(res.message);
    }
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = StorageService.importDatabaseJson(text);
        onImportFullDatabase(imported);
        alert('Database imported successfully. All quotes and price books have been updated.');
      } catch (err: any) {
        alert('Failed to import database: ' + (err?.message || 'Invalid format'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Setup drawing pad canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0B1B5C'; // Dark navy ink

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      isDrawing.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const onPointerUp = () => {
      isDrawing.current = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const useDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onUpdateSettings({ ...settings, sig: dataUrl });
    alert('Drawn signature saved successfully.');
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateSettings({ ...settings, sig: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadAsset = (key: 'hdr' | 'ftr' | 'wm', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateSettings({ ...settings, [key]: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetAsset = (key: 'hdr' | 'ftr' | 'wm') => {
    onUpdateSettings({ ...settings, [key]: '' });
  };

  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleUploadBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Image file size is too large (over 8MB). Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateSettings({
        ...settings,
        bgImage: reader.result as string,
        bgOpacity: settings.bgOpacity || 20,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* 0. App Interface & Professional Color Themes */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ring-1 ring-black/10"
                style={{ backgroundColor: getTheme(settings.theme).primary }}
              >
                <Palette className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                App Interface &amp; Professional Color Themes
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select an executive corporate color theme tailored for engineering &amp; industrial inspection quotation proposals.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: getTheme(settings.theme).lightBg,
              color: getTheme(settings.theme).primary,
              borderColor: getTheme(settings.theme).border,
            }}
          >
            Active: {getTheme(settings.theme).name}
          </span>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEMES.map((themeOption) => {
            const isSelected = (settings.theme || 'navy') === themeOption.id;
            return (
              <div
                key={themeOption.id}
                onClick={() => {
                  applyTheme(themeOption.id);
                  onUpdateSettings({ ...settings, theme: themeOption.id });
                }}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none shrink-0">{themeOption.accentEmoji}</span>
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shadow-xs shrink-0"
                      style={{ backgroundColor: themeOption.primary }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {themeOption.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {themeOption.vibe}
                      </div>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">Select</span>
                  )}
                </div>

                {/* Color Swatch Preview Band */}
                <div className="flex h-3 rounded-md overflow-hidden my-1.5 border border-black/5">
                  <div className="flex-1" style={{ backgroundColor: themeOption.primaryDark }} />
                  <div className="flex-2" style={{ backgroundColor: themeOption.primary }} />
                  <div className="flex-1" style={{ backgroundColor: themeOption.primaryHover }} />
                  <div className="flex-1" style={{ backgroundColor: themeOption.border }} />
                  <div className="flex-1" style={{ backgroundColor: themeOption.lightBg }} />
                </div>

                <p className="text-[11px] text-slate-600 font-medium mt-1 leading-tight">
                  {themeOption.tagline}
                </p>

                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-500">Background:</span>
                  <span className="truncate max-w-[170px] text-slate-600">{themeOption.bgPatternName}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Background Picture Subsection */}
        <div className="pt-5 border-t border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-xs"
                style={{ backgroundColor: getTheme(settings.theme).primary }}
              >
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Custom Background Picture &amp; Wallpaper
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set a custom facility photo or wallpaper behind the app without affecting text contrast or function.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadBgImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: getTheme(settings.theme).primary }}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Picture</span>
              </button>

              {settings.bgImage && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, bgImage: '' })}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  title="Remove custom background picture"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Picture</span>
                </button>
              )}
            </div>
          </div>

          {/* Preset Background Wallpapers Gallery */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Preset Offline Backgrounds:</span>
              <span className="text-[10px] text-slate-400">Click any preset to apply instantly</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {BACKGROUND_PRESETS.map((preset) => {
                const isSelected = settings.bgImage === preset.dataUrl;
                return (
                  <div
                    key={preset.id}
                    onClick={() => onUpdateSettings({ ...settings, bgImage: preset.dataUrl, bgOpacity: settings.bgOpacity || 20 })}
                    className={`p-2 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`h-12 rounded-lg bg-gradient-to-br ${preset.thumbnailGradient} relative overflow-hidden mb-1 flex items-center justify-center`}>
                      <div 
                        className="absolute inset-0 bg-cover bg-center opacity-40"
                        style={{ backgroundImage: `url(${preset.dataUrl})` }}
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-[11px] text-slate-900 truncate">{preset.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Background Tuning Controls (Opacity, Blur, Contrast Overlay) */}
          {settings.bgImage && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-xs font-bold text-slate-800">
                <Sliders className="w-4 h-4 text-slate-600" />
                <span>Adjust Picture Readability &amp; Blend</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">Picture Opacity:</span>
                    <span className="font-mono font-bold text-slate-900">{settings.bgOpacity ?? 20}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="1"
                    value={settings.bgOpacity ?? 20}
                    onChange={(e) => onUpdateSettings({ ...settings, bgOpacity: parseInt(e.target.value) || 20 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>5% (Subtle)</span>
                    <span>20% (Optimal)</span>
                    <span>60% (Vibrant)</span>
                  </div>
                </div>

                {/* Blur */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">Picture Blur:</span>
                    <span className="font-mono font-bold text-slate-900">{settings.bgBlur ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={settings.bgBlur ?? 0}
                    onChange={(e) => onUpdateSettings({ ...settings, bgBlur: parseInt(e.target.value) || 0 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0px (Crisp)</span>
                    <span>3px (Soft)</span>
                    <span>10px (Abstract)</span>
                  </div>
                </div>
              </div>

              {/* Contrast Protection Overlay */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contrast Protection Shield:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { id: 'light', label: 'Light Shield', desc: 'Preserves sharp text' },
                    { id: 'dark', label: 'Dark Tint', desc: 'Cinematic depth' },
                    { id: 'theme', label: 'Theme Hue', desc: 'Blends with theme' },
                    { id: 'none', label: 'No Shield', desc: 'Raw picture' },
                  ].map((ov) => {
                    const isSelected = (settings.bgOverlay || 'light') === ov.id;
                    return (
                      <button
                        key={ov.id}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, bgOverlay: ov.id as any })}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-[11px] leading-tight">{ov.label}</div>
                        <div className="text-[9px] opacity-75">{ov.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Guarantee Note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Zero Impact on Functionality:</strong> Background pictures run on an isolated non-interactive background layer (<code className="font-mono font-bold">pointer-events: none</code>). All quotation inputs, calculation logic, buttons, price books, and PDF generation function at 100% speed.
            </div>
          </div>
        </div>
      </div>

      {/* 1. Quotation Defaults */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Defaults for New Quotations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure reference prefix numbering, KSA VAT percentage, default titles, and clauses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Reference Prefix</label>
            <input
              type="text"
              value={settings.prefix}
              onChange={(e) => onUpdateSettings({ ...settings, prefix: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Next Reference Number</label>
            <input
              type="number"
              value={settings.next}
              onChange={(e) => onUpdateSettings({ ...settings, next: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Default VAT %</label>
            <input
              type="number"
              value={settings.vat}
              onChange={(e) => onUpdateSettings({ ...settings, vat: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Default Title (Standard)</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => onUpdateSettings({ ...settings, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Default Delivery Terms</label>
            <textarea
              rows={2}
              value={settings.delivery}
              onChange={(e) => onUpdateSettings({ ...settings, delivery: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Default Service Beginning Terms</label>
            <textarea
              rows={2}
              value={settings.service}
              onChange={(e) => onUpdateSettings({ ...settings, service: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>
        </div>

        <div className="text-xs pt-2">
          <label className="block text-slate-700 font-semibold mb-1">Default Introduction Letter Text</label>
          <textarea
            rows={3}
            value={settings.intro}
            onChange={(e) => onUpdateSettings({ ...settings, intro: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-medium"
          />
        </div>

        <div className="text-xs pt-2">
          <label className="block text-slate-700 font-semibold mb-1">Default Standard Terms &amp; Conditions</label>
          <textarea
            rows={6}
            value={settings.tc}
            onChange={(e) => onUpdateSettings({ ...settings, tc: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* 2. Digital Signature Studio */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Digital Signature Studio &amp; Stamp
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Draw your signature below using mouse, touch, or stylus, or upload a transparent signature or company stamp.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Signer Full Name</label>
            <input
              type="text"
              value={settings.signer}
              onChange={(e) => onUpdateSettings({ ...settings, signer: e.target.value })}
              placeholder="e.g. Mohammed Al-Otaibi"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Designation / Role</label>
            <input
              type="text"
              value={settings.role}
              onChange={(e) => onUpdateSettings({ ...settings, role: e.target.value })}
              placeholder="e.g. Operations Manager"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-medium"
            />
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="pt-2">
          <label className="block text-slate-700 text-xs font-semibold mb-2">
            Signature Drawing Pad
          </label>
          <canvas
            ref={canvasRef}
            width={520}
            height={150}
            className="w-full max-w-lg h-36 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-crosshair touch-none shadow-inner"
          />

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Clear Pad
            </button>
            <button
              type="button"
              onClick={useDrawnSignature}
              className="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              Apply Drawn Signature
            </button>
            {settings.sig && (
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, sig: '' })}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
              >
                Remove Current Signature
              </button>
            )}
          </div>
        </div>

        {/* Upload File Alternative */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Or Upload Signature / Stamp Image</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleUploadSignature}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          {settings.sig && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
              <span className="text-[11px] text-slate-500">Active signature:</span>
              <img
                src={settings.sig}
                alt="Active Signature"
                className="h-10 bg-white border border-slate-200 rounded p-1 object-contain"
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Letterhead Style & Branding */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Official Letterhead Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the PDF letterhead presentation style. Custom high-resolution graphics can be uploaded below.
          </p>
        </div>

        <div className="max-w-md text-xs">
          <label className="block text-slate-700 font-semibold mb-1">Letterhead Mode</label>
          <select
            value={settings.lh}
            onChange={(e) =>
              onUpdateSettings({ ...settings, lh: e.target.value as 'band' | 'orig' | 'none' })
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-semibold text-slate-900"
          >
            <option value="band">Corporate Dark Navy Blue Band (Official Modern Corporate Style)</option>
            <option value="orig">Original Letterhead (Margin-based Classic Header)</option>
            <option value="none">None (For Printing on Company Pre-Printed Stationery)</option>
          </select>
        </div>

        {/* Asset Previews & Upload */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs">
          {/* Header Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Top Header Banner</span>
              {settings.hdr && (
                <button
                  type="button"
                  onClick={() => resetAsset('hdr')}
                  className="text-xs text-blue-700 hover:underline font-semibold"
                >
                  Reset Default
                </button>
              )}
            </div>
            <img
              src={getAssetImage('hdr', settings)}
              alt="Header"
              className="w-full h-12 object-contain bg-white border border-slate-300 rounded p-1"
            />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleUploadAsset('hdr', e)}
              className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-slate-200"
            />
          </div>

          {/* Footer Band */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Bottom Footer Band</span>
              {settings.ftr && (
                <button
                  type="button"
                  onClick={() => resetAsset('ftr')}
                  className="text-xs text-blue-700 hover:underline font-semibold"
                >
                  Reset Default
                </button>
              )}
            </div>
            <img
              src={getAssetImage('ftr', settings)}
              alt="Footer"
              className="w-full h-12 object-contain bg-white border border-slate-300 rounded p-1"
            />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleUploadAsset('ftr', e)}
              className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-slate-200"
            />
          </div>

          {/* Watermark Logo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Watermark Logo</span>
              {settings.wm && (
                <button
                  type="button"
                  onClick={() => resetAsset('wm')}
                  className="text-xs text-blue-700 hover:underline font-semibold"
                >
                  Reset Default
                </button>
              )}
            </div>
            <img
              src={getAssetImage('wm', settings)}
              alt="Watermark"
              className="w-full h-12 object-contain bg-white border border-slate-300 rounded p-1"
            />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleUploadAsset('wm', e)}
              className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-slate-200"
            />
          </div>
        </div>
      </div>

      {/* 4. INBUILT LOCAL & NETWORK FOLDER STORAGE OPTIONS */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <FolderCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Inbuilt Local &amp; Network Storage Options</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                  Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your preferred storage folder, shared network drives, and native Windows save pop-up window behaviors.
              </p>
            </div>
          </div>
        </div>

        {/* Folder Connection Status Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-700" />
                <span>Connected Storage Location:</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                {connectedFolderName ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Active Folder: {connectedFolderName}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>No folder linked yet &mdash; Windows Save dialog will prompt each time</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectFolder}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{connectedFolderName ? 'Change Folder / Network' : 'Browse & Select Folder'}</span>
              </button>

              {connectedFolderName && (
                <button
                  type="button"
                  onClick={handleDisconnectFolder}
                  className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            <b>Network Shares &amp; Local Folders:</b> You can pick any local folder (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">C:\UIC_Quotations</code>) or mapped network drives (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">Z:\Shared_Quotes</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">\\Server\Quotes</code>) on your local company network.
          </p>
        </div>

        {/* Custom Path String Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-blue-700" />
              <span>Default Storage Path (Local Folder or Network Share UNC)</span>
            </label>
            <input
              type="text"
              value={settings.defaultStoragePath || ''}
              onChange={(e) => onUpdateSettings({ ...settings, defaultStoragePath: e.target.value })}
              placeholder="e.g. C:\UIC_Quotations or \\192.168.1.50\Quotes or Z:\Quotes"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-mono text-slate-900 font-medium"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Used as the reference folder and default location for all quotation documents.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5 text-blue-700" />
              <span>Save Action Behavior</span>
            </label>
            <select
              value={settings.storageSaveMode || 'dialog'}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  storageSaveMode: e.target.value as 'dialog' | 'direct' | 'download',
                })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-semibold text-slate-900"
            >
              <option value="dialog">
                Native Windows "Save As" Pop-up Window (Directs to default folder) &mdash; [Recommended]
              </option>
              <option value="direct">
                Direct-to-Folder Save (1-Click saves directly to connected folder/network)
              </option>
              <option value="download">
                Standard Browser Download (Saves to browser Downloads folder)
              </option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {settings.storageSaveMode === 'direct'
                ? 'Files will be saved automatically directly into your connected folder without prompting.'
                : 'A native Windows file dialog window will open up directly, starting inside your configured storage folder.'}
            </p>
          </div>
        </div>

        {/* Live Auto-Sync Toggle & Test Action */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <label className="flex items-start sm:items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSyncDatabaseFile !== false}
              onChange={(e) => onUpdateSettings({ ...settings, autoSyncDatabaseFile: e.target.checked })}
              className="mt-0.5 sm:mt-0 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-slate-800 font-medium">
              <b>Auto-Sync Database File:</b> Automatically save a live copy of <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-900">UIC_Quotation_Database.json</code> to the connected folder whenever a quote is created or edited.
            </span>
          </label>

          <button
            type="button"
            onClick={handleTestSave}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition-colors shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>Test Storage &amp; Pop-up Window</span>
          </button>
        </div>

        {/* Test Result Banner */}
        {testSaveStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{testSaveStatus}</span>
          </div>
        )}
      </div>

      {/* 5. DATABASE BACKUP & RESTORATION */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Database Backup &amp; Safe File Export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Save a master JSON file containing all quotes, company price books, rates, and settings to your chosen directory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportDatabase}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Save Database Backup (.json)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-blue-700" />
            <span>Restore / Import Database (.json)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportDatabase}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

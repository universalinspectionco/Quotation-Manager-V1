import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  FileText, 
  BarChart2, 
  FolderCheck, 
  Keyboard, 
  Palette, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  ShieldCheck, 
  Wrench, 
  Gauge, 
  Laptop, 
  Save, 
  Waves, 
  Cpu, 
  Car, 
  Play
} from 'lucide-react';
import { AppTheme } from '../types/quotation';
import { THEMES, getTheme } from '../utils/theme';

interface AppIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewQuote: () => void;
  currentTheme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
}

export const AppIntroModal: React.FC<AppIntroModalProps> = ({
  isOpen,
  onClose,
  onStartNewQuote,
  currentTheme = 'navy',
  onChangeTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'themes' | 'shortcuts'>('overview');
  const [featureStep, setFeatureStep] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  const themeConfig = getTheme(currentTheme);

  // Close with Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCloseIntro = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('uic_intro_dismissed', 'true');
      } catch {}
    }
    onClose();
  };

  if (!isOpen) return null;

  const features = [
    {
      title: 'Active Client Job Frequency Analytics',
      badge: 'Dashboard Analytics',
      desc: 'Interactive bar charts tracking won jobs, booked projects, conversion win rate %, and contract amounts in SAR. Click any client bar to instantly filter quotes below.',
      icon: <BarChart2 className="w-6 h-6 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200 text-blue-900',
    },
    {
      title: 'Auto-Save & Dual Export (Ctrl + S)',
      badge: 'Instant Productivity',
      desc: 'Press Ctrl+S inside any quote to automatically save to database, display live PDF preview, and simultaneously write both .pdf and .xlsx files to your default local folder.',
      icon: <Save className="w-6 h-6 text-emerald-600" />,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    },
    {
      title: 'Dual Engine: Standard & Valve Testing',
      badge: 'Quotation Engine',
      desc: 'Create official NDT / Inspection proposals or specialized Valve Testing quotes with pipe size (1/2" to 24"), pressure class (150# to 2500#), and Pass/Fail rate clauses.',
      icon: <Gauge className="w-6 h-6 text-sky-600" />,
      color: 'bg-sky-50 border-sky-200 text-sky-900',
    },
    {
      title: 'Local & Network Folder Storage',
      badge: 'Zero Cloud Lock-in',
      desc: 'Link native PC folders (e.g. C:\\UIC_Quotations) or company shared network paths. Automatically syncs database backups and saves documents directly to your drives.',
      icon: <FolderCheck className="w-6 h-6 text-indigo-600" />,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    },
    {
      title: 'Price Book Intelligence',
      badge: 'Smart Autocomplete',
      desc: 'Learns agreed rates and item descriptions for every client as you generate quotes. Automatically autocompletes pricing and terms next time you quote that company.',
      icon: <CheckCircle2 className="w-6 h-6 text-amber-600" />,
      color: 'bg-amber-50 border-amber-200 text-amber-900',
    },
    {
      title: '10 Atmospheric Themes & Backgrounds',
      badge: 'Personalized Workspaces',
      desc: 'Choose from Ocean Waves, Cyber Anime, Industrial Mechanical, Motorsport/Car, Royal Navy, Executive Slate, Emerald, and more with distinctive ambient background textures.',
      icon: <Palette className="w-6 h-6 text-fuchsia-600" />,
      color: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Hero Banner */}
        <div 
          className="relative px-6 py-5 text-white flex items-center justify-between overflow-hidden"
          style={{ backgroundColor: themeConfig.primary }}
        >
          {/* Subtle background glow decorative circles */}
          <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-white/10 blur-lg pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center font-bold text-xl shadow-xs">
              UIC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Universal Inspection Co. Ltd.
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 hidden sm:inline-block">
                  Quotation Manager v2.5
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium">
                Professional Calibration, Valve Testing &amp; Technical Services System
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseIntro}
            className="relative z-10 p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            title="Close intro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview &amp; Welcome
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'features'
                ? 'border-blue-600 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Core Features ({features.length})
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'themes'
                ? 'border-blue-600 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            10 Visual Themes &amp; Backgrounds
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-900 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Keyboard Shortcuts (F1)
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-700">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shrink-0 shadow-md"
                  style={{ backgroundColor: themeConfig.primary }}
                >
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Your Complete Industrial Quotation Command Center
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Designed specifically for Universal Inspection Co. Ltd. to streamline client proposals, valve testing calibrations, won project tracking, and immediate official export to PDF, Excel, and Word with zero cloud dependence.
                  </p>
                </div>
              </div>

              {/* 3 Quick Highlight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Client Job Frequency</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Real-time bar chart of booked projects, client win rates, and SAR pipeline on your dashboard.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Save className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Ctrl + S Dual Auto-Save</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Generates and auto-saves both PDF and Excel directly to your selected Windows PC folder.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-all shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2.5">
                    <Palette className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Theme Backgrounds</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ocean Waves, Cyber Anime, Industrial Mechanical, Motorsport/Car, and Royal Navy backdrops.
                  </p>
                </div>
              </div>

              {/* Workflows Supported */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Specialized Services Covered
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Valve Testing &amp; Calibration:</strong> Safety relief, control valves, 150# - 2500# with Pass/Fail conditions.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Inspection &amp; Calibration:</strong> Dimensional, metallurgical, electrical, pressure, and NDT equipment.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Bilingual Documents:</strong> Arabic &amp; English company registration, tax invoices, and standard UIC terms.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Direct Folder Linking:</strong> Direct storage in your company network shared folder or local drive.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {features.map((feat, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${feat.color}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {feat.icon}
                        <h4 className="font-bold text-xs text-slate-900">{feat.title}</h4>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-black/10">
                        {feat.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: THEMES & BACKGROUNDS */}
          {activeTab === 'themes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Choose Your Workspace Theme &amp; Background
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Includes your requested Ocean, Anime, Mechanical, and Motorsport/Car themes with custom backgrounds.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Current: {themeConfig.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {THEMES.map((t) => {
                  const isCurrent = t.id === currentTheme;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onChangeTheme && onChangeTheme(t.id)}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{t.accentEmoji}</span>
                          <span className="font-bold text-xs text-slate-900">{t.name}</span>
                        </div>
                        {isCurrent && (
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Swatch */}
                      <div className="flex h-3 rounded-md overflow-hidden my-1 border border-black/10">
                        <div className="flex-1" style={{ backgroundColor: t.primaryDark }} />
                        <div className="flex-2" style={{ backgroundColor: t.primary }} />
                        <div className="flex-1" style={{ backgroundColor: t.primaryHover }} />
                        <div className="flex-1" style={{ backgroundColor: t.border }} />
                        <div className="flex-1" style={{ backgroundColor: t.lightBg }} />
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700">Background:</span> {t.bgPatternName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-900 mb-2">Essential Keyboard Shortcuts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Auto-save &amp; Dual PDF/Excel export</span>
                    <kbd className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
                      Ctrl + S
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">New Quotation Picker</span>
                    <kbd className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      Alt + N
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Search Quotes &amp; Price Book</span>
                    <kbd className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      Alt + F
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Full Shortcuts Dialog</span>
                    <kbd className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      F1
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Strip */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Don't show this intro automatically on startup</span>
          </label>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={handleCloseIntro}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                handleCloseIntro();
                onStartNewQuote();
              }}
              className="px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2 hover:opacity-95"
              style={{ backgroundColor: themeConfig.primary }}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Creating Quotes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

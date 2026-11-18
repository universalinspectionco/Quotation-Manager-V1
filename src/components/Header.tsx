import React, { useState, useEffect, useRef } from 'react';
import { 
  Keyboard, 
  HardDrive, 
  Download, 
  WifiOff, 
  Laptop,
  Palette,
  Check,
  Sparkles,
  Image as ImageIcon,
  Menu,
  Search,
  Plus,
  Film
} from 'lucide-react';
import { AppTheme } from '../types/quotation';
import { THEMES, getTheme } from '../utils/theme';

interface HeaderProps {
  currentTab: 'list' | 'edit' | 'report' | 'book' | 'set';
  onSelectTab: (tab: 'list' | 'edit' | 'report' | 'book' | 'set') => void;
  onNewQuoteClick: () => void;
  onOpenShortcuts: () => void;
  pendingPermission: boolean;
  onReconnectDb?: () => void;
  storageStatus?: string;
  isInstallable?: boolean;
  isInstalled?: boolean;
  onInstall?: () => void;
  isOnline?: boolean;
  onOpenDesktopSetup?: () => void;
  theme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
  onOpenIntro?: () => void;
  hasBgImage?: boolean;
  onOpenBgPicture?: () => void;
  onToggleMobileSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onNewQuoteClick,
  onOpenShortcuts,
  pendingPermission,
  onReconnectDb,
  storageStatus,
  isInstallable,
  isInstalled,
  onInstall,
  isOnline = true,
  onOpenDesktopSetup,
  theme = 'terminal',
  onChangeTheme,
  onOpenIntro,
  hasBgImage = false,
  onOpenBgPicture,
  onToggleMobileSidebar,
  searchQuery = '',
  onSearchChange,
}) => {
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const currentThemeConfig = getTheme(theme);

  // Close theme picker on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 glass-header border-b border-[var(--border,rgba(228,228,231,0.12))] transition-colors">
      {/* Offline Status Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-inner">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode Active &middot; All quotes and changes are saved locally to your device storage.</span>
        </div>
      )}

      {/* Top Banner Notice if Database File Needs Permission */}
      {pendingPermission && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Local database file linked but requires browser permission to enable auto-save.</span>
          </div>
          {onReconnectDb && (
            <button
              onClick={onReconnectDb}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xs text-xs transition-colors cursor-pointer"
            >
              Authorize Local File
            </button>
          )}
        </div>
      )}

      {/* Main Top Bar matching Variation 23 */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
          
          {/* Left: Mobile Menu Toggle + Search Field */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
            {/* Mobile Hamburger */}
            {onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
                title="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Variation 23 Monospace Search Field */}
            <div className="relative w-full max-w-md">
              <input
                id="sq"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  if (onSearchChange) onSearchChange(e.target.value);
                }}
                placeholder="FILTER BY REFERENCE_ID OR CLIENT..."
                style={{ width: '375px', height: '33px' }}
                className="bg-transparent border border-[var(--border,rgba(228,228,231,0.12))] px-3.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-mono text-[var(--ink,#E4E4E7)] placeholder-[var(--ink-faint,rgba(228,228,231,0.5))] rounded-xs outline-hidden focus:border-[var(--accent,#FF3B30)] transition-colors tracking-wide"
              />
              <span className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--ink-faint,rgba(228,228,231,0.4))] pointer-events-none">
                Alt+F
              </span>
            </div>
          </div>

          {/* Right Action Zone */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Live System Indicator */}
            <div className="hidden sm:flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isOnline ? '#4CD964' : '#F59E0B',
                  boxShadow: isOnline ? '0 0 8px #4CD964' : 'none',
                }}
              />
              <span 
                className="label-mono text-[10px] inline-block"
                style={{ width: '75px', color: isOnline ? '#4CD964' : '#F59E0B' }}
              >
                {isOnline ? 'System Live' : 'Offline'}
              </span>
            </div>

            {/* Background Picture / Live Animation Wallpaper */}
            {onOpenBgPicture && (
              <button
                type="button"
                onClick={onOpenBgPicture}
                title="Live Wallpaper & Animations Studio"
                style={{ width: '80px' }}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-mono text-[var(--ink,#E4E4E7)] bg-white/[0.04] hover:bg-white/[0.08] hover:border-[var(--accent,#FF3B30)] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs transition-all cursor-pointer group"
              >
                <Film className="w-3.5 h-3.5 text-[var(--accent,#FF3B30)] group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline text-[11px]">Live BG</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              </button>
            )}

            {/* Theme Switcher Dropdown */}
            {onChangeTheme && (
              <div className="relative" ref={themeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsThemeOpen(!isThemeOpen)}
                  title="Switch Theme"
                  style={{ width: '100px' }}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-mono text-[var(--ink,#E4E4E7)] bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs transition-colors cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  <span 
                    className="w-2 h-2 rounded-full inline-block shrink-0" 
                    style={{ backgroundColor: currentThemeConfig.primary }} 
                  />
                  <span className="text-[11px] truncate max-w-[60px]">
                    {currentThemeConfig.name.split(' ')[0]}
                  </span>
                </button>

                {isThemeOpen && (
                  <div 
                    className="absolute right-0 top-full mt-2 w-80 rounded-sm shadow-2xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
                    style={{
                      backgroundColor: 'var(--surface, #1C1C1E)',
                      borderColor: 'var(--border, rgba(228, 228, 231, 0.12))',
                      color: 'var(--ink, #E4E4E7)',
                    }}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink-faint,rgba(228,228,231,0.6))] border-b border-[var(--border,rgba(228,228,231,0.12))] mb-1 flex items-center justify-between">
                      <span>Themes &amp; Architecture</span>
                      <span className="text-[9px] text-[var(--accent,#FF3B30)] font-semibold">{THEMES.length} Presets</span>
                    </div>

                    <div className="space-y-0.5">
                      {THEMES.map((t) => {
                        const isActive = t.id === theme;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              onChangeTheme(t.id);
                              setIsThemeOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between rounded-xs transition-colors cursor-pointer ${
                              isActive 
                                ? 'bg-black/10 dark:bg-white/[0.08] font-bold text-[var(--ink,#E4E4E7)]' 
                                : 'hover:bg-black/5 dark:hover:bg-white/[0.04] text-[var(--ink-secondary,rgba(228,228,231,0.8))]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-sm shrink-0">{t.accentEmoji}</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-[var(--ink,#E4E4E7)] leading-tight truncate text-xs">{t.name}</div>
                                <div className="text-[10px] text-[var(--ink-faint,rgba(228,228,231,0.6))] font-normal truncate mt-0.5">
                                  {t.tagline}
                                </div>
                              </div>
                            </div>
                            {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Desktop Setup Button */}
            {onOpenDesktopSetup && (
              <button
                onClick={onOpenDesktopSetup}
                title="Windows Desktop Setup (.exe & Portable)"
                style={{ width: '60px', height: '25px' }}
                className="flex items-center justify-center gap-1 text-[11px] font-mono text-[var(--ink,#E4E4E7)] bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs transition-all cursor-pointer p-0"
              >
                <Download className="w-3 h-3 opacity-80" />
                <span className="text-[10px]">App</span>
              </button>
            )}

            {/* Guided Tour */}
            {onOpenIntro && (
              <button
                onClick={onOpenIntro}
                title="App Intro &amp; Tour"
                style={{ width: '50px', height: '25px' }}
                className="flex items-center justify-center gap-1 text-[11px] font-mono text-[var(--ink,#E4E4E7)] bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs transition-all cursor-pointer p-0"
              >
                <Sparkles className="w-3 h-3 text-[var(--accent,#FF3B30)]" />
                <span className="text-[10px]">Tour</span>
              </button>
            )}

            {/* Keyboard Shortcuts */}
            <button
              onClick={onOpenShortcuts}
              title="Keyboard Shortcuts (Press ? or F1)"
              className="p-1.5 text-[var(--ink,#E4E4E7)] bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs transition-colors cursor-pointer"
            >
              <Keyboard className="w-4 h-4 opacity-80" />
            </button>

            {/* Variation 23 Primary CTA */}
            <button
              onClick={onNewQuoteClick}
              className="btn-cta shrink-0 font-syne text-[11px] sm:text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ New Quote</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

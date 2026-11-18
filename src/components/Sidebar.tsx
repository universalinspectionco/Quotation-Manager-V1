import React from 'react';
import { 
  FileText, 
  BarChart3, 
  BookOpen, 
  Settings as SettingsIcon, 
  Plus, 
  HardDrive, 
  Laptop, 
  X,
  Edit3
} from 'lucide-react';
import { ThemeConfig } from '../utils/theme';

interface SidebarProps {
  currentTab: 'list' | 'edit' | 'report' | 'book' | 'set';
  onSelectTab: (tab: 'list' | 'edit' | 'report' | 'book' | 'set') => void;
  onNewQuoteClick: () => void;
  quotesCount: number;
  themeConfig: ThemeConfig;
  editingQuoteRefNo?: string;
  storageStatus?: string;
  isInstalled?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onNewQuoteClick,
  quotesCount,
  themeConfig,
  editingQuoteRefNo,
  storageStatus,
  isInstalled,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside Element */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[280px] backdrop-blur-xl flex flex-col p-6 sm:p-7 border-r transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--surface, #1C1C1E)',
          borderColor: 'var(--border, rgba(228, 228, 231, 0.12))',
          color: 'var(--ink, #E4E4E7)',
        }}
      >
        {/* Brand Block */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <div 
              className="font-bold leading-none tracking-tight mb-2 flex items-center justify-center"
              style={{ 
                color: 'var(--accent, #FF3B30)',
                width: '200px',
                height: '45px',
                fontSize: '50px',
                fontStyle: 'normal',
                textDecorationLine: 'none',
                fontFamily: 'JetBrains Mono',
                textAlign: 'center',
              }}
            >
              UIC
            </div>
            <p 
              className="font-semibold text-sm tracking-tight text-[var(--ink,#E4E4E7)] leading-tight"
              style={{ textAlign: 'center' }}
            >
              Universal Inspection
            </p>
            <p 
              className="label-mono text-[9px] mt-1 text-[var(--ink-faint,rgba(228,228,231,0.5))]"
              style={{ textAlign: 'center' }}
            >
              C.R. 2055011643
            </p>
          </div>

          {/* Close button for mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
              title="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary CTA Button */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => {
              onNewQuoteClick();
              if (onCloseMobile) onCloseMobile();
            }}
            className="btn-cta w-full py-3 px-4 font-syne text-xs font-bold tracking-wider rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Quote</span>
          </button>
        </div>

        {/* Navigation Group */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {/* Quotes Tab */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('list');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full py-3 px-3.5 rounded-sm text-left text-xs sm:text-sm font-medium flex items-center justify-between gap-3 transition-all cursor-pointer ${
              currentTab === 'list'
                ? 'bg-white/[0.04] text-[var(--ink,#E4E4E7)] font-semibold border-l-[3px]'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)] hover:bg-white/[0.02]'
            }`}
            style={{
              borderLeftColor: currentTab === 'list' ? 'var(--accent, #FF3B30)' : 'transparent',
            }}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 shrink-0 opacity-80" />
              <span>Quotes</span>
            </div>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs bg-white/[0.06] text-[var(--ink-faint,rgba(228,228,231,0.6))]">
              {quotesCount}
            </span>
          </button>

          {/* Active Editing Quote Tab (if active) */}
          {currentTab === 'edit' && (
            <button
              type="button"
              onClick={() => {
                onSelectTab('edit');
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full py-3 px-3.5 rounded-sm text-left text-xs sm:text-sm font-semibold flex items-center gap-3 bg-white/[0.04] text-[var(--ink,#E4E4E7)] border-l-[3px] cursor-pointer"
              style={{
                borderLeftColor: 'var(--accent, #FF3B30)',
              }}
            >
              <Edit3 className="w-4 h-4 shrink-0 text-[var(--accent,#FF3B30)]" />
              <div className="truncate min-w-0">
                <span className="block truncate font-mono text-xs">
                  {editingQuoteRefNo || 'Editor'}
                </span>
              </div>
            </button>
          )}

          {/* Status Report Tab */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('report');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full py-3 px-3.5 rounded-sm text-left text-xs sm:text-sm font-medium flex items-center gap-3 transition-all cursor-pointer ${
              currentTab === 'report'
                ? 'bg-white/[0.04] text-[var(--ink,#E4E4E7)] font-semibold border-l-[3px]'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)] hover:bg-white/[0.02]'
            }`}
            style={{
              borderLeftColor: currentTab === 'report' ? 'var(--accent, #FF3B30)' : 'transparent',
            }}
          >
            <BarChart3 className="w-4 h-4 shrink-0 opacity-80" />
            <span>Status Report</span>
          </button>

          {/* Price Book Tab */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('book');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full py-3 px-3.5 rounded-sm text-left text-xs sm:text-sm font-medium flex items-center gap-3 transition-all cursor-pointer ${
              currentTab === 'book'
                ? 'bg-white/[0.04] text-[var(--ink,#E4E4E7)] font-semibold border-l-[3px]'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)] hover:bg-white/[0.02]'
            }`}
            style={{
              borderLeftColor: currentTab === 'book' ? 'var(--accent, #FF3B30)' : 'transparent',
            }}
          >
            <BookOpen className="w-4 h-4 shrink-0 opacity-80" />
            <span>Price Book</span>
          </button>

          {/* Settings Tab */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('set');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full py-3 px-3.5 rounded-sm text-left text-xs sm:text-sm font-medium flex items-center gap-3 transition-all cursor-pointer ${
              currentTab === 'set'
                ? 'bg-white/[0.04] text-[var(--ink,#E4E4E7)] font-semibold border-l-[3px]'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)] hover:bg-white/[0.02]'
            }`}
            style={{
              borderLeftColor: currentTab === 'set' ? 'var(--accent, #FF3B30)' : 'transparent',
            }}
          >
            <SettingsIcon className="w-4 h-4 shrink-0 opacity-80" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Bottom Architecture / Version Block */}
        <div className="mt-auto pt-6 border-t border-[var(--border,rgba(228,228,231,0.12))]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="label-mono text-[9px]">Architecture</span>
            <span className="font-mono text-[11px] text-[var(--ink,#E4E4E7)] font-medium">v2.4.0-E</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="label-mono text-[9px]">Environment</span>
            <span className="font-mono text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-2xs" />
              Production
            </span>
          </div>

          {/* Local Storage Indicator */}
          {storageStatus && (
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5 text-[10px] text-[var(--ink-faint,rgba(228,228,231,0.5))] truncate">
              <HardDrive className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">{storageStatus}</span>
            </div>
          )}

          {isInstalled && (
            <div className="mt-2 text-[10px] text-[var(--ink-faint,rgba(228,228,231,0.5))] flex items-center gap-1.5">
              <Laptop className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Native Desktop Mode</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Quotation, QuoteType, QuoteStatus, Settings, CompanyPriceBook, AppDatabase } from './types/quotation';
import { StorageService } from './services/storage';
import { cleanKey, todayISO } from './utils/formatters';
import { Header } from './components/Header';
import { QuotesList } from './components/QuotesList';
import { QuoteEditor } from './components/QuoteEditor';
import { ReportView } from './components/ReportView';
import { PriceBookView } from './components/PriceBookView';
import { SettingsView } from './components/SettingsView';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { TypePickerModal } from './components/TypePickerModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { AppIntroModal } from './components/AppIntroModal';
import { BackgroundPictureModal } from './components/BackgroundPictureModal';
import { ImportPastQuotesModal } from './components/ImportPastQuotesModal';
import { LiveCanvasWallpaper } from './components/LiveCanvasWallpaper';
import { Sidebar } from './components/Sidebar';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { applyTheme, getTheme, getThemeDefaultAnimation } from './utils/theme';

export default function App() {
  const [database, setDatabase] = useState<AppDatabase>(() => StorageService.loadDatabase());
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [currentTab, setCurrentTab] = useState<'list' | 'edit' | 'report' | 'book' | 'set'>('list');
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState<boolean>(false);
  const [isIntroOpen, setIsIntroOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('uic_intro_dismissed') !== 'true';
    } catch {
      return false;
    }
  });
  const [isBgModalOpen, setIsBgModalOpen] = useState<boolean>(false);
  const [isImportPastQuotesOpen, setIsImportPastQuotesOpen] = useState<boolean>(false);
  const [reportMonthFilter, setReportMonthFilter] = useState<string | undefined>(undefined);
  const [storageStatus, setStorageStatus] = useState<string>('');
  const [pendingPermission, setPendingPermission] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync state changes with StorageService
  const updateDatabase = useCallback((newDb: AppDatabase) => {
    setDatabase(newDb);
    StorageService.saveDatabase(newDb, (msg) => setStorageStatus(msg));
  }, []);

  // Apply active professional theme to document root
  useEffect(() => {
    applyTheme(database.set.theme);
  }, [database.set.theme]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName || '';
      const isInput = /INPUT|TEXTAREA|SELECT/i.test(tag);

      // F1 or ? (outside input)
      if (e.key === 'F1' || (e.key === '?' && !isInput)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      // Alt + shortcuts
      if (e.altKey) {
        if (e.code === 'Digit1') {
          e.preventDefault();
          setCurrentTab('list');
        } else if (e.code === 'Digit2' || e.code === 'KeyN') {
          e.preventDefault();
          setIsTypePickerOpen(true);
        } else if (e.code === 'Digit3') {
          e.preventDefault();
          setCurrentTab('report');
        } else if (e.code === 'Digit4') {
          e.preventDefault();
          setCurrentTab('book');
        } else if (e.code === 'Digit5') {
          e.preventDefault();
          setCurrentTab('set');
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          const searchInput = document.getElementById('sq') || document.getElementById('bq');
          if (searchInput) {
            searchInput.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Start new quotation of selected type
  const handleStartNewQuote = (type: QuoteType) => {
    const S = database.set;
    const isValve = type === 'valve';

    const newQuote: Quotation = {
      id: `q-${Date.now()}`,
      type,
      ref: `${S.prefix}${S.next}`,
      date: todayISO(),
      client: '',
      attn: '',
      location: '',
      title: isValve ? S.titleV : S.title,
      sub: isValve ? S.subV : '',
      revised: false,
      rateNote: S.rateNote,
      vatNote: S.vatNote,
      showTot: isValve ? true : false,
      showRm: false,
      via: '',
      clientCode: '',
      svc: isValve ? 'Valve Testing' : 'Inspection',
      dept: isValve ? 'Mechanical Testing' : 'Quality Control',
      spDept: '',
      delivery: S.delivery,
      service: S.service,
      intro: S.intro,
      items: [
        {
          d: '',
          q: 1,
          r: 0,
          sns: '',
          sz: isValve ? '2"' : '',
          cl: isValve ? '150#' : '',
          rm: '',
        },
      ],
      tc: isValve ? S.tcv : S.tc,
      vat: S.vat,
      status: 'Draft',
      notes: '',
      closing: S.closing,
      sign: !!S.sig,
      isNew: true,
    };

    setEditingQuote(newQuote);
    setIsTypePickerOpen(false);
    setCurrentTab('edit');
  };

  // Edit existing quote
  const handleEditQuote = (id: string) => {
    const found = database.quotes.find((q) => q.id === id);
    if (!found) return;
    setEditingQuote(JSON.parse(JSON.stringify(found)));
    setCurrentTab('edit');
  };

  // Clone / duplicate quotation
  const handleCloneQuote = (id: string) => {
    const found = database.quotes.find((q) => q.id === id);
    if (!found) return;

    const S = database.set;
    const cloned: Quotation = {
      ...JSON.parse(JSON.stringify(found)),
      id: `q-${Date.now()}`,
      ref: `${S.prefix}${S.next}`,
      date: todayISO(),
      status: 'Draft',
      isNew: true,
    };

    setEditingQuote(cloned);
    setCurrentTab('edit');
  };

  // Delete quote
  const handleDeleteQuote = (id: string) => {
    const updatedQuotes = database.quotes.filter((q) => q.id !== id);
    updateDatabase({ ...database, quotes: updatedQuotes });
  };

  // Status changer in-line
  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    const updatedQuotes = database.quotes.map((q) => (q.id === id ? { ...q, status: newStatus } : q));
    updateDatabase({ ...database, quotes: updatedQuotes });
  };

  // Update remarks / follow-up notes in report
  const handleUpdateNotes = (id: string, notes: string) => {
    const updatedQuotes = database.quotes.map((q) => (q.id === id ? { ...q, notes } : q));
    updateDatabase({ ...database, quotes: updatedQuotes });
  };

  // Save quote from editor
  const handleSaveQuote = (quoteToSave: Quotation, stayInEditor: boolean = false) => {
    const isNew = quoteToSave.isNew;
    delete quoteToSave.isNew;

    const newDb = { ...database };
    const quotes = [...newDb.quotes];

    // Record prices in price book memory
    StorageService.recordPriceBook(
      newDb,
      quoteToSave.client,
      quoteToSave.items,
      quoteToSave.date,
      quoteToSave.ref,
      'quote'
    );

    // Save or update quote list
    const existingIndex = quotes.findIndex((q) => q.id === quoteToSave.id);
    if (existingIndex >= 0) {
      quotes[existingIndex] = quoteToSave;
    } else {
      quotes.unshift(quoteToSave);
      // Auto-increment next reference number if it matched the default
      if (isNew && quoteToSave.ref === `${newDb.set.prefix}${newDb.set.next}`) {
        newDb.set.next++;
      }
    }

    newDb.quotes = quotes;
    updateDatabase(newDb);

    if (stayInEditor) {
      setEditingQuote(quoteToSave);
    } else {
      setEditingQuote(null);
      setCurrentTab('list');
    }
  };

  // Update settings
  const handleUpdateSettings = (newSettings: Settings) => {
    updateDatabase({ ...database, set: newSettings });
  };

  // Update price books
  const handleUpdatePriceBooks = (newPriceBooks: Record<string, CompanyPriceBook>) => {
    updateDatabase({ ...database, prices: newPriceBooks });
  };

  // Import full database from backup
  const handleImportFullDatabase = (importedDb: AppDatabase) => {
    updateDatabase(importedDb);
    setEditingQuote(null);
    setCurrentTab('list');
  };

  // Batch import past quotations (and optionally index into company price books)
  const handleImportPastQuotes = (importedQuotes: Quotation[], indexIntoPriceBook: boolean) => {
    const newDb: AppDatabase = {
      ...database,
      quotes: [...database.quotes],
      prices: { ...database.prices },
    };

    let addedCount = 0;
    let updatedCount = 0;

    importedQuotes.forEach((incoming) => {
      const idxByRef = newDb.quotes.findIndex(
        (existing) => existing.ref.trim().toLowerCase() === incoming.ref.trim().toLowerCase()
      );
      if (idxByRef >= 0) {
        newDb.quotes[idxByRef] = {
          ...newDb.quotes[idxByRef],
          ...incoming,
          id: newDb.quotes[idxByRef].id,
        };
        updatedCount++;
      } else {
        newDb.quotes.push(incoming);
        addedCount++;
      }

      if (indexIntoPriceBook) {
        StorageService.recordPriceBook(
          newDb,
          incoming.client,
          incoming.items,
          incoming.date,
          incoming.ref,
          'import'
        );
      }
    });

    newDb.quotes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    updateDatabase(newDb);

    return { addedCount, updatedCount };
  };

  return (
    <div className="min-h-screen theme-app-bg flex flex-col lg:flex-row relative overflow-x-hidden text-[var(--ink,#E4E4E7)]">
      {/* Custom Background Picture / Live Animation Wallpaper Layer (Fixed, pointer-events-none) */}
      {(() => {
        const isVideoBg = database.set.bgType === 'video' && !!database.set.bgVideoUrl;
        const isImageBg = database.set.bgType === 'image' && !!database.set.bgImage;
        const activeThemePreset = getThemeDefaultAnimation(database.set.theme);
        const activePreset = database.set.bgAnimationPreset || activeThemePreset;
        const isCanvasBg = database.set.bgType === 'canvas' || (!isVideoBg && !isImageBg);

        const currentOpacity = (database.set.bgOpacity ?? 75) / 100;

        return (
          <div 
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden" 
            aria-hidden="true"
          >
            {/* Live Video Loop Wallpaper */}
            {isVideoBg && (
              <video
                key={database.set.bgVideoUrl}
                src={database.set.bgVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                ref={(el) => {
                  if (el) {
                    el.playbackRate = database.set.bgPlaybackSpeed ?? 1.0;
                    if (database.set.bgPlayState === 'paused') {
                      el.pause();
                    } else {
                      el.play().catch(() => {});
                    }
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
                style={{
                  opacity: Math.max(0.35, currentOpacity),
                  filter: database.set.bgBlur ? `blur(${database.set.bgBlur}px)` : 'none',
                  transform: database.set.bgBlur ? 'scale(1.05)' : 'none',
                }}
              />
            )}

            {/* Procedural HTML5 60FPS Live Canvas Animation (Default or Canvas Mode) */}
            {isCanvasBg && (
              <div 
                className="absolute inset-0 transition-all duration-300"
                style={{
                  opacity: currentOpacity,
                  filter: database.set.bgBlur ? `blur(${database.set.bgBlur}px)` : 'none',
                  transform: database.set.bgBlur ? 'scale(1.05)' : 'none',
                }}
              >
                <LiveCanvasWallpaper
                  preset={activePreset}
                  playState={database.set.bgPlayState ?? 'playing'}
                  speed={database.set.bgPlaybackSpeed ?? 1.0}
                  themeColor={getTheme(database.set.theme).primary}
                />
              </div>
            )}

            {/* Custom Static Photo Wallpaper */}
            {isImageBg && database.set.bgImage && (
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-300"
                style={{
                  backgroundImage: `url(${database.set.bgImage})`,
                  opacity: Math.max(0.25, currentOpacity),
                  filter: database.set.bgBlur ? `blur(${database.set.bgBlur}px)` : 'none',
                  transform: database.set.bgBlur ? 'scale(1.05)' : 'none',
                }}
              />
            )}

            {/* Contrast Protection Overlays */}
            {database.set.bgOverlay === 'dark' && (
              <div className="absolute inset-0 bg-slate-950/40" />
            )}
            {database.set.bgOverlay === 'light' && (
              <div className="absolute inset-0 bg-white/30" />
            )}
            {database.set.bgOverlay === 'theme' && (
              <div 
                className="absolute inset-0" 
                style={{ backgroundColor: `${getTheme(database.set.theme).primary}15` }} 
              />
            )}
          </div>
        );
      })()}

      {/* Left Sidebar Architecture matching Variation 23 */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'edit' && !editingQuote) {
            setIsTypePickerOpen(true);
            return;
          }
          setCurrentTab(tab);
        }}
        onNewQuoteClick={() => setIsTypePickerOpen(true)}
        quotesCount={database.quotes.length}
        themeConfig={getTheme(database.set.theme)}
        editingQuoteRefNo={editingQuote?.ref}
        storageStatus={storageStatus}
        isInstalled={isInstalled}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Shell matching Variation 23 */}
      <div className="content-shell flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'edit' && !editingQuote) {
              setIsTypePickerOpen(true);
              return;
            }
            setCurrentTab(tab);
          }}
          onNewQuoteClick={() => setIsTypePickerOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          pendingPermission={pendingPermission}
          storageStatus={storageStatus}
          isInstallable={isInstallable}
          isInstalled={isInstalled}
          onInstall={install}
          isOnline={isOnline}
          onOpenDesktopSetup={() => setIsDesktopModalOpen(true)}
          theme={database.set.theme}
          onChangeTheme={(newTheme) => handleUpdateSettings({ ...database.set, theme: newTheme })}
          onOpenIntro={() => setIsIntroOpen(true)}
          hasBgImage={!!(
            (database.set.bgType === 'video' && database.set.bgVideoUrl) ||
            (database.set.bgType === 'canvas' && database.set.bgAnimationPreset) ||
            ((!database.set.bgType || database.set.bgType === 'image') && database.set.bgImage)
          )}
          onOpenBgPicture={() => setIsBgModalOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Main Viewport Container */}
        <main 
          className="relative z-10 flex-1 w-full max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-all bg-transparent"
        >
          {currentTab === 'list' && (
            <QuotesList
              quotes={database.quotes}
              settings={database.set}
              onEditQuote={handleEditQuote}
              onCloneQuote={handleCloneQuote}
              onDeleteQuote={handleDeleteQuote}
              onStatusChange={handleStatusChange}
              onNewQuoteClick={() => setIsTypePickerOpen(true)}
              onPreviewPdf={(q) => setPreviewQuote(q)}
              onOpenIntro={() => setIsIntroOpen(true)}
              onOpenImportPastQuotes={() => setIsImportPastQuotesOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {currentTab === 'edit' && editingQuote && (
            <QuoteEditor
              initialQuote={editingQuote}
              settings={database.set}
              priceBooks={database.prices}
              onSaveQuote={handleSaveQuote}
              onCancel={() => {
                setEditingQuote(null);
                setCurrentTab('list');
              }}
              onPreviewPdf={(q) => setPreviewQuote(q)}
            />
          )}

          {currentTab === 'report' && (
            <ReportView
              quotes={database.quotes}
              settings={database.set}
              onStatusChange={handleStatusChange}
              onUpdateNotes={handleUpdateNotes}
              onOpenImportPastQuotes={() => setIsImportPastQuotesOpen(true)}
              initialMonthFilter={reportMonthFilter}
            />
          )}

          {currentTab === 'book' && (
            <PriceBookView
              priceBooks={database.prices}
              database={database}
              onUpdatePriceBooks={handleUpdatePriceBooks}
              onImportFullDatabase={handleImportFullDatabase}
              onOpenImportPastQuotes={() => setIsImportPastQuotesOpen(true)}
            />
          )}

          {currentTab === 'set' && (
            <SettingsView
              settings={database.set}
              database={database}
              onUpdateSettings={handleUpdateSettings}
              onImportFullDatabase={handleImportFullDatabase}
            />
          )}
        </main>

        {/* Variation 23 Terminal Footer */}
        <footer className="px-6 py-4 border-t border-[var(--border,rgba(228,228,231,0.12))] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[var(--bg,#111113)]">
          <div className="label-mono text-[10px]">Universal Inspection Co. Ltd. (UIC)</div>
          <div className="label-mono text-[10px]">Internal Enterprise Terminal // 2026</div>
        </footer>
      </div>

      {/* Interactive In-App PDF Preview Modal */}
      {previewQuote && (
        <PdfPreviewModal
          quotation={previewQuote}
          settings={database.set}
          isOpen={!!previewQuote}
          onClose={() => setPreviewQuote(null)}
        />
      )}

      {/* Quotation Type Picker Dialog (Standard vs Valve) */}
      <TypePickerModal
        isOpen={isTypePickerOpen}
        onClose={() => setIsTypePickerOpen(false)}
        onSelectType={handleStartNewQuote}
      />

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Windows Desktop Setup & .exe Guide Dialog */}
      <DesktopInstallModal
        isOpen={isDesktopModalOpen}
        onClose={() => setIsDesktopModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onInstall={install}
      />

      {/* App Intro & Guided Feature Tour Dialog */}
      <AppIntroModal
        isOpen={isIntroOpen}
        onClose={() => setIsIntroOpen(false)}
        onStartNewQuote={() => setIsTypePickerOpen(true)}
        currentTheme={database.set.theme}
        onChangeTheme={(newTheme) => handleUpdateSettings({ ...database.set, theme: newTheme })}
      />

      {/* Custom Background Picture & Wallpaper Controller Modal */}
      <BackgroundPictureModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        settings={database.set}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Batch Import Past Quotations & Past Month Archive Modal */}
      {isImportPastQuotesOpen && (
        <ImportPastQuotesModal
          isOpen={isImportPastQuotesOpen}
          onClose={() => setIsImportPastQuotesOpen(false)}
          settings={database.set}
          onImportQuotes={handleImportPastQuotes}
          onViewReportForMonth={(monthStr) => {
            setReportMonthFilter(monthStr);
            setCurrentTab('report');
          }}
        />
      )}
    </div>
  );
}

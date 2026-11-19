import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Eye, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Upload, 
  Hash, 
  Sparkles, 
  BookOpen, 
  HelpCircle,
  Building,
  Check,
  Wrench,
  Gauge,
  FileDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Quotation, LineItem, Settings, CompanyPriceBook, QuoteType, QuoteStatus } from '../types/quotation';
import { calculateTotals, cleanKey, formatCurrency, parseNumber, parseSerialNumbers, sanitizeFilename } from '../utils/formatters';
import { SerialModal } from './SerialModal';
import { CtrlSaveModal } from './CtrlSaveModal';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { PdfGeneratorService } from '../services/pdfGenerator';
import { WordGeneratorService } from '../services/wordGenerator';
import { FileStorageService } from '../services/fileStorageService';
import { AiQuoteStudio, AiStudioTab } from './AiQuoteStudio';

interface QuoteEditorProps {
  initialQuote: Quotation;
  settings: Settings;
  priceBooks: Record<string, CompanyPriceBook>;
  onSaveQuote: (quote: Quotation, stayInEditor?: boolean) => void;
  onCancel: () => void;
  onPreviewPdf: (quote: Quotation) => void;
  initialAiTab?: AiStudioTab | null;
}

const ALL_STATUSES: QuoteStatus[] = [
  'Draft',
  'Waiting For PO',
  'Job Received',
  'Under Process',
  'Completed',
  'Lost',
];

export const QuoteEditor: React.FC<QuoteEditorProps> = ({
  initialQuote,
  settings,
  priceBooks,
  onSaveQuote,
  onCancel,
  onPreviewPdf,
  initialAiTab = null,
}) => {
  const [quote, setQuote] = useState<Quotation>({ ...initialQuote });
  const [activeSerialIndex, setActiveSerialIndex] = useState<number | null>(null);
  const [isPriceBookDrawerOpen, setIsPriceBookDrawerOpen] = useState<boolean>(false);
  const [isCtrlSaveModalOpen, setIsCtrlSaveModalOpen] = useState<boolean>(false);
  const [priceBookSearch, setPriceBookSearch] = useState<string>('');
  const [isAiStudioOpen, setIsAiStudioOpen] = useState<boolean>(Boolean(initialAiTab));
  const [aiStudioTab, setAiStudioTab] = useState<AiStudioTab>(initialAiTab || 'rfq');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialAiTab) {
      setAiStudioTab(initialAiTab);
      setIsAiStudioOpen(true);
    }
  }, [initialAiTab]);

  const openAiStudio = (tab: AiStudioTab) => {
    setAiStudioTab(tab);
    setIsAiStudioOpen(true);
  };

  const V = quote.type === 'valve';
  const RM = !V && quote.showRm;
  const totals = calculateTotals(quote);

  // Autocomplete price book for current company
  const companyKey = cleanKey(quote.client);
  const companyPriceBook = priceBooks[companyKey] || null;
  const savedPricesCount = companyPriceBook ? Object.keys(companyPriceBook.items).length : 0;

  // Handle line item field changes
  const updateItem = (index: number, field: keyof LineItem, val: any) => {
    setQuote((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: val };
      return { ...prev, items };
    });
  };

  // Add a new blank item row
  const addItem = () => {
    setQuote((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          d: '',
          q: 1,
          r: 0,
          sns: '',
          sz: V ? '2"' : '',
          cl: V ? '150#' : '',
          rm: '',
        },
      ],
    }));
  };

  // Remove an item row
  const removeItem = (index: number) => {
    setQuote((prev) => {
      if (prev.items.length <= 1) {
        return {
          ...prev,
          items: [{ d: '', q: 1, r: 0, sns: '', sz: '', cl: '', rm: '' }],
        };
      }
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items };
    });
  };

  // Check for short code or exact match on Description change
  const handleDescriptionChange = (index: number, newDesc: string) => {
    updateItem(index, 'd', newDesc);

    if (!companyPriceBook) return;

    const trimmed = newDesc.trim().toLowerCase();
    // 1. Check if short code matches
    const codeMatch = Object.values(companyPriceBook.items).find(
      (e) => (e.c || '').trim().toLowerCase() === trimmed
    );
    if (codeMatch) {
      updateItem(index, 'd', codeMatch.bd || codeMatch.d);
      if (codeMatch.sz) updateItem(index, 'sz', codeMatch.sz);
      if (codeMatch.cl) updateItem(index, 'cl', codeMatch.cl);
      if (!Number(quote.items[index]?.r)) {
        updateItem(index, 'r', codeMatch.r);
      }
      return;
    }

    // 2. Check full name match
    const nameKey = cleanKey(newDesc);
    const itemMatch = companyPriceBook.items[nameKey];
    if (itemMatch && !Number(quote.items[index]?.r)) {
      updateItem(index, 'r', itemMatch.r);
      if (itemMatch.sz) updateItem(index, 'sz', itemMatch.sz);
      if (itemMatch.cl) updateItem(index, 'cl', itemMatch.cl);
    }
  };

  // Apply all saved prices from company price book
  const handleApplyAllSavedPrices = () => {
    if (!companyPriceBook) return;
    let updatedCount = 0;

    setQuote((prev) => {
      const items = prev.items.map((item) => {
        const fullDesc = [item.d, item.sz, item.cl].filter(Boolean).join(' ');
        const itemKey = cleanKey(fullDesc);
        const match = companyPriceBook.items[itemKey] || companyPriceBook.items[cleanKey(item.d)];
        if (match && Number(item.r) !== match.r) {
          updatedCount++;
          return { ...item, r: match.r };
        }
        return item;
      });
      return { ...prev, items };
    });

    alert(
      updatedCount > 0
        ? `Applied saved rates to ${updatedCount} item(s) from ${companyPriceBook.name}'s price book.`
        : 'All items already match saved company rates.'
    );
  };

  // Add an item from the price book drawer
  const handleAddFromPriceBook = (itemKey: string) => {
    if (!companyPriceBook) return;
    const entry = companyPriceBook.items[itemKey];
    if (!entry) return;

    setQuote((prev) => {
      const isBlankFirst = prev.items.length === 1 && !prev.items[0].d && !Number(prev.items[0].r);
      const newItem: LineItem = {
        d: entry.bd || entry.d,
        q: 1,
        r: entry.r,
        sz: entry.sz || '',
        cl: entry.cl || '',
        rm: '',
      };

      return {
        ...prev,
        items: isBlankFirst ? [newItem] : [...prev.items, newItem],
      };
    });
  };

  // Excel template download
  const handleDownloadTemplate = () => {
    const blob = ExcelGeneratorService.generateImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UIC-Quotation-Items-Template.xlsx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Import line items from Excel / CSV file
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const result = await ExcelGeneratorService.parseExcelQuote(file);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (!result.items.length) {
        alert('No line items found below the header row.');
        return;
      }

      const replaceExisting =
        (quote.items.length === 1 && !quote.items[0].d && !Number(quote.items[0].r)) ||
        window.confirm(
          `Found ${result.items.length} items in ${file.name}.\n\nClick OK to replace existing items, or Cancel to append them to the end.`
        );

      setQuote((prev) => {
        const newItems = replaceExisting ? result.items : [...prev.items, ...result.items];
        const hasRemarks = newItems.some((i) => i.rm && i.rm.trim());

        const updated: Quotation = {
          ...prev,
          items: newItems,
          showRm: hasRemarks || prev.showRm,
        };

        // If header metadata was detected
        if (result.header.client && !prev.client) updated.client = result.header.client;
        if (result.header.attn && !prev.attn) updated.attn = result.header.attn;
        if (result.header.location && !prev.location) updated.location = result.header.location;
        if (result.header.ref && !prev.ref) updated.ref = result.header.ref;
        if (result.header.date && !prev.date) updated.date = result.header.date;

        return updated;
      });

      alert(`Successfully imported ${result.items.length} items from ${file.name}.`);
    } catch (err: any) {
      alert(`Could not import file: ${err?.message || 'Unknown error'}`);
    }
  };

  // Save quote handler
  const handleSave = () => {
    if (!quote.client.trim()) {
      alert('Please enter a Client Name before saving.');
      return;
    }
    if (!quote.ref.trim()) {
      alert('Please enter a Reference number.');
      return;
    }

    // Trigger celebratory confetti effect
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch {}

    onSaveQuote(quote);
  };

  const handleSaveAndExportPdf = async () => {
    if (!quote.client.trim()) {
      alert('Please enter a Client Name before saving.');
      return;
    }
    if (!quote.ref.trim()) {
      alert('Please enter a Reference number.');
      return;
    }

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch {}

    onSaveQuote(quote);

    try {
      const blob = PdfGeneratorService.getQuotePdfBlob(quote, settings);
      const filename = `${sanitizeFilename(quote)}.pdf`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/pdf',
        description: 'PDF Quotation Document',
        extension: '.pdf',
        settings,
      });
      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Quote saved, but PDF export failed: ${e?.message || 'Error'}`);
    }
  };

  // Dedicated Ctrl + S Quick Save Handler:
  // Saves quote to database and opens CtrlSaveModal with PDF preview & automatic dual file saving
  const handleQuickCtrlSave = () => {
    if (!quote.client.trim()) {
      alert('Please enter a Client Name before saving.');
      return;
    }
    if (!quote.ref.trim()) {
      alert('Please enter a Reference number.');
      return;
    }

    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch {}

    // Save current quote state to database without navigating away
    onSaveQuote(quote, true);

    // Open CtrlSaveModal inside the current quote creation window
    setIsCtrlSaveModalOpen(true);
  };

  // Intercept Ctrl + S (and Cmd + S) keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleQuickCtrlSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quote, settings]);

  return (
    <div className="space-y-6 pb-24">
      
      {/* Top Banner & Mode Selector */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200/70 uppercase tracking-wider">
              {V ? 'Valve Test Services' : 'Standard Services'}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-mono font-semibold">{quote.ref}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
            {quote.isNew ? 'Create New Quotation' : `Edit Quotation · ${quote.ref}`}
          </h2>
        </div>

        {/* Mode & AI Studio Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAiStudioOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              isAiStudioOpen
                ? 'bg-blue-800 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAiStudioOpen ? 'Hide AI Studio' : 'AI Quote Studio'}</span>
          </button>

          {/* Switch Type Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setQuote((prev) => ({ ...prev, type: 'std', title: settings.title, tc: settings.tc }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                !V ? 'bg-white text-blue-950 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Standard</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setQuote((prev) => ({
                  ...prev,
                  type: 'valve',
                  title: settings.titleV,
                  sub: settings.subV,
                  tc: settings.tcv,
                  rateNote: settings.rateNote,
                  vatNote: settings.vatNote,
                }))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                V ? 'bg-white text-blue-950 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Valve Testing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable AI Quote Creation Studio */}
      <AiQuoteStudio
        isOpen={isAiStudioOpen}
        activeTab={aiStudioTab}
        onChangeTab={setAiStudioTab}
        onClose={() => setIsAiStudioOpen(false)}
        quote={quote}
        settings={settings}
        priceBooks={priceBooks}
        onUpdateQuote={setQuote}
      />

      {/* Header Metadata Section */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Client &amp; Quotation Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Client Name with Datalist */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              list="client-suggestions"
              value={quote.client}
              onChange={(e) => setQuote({ ...quote, client: e.target.value })}
              placeholder="e.g. Majan, Saudi Aramco, SABIC"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-hidden font-medium"
            />
            <datalist id="client-suggestions">
              {Object.values(priceBooks).map((cp) => (
                <option key={cp.name} value={cp.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Attn To</label>
            <input
              type="text"
              value={quote.attn}
              onChange={(e) => setQuote({ ...quote, attn: e.target.value })}
              placeholder="e.g. Majan, Eng. Mohammed"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Reference #</label>
            <input
              type="text"
              value={quote.ref}
              onChange={(e) => setQuote({ ...quote, ref: e.target.value })}
              placeholder="e.g. UIC/L/5"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Quotation Date</label>
            <input
              type="date"
              value={quote.date}
              onChange={(e) => setQuote({ ...quote, date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Location</label>
            <input
              type="text"
              value={quote.location}
              onChange={(e) => setQuote({ ...quote, location: e.target.value })}
              placeholder="e.g. Jubail, Ras Tanura, Yanbu"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-semibold mb-1">Document Title</label>
            <input
              type="text"
              value={quote.title}
              onChange={(e) => setQuote({ ...quote, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Pipeline Status</label>
            <select
              value={quote.status}
              onChange={(e) => setQuote({ ...quote, status: e.target.value as QuoteStatus })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden font-semibold"
            >
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Valve Specific Controls */}
        {V && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Subject Line (Sub:)</label>
                <input
                  type="text"
                  value={quote.sub || ''}
                  onChange={(e) => setQuote({ ...quote, sub: e.target.value })}
                  placeholder="e.g. Quotation for safety valve testing and calibration services."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rate Column Note</label>
                <input
                  type="text"
                  value={quote.rateNote || ''}
                  onChange={(e) => setQuote({ ...quote, rateNote: e.target.value })}
                  placeholder="(Pass or Fail)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={!!quote.revised}
                  onChange={(e) => setQuote({ ...quote, revised: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Revised Quotation (Adds "REVISED" in title banner)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={!!quote.showTot}
                  onChange={(e) => setQuote({ ...quote, showTot: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Show Total Amount, VAT &amp; Net Total rows</span>
              </label>
            </div>
          </div>
        )}

        {/* Standard Specific Checkbox */}
        {!V && (
          <div className="pt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
              <input
                type="checkbox"
                checked={!!quote.showRm}
                onChange={(e) => setQuote({ ...quote, showRm: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Include Remarks Column on Line Items Table</span>
            </label>
          </div>
        )}

        {/* Corporate Reporting Metadata (Optional) */}
        <div className="pt-3 border-t border-slate-100">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Classification &amp; Reporting Metadata (Optional)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">Sent Via</label>
              <input
                type="text"
                value={quote.via || ''}
                onChange={(e) => setQuote({ ...quote, via: e.target.value })}
                placeholder="e.g. Email"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Client Code</label>
              <input
                type="text"
                value={quote.clientCode || ''}
                onChange={(e) => setQuote({ ...quote, clientCode: e.target.value })}
                placeholder="e.g. MAJ-08"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Service Type</label>
              <input
                type="text"
                value={quote.svc || ''}
                onChange={(e) => setQuote({ ...quote, svc: e.target.value })}
                placeholder="e.g. Inspection"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Department</label>
              <input
                type="text"
                value={quote.dept || ''}
                onChange={(e) => setQuote({ ...quote, dept: e.target.value })}
                placeholder="e.g. Lifting Gear"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Specific Dept</label>
              <input
                type="text"
                value={quote.spDept || ''}
                onChange={(e) => setQuote({ ...quote, spDept: e.target.value })}
                placeholder="e.g. Jubail Plant"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Company Price Memory Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>{quote.client.trim() ? quote.client : 'No Client Selected'}</span>
                {savedPricesCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                    {savedPricesCount} saved prices in memory
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {savedPricesCount > 0
                  ? 'Type an item name or short code in the table below to auto-populate the client-negotiated rate.'
                  : 'As you save quotes or import price books, client-specific rates will be remembered here.'}
              </p>
            </div>
          </div>

          {savedPricesCount > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleApplyAllSavedPrices}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Apply Saved Rates
              </button>
              <button
                type="button"
                onClick={() => setIsPriceBookDrawerOpen(!isPriceBookDrawerOpen)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                {isPriceBookDrawerOpen ? 'Close Price List' : 'Browse Price Book'}
              </button>
            </div>
          )}
        </div>

        {/* Expandable Price Book Items Browser */}
        {isPriceBookDrawerOpen && companyPriceBook && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <input
              type="text"
              value={priceBookSearch}
              onChange={(e) => setPriceBookSearch(e.target.value)}
              placeholder="Search saved items for this company..."
              className="w-full max-w-sm px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-hidden"
            />
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {Object.entries(companyPriceBook.items)
                .filter(([_, item]) =>
                  item.d.toLowerCase().includes(priceBookSearch.toLowerCase())
                )
                .map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAddFromPriceBook(key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-700" />
                    <span className="font-semibold text-slate-800">{item.d}</span>
                    <span className="text-slate-400">&middot;</span>
                    <span className="font-mono font-bold text-blue-800">SAR {formatCurrency(item.r)}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Line Items Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Line Items &amp; Services</h3>
            <p className="text-xs text-slate-500">All rates in Saudi Riyals (SAR), exclusive of VAT.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAiStudio('scope')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Build Scope</span>
            </button>

            <button
              type="button"
              onClick={() => openAiStudio('polish')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              AI Polish &amp; Audit
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Download Excel Template
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import from Excel</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleExcelImport}
            />

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {/* Dynamic Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[240px]">Description &amp; Serials</th>
                {V && (
                  <>
                    <th className="py-3 px-3 w-24">Size (Inch)</th>
                    <th className="py-3 px-3 w-28">Class Rating</th>
                  </>
                )}
                <th className="py-3 px-3 w-20">Qty</th>
                <th className="py-3 px-3 w-28 text-right">Unit Rate (SAR)</th>
                <th className="py-3 px-3 w-28 text-right">Amount (SAR)</th>
                {RM && <th className="py-3 px-3 min-w-[160px]">Remarks</th>}
                <th className="py-3 px-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.items.map((item, index) => {
                const serialsList = parseSerialNumbers(item.sns);
                const hasSerials = serialsList.length > 0;

                // Price memory hint
                const fullDesc = [item.d, item.sz, item.cl].filter(Boolean).join(' ');
                const matchItem = companyPriceBook?.items[cleanKey(fullDesc)] || companyPriceBook?.items[cleanKey(item.d)];
                const diffRate = matchItem && parseNumber(item.r) !== matchItem.r;

                return (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                      {index + 1}
                    </td>

                    {/* Description */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.d}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        placeholder="e.g. Electric Hoist or short code"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden font-medium"
                      />

                      {/* Serial Number Controls (for standard quotes) */}
                      {!V && (
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSerialIndex(index)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                              hasSerials
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Hash className="w-3 h-3" />
                            <span>
                              {hasSerials
                                ? `Serials (${serialsList.length}${
                                    serialsList.length !== Number(item.q) ? ` / Qty ${item.q}` : ''
                                  })`
                                : '+ Serial numbers'}
                            </span>
                          </button>

                          {matchItem && (
                            <span className={`text-[11px] ${diffRate ? 'text-amber-700' : 'text-slate-400'}`}>
                              Saved: {formatCurrency(matchItem.r)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Valve Specific: Size & Class */}
                    {V && (
                      <>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.sz || ''}
                            onChange={(e) => updateItem(index, 'sz', e.target.value)}
                            placeholder='e.g. 2"'
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden text-center font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.cl || ''}
                            onChange={(e) => updateItem(index, 'cl', e.target.value)}
                            placeholder="e.g. 300#"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden text-center font-mono"
                          />
                        </td>
                      </>
                    )}

                    {/* Quantity */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.q}
                        onChange={(e) => updateItem(index, 'q', parseNumber(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden text-center font-mono font-medium"
                      />
                    </td>

                    {/* Unit Rate */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.r}
                        onChange={(e) => updateItem(index, 'r', parseNumber(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden text-right font-mono font-medium"
                      />
                    </td>

                    {/* Line Amount */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      SAR {formatCurrency(item.q * item.r)}
                    </td>

                    {/* Remarks (if enabled) */}
                    {RM && (
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.rm || ''}
                          onChange={(e) => updateItem(index, 'rm', e.target.value)}
                          placeholder="e.g. Pass or Fail"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden"
                        />
                      </td>
                    )}

                    {/* Remove Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        title="Delete item"
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Summary Footer Card */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Item</span>
            </button>
          </div>

          <div className="w-full sm:w-80 space-y-2 text-xs">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Total Requested Quantities</span>
              <span className="font-mono font-bold text-slate-900">{totals.totalQty}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600 border-t border-slate-200 pt-1.5">
              <span>Total Amount (Exclusive of VAT)</span>
              <span className="font-mono font-bold text-slate-900">SAR {formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>VAT Amount ({quote.vat}%)</span>
              <span className="font-mono font-bold text-slate-900">SAR {formatCurrency(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm font-bold text-blue-900 border-t-2 border-blue-700 pt-2 bg-blue-50/50 px-2 rounded">
              <span>Net Total Amount</span>
              <span className="font-mono">SAR {formatCurrency(totals.netTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions Editor */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Terms &amp; Conditions (Editable per Quote)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Headings ending with a colon (e.g. <b>Terms &amp; Conditions:</b>) will automatically format with blue divider lines on the PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQuote({ ...quote, tc: V ? settings.tcv : settings.tc })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Default</span>
          </button>
        </div>

        <textarea
          rows={10}
          value={quote.tc}
          onChange={(e) => setQuote({ ...quote, tc: e.target.value })}
          className="w-full p-3.5 text-xs bg-slate-50/70 border border-slate-200/90 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 outline-hidden font-mono leading-relaxed"
        />
      </div>

      {/* Closing & Digital Signature */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Closing Remarks &amp; Digital Signature
        </h3>

        <div>
          <label className="block text-slate-700 text-xs font-semibold mb-1">Closing Note</label>
          <textarea
            rows={3}
            value={quote.closing}
            onChange={(e) => setQuote({ ...quote, closing: e.target.value })}
            className="w-full p-3 text-xs bg-slate-50/70 border border-slate-200/90 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 outline-hidden"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs">
          <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-800">
            <input
              type="checkbox"
              checked={!!quote.sign}
              onChange={(e) => setQuote({ ...quote, sign: e.target.checked })}
              className="rounded-md text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Attach Official Digital Signature &amp; Stamp on PDF</span>
          </label>

          {settings.sig ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                Signer: <b className="text-slate-900">{settings.signer}</b> ({settings.role})
              </span>
              <img
                src={settings.sig}
                alt="Signature preview"
                className="h-9 border border-slate-200 bg-white rounded-lg p-0.5 shadow-2xs"
              />
            </div>
          ) : (
            <span className="text-amber-700 font-medium">
              No signature saved yet. Add your signature in Settings tab.
            </span>
          )}
        </div>
      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 glass-header border-t border-slate-200/80 py-3 px-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden sm:block text-xs">
            <span className="text-slate-400 font-medium">Quotation Ref: </span>
            <span className="font-mono font-bold text-blue-900">{quote.ref}</span>
            <span className="text-slate-300 mx-2">·</span>
            <span className="font-bold text-slate-800">{quote.client || 'Draft'}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onPreviewPdf(quote)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-blue-700" />
              <span>Preview PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={handleQuickCtrlSave}
              title="Quick Save & Auto-Export PDF & Excel to default folder (Ctrl+S)"
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 active:scale-97 rounded-xl transition-all shadow-xs cursor-pointer ring-1 ring-black/10"
            >
              <Save className="w-4 h-4 text-emerald-300" />
              <span>Auto-Save &amp; Preview</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-blue-950 text-blue-200 border border-blue-700/60 rounded">
                Ctrl+S
              </kbd>
            </button>

            <button
              type="button"
              onClick={handleSaveAndExportPdf}
              title="Save quote and open Windows Save Dialog directly in your default folder"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-97 rounded-xl transition-all shadow-xs cursor-pointer ring-1 ring-amber-500/20"
            >
              <FileDown className="w-4 h-4 text-slate-950" />
              <span>Export PDF Dialog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ctrl + S Preview & Dual Auto-Save Modal */}
      {isCtrlSaveModalOpen && (
        <CtrlSaveModal
          isOpen={isCtrlSaveModalOpen}
          onClose={() => setIsCtrlSaveModalOpen(false)}
          quote={quote}
          settings={settings}
          onContinueEditing={() => setIsCtrlSaveModalOpen(false)}
          onBackToList={onCancel}
        />
      )}

      {/* Serial Numbers Modal */}
      {activeSerialIndex !== null && (
        <SerialModal
          itemIndex={activeSerialIndex}
          item={quote.items[activeSerialIndex]}
          isOpen={activeSerialIndex !== null}
          onClose={() => setActiveSerialIndex(null)}
          onSave={(newSns, updateQty) => {
            setQuote((prev) => {
              const items = [...prev.items];
              items[activeSerialIndex] = {
                ...items[activeSerialIndex],
                sns: newSns,
                q: updateQty ? parseSerialNumbers(newSns).length || items[activeSerialIndex].q : items[activeSerialIndex].q,
              };
              return { ...prev, items };
            });
            setActiveSerialIndex(null);
          }}
        />
      )}
    </div>
  );
};

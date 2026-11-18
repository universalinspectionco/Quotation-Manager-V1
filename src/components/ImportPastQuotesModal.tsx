import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Check, 
  Download, 
  Building, 
  Clock, 
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileCheck,
  RotateCcw
} from 'lucide-react';
import { Quotation, QuoteStatus, LineItem, Settings } from '../types/quotation';
import { cleanKey, extractRefAndClientFromFilename, formatCurrency, formatDateUK, parseFlexibleDate, parseNumber } from '../utils/formatters';
import { PdfParserService } from '../services/pdfParser';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { FileStorageService } from '../services/fileStorageService';

interface ImportPastQuotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onImportQuotes: (quotes: Quotation[], indexIntoPriceBook: boolean) => { addedCount: number; updatedCount: number };
  onViewReportForMonth?: (monthYearStr: string) => void;
}

interface ParsedImportQuote {
  id: string;
  ref: string;
  date: string;
  client: string;
  title: string;
  location: string;
  attn: string;
  via?: string;
  clientCode?: string;
  svc?: string;
  dept?: string;
  spDept?: string;
  status: QuoteStatus;
  items: LineItem[];
  notes?: string;
  sourceFile: string;
  selected: boolean;
  error?: string;
}

const ALL_STATUSES: QuoteStatus[] = [
  'Completed',
  'Job Received',
  'Waiting For PO',
  'Under Process',
  'Draft',
  'Lost',
];

export const ImportPastQuotesModal: React.FC<ImportPastQuotesModalProps> = ({
  isOpen,
  onClose,
  settings,
  onImportQuotes,
  onViewReportForMonth,
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'files'>('excel');
  const [parsedQuotes, setParsedQuotes] = useState<ParsedImportQuote[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusForAll, setStatusForAll] = useState<QuoteStatus>('Completed');
  const [indexIntoPriceBook, setIndexIntoPriceBook] = useState<boolean>(true);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; latestMonth: string } | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to extract YYYY-MM
  const getMonthStr = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.slice(0, 7);
  };

  // 1. Download Blank Past Quotations Excel Template
  const handleDownloadTemplate = () => {
    try {
      if (!window.XLSX) {
        alert('Spreadsheet library is not ready.');
        return;
      }

      const sampleData = [
        {
          'Ref No': 'UIC/L/5',
          'Date (YYYY-MM-DD)': '2026-10-15',
          'Client Name': 'Majan Inspection',
          'Title / Scope': 'Quotation for Inspection Services',
          'Location': 'Jubail Industrial City',
          'Attn To': 'Mr. Ahmed',
          'Status': 'Completed',
          'Item Description': 'Electric Hoist S/N 0001, 125515',
          'Quantity': 3,
          'Unit Rate (SAR)': 26.00,
          'Notes': 'Past month inspection completed on schedule',
        },
        {
          'Ref No': 'UIC/L/5',
          'Date (YYYY-MM-DD)': '2026-10-15',
          'Client Name': 'Majan Inspection',
          'Title / Scope': 'Quotation for Inspection Services',
          'Location': 'Jubail Industrial City',
          'Attn To': 'Mr. Ahmed',
          'Status': 'Completed',
          'Item Description': 'Shackle & Sling Proof Load Test',
          'Quantity': 10,
          'Unit Rate (SAR)': 15.00,
          'Notes': '',
        },
        {
          'Ref No': 'UIC/L/6',
          'Date (YYYY-MM-DD)': '2026-10-22',
          'Client Name': 'Rawabi Holding',
          'Title / Scope': 'Valve Hydrostatic Testing',
          'Location': 'Dammam Yard',
          'Attn To': 'Eng. Khalid',
          'Status': 'Job Received',
          'Item Description': 'Gate Valve 2" 150# Hydro Test',
          'Quantity': 8,
          'Unit Rate (SAR)': 45.00,
          'Notes': 'PO received for past month job',
        },
      ];

      const ws = window.XLSX.utils.json_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 24 },
        { wch: 32 },
        { wch: 22 },
        { wch: 16 },
        { wch: 15 },
        { wch: 38 },
        { wch: 10 },
        { wch: 16 },
        { wch: 30 },
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Past Quotations');
      const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      FileStorageService.saveFile({
        blob,
        filename: 'UIC_Past_Quotations_Template.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Past Quotations Excel Template',
        extension: '.xlsx',
        modeOverride: 'download',
      });
    } catch (e: any) {
      alert(`Could not generate template: ${e?.message || 'Error'}`);
    }
  };

  // 2. Parse Tabular Excel / CSV Spreadsheet of Past Quotations
  const handleUploadExcelSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      if (!window.XLSX) {
        throw new Error('Spreadsheet library is not ready.');
      }

      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const grid: any[][] = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (!grid.length) {
        alert('The uploaded spreadsheet contains no rows.');
        setIsProcessing(false);
        return;
      }

      // Auto-detect header row across first 15 rows
      let headerIdx = 0;
      for (let i = 0; i < Math.min(15, grid.length); i++) {
        const nonEmpty = grid[i].map((c: any) => String(c ?? '').trim()).filter(Boolean);
        if (
          nonEmpty.length >= 3 &&
          nonEmpty.some((c: string) => /ref|quotation|quote\s*no|company|client|date|amount|rate/i.test(c))
        ) {
          headerIdx = i;
          break;
        }
      }

      const headers = grid[headerIdx].map((c: any) => String(c ?? '').trim());
      const findColIdx = (patterns: RegExp[]) => {
        for (const pat of patterns) {
          const found = headers.findIndex((h) => pat.test(h));
          if (found >= 0) return found;
        }
        return -1;
      };

      const refCol = findColIdx([/^ref/i, /^quotation$/i, /quote\s*no/i, /^quotation\s*(?:no|#)/i, /reference/i]);
      const dateCol = findColIdx([/^date/i, /quoted\s*date/i]);
      const clientCol = findColIdx([/^company\s*name/i, /^client\s*name/i, /^customer/i, /^client$/i, /^company$/i]);
      const titleCol = findColIdx([/^title/i, /^scope/i, /^service\s*type/i, /^service$/i]);
      const locationCol = findColIdx([/^location/i, /^site/i, /^city/i]);
      const attnCol = findColIdx([/^attn/i, /^contact/i]);
      const viaCol = findColIdx([/^via$/i]);
      const clientCodeCol = findColIdx([/^client\s*code/i]);
      const svcCol = findColIdx([/^service\s*type/i, /^svc$/i]);
      const deptCol = findColIdx([/^department$/i, /^dept$/i]);
      const spDeptCol = findColIdx([/^specific\s*dept/i]);
      const statusCol = findColIdx([/^status/i]);
      const descCol = findColIdx([/^item\s*desc/i, /^desc/i, /^service\s*desc/i, /^item$/i]);
      const qtyCol = findColIdx([/^qty/i, /^quant/i]);
      const rateCol = findColIdx([/^unit\s*rate/i, /^rate/i, /^price/i]);
      const netAmountCol = findColIdx([/^net\s*amount/i, /^net\s*total/i, /^total\s*amount/i, /^amount/i]);
      const notesCol = findColIdx([/^notes/i, /^remarks/i, /^comment/i]);

      const matchStatus = (raw: string): QuoteStatus => {
        const cleaned = raw.trim().toLowerCase();
        const found = ALL_STATUSES.find((st) => st.toLowerCase() === cleaned);
        return found || statusForAll;
      };

      const fallbackPastMonthDate = () => {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        return now.toISOString().slice(0, 10);
      };

      const vatMultiplier = 1 + (parseNumber(settings.vat ?? 15) / 100);
      const quotesMap = new Map<string, ParsedImportQuote>();

      for (let i = headerIdx + 1; i < grid.length; i++) {
        const row = grid[i];
        if (!row || row.every((cell: any) => String(cell ?? '').trim() === '')) continue;

        const rowText = row.map((c: any) => String(c ?? '').trim()).join(' ');
        if (/summary\s*by\s*status/i.test(rowText)) break;

        const cellStr = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
        const rawRef = cellStr(refCol);
        const rawClient = cellStr(clientCol);
        const splitRefClient = extractRefAndClientFromFilename(rawRef);
        const ref = (splitRefClient.ref && (!rawClient || /^(client|company)$/i.test(rawClient)) ? splitRefClient.ref : rawRef) || `PAST-${i - headerIdx}`;
        const rawDate = dateCol >= 0 ? row[dateCol] : '';
        const date = parseFlexibleDate(rawDate) || fallbackPastMonthDate();
        const client =
          (rawClient && !/^(client|company)$/i.test(rawClient) ? rawClient : splitRefClient.client) ||
          'Client';
        const title = cellStr(titleCol) || 'Quotation for Inspection Services';
        const location = cellStr(locationCol);
        const attn = cellStr(attnCol);
        const via = cellStr(viaCol);
        const clientCode = cellStr(clientCodeCol);
        const svc = cellStr(svcCol);
        const dept = cellStr(deptCol);
        const spDept = cellStr(spDeptCol);
        const rawStatus = cellStr(statusCol);
        const status: QuoteStatus = rawStatus ? matchStatus(rawStatus) : statusForAll;

        const desc = cellStr(descCol) || (svc ? `${svc} Services` : 'Inspection Services');
        const qty = parseNumber(cellStr(qtyCol)) || 1;
        let rate = rateCol >= 0 ? parseNumber(cellStr(rateCol)) : 0;
        if (rate === 0 && netAmountCol >= 0) {
          const netVal = parseNumber(cellStr(netAmountCol));
          if (netVal > 0) {
            const isNetWithVat = /net/i.test(headers[netAmountCol] || '');
            const preVat = isNetWithVat ? netVal / vatMultiplier : netVal;
            rate = Math.round((preVat / qty) * 100) / 100;
          }
        }
        const notes = cellStr(notesCol);

        const item: LineItem = { d: desc, q: qty, r: rate };

        if (quotesMap.has(ref)) {
          const existing = quotesMap.get(ref)!;
          existing.items.push(item);
          if (!existing.notes && notes) existing.notes = notes;
        } else {
          quotesMap.set(ref, {
            id: `past-q-${Date.now()}-${i}`,
            ref,
            date,
            client,
            title,
            location,
            attn,
            via,
            clientCode,
            svc,
            dept,
            spDept,
            status,
            items: [item],
            notes,
            sourceFile: file.name,
            selected: true,
          });
        }
      }

      const parsedList = Array.from(quotesMap.values());
      if (!parsedList.length) {
        alert('No quotation rows could be read from the uploaded spreadsheet.');
      } else {
        setParsedQuotes(parsedList);
      }
    } catch (err: any) {
      alert(`Could not process Excel file: ${err?.message || 'Error'}`);
    } finally {
      setIsProcessing(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // 3. Parse Batch PDF / Excel Documents from Past Months
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setIsProcessing(true);
    const parsedList: ParsedImportQuote[] = [];
    const fallbackToday = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileMeta = extractRefAndClientFromFilename(f.name);
      try {
        if (/\.pdf$/i.test(f.name)) {
          const res = await PdfParserService.parsePdfQuote(f);
          const cleanRef = res.ref || fileMeta.ref || f.name.replace(/\.pdf$/i, '');
          const cleanClient = res.client || fileMeta.client || 'Client';
          const cleanDate = parseFlexibleDate(res.date) || fallbackToday;

          parsedList.push({
            id: `past-q-pdf-${Date.now()}-${i}`,
            ref: cleanRef,
            date: cleanDate,
            client: cleanClient,
            title: res.title || 'Quotation for Inspection Services',
            location: res.location || '',
            attn: res.attn || '',
            status: statusForAll,
            items: res.items.length ? res.items : [{ d: 'Inspection Services', q: 1, r: 0 }],
            sourceFile: f.name,
            selected: true,
            error: res.error,
          });
        } else {
          const xlRes = await ExcelGeneratorService.parseExcelQuote(f);
          const cleanRef = xlRes.header.ref || fileMeta.ref || f.name.replace(/\.xlsx?$/i, '');
          const cleanClient = xlRes.header.client || fileMeta.client || 'Client';
          const cleanDate = parseFlexibleDate(xlRes.header.date) || fallbackToday;

          parsedList.push({
            id: `past-q-xl-${Date.now()}-${i}`,
            ref: cleanRef,
            date: cleanDate,
            client: cleanClient,
            title: xlRes.header.title || 'Quotation for Inspection Services',
            location: xlRes.header.location || '',
            attn: xlRes.header.attn || '',
            status: statusForAll,
            items: xlRes.items.length ? xlRes.items : [{ d: 'Inspection Services', q: 1, r: 0 }],
            sourceFile: f.name,
            selected: true,
            error: xlRes.error,
          });
        }
      } catch (err: any) {
        parsedList.push({
          id: `past-err-${Date.now()}-${i}`,
          ref: fileMeta.ref || f.name,
          date: fallbackToday,
          client: fileMeta.client || 'Unknown',
          title: '',
          location: '',
          attn: '',
          status: 'Completed',
          items: [],
          sourceFile: f.name,
          selected: false,
          error: `Failed to parse: ${err?.message || 'Error'}`,
        });
      }
    }

    setParsedQuotes((prev) => [...prev, ...parsedList]);
    setIsProcessing(false);
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  // Change status for all parsed quotes
  const handleApplyStatusToAll = (newStatus: QuoteStatus) => {
    setStatusForAll(newStatus);
    setParsedQuotes((prev) => prev.map((q) => ({ ...q, status: newStatus })));
  };

  // Toggle selection
  const handleToggleSelectAll = (checked: boolean) => {
    setParsedQuotes((prev) => prev.map((q) => ({ ...q, selected: checked })));
  };

  const handleToggleQuote = (id: string) => {
    setParsedQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  };

  const handleUpdateQuoteStatus = (id: string, st: QuoteStatus) => {
    setParsedQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: st } : q))
    );
  };

  const handleUpdateQuoteField = (id: string, field: 'ref' | 'date' | 'client', val: string) => {
    setParsedQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
    );
  };

  // Commit Quotes to App Database
  const handleConfirmImport = () => {
    const selectedQuotes = parsedQuotes.filter((q) => q.selected && !q.error);
    if (!selectedQuotes.length) {
      alert('Please select at least one quotation to import.');
      return;
    }

    // Convert to proper Quotation objects
    const quotesToSave: Quotation[] = selectedQuotes.map((p) => {
      const isValve = /valve/i.test(p.title) || p.items.some((it) => it.sz || it.cl);
      const normalizedDate = parseFlexibleDate(p.date) || new Date().toISOString().slice(0, 10);
      return {
        id: p.id,
        ref: p.ref.trim(),
        date: normalizedDate,
        client: p.client.trim(),
        title: p.title || (isValve ? 'Quotation for Valve Testing Services' : 'Quotation for Inspection Services'),
        type: isValve ? 'valve' : 'std',
        location: p.location,
        attn: p.attn,
        via: p.via,
        clientCode: p.clientCode,
        svc: p.svc || (isValve ? 'Valve Testing' : 'Inspection'),
        dept: p.dept || (isValve ? 'Mechanical Testing' : 'Quality Control'),
        spDept: p.spDept,
        status: p.status,
        items: p.items,
        notes: p.notes || '',
        delivery: settings.delivery || '',
        service: settings.service || '',
        intro: settings.intro || '',
        tc: isValve ? (settings.tcv || settings.tc) : settings.tc,
        vat: settings.vat ?? 15,
        closing: settings.closing || '',
        sign: true,
      };
    });

    const res = onImportQuotes(quotesToSave, indexIntoPriceBook);

    // Determine the latest month imported (e.g. "2026-10")
    const sortedDates = quotesToSave.map((q) => q.date).sort().reverse();
    const latestMonth = sortedDates[0]?.slice(0, 7) || '';

    setImportResult({
      added: res.addedCount,
      updated: res.updatedCount,
      latestMonth,
    });
  };

  const selectedCount = parsedQuotes.filter((q) => q.selected && !q.error).length;
  const totalValue = parsedQuotes
    .filter((q) => q.selected && !q.error)
    .reduce((acc, q) => {
      const itemsTotal = q.items.reduce((sum, it) => sum + (Number(it.q) || 0) * (Number(it.r) || 0), 0);
      return acc + itemsTotal * 1.15; // Net with VAT
    }, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-zinc-100">
        
        {/* Header Bar */}
        <div className="bg-slate-900 dark:bg-black text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Import Past Quotations &amp; Month Archive
              </h3>
              <p className="text-xs text-slate-400">
                Load past quotations to generate pipeline reports for previous months and index historical prices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {importResult ? (
          // Success Splash View
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              Past Quotations Successfully Added!
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
              Imported <strong className="text-slate-900 dark:text-white">{importResult.added}</strong> new quotation(s) and updated <strong className="text-slate-900 dark:text-white">{importResult.updated}</strong> existing record(s).
            </p>

            {indexIntoPriceBook && (
              <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 mt-3">
                ✓ All items and rates were indexed into Company Price Books for auto-fill in future quotes.
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full">
              {onViewReportForMonth && importResult.latestMonth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewReportForMonth(importResult.latestMonth);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>View Report for {importResult.latestMonth}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 py-2.5 px-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Done &middot; Back to App
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Tabs & Upload Stage */}
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 bg-slate-200/80 dark:bg-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('excel')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'excel'
                      ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Tabular Excel / CSV Ledger</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'files'
                      ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Batch PDF / Excel Quote Documents</span>
                </button>
              </div>

              {activeTab === 'excel' && (
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
                  title="Download clean Excel template to fill in past quotations"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Past Quotes Excel Template</span>
                </button>
              )}
            </div>

            {/* Upload Action Area */}
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
              {activeTab === 'excel' ? (
                <div className="border-2 border-dashed border-blue-200 dark:border-zinc-700 hover:border-blue-500 rounded-xl p-6 text-center transition-colors bg-blue-50/30 dark:bg-zinc-950/40">
                  <FileSpreadsheet className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Upload Past Quotations Spreadsheet (.xlsx, .xls, .csv)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    Rows with the same reference number are automatically grouped into multi-item quotations with dates and client details.
                  </p>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleUploadExcelSheet}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => excelInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isProcessing ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Choose Excel / CSV File</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-indigo-200 dark:border-zinc-700 hover:border-indigo-500 rounded-xl p-6 text-center transition-colors bg-indigo-50/30 dark:bg-zinc-950/40">
                  <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Select Multiple Past Quotation Files (.pdf, .xlsx)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    Select all quotation PDFs or Excel sheets from your past month folder. The system will automatically extract reference numbers, dates, clients, line items, and totals.
                  </p>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <input
                      ref={filesInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.xlsx,.xls"
                      onChange={handleUploadFiles}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => filesInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isProcessing ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Select Past Quote Files (Batch)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Parsed Quotes Preview List */}
            {parsedQuotes.length > 0 ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-5">
                {/* Batch Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs bg-slate-100 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={parsedQuotes.every((q) => q.selected)}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Select All ({parsedQuotes.length})</span>
                    </label>

                    <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700" />

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Set All Status:</span>
                      <select
                        value={statusForAll}
                        onChange={(e) => handleApplyStatusToAll(e.target.value as QuoteStatus)}
                        className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md font-semibold text-xs"
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <span>
                      Selected: <strong className="text-blue-600 dark:text-blue-400">{selectedCount}</strong> quotes
                    </span>
                    <span>
                      Total Pipeline: <strong className="text-emerald-600 dark:text-emerald-400">SAR {formatCurrency(totalValue)}</strong>
                    </span>
                  </div>
                </div>

                {/* Table of Parsed Quotes */}
                <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                        <th className="py-2.5 px-3 w-10"></th>
                        <th className="py-2.5 px-3 font-semibold">Ref &amp; Date</th>
                        <th className="py-2.5 px-3 font-semibold">Client &amp; Scope</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Items</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Net Value (SAR)</th>
                        <th className="py-2.5 px-3 font-semibold">Status for Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {parsedQuotes.map((q) => {
                        const quoteNet = q.items.reduce((acc, it) => acc + (Number(it.q) || 0) * (Number(it.r) || 0), 0) * 1.15;
                        return (
                          <tr
                            key={q.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                              q.error ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={q.selected}
                                disabled={Boolean(q.error)}
                                onChange={() => handleToggleQuote(q.id)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3 align-top font-mono space-y-1">
                              <input
                                type="text"
                                value={q.ref}
                                onChange={(e) => handleUpdateQuoteField(q.id, 'ref', e.target.value)}
                                className="w-36 px-2 py-0.5 text-xs font-bold bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500"
                                title="Quote Reference No."
                              />
                              <input
                                type="date"
                                value={parseFlexibleDate(q.date) || ''}
                                onChange={(e) => handleUpdateQuoteField(q.id, 'date', e.target.value)}
                                className="block w-36 px-2 py-0.5 text-[11px] bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500"
                                title="Quotation Date"
                              />
                            </td>
                            <td className="py-2 px-3 align-top space-y-1">
                              <input
                                type="text"
                                value={q.client}
                                onChange={(e) => handleUpdateQuoteField(q.id, 'client', e.target.value)}
                                className="w-full min-w-[200px] px-2 py-0.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500"
                                title="Company / Client Name"
                              />
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-xs">
                                {q.sourceFile} &middot; {q.title || 'Inspection Services'}
                              </div>
                              {q.error && (
                                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                  {q.error}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top text-center font-mono">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-semibold text-slate-700 dark:text-zinc-300">
                                {q.items.length} item{q.items.length === 1 ? '' : 's'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 align-top text-right font-mono font-bold text-slate-900 dark:text-zinc-100">
                              SAR {formatCurrency(quoteNet)}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <select
                                value={q.status}
                                onChange={(e) => handleUpdateQuoteStatus(q.id, e.target.value as QuoteStatus)}
                                className="px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded text-xs font-semibold"
                              >
                                {ALL_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Clock className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                  No Past Quotes Loaded Yet
                </p>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Upload an Excel spreadsheet with your past month quotation ledger, or select quotation PDF/Excel files to review them before adding.
                </p>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indexIntoPriceBook}
                  onChange={(e) => setIndexIntoPriceBook(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Also index item rates into Company Price Books for auto-fill in future quotes</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={selectedCount === 0 || isProcessing}
                  onClick={handleConfirmImport}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Import {selectedCount} Past Quotation{selectedCount === 1 ? '' : 's'} to App</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  CheckCircle2,
  AlertCircle, 
  Download, 
  Building, 
  Clock, 
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileCheck,
  RotateCcw,
  Merge
} from 'lucide-react';
import { CompanyPriceBook, PriceBookItem, PriceHistoryEntry } from '../types/quotation';
import { cleanKey, formatCurrency, parseNumber } from '../utils/formatters';
import { FileStorageService } from '../services/fileStorageService';

interface ImportPriceBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPriceBooks: Record<string, CompanyPriceBook>;
  onConfirmImport: (newPriceBooks: Record<string, CompanyPriceBook>, mode: 'merge' | 'replace') => void;
}

interface ParsedCompanyPreview {
  key: string;
  name: string;
  itemCount: number;
  sampleItems: Array<{ d: string; r: number; c?: string }>;
}

export const ImportPriceBookModal: React.FC<ImportPriceBookModalProps> = ({
  isOpen,
  onClose,
  currentPriceBooks,
  onConfirmImport,
}) => {
  const [parsedData, setParsedData] = useState<Record<string, CompanyPriceBook> | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download Blank Price Book Template
  const handleDownloadTemplate = () => {
    try {
      if (!window.XLSX) {
        alert('Spreadsheet engine is not ready.');
        return;
      }

      const sampleRows = [
        {
          Company: 'Majan Inspection',
          'Short Code': 'eh',
          'Item Description': 'Electric Hoist S/N Inspection',
          'Unit Rate (SAR)': 26.00,
          'Last Quoted Date': '2026-11-03',
          'Price History': '26.00 (2026-11-03); 24.00 (2026-04-12)',
        },
        {
          Company: 'Majan Inspection',
          'Short Code': 'sl',
          'Item Description': 'Webbing Sling 5T Proof Load Test',
          'Unit Rate (SAR)': 18.00,
          'Last Quoted Date': '2026-10-20',
          'Price History': '18.00 (2026-10-20)',
        },
        {
          Company: 'Rawabi Holding',
          'Short Code': 'gv-2',
          'Item Description': 'Gate Valve 2" 150# Hydro Test',
          'Unit Rate (SAR)': 45.00,
          'Last Quoted Date': '2026-10-15',
          'Price History': '45.00 (2026-10-15); 40.00 (2025-11-02)',
        },
        {
          Company: 'Saudi Aramco',
          'Short Code': 'bv-4',
          'Item Description': 'Ball Valve 4" 300# Testing & Tagging',
          'Unit Rate (SAR)': 65.00,
          'Last Quoted Date': '2026-09-10',
          'Price History': '65.00 (2026-09-10)',
        },
      ];

      const ws = window.XLSX.utils.json_to_sheet(sampleRows);
      ws['!cols'] = [
        { wch: 24 },
        { wch: 14 },
        { wch: 42 },
        { wch: 18 },
        { wch: 18 },
        { wch: 44 },
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Price Book');
      const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      FileStorageService.saveFile({
        blob,
        filename: 'UIC_PriceBook_Import_Template.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Price Book Transfer Template',
        extension: '.xlsx',
        modeOverride: 'download',
      });
    } catch (e: any) {
      alert(`Could not download template: ${e?.message || 'Error'}`);
    }
  };

  // 2. Parse Excel/CSV File from Another PC
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setSourceFileName(file.name);

    try {
      if (!window.XLSX) {
        throw new Error('Spreadsheet library is not ready.');
      }

      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      
      const newPriceBooks: Record<string, CompanyPriceBook> = {};
      let totalParsed = 0;

      // Iterate through all sheets
      wb.SheetNames.forEach((sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

        rows.forEach((row) => {
          // Identify columns flexibly
          const findVal = (patterns: RegExp[]): string => {
            for (const key of Object.keys(row)) {
              for (const pat of patterns) {
                if (pat.test(key.trim())) {
                  const val = row[key];
                  if (val instanceof Date) return val.toISOString().slice(0, 10);
                  return String(val ?? '').trim();
                }
              }
            }
            return '';
          };

          const companyName = findVal([/^company/i, /^client/i, /^customer/i]) || sheetName;
          const desc = findVal([/^item\s*desc/i, /^desc/i, /^item/i, /^service/i]);
          const rateVal = parseNumber(findVal([/^rate/i, /^unit\s*rate/i, /^price/i]));
          const code = findVal([/^code/i, /^short\s*code/i, /^item\s*code/i]).toLowerCase();
          let dateStr = findVal([/^last\s*quoted\s*date/i, /^date/i, /^quoted\s*date/i]);
          if (!dateStr || !/\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            dateStr = new Date().toISOString().slice(0, 10);
          }
          const historyRaw = findVal([/^history/i, /^price\s*history/i]);

          if (!desc || !(rateVal > 0)) return;

          const compKey = cleanKey(companyName);
          if (!compKey) return;

          if (!newPriceBooks[compKey]) {
            newPriceBooks[compKey] = {
              name: companyName,
              items: {},
            };
          }

          const itemKey = cleanKey(desc);

          // Parse history if present
          const historyEntries: PriceHistoryEntry[] = [];
          if (historyRaw) {
            historyRaw.split(';').forEach((entryStr) => {
              const trimmed = entryStr.trim();
              const match = trimmed.match(/([\d.]+)\s*\(([^)]+)\)/);
              if (match) {
                historyEntries.push({
                  r: parseNumber(match[1]),
                  date: match[2].trim(),
                  ref: '',
                  src: 'transfer',
                });
              }
            });
          }

          if (!historyEntries.length) {
            historyEntries.push({
              r: rateVal,
              date: dateStr,
              ref: '',
              src: 'transfer',
            });
          }

          newPriceBooks[compKey].items[itemKey] = {
            d: desc,
            bd: desc,
            c: code,
            r: rateVal,
            date: dateStr,
            h: historyEntries,
          };

          totalParsed++;
        });
      });

      if (!totalParsed) {
        alert('No valid price book items could be found in the file. Ensure it contains columns: Company, Item Description, Unit Rate.');
        setParsedData(null);
      } else {
        setParsedData(newPriceBooks);
      }
    } catch (err: any) {
      alert(`Could not parse file: ${err?.message || 'Error'}`);
      setParsedData(null);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Confirm and apply to Price Book
  const handleConfirm = () => {
    if (!parsedData) return;
    onConfirmImport(parsedData, importMode);
    onClose();
  };

  // Preview statistics
  const previewCompanies: ParsedCompanyPreview[] = parsedData
    ? Object.entries(parsedData).map(([key, comp]) => {
        const items = Object.values(comp.items || {});
        return {
          key,
          name: comp.name,
          itemCount: items.length,
          sampleItems: items.slice(0, 3).map((it) => ({ d: it.d, r: it.r, c: it.c })),
        };
      })
    : [];

  const totalItemsCount = parsedData
    ? Object.values(parsedData).reduce((acc, c) => acc + Object.keys(c.items || {}).length, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[88vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="bg-slate-900 dark:bg-black text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Offline Price Book Transfer &amp; Import
              </h3>
              <p className="text-xs text-slate-400">
                Import company price books and rates exported from another PC via Excel/CSV without internet connection.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Step 1: Upload or Download Template */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Upload Box */}
            <div className="md:col-span-2 border-2 border-dashed border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-500 rounded-2xl p-6 text-center transition-colors bg-emerald-50/20 dark:bg-zinc-950/40 flex flex-col items-center justify-center">
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Select Price Book Spreadsheet (.xlsx, .xls, .csv)
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
                Select the Excel file exported from another PC or a spreadsheet containing your company prices.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  {isProcessing ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{parsedData ? 'Choose Different File' : 'Select File from Other PC'}</span>
                </button>
              </div>
            </div>

            {/* Template Box */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 bg-slate-50 dark:bg-zinc-950/60 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Blank Template</span>
                </span>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Want to prepare or transport price books manually? Download our pre-formatted Excel template.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template (.xlsx)</span>
              </button>
            </div>

          </div>

          {/* Step 2: Parsed Preview & Import Mode */}
          {parsedData && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Summary Banner */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Parsed {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'} across {previewCompanies.length} compan{previewCompanies.length === 1 ? 'y' : 'ies'}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                      Source: {sourceFileName}
                    </span>
                  </div>
                </div>

                {/* Import Mode Radio Controls */}
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span><strong>Merge</strong> (Keep existing + Add new)</span>
                  </label>

                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span><strong>Replace</strong> (Overwrite this PC)</span>
                  </label>
                </div>
              </div>

              {/* Company & Items Preview List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Companies in File:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {previewCompanies.map((comp) => {
                    const alreadyExists = Boolean(currentPriceBooks[comp.key]);
                    return (
                      <div
                        key={comp.key}
                        className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="font-bold text-slate-900 dark:text-zinc-100">{comp.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold">
                              {comp.itemCount} items
                            </span>
                            {alreadyExists && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                                Existing
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sample items */}
                        <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                          {comp.sampleItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-300">
                              <span className="truncate max-w-[200px]">
                                {it.c ? `[${it.c}] ` : ''}{it.d}
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                                SAR {formatCurrency(it.r)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {parsedData ? (
              <span>Ready to apply to this PC. No internet connection required.</span>
            ) : (
              <span>Select an Excel/CSV file from your USB or local network drive to begin.</span>
            )}
          </div>

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
              disabled={!parsedData || totalItemsCount === 0}
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Confirm &amp; Import to This PC</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

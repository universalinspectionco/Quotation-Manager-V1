import React, { useState, useMemo, useRef } from 'react';
import { 
  Building, 
  Search, 
  Plus, 
  Upload, 
  Trash2, 
  Download, 
  Check, 
  AlertCircle, 
  FileText,
  FileSpreadsheet,
  ArrowRight,
  HardDrive,
  Calendar
} from 'lucide-react';
import { CompanyPriceBook, PriceBookItem, AppDatabase } from '../types/quotation';
import { cleanKey, extractRefAndClientFromFilename, formatCurrency, parseFlexibleDate, parseNumber } from '../utils/formatters';
import { PdfParserService, ParsedQuoteResult } from '../services/pdfParser';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { StorageService } from '../services/storage';
import { FileStorageService } from '../services/fileStorageService';
import { ImportPriceBookModal } from './ImportPriceBookModal';

interface PriceBookViewProps {
  priceBooks: Record<string, CompanyPriceBook>;
  database: AppDatabase;
  onUpdatePriceBooks: (newPriceBooks: Record<string, CompanyPriceBook>) => void;
  onImportFullDatabase: (importedDb: AppDatabase) => void;
  onOpenImportPastQuotes?: () => void;
}

export const PriceBookView: React.FC<PriceBookViewProps> = ({
  priceBooks,
  database,
  onUpdatePriceBooks,
  onImportFullDatabase,
  onOpenImportPastQuotes,
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const companyKeys = useMemo(
    () =>
      Object.keys(priceBooks || {}).sort((a, b) => {
        const nameA = priceBooks[a]?.name || a;
        const nameB = priceBooks[b]?.name || b;
        return nameA.localeCompare(nameB);
      }),
    [priceBooks]
  );

  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>(
    companyKeys[0] || ''
  );
  const [companySearchQuery, setCompanySearchQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newItemDesc, setNewItemDesc] = useState<string>('');
  const [newItemRate, setNewItemRate] = useState<string>('');
  const [newItemCode, setNewItemCode] = useState<string>('');

  const filteredCompanyKeys = useMemo(() => {
    const q = companySearchQuery.toLowerCase().trim();
    if (!q) return companyKeys;
    return companyKeys.filter((k) => {
      const comp = priceBooks?.[k];
      const name = comp?.name || k;
      return name.toLowerCase().includes(q) || k.toLowerCase().includes(q);
    });
  }, [companyKeys, priceBooks, companySearchQuery]);

  const exportItemsToExcel = async (
    itemsData: Array<{
      Company: string;
      'Short Code': string;
      'Item Description': string;
      'Unit Rate (SAR)': number;
      'Last Quoted Date': string;
      'Price History': string;
    }>,
    filename: string
  ) => {
    try {
      let blob: Blob;
      let ext = '.xlsx';
      let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (window.XLSX && window.XLSX.utils) {
        const ws = window.XLSX.utils.json_to_sheet(itemsData);
        ws['!cols'] = [
          { wch: 26 },
          { wch: 14 },
          { wch: 48 },
          { wch: 16 },
          { wch: 16 },
          { wch: 40 },
        ];
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Price Book');
        const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([wbout], { type: mimeType });
      } else {
        const headers = ['Company', 'Short Code', 'Item Description', 'Unit Rate (SAR)', 'Last Quoted Date', 'Price History'];
        const rows = itemsData.map((r) => [
          `"${(r.Company || '').replace(/"/g, '""')}"`,
          `"${(r['Short Code'] || '').replace(/"/g, '""')}"`,
          `"${(r['Item Description'] || '').replace(/"/g, '""')}"`,
          r['Unit Rate (SAR)'],
          `"${(r['Last Quoted Date'] || '').replace(/"/g, '""')}"`,
          `"${(r['Price History'] || '').replace(/"/g, '""')}"`,
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        ext = '.csv';
        mimeType = 'text/csv';
        filename = filename.replace(/\.xlsx$/, '.csv');
      }

      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType,
        description: 'Price Book Spreadsheet',
        extension: ext,
        settings: database.set,
      });

      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Could not save Price Book: ${e?.message || 'Error'}`);
    }
  };

  const handleDownloadCurrentCompany = () => {
    if (!activeCompany) return;
    const items = activeCompany.items || {};
    const itemsData = Object.values(items).map((item) => ({
      Company: activeCompany.name || 'Company',
      'Short Code': item?.c || '',
      'Item Description': item?.d || '',
      'Unit Rate (SAR)': item?.r || 0,
      'Last Quoted Date': item?.date || '',
      'Price History': (item?.h || []).map((h) => `${formatCurrency(h.r)} (${h.date})`).join('; '),
    }));

    if (!itemsData.length) {
      alert(`No price items found for ${activeCompany.name || 'this company'} yet.`);
      return;
    }

    const filename = `PriceBook_${cleanKey(activeCompany.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportItemsToExcel(itemsData, filename);
  };

  const handleDownloadAllCompanies = () => {
    const allData: Array<{
      Company: string;
      'Short Code': string;
      'Item Description': string;
      'Unit Rate (SAR)': number;
      'Last Quoted Date': string;
      'Price History': string;
    }> = [];

    companyKeys.forEach((key) => {
      const comp = priceBooks?.[key];
      if (!comp) return;
      const items = comp.items || {};
      Object.values(items).forEach((item) => {
        allData.push({
          Company: comp.name || key,
          'Short Code': item?.c || '',
          'Item Description': item?.d || '',
          'Unit Rate (SAR)': item?.r || 0,
          'Last Quoted Date': item?.date || '',
          'Price History': (item?.h || []).map((h) => `${formatCurrency(h.r)} (${h.date})`).join('; '),
        });
      });
    });

    if (!allData.length) {
      alert('The price book is currently empty. Add items or import past quotes first.');
      return;
    }

    const filename = `UIC_Complete_PriceBook_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportItemsToExcel(allData, filename);
  };

  const handleApplyPriceBookImport = (
    importedPrices: Record<string, CompanyPriceBook>,
    mode: 'merge' | 'replace'
  ) => {
    let finalPrices: Record<string, CompanyPriceBook> = {};

    if (mode === 'replace') {
      finalPrices = importedPrices;
    } else {
      finalPrices = { ...priceBooks };
      Object.entries(importedPrices).forEach(([compKey, importedComp]) => {
        if (!finalPrices[compKey]) {
          finalPrices[compKey] = importedComp;
        } else {
          const targetComp = { ...finalPrices[compKey], items: { ...finalPrices[compKey].items } };
          Object.entries(importedComp.items || {}).forEach(([itemKey, importedItem]) => {
            const existingItem = targetComp.items[itemKey];
            if (!existingItem) {
              targetComp.items[itemKey] = importedItem;
            } else {
              const mergedHistory = [...(importedItem.h || []), ...(existingItem.h || [])]
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .slice(0, 15);

              targetComp.items[itemKey] = {
                ...existingItem,
                r: importedItem.r || existingItem.r,
                date: importedItem.date || existingItem.date,
                c: importedItem.c || existingItem.c,
                h: mergedHistory,
              };
            }
          });
          finalPrices[compKey] = targetComp;
        }
      });
    }

    onUpdatePriceBooks(finalPrices);
    const firstKey = Object.keys(importedPrices)[0];
    if (firstKey) setSelectedCompanyKey(firstKey);
  };

  // Uploaded quotes for batch price ingestion
  const [parsedQuotes, setParsedQuotes] = useState<ParsedQuoteResult[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const dbImportInputRef = useRef<HTMLInputElement>(null);

  const activeCompany = (priceBooks && selectedCompanyKey) ? priceBooks[selectedCompanyKey] || null : null;

  // Filtered items for selected company
  const filteredItems = useMemo(() => {
    if (!activeCompany) return [];
    const items = activeCompany.items || {};
    const q = searchQuery.toLowerCase().trim();
    return Object.entries(items)
      .filter(([_, item]) => {
        if (!item) return false;
        if (!q) return true;
        return (
          (item.d || '').toLowerCase().includes(q) ||
          (item.c || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a[1]?.d || '').localeCompare(b[1]?.d || ''));
  }, [activeCompany, searchQuery]);

  // Add new company
  const handleAddCompany = () => {
    const name = newCompanyName.trim();
    if (!name) return;
    const key = cleanKey(name);
    if (priceBooks[key]) {
      alert('A company with this name already exists.');
      setSelectedCompanyKey(key);
      setNewCompanyName('');
      return;
    }

    const updated = {
      ...priceBooks,
      [key]: {
        name,
        items: {},
      },
    };
    onUpdatePriceBooks(updated);
    setSelectedCompanyKey(key);
    setNewCompanyName('');
  };

  // Rename or merge company
  const handleRenameCompany = () => {
    if (!activeCompany) return;
    const newName = prompt('Enter new company name (entering an existing company will merge prices):', activeCompany.name);
    if (!newName || !newName.trim()) return;

    const newKey = cleanKey(newName);
    const updated = { ...priceBooks };
    delete updated[selectedCompanyKey];

    const targetCompany = updated[newKey] || { name: newName.trim(), items: {} };

    // Merge items
    Object.entries(activeCompany.items || {}).forEach(([k, item]) => {
      const existing = targetCompany.items[k];
      if (!existing) {
        targetCompany.items[k] = item;
      } else {
        existing.h = [...existing.h, ...item.h]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 15);
        existing.r = existing.h[0]?.r || item.r;
        existing.date = existing.h[0]?.date || item.date;
      }
    });

    updated[newKey] = targetCompany;
    onUpdatePriceBooks(updated);
    setSelectedCompanyKey(newKey);
  };

  // Delete company
  const handleDeleteCompany = () => {
    if (!activeCompany) return;
    if (confirm(`Delete the entire price book for ${activeCompany.name}?`)) {
      const updated = { ...priceBooks };
      delete updated[selectedCompanyKey];
      onUpdatePriceBooks(updated);
      setSelectedCompanyKey(Object.keys(updated)[0] || '');
    }
  };

  // Update item field
  const handleUpdateItemField = (itemKey: string, field: 'c' | 'd' | 'r', val: any) => {
    if (!activeCompany) return;
    const updated = { ...priceBooks };
    const comp = { ...updated[selectedCompanyKey] };
    const item = { ...comp.items[itemKey] };

    if (field === 'r') {
      const rate = parseNumber(val);
      if (!(rate > 0)) return;
      item.r = rate;
      item.date = new Date().toISOString().slice(0, 10);
      item.h = [{ r: rate, date: item.date, ref: '', src: 'manual' }, ...item.h].slice(0, 15);
    } else if (field === 'c') {
      const code = String(val).trim().toLowerCase();
      item.c = code;
    } else if (field === 'd') {
      item.d = String(val).trim();
    }

    comp.items[itemKey] = item;
    updated[selectedCompanyKey] = comp;
    onUpdatePriceBooks(updated);
  };

  // Delete single item from active company
  const handleDeleteItem = (itemKey: string) => {
    if (!activeCompany) return;
    const updated = { ...priceBooks };
    const comp = { ...updated[selectedCompanyKey] };
    delete comp.items[itemKey];
    updated[selectedCompanyKey] = comp;
    onUpdatePriceBooks(updated);
  };

  // Add new item to company
  const handleAddItem = () => {
    const desc = newItemDesc.trim();
    const rate = parseNumber(newItemRate);
    if (!desc || !(rate > 0)) {
      alert('Please enter a description and a valid positive rate.');
      return;
    }

    const itemKey = cleanKey(desc);
    const updated = { ...priceBooks };
    const comp = { ...updated[selectedCompanyKey] };

    const entry: PriceBookItem = {
      d: desc,
      bd: desc,
      c: newItemCode.trim().toLowerCase(),
      r: rate,
      date: new Date().toISOString().slice(0, 10),
      h: [{ r: rate, date: new Date().toISOString().slice(0, 10), ref: '', src: 'manual' }],
    };

    comp.items[itemKey] = entry;
    updated[selectedCompanyKey] = comp;
    onUpdatePriceBooks(updated);

    setNewItemDesc('');
    setNewItemRate('');
    setNewItemCode('');
  };

  // Handle upload of past quotes (PDF, Excel, CSV)
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setIsProcessingFiles(true);

    const results: ParsedQuoteResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileMeta = extractRefAndClientFromFilename(f.name);
      try {
        if (/\.pdf$/i.test(f.name)) {
          const res = await PdfParserService.parsePdfQuote(f);
          results.push({
            ...res,
            ref: res.ref || fileMeta.ref || '',
            client: res.client || fileMeta.client || '',
            date: parseFlexibleDate(res.date) || new Date().toISOString().slice(0, 10),
          });
        } else {
          const xlRes = await ExcelGeneratorService.parseExcelQuote(f);
          results.push({
            file: f.name,
            client: xlRes.header.client || fileMeta.client || '',
            date: parseFlexibleDate(xlRes.header.date) || new Date().toISOString().slice(0, 10),
            ref: xlRes.header.ref || fileMeta.ref || '',
            items: xlRes.items,
            error: xlRes.error,
          });
        }
      } catch (err: any) {
        results.push({
          file: f.name,
          client: fileMeta.client || '',
          date: new Date().toISOString().slice(0, 10),
          ref: fileMeta.ref || '',
          items: [],
          error: `Failed to read file: ${err?.message || 'Error'}`,
        });
      }
    }

    setParsedQuotes((prev) => [...prev, ...results]);
    setIsProcessingFiles(false);
    if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
  };

  // Commit uploaded quote prices to the price book
  const handleCommitParsedQuotes = () => {
    if (parsedQuotes.some((m) => m.items.length > 0 && !cleanKey(m.client))) {
      alert('Please specify a company name for each uploaded quote before saving.');
      return;
    }

    const updated = { ...priceBooks };
    let totalItemsRecorded = 0;
    const touchedCompanies = new Set<string>();

    parsedQuotes.forEach((quote) => {
      if (!quote.items.length) return;
      const compKey = cleanKey(quote.client);
      if (!compKey) return;

      if (!updated[compKey]) {
        updated[compKey] = {
          name: quote.client.trim(),
          items: {},
        };
      }

      const comp = updated[compKey];
      quote.items.forEach((item) => {
        const desc = item.d.trim();
        const rate = parseNumber(item.r);
        if (!desc || !(rate > 0)) return;

        const itemKey = cleanKey(desc);
        const existing = comp.items[itemKey];

        const historyEntry = {
          r: rate,
          date: quote.date,
          ref: quote.ref,
          src: 'import',
        };

        if (!existing) {
          comp.items[itemKey] = {
            d: desc,
            bd: desc,
            r: rate,
            date: quote.date,
            h: [historyEntry],
          };
        } else {
          existing.h = [historyEntry, ...existing.h]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 15);
          existing.r = existing.h[0]?.r || rate;
          existing.date = existing.h[0]?.date || quote.date;
        }
        totalItemsRecorded++;
      });

      touchedCompanies.add(compKey);
    });

    onUpdatePriceBooks(updated);
    setParsedQuotes([]);
    alert(`Successfully committed ${totalItemsRecorded} price records across ${touchedCompanies.size} company price books.`);
  };

  // Database JSON Export / Import
  const handleExportDb = () => {
    StorageService.exportDatabaseJson(database);
  };

  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = StorageService.importDatabaseJson(reader.result as string);
        onImportFullDatabase(imported);
        alert('Database restored successfully from backup.');
      } catch (err: any) {
        alert(`Failed to import database: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Upload Past Quotes Section */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Import Past Quotations (PDF or Excel)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select one or more previous quotations. The system extracts company names, dates, references, and item rates automatically to build your price memory.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => fileUploadInputRef.current?.click()}
            disabled={isProcessingFiles}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-semibold transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-700" />
            <span>{isProcessingFiles ? 'Extracting files...' : 'Choose Past Quotation Files (PDF / XLSX)'}</span>
          </button>
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv"
            hidden
            onChange={handleUploadFiles}
          />
        </div>

        {/* Uploaded File Cards */}
        {parsedQuotes.length > 0 && (
          <div className="space-y-4 pt-2">
            {parsedQuotes.map((qResult, qIdx) => (
              <div
                key={qIdx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-slate-800">{qResult.file}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setParsedQuotes(parsedQuotes.filter((_, i) => i !== qIdx))}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {qResult.error ? (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {qResult.error}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1 font-semibold">Company Name</label>
                        <input
                          type="text"
                          value={qResult.client}
                          onChange={(e) => {
                            const copy = [...parsedQuotes];
                            copy[qIdx].client = e.target.value;
                            setParsedQuotes(copy);
                          }}
                          placeholder="Assign company..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md outline-hidden font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1 font-semibold">Quote Date</label>
                        <input
                          type="date"
                          value={qResult.date}
                          onChange={(e) => {
                            const copy = [...parsedQuotes];
                            copy[qIdx].date = e.target.value;
                            setParsedQuotes(copy);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1 font-semibold">Reference</label>
                        <input
                          type="text"
                          value={qResult.ref}
                          onChange={(e) => {
                            const copy = [...parsedQuotes];
                            copy[qIdx].ref = e.target.value;
                            setParsedQuotes(copy);
                          }}
                          placeholder="e.g. UIC/L/5"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px]">
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3 text-center w-16">Qty</th>
                            <th className="py-2 px-3 text-right w-28">Rate (SAR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {qResult.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 px-3">{it.d}</td>
                              <td className="py-1.5 px-3 text-center">{it.q}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-semibold">
                                {formatCurrency(it.r)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleCommitParsedQuotes}
                className="flex items-center gap-2 px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>
                  Commit {parsedQuotes.reduce((acc, q) => acc + q.items.length, 0)} Items into Price Book
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Company Price Book Manager */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-700" />
              <span>Company Price Book &amp; Price Memory</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Client-negotiated pricing and item short-codes for instantaneous quote building.
            </p>
          </div>

          {/* Quick Actions: Offline Transport & Past Quotes */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-97"
              title="Import price book from an Excel or CSV file from another PC (Offline)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import from Another PC (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadAllCompanies}
              disabled={companyKeys.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer ring-1 ring-black/10"
              title="Export complete price book to transfer to another PC (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export for Another PC (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCurrentCompany}
              disabled={!activeCompany}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold transition-all shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer"
              title="Download selected company price book as .xlsx"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              <span>Active Company (.xlsx)</span>
            </button>

            {onOpenImportPastQuotes && (
              <button
                type="button"
                onClick={onOpenImportPastQuotes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Import past month quotations to create reports and index prices"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Import Past Month Quotes</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Layout: Left = Company Search Column, Right = Items & Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Dedicated Company Search & Directory */}
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Companies ({companyKeys.length})
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {filteredCompanyKeys.length} matching
              </span>
            </div>

            {/* Company Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-600 font-medium"
              />
              {companySearchQuery && (
                <button
                  type="button"
                  onClick={() => setCompanySearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* Quick Add Company input inside column */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCompany();
                }}
                placeholder="+ Add new company..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-600 font-medium"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="p-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg transition-colors shrink-0"
                title="Add company"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Company List */}
            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {filteredCompanyKeys.length > 0 ? (
                filteredCompanyKeys.map((key) => {
                  const comp = priceBooks[key];
                  const count = Object.keys(comp.items || {}).length;
                  const isSelected = key === selectedCompanyKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedCompanyKey(key);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-blue-900 text-white font-bold shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 font-medium'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate">{comp.name}</div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
                          isSelected
                            ? 'bg-blue-800 text-blue-100'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  {companySearchQuery ? 'No matching company found.' : 'No companies added yet.'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Company Items Table */}
          <div className="lg:col-span-8 space-y-3">
            {activeCompany ? (
              <>
                {/* Active Company Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{activeCompany.name}</span>
                    <span className="text-[11px] text-slate-500">
                      ({Object.keys(activeCompany.items || {}).length} items recorded)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRenameCompany}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white border border-slate-300 rounded-md transition-colors"
                    >
                      Rename / Merge
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteCompany}
                      className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors"
                    >
                      Delete
                    </button>

                    {/* Item Filter */}
                    <div className="relative w-48 sm:w-56">
                      <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="bq"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter items..."
                        className="w-full pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Company Items Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3 w-28">Short Code</th>
                  <th className="py-3 px-3 min-w-[280px]">Item Description</th>
                  <th className="py-3 px-3 w-32 text-right">Rate (SAR)</th>
                  <th className="py-3 px-3 w-28">Last Quoted</th>
                  <th className="py-3 px-3 min-w-[180px]">Price History</th>
                  <th className="py-3 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(([itemKey, item]) => (
                  <tr key={itemKey} className="hover:bg-slate-50/60 transition-colors">
                    {/* Short Code */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.c || ''}
                        onChange={(e) => handleUpdateItemField(itemKey, 'c', e.target.value)}
                        placeholder="e.g. eh"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-blue-900 focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden"
                      />
                    </td>

                    {/* Description */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.d}
                        onChange={(e) => handleUpdateItemField(itemKey, 'd', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden"
                      />
                    </td>

                    {/* Rate */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.r}
                        onChange={(e) => handleUpdateItemField(itemKey, 'r', e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-right text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-600 outline-hidden ml-auto"
                      />
                    </td>

                    {/* Last Date */}
                    <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">
                      {item.date}
                    </td>

                    {/* History */}
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {item.h && item.h.length > 1
                        ? item.h
                            .slice(1, 4)
                            .map((x) => `${formatCurrency(x.r)} (${x.date})`)
                            .join(', ')
                        : '—'}
                    </td>

                    {/* Delete */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(itemKey)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add New Item Row */}
                <tr className="bg-blue-50/40 border-t border-blue-200">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={newItemCode}
                      onChange={(e) => setNewItemCode(e.target.value)}
                      placeholder="code"
                      className="w-full px-2 py-1 bg-white border border-blue-200 rounded font-mono font-bold text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      placeholder="New item description..."
                      className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      value={newItemRate}
                      onChange={(e) => setNewItemRate(e.target.value)}
                      placeholder="Rate (SAR)"
                      className="w-24 px-2 py-1 bg-white border border-blue-200 rounded font-mono text-xs text-right font-bold ml-auto"
                    />
                  </td>
                  <td colSpan={3} className="py-2 px-3">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-800 hover:bg-blue-900 text-white rounded text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
          Please select a company from the list on the left to view and manage its price book items.
        </div>
      )}
    </div>
  </div>
</div>

      {/* 3. Database Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Database Storage &amp; Backup
        </h3>
        <p className="text-xs text-slate-500">
          The database stores all quotations, company price memories, digital signatures, and defaults. Export regularly to keep a local offline backup file.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportDb}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-700" />
            <span>Export Database (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => dbImportInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>Import Database (.json)</span>
          </button>
          <input
            ref={dbImportInputRef}
            type="file"
            accept=".json"
            hidden
            onChange={handleImportDb}
          />
        </div>
      </div>

      {/* Offline Price Book Import Modal */}
      {isImportModalOpen && (
        <ImportPriceBookModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentPriceBooks={priceBooks}
          onConfirmImport={handleApplyPriceBookImport}
        />
      )}
    </div>
  );
};

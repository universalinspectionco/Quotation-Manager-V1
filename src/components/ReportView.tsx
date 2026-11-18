import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Search, 
  TrendingUp, 
  Coins, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  ArrowUpDown,
  Calendar,
  Upload,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Quotation, QuoteStatus, Settings } from '../types/quotation';
import { calculateTotals, formatCurrency, formatDateUK, parseFlexibleDate, sanitizeFilename } from '../utils/formatters';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { WordGeneratorService } from '../services/wordGenerator';
import { FileStorageService } from '../services/fileStorageService';
import { getTheme } from '../utils/theme';

interface ReportViewProps {
  quotes: Quotation[];
  settings?: Settings;
  onStatusChange: (id: string, newStatus: QuoteStatus) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onOpenImportPastQuotes?: () => void;
  initialMonthFilter?: string;
}

const ALL_STATUSES: QuoteStatus[] = [
  'Draft',
  'Waiting For PO',
  'Job Received',
  'Under Process',
  'Completed',
  'Lost',
];

export const ReportView: React.FC<ReportViewProps> = ({
  quotes,
  settings,
  onStatusChange,
  onUpdateNotes,
  onOpenImportPastQuotes,
  initialMonthFilter,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonthFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const theme = getTheme(settings?.theme);

  useEffect(() => {
    if (initialMonthFilter) {
      setSelectedMonth(initialMonthFilter);
    }
  }, [initialMonthFilter]);

  // Compute available months dynamically from quotes
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    (quotes || []).forEach((q) => {
      const iso = parseFlexibleDate(q?.date) || q?.date || '';
      if (iso.length >= 7 && /^\d{4}-\d{2}/.test(iso)) {
        monthsSet.add(iso.slice(0, 7));
      }
    });

    // Ensure current month and last month are present in list
    const now = new Date();
    const thisMonthStr = now.toISOString().slice(0, 7);
    now.setMonth(now.getMonth() - 1);
    const lastMonthStr = now.toISOString().slice(0, 7);
    monthsSet.add(thisMonthStr);
    monthsSet.add(lastMonthStr);

    return Array.from(monthsSet).sort().reverse();
  }, [quotes]);

  const formatMonthLabel = (m: string) => {
    if (m === 'all') return 'All Time (All Months)';
    try {
      const [year, month] = m.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const monthName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      
      const now = new Date();
      const thisM = now.toISOString().slice(0, 7);
      now.setMonth(now.getMonth() - 1);
      const lastM = now.toISOString().slice(0, 7);

      if (m === lastM) return `${monthName} (Past Month)`;
      if (m === thisM) return `${monthName} (This Month)`;
      return monthName;
    } catch {
      return m;
    }
  };

  // Quotes matching the selected month period
  const monthQuotes = useMemo(() => {
    if (selectedMonth === 'all') return quotes || [];
    return (quotes || []).filter((q) => {
      const iso = parseFlexibleDate(q?.date) || q?.date || '';
      return iso.startsWith(selectedMonth);
    });
  }, [quotes, selectedMonth]);

  // Sorted and filtered quotes across month, status, and search query
  const filteredQuotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return monthQuotes
      .filter((quote) => {
        const matchesStatus = statusFilter === 'All' || quote.status === statusFilter;
        if (!matchesStatus) return false;
        if (!q) return true;

        return (
          (quote.client || '').toLowerCase().includes(q) ||
          (quote.location || '').toLowerCase().includes(q) ||
          (quote.ref || '').toLowerCase().includes(q) ||
          (quote.svc || '').toLowerCase().includes(q) ||
          (quote.dept || '').toLowerCase().includes(q) ||
          (quote.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = parseFlexibleDate(a.date) || a.date || '';
        const db = parseFlexibleDate(b.date) || b.date || '';
        return db.localeCompare(da);
      });
  }, [monthQuotes, statusFilter, searchQuery]);

  // Overall KPI statistics strictly calculated on the selected month period
  const summary = useMemo(() => {
    const totalCount = monthQuotes.length;
    const totalValue = monthQuotes.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0);

    const wonStatuses = ['Job Received', 'Under Process', 'Completed'];
    const wonQuotes = monthQuotes.filter((q) => wonStatuses.includes(q.status));
    const wonCount = wonQuotes.length;
    const wonValue = wonQuotes.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0);

    const lostQuotes = monthQuotes.filter((q) => q.status === 'Lost');
    const decidedCount = wonCount + lostQuotes.length;
    const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

    const byStatus = ALL_STATUSES.map((st) => {
      const matching = monthQuotes.filter((q) => q.status === st);
      const val = matching.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0);
      return { status: st, count: matching.length, total: val };
    });

    return {
      totalCount,
      totalValue,
      wonCount,
      wonValue,
      winRate,
      byStatus,
    };
  }, [monthQuotes]);

  // Export Excel report for the selected month
  const handleExportExcel = async () => {
    try {
      const blob = await ExcelGeneratorService.generateReportExcel(filteredQuotes);
      const periodTag = selectedMonth === 'all' ? 'All-Time' : selectedMonth;
      const filename = `UIC-Quotation-Report-${periodTag}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Excel Pipeline Report',
        extension: '.xlsx',
        settings,
      });
      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Export error: ${e?.message || 'Failed to export Excel report'}`);
    }
  };

  // Export Word report for the selected month
  const handleExportWord = async () => {
    try {
      const blob = await WordGeneratorService.generateReportWord(filteredQuotes);
      const periodTag = selectedMonth === 'all' ? 'All-Time' : selectedMonth;
      const filename = `UIC-Quotation-Report-${periodTag}-${new Date().toISOString().slice(0, 10)}.docx`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        description: 'Word Pipeline Report',
        extension: '.docx',
        settings,
      });
      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Export error: ${e?.message || 'Failed to export Word report'}`);
    }
  };

  const getStatusBadgeStyle = (status: QuoteStatus) => {
    switch (status) {
      case 'Job Received':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Waiting For PO':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Under Process':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'Completed':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'Lost':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'Draft':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Export Buttons */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quotation Status &amp; Monthly Performance Report
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Filter performance metrics and generate executive reports for the past month or any historical period.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import Past Month Quotes Button */}
          {onOpenImportPastQuotes && (
            <button
              type="button"
              onClick={onOpenImportPastQuotes}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-xs cursor-pointer active:scale-97"
              title="Add past quotations from spreadsheet or PDFs into the app to generate reports"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Past Month Quotes</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700 rounded-xl transition-all shadow-2xs cursor-pointer"
            title="Export report in Microsoft Word format (.docx)"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Export Word</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded-xl transition-all shadow-xs active:scale-97 cursor-pointer"
            title="Export report in Microsoft Excel format (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-200" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* MONTH / DATE PERIOD SELECTOR TOOLBAR */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-white/70 dark:bg-zinc-900/70 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mr-1">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Report Period:</span>
          </div>

          {/* Quick Period Selector Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Dates &amp; History ({quotes.length} total)</option>
            {availableMonths.map((m) => {
              const countInMonth = (quotes || []).filter((q) => q && q.date && q.date.startsWith(m)).length;
              return (
                <option key={m} value={m}>
                  {formatMonthLabel(m)} &middot; {countInMonth} quote{countInMonth === 1 ? '' : 's'}
                </option>
              );
            })}
          </select>

          {/* Quick preset buttons */}
          {(() => {
            const now = new Date();
            const thisM = now.toISOString().slice(0, 7);
            now.setMonth(now.getMonth() - 1);
            const lastM = now.toISOString().slice(0, 7);

            return (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedMonth(lastM)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedMonth === lastM
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  Past Month
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonth(thisM)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedMonth === thisM
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonth('all')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedMonth === 'all'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  All History
                </button>
              </div>
            );
          })()}
        </div>

        {/* Active Period Status Pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-zinc-400">Showing:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
            {monthQuotes.length} quotes &middot; SAR {formatCurrency(summary.totalValue)}
          </span>
          {selectedMonth !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Period</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summary.byStatus.map((item) => (
          <div key={item.status} className="glass-card p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs bg-white dark:bg-zinc-900">
            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate">{item.status}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">{item.count}</div>
            <div className="text-[11px] text-slate-400 font-mono truncate tabular-nums">
              SAR {formatCurrency(item.total)}
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="glass-panel rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden bg-white dark:bg-zinc-900">
        
        {/* Controls Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 dark:bg-zinc-900/60">
          
          {/* Status Tabs (Segmented Controller) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 p-1 bg-slate-100/80 dark:bg-zinc-800 rounded-xl border border-slate-200/60 dark:border-zinc-700">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer ${
                statusFilter === 'All'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50'
              }`}
            >
              All ({monthQuotes.length})
            </button>
            {ALL_STATUSES.map((status) => {
              const countInStatus = monthQuotes.filter((q) => q.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    statusFilter === status
                      ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50'
                  }`}
                >
                  {status} {countInStatus > 0 && `(${countInStatus})`}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, service, ref, notes..."
              className="w-full pl-10 pr-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-slate-200/90 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 outline-hidden transition-all shadow-2xs text-slate-800 dark:text-zinc-100 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Corporate Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">S.No</th>
                <th className="py-3 px-3">Ref</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Via</th>
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3">Service</th>
                <th className="py-3 px-3">Dept</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Net Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 min-w-[180px]">Remarks / Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredQuotes.length > 0 ? (
                filteredQuotes.map((q, idx) => {
                  const totals = calculateTotals(q);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-900 dark:text-blue-300 whitespace-nowrap">
                        {q.ref}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-600 dark:text-zinc-400">
                        {formatDateUK(q.date)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-zinc-100 truncate max-w-xs">
                        {q.client}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{q.via || '—'}</td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-zinc-400">{q.clientCode || '—'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300 font-medium">{q.svc || 'Inspection'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{q.dept || '—'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400 capitalize">{q.location || '—'}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        SAR {formatCurrency(totals.netTotal)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={q.status}
                          onChange={(e) => onStatusChange(q.id, e.target.value as QuoteStatus)}
                          className={`text-[11px] font-bold py-0.5 px-2 rounded border outline-hidden cursor-pointer ${getStatusBadgeStyle(
                            q.status
                          )}`}
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st} className="bg-white text-slate-900 font-medium">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={q.notes || ''}
                          onChange={(e) => onUpdateNotes(q.id, e.target.value)}
                          placeholder="Add remark..."
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-xs focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-blue-600 outline-hidden"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <AlertCircle className="w-8 h-8 opacity-30 mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-zinc-300">
                        No quotations found for this period.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {onOpenImportPastQuotes && (
                          <button
                            type="button"
                            onClick={onOpenImportPastQuotes}
                            className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 cursor-pointer shadow-xs"
                          >
                            + Import Past Month Quotes Now
                          </button>
                        )}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

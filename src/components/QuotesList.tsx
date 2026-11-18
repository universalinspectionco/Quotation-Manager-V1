import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  FileSpreadsheet, 
  FileText, 
  Copy, 
  Edit3, 
  Trash2, 
  X, 
  AlertCircle,
  Upload
} from 'lucide-react';
import { Quotation, QuoteStatus, Settings } from '../types/quotation';
import { calculateTotals, formatCurrency, formatDateUK, sanitizeFilename } from '../utils/formatters';
import { PdfGeneratorService } from '../services/pdfGenerator';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { WordGeneratorService } from '../services/wordGenerator';
import { FileStorageService } from '../services/fileStorageService';
import { ClientFrequencyChart } from './ClientFrequencyChart';
import { getTheme } from '../utils/theme';

interface QuotesListProps {
  quotes: Quotation[];
  settings: Settings;
  onEditQuote: (id: string) => void;
  onCloneQuote: (id: string) => void;
  onDeleteQuote: (id: string) => void;
  onStatusChange: (id: string, newStatus: QuoteStatus) => void;
  onNewQuoteClick: () => void;
  onPreviewPdf: (quote: Quotation) => void;
  onOpenIntro?: () => void;
  onOpenImportPastQuotes?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

const ALL_STATUSES: QuoteStatus[] = [
  'Draft',
  'Waiting For PO',
  'Job Received',
  'Under Process',
  'Completed',
  'Lost',
];

export const QuotesList: React.FC<QuotesListProps> = ({
  quotes,
  settings,
  onEditQuote,
  onCloneQuote,
  onDeleteQuote,
  onStatusChange,
  onNewQuoteClick,
  onPreviewPdf,
  onOpenIntro,
  onOpenImportPastQuotes,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = externalOnSearchChange || setLocalSearchQuery;

  const theme = getTheme(settings.theme);

  // Filter quotes across status, client filter from chart, and text query
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (!q) return false;

      // Status filter
      if (statusFilter !== 'All' && q.status !== statusFilter) {
        return false;
      }

      // Client filter from interactive chart
      if (selectedClientFilter) {
        const clientName = (q.client || '').trim().toLowerCase();
        if (clientName !== selectedClientFilter.trim().toLowerCase()) {
          return false;
        }
      }

      // Search token filter
      if (searchQuery.trim()) {
        const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const searchableText = [
          q.ref || '',
          q.client || '',
          q.title || '',
          q.attn || '',
          q.sub || '',
          q.svc || '',
          q.location || '',
          q.type || '',
          q.status || '',
          ...(q.items || []).map((it) => `${it.d} ${it.sz || ''} ${it.cl || ''} ${it.sns || ''}`),
        ]
          .join(' ')
          .toLowerCase();

        const allTokensMatch = tokens.every((token) => searchableText.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [quotes, statusFilter, selectedClientFilter, searchQuery]);

  // Executive KPI stats calculation
  const stats = useMemo(() => {
    const list = quotes || [];
    const totalCount = list.length;
    const totalValue = list.reduce((acc, q) => acc + (q ? calculateTotals(q).netTotal : 0), 0);

    const wonStatuses = ['Job Received', 'Under Process', 'Completed'];
    const wonQuotes = list.filter((q) => q && wonStatuses.includes(q.status));
    const wonCount = wonQuotes.length;
    const wonValue = wonQuotes.reduce((acc, q) => acc + (q ? calculateTotals(q).netTotal : 0), 0);

    const lostQuotes = list.filter((q) => q && q.status === 'Lost');
    const decidedCount = wonCount + lostQuotes.length;
    const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

    return {
      totalCount,
      totalValue,
      wonCount,
      wonValue,
      winRate,
    };
  }, [quotes]);

  // Compute Client Density for right aside meters
  const clientDensity = useMemo(() => {
    const counts: Record<string, number> = {};
    quotes.forEach((q) => {
      const client = q.client?.trim() || 'Other';
      counts[client] = (counts[client] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    return sorted.slice(0, 5).map(([name, count]) => ({
      name,
      count,
      percent: Math.min(100, Math.round((count / max) * 100)),
    }));
  }, [quotes]);

  // Compute Allocation Report percentages
  const allocationReport = useMemo(() => {
    const total = quotes.length || 1;
    return ALL_STATUSES.map((status) => {
      const count = quotes.filter((q) => q.status === status).length;
      const pct = Math.round((count / total) * 100);
      return { status, count, pct };
    }).filter((item) => item.count > 0);
  }, [quotes]);

  const handleDownloadPdf = async (quote: Quotation) => {
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
      alert(`Could not save PDF: ${e?.message || 'Error'}`);
    }
  };

  const handleDownloadExcel = async (quote: Quotation) => {
    try {
      const blob = await ExcelGeneratorService.generateQuoteExcel(quote, settings);
      const filename = `${sanitizeFilename(quote)}.xlsx`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Excel Spreadsheet',
        extension: '.xlsx',
        settings,
      });
      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Could not export Excel: ${e?.message || 'Error'}`);
    }
  };

  const handleDownloadWord = async (quote: Quotation) => {
    try {
      const blob = await WordGeneratorService.generateQuoteWord(quote, settings);
      const filename = `${sanitizeFilename(quote)}.docx`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        description: 'Word Document',
        extension: '.docx',
        settings,
      });
      if (res.success && res.method !== 'download') {
        alert(res.message);
      }
    } catch (e: any) {
      alert(`Could not export Word: ${e?.message || 'Error'}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 1. Hero Title matching Variation 23 */}
      <div className="hero-title border-b border-[var(--border,rgba(228,228,231,0.12))] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span 
              className="label-mono text-[10px] tracking-widest block mb-1.5"
              style={{ color: '#063074' }}
            >
              Environment: Production &middot; Universal Inspection Co. Ltd. (C.R. 2055011643)
            </span>
            <h1 
              className="font-syne text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--ink,#E4E4E7)] leading-none"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '55px',
                lineHeight: '54px',
                textDecorationLine: 'underline',
              }}
            >
              Quotation Hub
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Animated telemetry waveform */}
            <div className="flex items-end gap-0.5 h-3.5 px-1 py-0.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xs" title="60FPS Telemetry Live">
              <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2" />
              <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.2s_ease-in-out_infinite_0.2s] h-3" />
              <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-1.5" />
              <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.1s] h-2.5" />
            </div>
            <span 
              className="label-mono text-[10px]"
              style={{ color: '#00f991' }}
            >
              Active Terminal v2.4.0-E
            </span>
          </div>
        </div>
      </div>

      {/* 2. Stats Strip matching Variation 23 */}
      <section 
        className="stats-strip grid grid-cols-2 lg:grid-cols-4 border-b border-[var(--border,rgba(228,228,231,0.12))] pb-2"
        style={{ width: '1000px', maxWidth: '100%' }}
      >
        <div className="stat-box py-4 sm:py-6 border-r border-[var(--border,rgba(228,228,231,0.12))] pr-4">
          <span className="label-mono text-[10px]" style={{ color: '#ee0c4c' }}>Total Volume</span>
          <div className="font-mono text-2xl sm:text-3xl font-semibold mt-2 text-[var(--ink,#E4E4E7)]">
            {stats.totalCount < 10 ? `0${stats.totalCount}` : stats.totalCount}
          </div>
        </div>

        <div className="stat-box py-4 sm:py-6 border-r border-[var(--border,rgba(228,228,231,0.12))] px-4 sm:px-6">
          <span className="label-mono text-[10px]" style={{ color: '#f20b40' }}>Gross Confirmed</span>
          <div className="font-mono text-xl sm:text-2xl font-semibold mt-2 text-[var(--ink,#E4E4E7)] truncate">
            SAR {formatCurrency(stats.wonValue)}
          </div>
        </div>

        <div className="stat-box py-4 sm:py-6 border-r border-[var(--border,rgba(228,228,231,0.12))] px-4 sm:px-6">
          <span className="label-mono text-[10px]" style={{ color: '#f1053b' }}>Conversion</span>
          <div className="font-mono text-2xl sm:text-3xl font-semibold mt-2 text-[var(--ink,#E4E4E7)]">
            {stats.winRate}%
          </div>
        </div>

        <div className="stat-box py-4 sm:py-6 pl-4 sm:pl-6">
          <span className="label-mono text-[10px]" style={{ color: '#ee062f' }}>Pipeline Value</span>
          <div 
            className="font-mono text-xl sm:text-2xl font-bold mt-2 truncate"
            style={{ color: 'var(--accent, #FF3B30)' }}
          >
            SAR {formatCurrency(stats.totalValue)}
          </div>
        </div>
      </section>

      {/* 3. Central Grid: Left Ledger + Right Client Density Aside */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        
        {/* Left: Active Quotations Ledger Table + Client Frequency Chart */}
        <div className="space-y-8 min-w-0">
          
          {/* Active Quotations Ledger Panel */}
          <section className="glass-panel rounded-sm border border-[var(--border,rgba(228,228,231,0.12))] p-4 sm:p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border,rgba(228,228,231,0.12))]">
              <div className="flex flex-wrap items-center gap-2.5">
                <span 
                  className="label-mono font-bold text-[var(--ink,#E4E4E7)]"
                  style={{ lineHeight: '16.6px', fontSize: '12.4px' }}
                >
                  Ledger: Active Quotations
                </span>
                <span 
                  className="label-mono text-[9px] px-2 py-0.5 rounded-xs bg-white/[0.04] text-[var(--ink-faint,rgba(228,228,231,0.6))]"
                >
                  {filteredQuotes.length} Records
                </span>

                {onOpenImportPastQuotes && (
                  <button
                    type="button"
                    onClick={onOpenImportPastQuotes}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 rounded-xs transition-colors cursor-pointer"
                    title="Import past month quotations from Excel or PDF documents"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Import Past Quotes</span>
                  </button>
                )}
              </div>

              {/* Status Segmented Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1 p-0.5 bg-black/30 rounded-xs border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer ${
                    statusFilter === 'All'
                      ? 'bg-[var(--accent,#FF3B30)] text-white font-bold'
                      : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)]'
                  }`}
                >
                  ALL
                </button>
                {ALL_STATUSES.map((status) => {
                  const count = quotes.filter((q) => q.status === status).length;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`px-2 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer ${
                        statusFilter === status
                          ? 'bg-[var(--accent,#FF3B30)] text-white font-bold'
                          : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)]'
                      }`}
                    >
                      {status.toUpperCase()} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Client Filter Notice */}
            {selectedClientFilter && (
              <div className="mb-4 px-3 py-2 bg-white/[0.04] border border-[var(--border,rgba(228,228,231,0.12))] rounded-xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="label-mono text-[10px]">Filter Active:</span>
                  <span className="font-semibold text-[var(--ink,#E4E4E7)]">{selectedClientFilter}</span>
                  <span className="text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                    ({filteredQuotes.length} matches)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClientFilter('')}
                  className="label-mono text-[10px] text-[var(--accent,#FF3B30)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            )}

            {/* Quotations Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border,rgba(228,228,231,0.12))]">
                    <th className="label-mono pb-3 pr-4">Reference</th>
                    <th className="label-mono pb-3 px-4">Client &amp; Scope</th>
                    <th className="label-mono pb-3 px-4 text-right">Amount (SAR)</th>
                    <th className="label-mono pb-3 px-4">Status</th>
                    <th className="label-mono pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border,rgba(228,228,231,0.08))]">
                  {filteredQuotes.length > 0 ? (
                    filteredQuotes.map((quote, idx) => {
                      const totals = calculateTotals(quote);
                      const isWon = quote.status === 'Completed' || quote.status === 'Job Received';
                      const isFirstRow = idx === 0;

                      return (
                        <tr 
                          key={quote.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Reference */}
                          <td className="py-3.5 pr-4 align-top">
                            <span className="font-mono text-xs font-medium text-[var(--ink,#E4E4E7)] block">
                              {quote.ref}
                            </span>
                            <span className="label-mono text-[9px] text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                              {formatDateUK(quote.date)}
                            </span>
                          </td>

                          {/* Client & Scope */}
                          <td className="py-3.5 px-4 align-top max-w-[260px]">
                            <div className="font-semibold text-xs text-[var(--ink,#E4E4E7)] truncate">
                              {quote.client || 'Unnamed Client'}
                            </div>
                            <div className="text-[11px] text-[var(--ink-faint,rgba(228,228,231,0.5))] truncate mt-0.5">
                              {quote.sub || quote.title || quote.svc || 'Inspection Services'}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <span className="font-mono text-xs font-semibold text-[var(--ink,#E4E4E7)] tabular-nums">
                              {formatCurrency(totals.netTotal)}
                            </span>
                          </td>

                          {/* Status Tag */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="relative inline-flex items-center gap-1.5">
                              <span 
                                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                                style={{
                                  backgroundColor: isWon ? '#10B981' : quote.status === 'Waiting For PO' ? '#3B82F6' : '#F59E0B',
                                  boxShadow: isWon ? '0 0 8px #10B981' : 'none',
                                }}
                              />
                              <div className="relative inline-block">
                                <select
                                  value={quote.status}
                                  onChange={(e) => onStatusChange(quote.id, e.target.value as QuoteStatus)}
                                  className="font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded-xs border cursor-pointer appearance-none pr-5 outline-hidden transition-colors"
                                  style={{
                                    backgroundColor: 'transparent',
                                    borderColor: isWon ? 'var(--accent, #FF3B30)' : 'var(--border, rgba(228, 228, 231, 0.2))',
                                    color: isWon ? 'var(--accent, #FF3B30)' : 'var(--ink, #E4E4E7)',
                                  }}
                                >
                                {ALL_STATUSES.map((st) => (
                                  <option key={st} value={st} className="bg-[var(--surface,#18181b)] text-[var(--ink,#E4E4E7)]">
                                    {st.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none opacity-60">
                                ▼
                              </span>
                            </div>
                          </div>
                        </td>

                          {/* Actions: View, PDF, Excel, Edit, Duplicate, Delete all in the same line */}
                          <td className="py-3.5 pl-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* View / PDF Preview */}
                              <button
                                type="button"
                                onClick={() => onPreviewPdf(quote)}
                                title="View Quotation (PDF Preview)"
                                className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Save PDF */}
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(quote)}
                                title="Save PDF Document"
                                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Save Excel */}
                              <button
                                type="button"
                                onClick={() => handleDownloadExcel(quote)}
                                title="Save Excel Spreadsheet (.xlsx)"
                                className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Quote */}
                              <button
                                type="button"
                                onClick={() => onEditQuote(quote.id)}
                                title="Edit Quotation"
                                className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate Quote */}
                              <button
                                type="button"
                                onClick={() => onCloneQuote(quote.id)}
                                title="Duplicate Quotation"
                                className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Quote */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete quotation ${quote.ref} for ${quote.client}?`)) {
                                    onDeleteQuote(quote.id);
                                  }
                                }}
                                title="Delete Quotation"
                                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xs transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <AlertCircle className="w-6 h-6 opacity-40 mb-1" />
                          <p className="text-xs font-mono font-medium text-[var(--ink,#E4E4E7)]">No Quotations Found</p>
                          <p className="text-[11px] text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                            {searchQuery ? `No matching records for "${searchQuery}"` : 'Get started by creating your first quotation.'}
                          </p>
                          <button
                            type="button"
                            onClick={onNewQuoteClick}
                            className="btn-cta mt-3 text-xs"
                          >
                            + Create First Quote
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger Footer */}
            <div className="pt-4 border-t border-[var(--border,rgba(228,228,231,0.12))] mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="label-mono text-[10px]">
                Active Records: {filteredQuotes.length} of {quotes.length}
              </span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="label-mono text-[10px]">Visible Pipeline:</span>
                <span className="font-bold text-[var(--ink,#E4E4E7)] tabular-nums">
                  SAR {formatCurrency(filteredQuotes.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0))}
                </span>
              </div>
            </div>
          </section>

          {/* Interactive Client Frequency Chart Embedded */}
          <section className="glass-panel rounded-sm border border-[var(--border,rgba(228,228,231,0.12))] p-4 sm:p-6">
            <ClientFrequencyChart
              quotes={quotes}
              selectedClient={selectedClientFilter}
              onSelectClient={(client) => setSelectedClientFilter(client)}
              themeConfig={theme}
            />
          </section>
        </div>

        {/* Right Aside: Client Density & Allocation Report matching Variation 23 */}
        <aside className="space-y-6">
          {/* Client Density Meters */}
          <div className="glass-panel p-5 sm:p-6 rounded-sm border border-[var(--border,rgba(228,228,231,0.12))]">
            <span className="label-mono text-[10px] block mb-4">Client Density</span>
            <div className="space-y-4">
              {clientDensity.map((client) => (
                <div key={client.name} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--ink,#E4E4E7)] truncate font-semibold">
                      {client.name}
                    </span>
                    <span className="label-mono text-[10px] text-[var(--ink-faint,rgba(228,228,231,0.6))]">
                      {client.percent}%
                    </span>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill" style={{ width: `${client.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation Report Breakdown */}
          <div className="glass-panel p-5 sm:p-6 rounded-sm border border-[var(--border,rgba(228,228,231,0.12))]">
            <span className="label-mono text-[10px] block mb-4">Allocation Report</span>
            <div className="space-y-3.5">
              {allocationReport.map((item) => (
                <div key={item.status} className="flex justify-between items-baseline text-xs">
                  <span className="label-mono text-[10px] opacity-100 text-[var(--ink,#E4E4E7)] font-medium">
                    {item.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                      ({item.count})
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--ink,#E4E4E7)]">
                      {item.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Environment Terminal Info */}
          <div className="glass-panel p-4 rounded-sm border border-[var(--border,rgba(228,228,231,0.12))] text-[11px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-mono text-[9px]">Internal Terminal</span>
              <span className="font-mono text-[10px] text-emerald-400 font-semibold">Active</span>
            </div>
            <p className="text-[var(--ink-faint,rgba(228,228,231,0.5))] leading-relaxed text-[10px]">
              C.R. 2055011643 &middot; Calibration, Valve Testing &amp; NDT Services Management Console
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

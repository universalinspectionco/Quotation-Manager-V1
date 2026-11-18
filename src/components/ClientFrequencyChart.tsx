import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  Briefcase, 
  CheckCircle2, 
  TrendingUp, 
  Award, 
  Coins, 
  ChevronRight,
  Filter,
  Users
} from 'lucide-react';
import { Quotation } from '../types/quotation';
import { calculateTotals, formatCurrency } from '../utils/formatters';
import { getTheme, ThemeConfig } from '../utils/theme';

interface ClientFrequencyChartProps {
  quotes: Quotation[];
  onSelectClient?: (clientName: string) => void;
  selectedClient?: string;
  themeConfig?: ThemeConfig;
}

interface ClientStat {
  client: string;
  wonCount: number;
  totalQuotes: number;
  inProgressCount: number;
  completedCount: number;
  waitingPoCount: number;
  wonValue: number;
  totalValue: number;
  winRate: number;
  latestDate: string;
}

export const ClientFrequencyChart: React.FC<ClientFrequencyChartProps> = ({
  quotes,
  onSelectClient,
  selectedClient = '',
  themeConfig,
}) => {
  const [metricMode, setMetricMode] = useState<'frequency' | 'value' | 'quotes'>('frequency');
  const [displayLimit, setDisplayLimit] = useState<number>(6);

  const theme = themeConfig || getTheme('navy');

  // Compute aggregated stats for each unique client
  const clientStats = useMemo(() => {
    const map = new Map<string, ClientStat>();
    const list = quotes || [];

    const WON_STATUSES = ['Job Received', 'Under Process', 'Completed'];

    list.forEach((q) => {
      if (!q || !q.client) return;
      const clientName = q.client.trim();
      if (!clientName) return;

      const existing = map.get(clientName) || {
        client: clientName,
        wonCount: 0,
        totalQuotes: 0,
        inProgressCount: 0,
        completedCount: 0,
        waitingPoCount: 0,
        wonValue: 0,
        totalValue: 0,
        winRate: 0,
        latestDate: q.date || '',
      };

      existing.totalQuotes += 1;
      const net = calculateTotals(q).netTotal;
      existing.totalValue += net;

      if (WON_STATUSES.includes(q.status)) {
        existing.wonCount += 1;
        existing.wonValue += net;
        if (q.status === 'Under Process' || q.status === 'Job Received') {
          existing.inProgressCount += 1;
        } else if (q.status === 'Completed') {
          existing.completedCount += 1;
        }
      } else if (q.status === 'Waiting For PO') {
        existing.waitingPoCount += 1;
      }

      if (q.date && (!existing.latestDate || q.date > existing.latestDate)) {
        existing.latestDate = q.date;
      }

      map.set(clientName, existing);
    });

    // Calculate win rates
    const statsArray: ClientStat[] = Array.from(map.values()).map((stat) => {
      return {
        ...stat,
        winRate: stat.totalQuotes > 0 ? Math.round((stat.wonCount / stat.totalQuotes) * 100) : 0,
      };
    });

    // Sort based on active metric
    statsArray.sort((a, b) => {
      if (metricMode === 'frequency') {
        if (b.wonCount !== a.wonCount) return b.wonCount - a.wonCount;
        return b.wonValue - a.wonValue;
      } else if (metricMode === 'value') {
        if (b.wonValue !== a.wonValue) return b.wonValue - a.wonValue;
        return b.wonCount - a.wonCount;
      } else {
        if (b.totalQuotes !== a.totalQuotes) return b.totalQuotes - a.totalQuotes;
        return b.wonCount - a.wonCount;
      }
    });

    return statsArray;
  }, [quotes, metricMode]);

  // Max value for computing percentage bar widths
  const maxMetricValue = useMemo(() => {
    if (clientStats.length === 0) return 1;
    if (metricMode === 'frequency') {
      return Math.max(...clientStats.map((c) => c.wonCount), 1);
    } else if (metricMode === 'value') {
      return Math.max(...clientStats.map((c) => c.wonValue), 1);
    } else {
      return Math.max(...clientStats.map((c) => c.totalQuotes), 1);
    }
  }, [clientStats, metricMode]);

  const displayedStats = useMemo(() => {
    if (displayLimit === 0) return clientStats;
    return clientStats.slice(0, displayLimit);
  }, [clientStats, displayLimit]);

  // Aggregate totals for the active won clients
  const totalWonJobsAllClients = useMemo(() => {
    return clientStats.reduce((sum, c) => sum + c.wonCount, 0);
  }, [clientStats]);

  const activeClientsCount = useMemo(() => {
    return clientStats.filter((c) => c.wonCount > 0).length;
  }, [clientStats]);

  return (
    <div className="glass-card rounded-sm p-4 sm:p-5 flex flex-col border border-[var(--border,rgba(228,228,231,0.12))]" style={{ height: '400px' }}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--border,rgba(228,228,231,0.12))]">
        <div>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-7 h-7 rounded-xs flex items-center justify-center text-white font-mono text-xs shadow-xs"
              style={{ backgroundColor: 'var(--accent, #FF3B30)' }}
            >
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--ink,#E4E4E7)] tracking-tight flex items-center gap-2 font-syne">
                Active Client Job Frequency
                <span className="label-mono text-[9px] text-[var(--ink-faint,rgba(228,228,231,0.5))]">
                  &middot; {activeClientsCount} Active Clients
                </span>
              </h3>
              <p className="label-mono text-[10px] text-[var(--ink-faint,rgba(228,228,231,0.5))] mt-0.5">
                Won contracts and work order volume per client
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Metric Toggles */}
        <div className="flex items-center gap-1 self-start sm:self-auto p-0.5 bg-black/30 rounded-xs border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMetricMode('frequency')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer ${
              metricMode === 'frequency'
                ? 'bg-[var(--accent,#FF3B30)] text-white font-bold'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)]'
            }`}
            title="Sort by number of Won / Booked jobs"
          >
            Jobs Won
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('value')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer ${
              metricMode === 'value'
                ? 'bg-[var(--accent,#FF3B30)] text-white font-bold'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)]'
            }`}
            title="Sort by confirmed job value (SAR)"
          >
            Value (SAR)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('quotes')}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-xs transition-colors cursor-pointer ${
              metricMode === 'quotes'
                ? 'bg-[var(--accent,#FF3B30)] text-white font-bold'
                : 'text-[var(--ink-faint,rgba(228,228,231,0.5))] hover:text-[var(--ink,#E4E4E7)]'
            }`}
            title="Sort by total quote inquiries"
          >
            Total Quotes
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="flex-1 py-3.5 overflow-y-auto pr-1">
        {clientStats.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-center p-4">
            <Users className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600">No client quotation history recorded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Create your first quote to see real-time job frequency analytics.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedStats.map((item, index) => {
              const isSelected = selectedClient.toLowerCase().trim() === item.client.toLowerCase().trim();
              
              // Percentage calculation based on current metric
              const barValue = 
                metricMode === 'frequency' ? item.wonCount :
                metricMode === 'value' ? item.wonValue :
                item.totalQuotes;

              const percentOfMax = maxMetricValue > 0 ? Math.min(100, Math.max(6, Math.round((barValue / maxMetricValue) * 100))) : 0;
              const hasWonJobs = item.wonCount > 0;

              return (
                <div
                  key={item.client}
                  onClick={() => onSelectClient && onSelectClient(isSelected ? '' : item.client)}
                  className={`group p-2.5 rounded-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.06] border-[var(--accent,#FF3B30)] shadow-xs'
                      : 'border-[var(--border,rgba(228,228,231,0.08))] hover:border-[var(--border,rgba(228,228,231,0.2))] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    {/* Client Name & Rank */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 h-4 rounded-xs flex items-center justify-center text-[9px] font-mono font-bold shrink-0 bg-white/[0.06] text-zinc-300">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-xs text-[var(--ink,#E4E4E7)] truncate">
                        {item.client}
                      </span>

                      {/* Clean Unboxed Status Label (Anti-Pill) */}
                      {hasWonJobs ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{item.wonCount} {item.wonCount === 1 ? 'Job' : 'Jobs'} Booked</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 shrink-0">
                          · Inquiry Only ({item.totalQuotes})
                        </span>
                      )}
                    </div>

                    {/* Numeric Metric Value */}
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <div className="font-mono text-xs font-bold tabular-nums">
                        {metricMode === 'frequency' && (
                          <span className="text-[var(--accent,#FF3B30)] font-extrabold">{item.wonCount} won</span>
                        )}
                        {metricMode === 'value' && (
                          <span className="text-emerald-500 font-extrabold">SAR {formatCurrency(item.wonValue)}</span>
                        )}
                        {metricMode === 'quotes' && (
                          <span className="text-[var(--ink,#E4E4E7)]">{item.totalQuotes} quotes</span>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-faint,rgba(228,228,231,0.4))] group-hover:text-[var(--accent,#FF3B30)] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {/* Frequency Progress Bar with Animated Glow */}
                  <div className="w-full meter-track rounded-none bg-white/[0.06] overflow-hidden">
                    <div
                      className="meter-fill transition-all duration-700 ease-out relative"
                      style={{
                        width: `${percentOfMax}%`,
                        backgroundColor: hasWonJobs ? 'var(--accent, #FF3B30)' : '#71717A',
                        boxShadow: hasWonJobs ? '0 0 8px rgba(255, 59, 48, 0.4)' : 'none',
                      }}
                    />
                  </div>

                  {/* Context Sub-strip with Unboxed Metadata */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--ink-faint,rgba(228,228,231,0.5))] mt-2 px-0.5">
                    <div className="flex items-center gap-3">
                      <span>Total Quotes: <strong className="text-[var(--ink,#E4E4E7)] font-mono tabular-nums">{item.totalQuotes}</strong></span>
                      {hasWonJobs && (
                        <span>Win Rate: <strong className="text-emerald-500 font-mono tabular-nums">{item.winRate}%</strong></span>
                      )}
                      {item.inProgressCount > 0 && (
                        <span className="text-blue-400 font-medium">· {item.inProgressCount} in progress</span>
                      )}
                    </div>
                    <div>
                      <span>Total Net: <strong className="font-mono text-[var(--ink,#E4E4E7)] tabular-nums font-semibold">SAR {formatCurrency(item.wonValue || item.totalValue)}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Strip with Quick Summary & Expand Control */}
      {clientStats.length > 0 && (
        <div className="pt-3 border-t border-[var(--border,rgba(228,228,231,0.12))] flex items-center justify-between text-xs text-[var(--ink-faint,rgba(228,228,231,0.6))]">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] text-[var(--ink-secondary,rgba(228,228,231,0.78))]">
              Top Client: <strong className="text-[var(--ink,#E4E4E7)]">{clientStats[0]?.client}</strong> · {clientStats[0]?.wonCount} won jobs (SAR {formatCurrency(clientStats[0]?.wonValue)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {clientStats.length > 6 && (
              <button
                type="button"
                onClick={() => setDisplayLimit((prev) => (prev === 0 ? 6 : 0))}
                className="text-[11px] font-semibold text-[var(--accent,#FF3B30)] hover:underline transition-colors cursor-pointer"
              >
                {displayLimit === 0 ? 'Show Top 6' : `Show All (${clientStats.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import { Quotation, LineItem } from '../types/quotation';

export function formatCurrency(value: number | string | undefined | null): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function calculateTotals(quote: Partial<Quotation>): {
  subtotal: number;
  vatAmount: number;
  netTotal: number;
  totalQty: number;
} {
  const items = quote.items || [];
  const subtotal = items.reduce((acc, item) => {
    const q = parseNumber(item.q);
    const r = parseNumber(item.r);
    return acc + q * r;
  }, 0);

  const vatRate = parseNumber(quote.vat ?? 15) / 100;
  const vatAmount = subtotal * vatRate;
  const netTotal = subtotal + vatAmount;

  const totalQty = items.reduce((acc, item) => acc + parseNumber(item.q), 0);

  return {
    subtotal,
    vatAmount,
    netTotal,
    totalQty,
  };
}

export function cleanKey(str?: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

export function parseSerialNumbers(rawSns?: string): string[] {
  if (!rawSns) return [];
  return String(rawSns)
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function toIsoYMD(year: number, month: number, day: number): string {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return '';
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y <= 69 ? 2000 + y : 1900 + y;
}

/**
 * Parses numeric, ISO, Excel serial, or word+number dates (e.g. "3 November 2026", "03-Nov-26", "Nov 3, 2026")
 * into canonical YYYY-MM-DD format without timezone off-by-one shifts. Returns '' if unparseable.
 */
export function parseFlexibleDate(input: any): string {
  if (input === null || input === undefined || input === '') return '';

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return '';
    // Add 60s buffer to handle SheetJS 23:59:59 rounding quirks cleanly
    const buffered = new Date(input.getTime() + 60000);
    return toIsoYMD(buffered.getFullYear(), buffered.getMonth() + 1, buffered.getDate());
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 20000 || input > 80000) return '';
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(input) * 86400000);
    return toIsoYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  let s = String(input).trim();
  if (!s || /^nan/i.test(s)) return '';

  // Pure numeric string -> Excel serial date
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial >= 20000 && serial <= 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
      return toIsoYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }

  // Normalize ordinal suffixes (1st, 2nd, 3rd, 4th) & extra whitespace
  s = s.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ').trim();

  // 1. ISO YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    return toIsoYMD(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  }

  // 2. Day + MonthWord + Year (e.g., "3 November 2026", "03-Nov-26", "03/Nov/2026", "3 Nov, 2026")
  m = s.match(/^(\d{1,2})[\s\-\/.,]+([A-Za-z]+)[\s\-\/.,]+(\d{2,4})(?:\s.*)?$/);
  if (m) {
    const monthNum = MONTH_MAP[m[2].toLowerCase()];
    if (monthNum) {
      return toIsoYMD(expandYear(parseInt(m[3], 10)), monthNum, parseInt(m[1], 10));
    }
  }

  // 3. MonthWord + Day + Year (e.g., "November 3, 2026", "Nov-03-26", "Nov 3 2026")
  m = s.match(/^([A-Za-z]+)[\s\-\/.,]+(\d{1,2})[\s\-\/.,]+(\d{2,4})(?:\s.*)?$/);
  if (m) {
    const monthNum = MONTH_MAP[m[1].toLowerCase()];
    if (monthNum) {
      return toIsoYMD(expandYear(parseInt(m[3], 10)), monthNum, parseInt(m[2], 10));
    }
  }

  // 4. Year + MonthWord + Day (e.g., "2026-Nov-03", "2026 November 3")
  m = s.match(/^(\d{4})[\s\-\/.,]+([A-Za-z]+)[\s\-\/.,]+(\d{1,2})$/);
  if (m) {
    const monthNum = MONTH_MAP[m[2].toLowerCase()];
    if (monthNum) {
      return toIsoYMD(parseInt(m[1], 10), monthNum, parseInt(m[3], 10));
    }
  }

  // 5. Numeric DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY (default KSA/UK DD/MM, auto-swap if MM > 12)
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = expandYear(parseInt(m[3], 10));
    if (b > 12 && a <= 12) {
      return toIsoYMD(y, a, b);
    }
    return toIsoYMD(y, b, a);
  }

  // 6. Final fallback: embedded date inside a longer string
  const embedded = s.match(/(\d{1,2}[\s\-\/.]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s\-\/.,]+\d{2,4}|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/i);
  if (embedded && embedded[1] !== s) {
    return parseFlexibleDate(embedded[1]);
  }

  return '';
}

/**
 * Extracts a quote reference number and company/client name from filenames like:
 * "95115-Kaefer Saudi Arabia.xlsx", "UIC_L_5-Majan.pdf", "95014R - Arabian Contracting.pdf"
 */
export function extractRefAndClientFromFilename(filename: string): { ref: string; client: string } {
  const base = String(filename || '')
    .replace(/\.(pdf|xlsx?|csv|docx?)$/i, '')
    .trim();
  if (!base) return { ref: '', client: '' };

  // Pattern 1: UIC_L_95115-Company Name or UIC/L/5 - Company Name
  let m = base.match(/^(UIC)[_\-\/\s]+([A-Z])[_\-\/\s]+(\d+[A-Za-z®]*)\s*[-–—]+\s*(.+)$/i);
  if (m) {
    return {
      ref: `${m[1].toUpperCase()}/${m[2].toUpperCase()}/${m[3]}`,
      client: m[4].replace(/_/g, ' ').replace(/\s+/g, ' ').trim(),
    };
  }

  // Pattern 2: Numeric Quote Ref + Separator + Company Name (e.g., "95115-Kaefer Saudi Arabia", "95014R - Company")
  m = base.match(/^(?:Quote|Quotation|Ref\.?|Q)?[_\-\s]*(\d{3,8}(?:[A-Za-z®]+|\(R\))?)\s*[-–—_]+\s*(.+)$/i);
  if (m) {
    const clientCandidate = m[2].replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    // Avoid treating trailing date-like numbers as company name
    if (clientCandidate && !/^\d{2,4}$/.test(clientCandidate)) {
      return {
        ref: m[1].trim(),
        client: clientCandidate,
      };
    }
  }

  // Pattern 3: Pure reference filename (e.g. "95125", "94979R", "95014®", "UIC_L_5")
  m = base.match(/^(UIC)[_\-\/]+([A-Z])[_\-\/]+(\d+[A-Za-z®]*)$/i);
  if (m) {
    return {
      ref: `${m[1].toUpperCase()}/${m[2].toUpperCase()}/${m[3]}`,
      client: '',
    };
  }

  if (/^\d{3,8}(?:[A-Za-z®]+|\(R\))?$/i.test(base)) {
    return { ref: base, client: '' };
  }

  // Pattern 4: Company Name followed by trailing ref (e.g., "Kaefer Saudi Arabia - 95115")
  m = base.match(/^(.+?)\s*[-–—_]+\s*(\d{3,8}(?:[A-Za-z®]+|\(R\))?)$/);
  if (m) {
    return {
      ref: m[2].trim(),
      client: m[1].replace(/_/g, ' ').replace(/\s+/g, ' ').trim(),
    };
  }

  return { ref: '', client: '' };
}

export function formatDateUK(dateStr: string): string {
  if (!dateStr) return '';
  const iso = parseFlexibleDate(dateStr) || dateStr;
  try {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
      .replace(/ /g, '-');
  } catch {
    return dateStr;
  }
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const iso = parseFlexibleDate(dateStr) || dateStr;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const parts = iso.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(m) && months[m] && !isNaN(d)) {
      return `${d} ${months[m]} ${y}`;
    }
  }
  return dateStr;
}

export function sanitizeFilename(quotation: Partial<Quotation>): string {
  const ref = quotation.ref || 'Quote';
  const client = quotation.client || 'Client';
  return `${ref}-${client}`.replace(/[^\w-]+/g, '_');
}

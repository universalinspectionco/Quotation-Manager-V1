import { LineItem } from '../types/quotation';
import { extractRefAndClientFromFilename, parseFlexibleDate, parseNumber } from '../utils/formatters';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface ParsedQuoteResult {
  file: string;
  client: string;
  date: string;
  ref: string;
  title?: string;
  location?: string;
  attn?: string;
  items: LineItem[];
  error?: string;
}

interface PdfRowText {
  full: string;
  left: string;
  right: string;
  y: number;
  page: number;
}

export class PdfParserService {
  /**
   * Parses an uploaded quotation PDF file and extracts client, date, ref, and item prices.
   */
  public static async parsePdfQuote(file: File): Promise<ParsedQuoteResult> {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is not loaded.');
    }

    if (
      window.pdfjsLib.GlobalWorkerOptions &&
      (!window.pdfjsLib.GlobalWorkerOptions.workerSrc ||
        !/pdf\.worker/i.test(window.pdfjsLib.GlobalWorkerOptions.workerSrc))
    ) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
    }

    const buffer = await file.arrayBuffer();
    const result: ParsedQuoteResult = {
      file: file.name,
      client: '',
      date: '',
      ref: '',
      title: '',
      location: '',
      attn: '',
      items: [],
    };

    try {
      const pdfBytes = new Uint8Array(buffer);
      let pdf: any;
      try {
        pdf = await window.pdfjsLib.getDocument({
          data: pdfBytes,
          disableWorker: typeof window !== 'undefined' && window.location?.protocol === 'file:',
        }).promise;
      } catch {
        pdf = await window.pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          disableWorker: true,
        }).promise;
      }
      const rows: PdfRowText[] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const splitX = viewport.width * 0.54;

        const textContent = await page.getTextContent();
        const items = textContent.items
          .filter((t: any) => t.str && t.str.trim())
          .map((t: any) => ({ x: t.transform[4], y: t.transform[5], s: t.str }))
          .sort((a: any, b: any) => b.y - a.y || a.x - b.x);

        let row: Array<{ x: number; y: number; s: string }> = [];
        let lastY: number | null = null;

        const flushRow = () => {
          if (!row.length) return;
          const sorted = [...row].sort((a, b) => a.x - b.x);
          const full = sorted.map((t) => t.s.trim()).join(' ').replace(/\s+/g, ' ').trim();
          const left = sorted
            .filter((t) => t.x < splitX)
            .map((t) => t.s.trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          const right = sorted
            .filter((t) => t.x >= splitX)
            .map((t) => t.s.trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          rows.push({
            full,
            left,
            right,
            y: sorted[0].y,
            page: p,
          });
          row = [];
        };

        items.forEach((t: any) => {
          if (row.length && lastY !== null && Math.abs(t.y - lastY) > 5) {
            flushRow();
          }
          if (!row.length) lastY = t.y;
          row.push(t);
        });
        flushRow();
      }

      const itemRegex = /^(\d{1,3})\s+(.+?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+(?:\.\d{1,2})?)$/;

      rows.forEach((r, idx) => {
        const line = r.full;
        const left = r.left || line;
        const right = r.right || line;

        // 1. Line Items
        const match = line.match(itemRegex);
        if (match && !/^(total|vat|net|requested)/i.test(match[2])) {
          const qty = parseNumber(match[3]);
          const rate = parseNumber(match[4]);
          const amount = parseNumber(match[5]);

          if (qty > 0 && Math.abs(qty * rate - amount) <= Math.max(1.5, amount * 0.03)) {
            result.items.push({
              d: match[2].trim(),
              q: qty,
              r: rate,
            });
          }
        }

        // 2. Title
        if (!result.title && /^REVISED\s+QUOTATION|^QUOTATION\s+FOR/i.test(line)) {
          result.title = line.trim();
        }

        // 3. Ref No. (search right column first, then full line)
        if (!result.ref) {
          const refTarget = /(?:ref|quote|quotation)/i.test(right) ? right : line;
          const refMatch = refTarget.match(
            /(?:Our\s*)?(?:Quotation|Quote|Ref(?:erence)?)\s*(?:No\.?|Number|#)?\s*[:.\-]+\s*([A-Za-z0-9\/\-_.®()]+)/i
          );
          if (refMatch) {
            const candidate = refMatch[1].trim();
            if (candidate && !/^[:.\-]+$/.test(candidate) && !/^(date|page|to|client)$/i.test(candidate)) {
              result.ref = candidate;
            }
          }
        }

        // 4. Date (search right column first, then full line; supports word+number dates)
        if (!result.date) {
          const dateTarget = /date/i.test(right) ? right : line;
          const dateMatch = dateTarget.match(/(?:Quotation\s*|Quote\s*)?Date\s*[:.\-]+\s*(.+)$/i);
          if (dateMatch) {
            const parsed = parseFlexibleDate(dateMatch[1].trim());
            if (parsed) result.date = parsed;
          }
        }

        // 5. Explicit Company / Client labels
        if (!result.client) {
          const explicitClient = left.match(
            /^(?:Company\s*Name|Client\s*Name|Customer\s*Name|Client|Customer|Company|M\/s\.?|To)\s*[:.\-]+\s*(.+)$/i
          );
          if (explicitClient) {
            const cVal = explicitClient[1].replace(/(?:Ref|Date)\s*[:.].*$/i, '').trim();
            if (cVal && !/^(client|company|n\/a)$/i.test(cVal)) {
              result.client = cVal;
            }
          }
        }

        // 6. Attn To block (standard UIC layout: "Attn To: <person>" followed by "<Company Name>" on next left-column row)
        const attnMatch = left.match(/(?:Attn\.?\s*To|Attention|Attn)\s*[:.\-]*\s*(.*)$/i);
        if (attnMatch) {
          const attnVal = attnMatch[1].replace(/(?:Ref|Date)\s*[:.].*$/i, '').trim();
          if (attnVal && !result.attn) {
            result.attn = attnVal;
          }

          if (!result.client) {
            for (let look = 1; look <= 2 && idx + look < rows.length; look++) {
              const nextLeft = (rows[idx + look].left || '')
                .replace(/Date\s*[:.\-].*$/i, '')
                .replace(/Ref\.?\s*[:.\-].*$/i, '')
                .trim();
              if (!nextLeft) continue;
              if (/^(location|sub|subject|dear\s+sir|tel|fax|email|p\.?o\.?|vat|s\.?\s*no|description|quotation|universal\s+inspection)/i.test(nextLeft)) {
                break;
              }
              if (parseFlexibleDate(nextLeft)) continue;
              result.client = nextLeft;
              break;
            }
          }
        }

        // 7. Location
        if (!result.location) {
          const locMatch = left.match(/^Location\s*[:.\-]+\s*(.+)$/i);
          if (locMatch) {
            result.location = locMatch[1].replace(/(?:Ref|Date)\s*[:.].*$/i, '').trim();
          }
          // Fallback: if client is still missing, inspect the left row right above Location:
          if (!result.client && /^Location\s*[:.\-]/i.test(left) && idx > 0) {
            const prevLeft = (rows[idx - 1].left || '')
              .replace(/Date\s*[:.\-].*$/i, '')
              .replace(/Ref\.?\s*[:.\-].*$/i, '')
              .trim();
            if (
              prevLeft &&
              !/^(attn|attention|ref|date|quotation|universal\s+inspection|m\/s)/i.test(prevLeft) &&
              !parseFlexibleDate(prevLeft)
            ) {
              result.client = prevLeft;
            }
          }
        }
      });

      // Fallback date scan across header rows if Date wasn't explicitly labeled
      if (!result.date) {
        for (const r of rows.slice(0, 25)) {
          const d = parseFlexibleDate(r.right) || parseFlexibleDate(r.full);
          if (d) {
            result.date = d;
            break;
          }
        }
      }

      // If Attn To was filled with company name directly (no separate line below)
      if (!result.client && result.attn) {
        result.client = result.attn;
      }

      // Filename fallback ONLY when Ref or Client couldn't be read from PDF body
      const fromFilename = extractRefAndClientFromFilename(file.name);
      if (!result.ref && fromFilename.ref) {
        result.ref = fromFilename.ref;
      }
      if (!result.client && fromFilename.client) {
        result.client = fromFilename.client;
      }

      if (!result.date) {
        result.date = new Date().toISOString().slice(0, 10);
      }

      if (!result.items.length) {
        result.error = 'No line items could be detected. Note: Scanned/image-only PDFs are not supported.';
      }
    } catch (e: any) {
      result.error = `Could not parse PDF: ${e?.message || 'Unknown error'}`;
    }

    return result;
  }
}

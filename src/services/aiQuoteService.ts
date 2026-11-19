import { CompanyPriceBook, LineItem, Quotation, QuoteType } from '../types/quotation';
import { cleanKey } from '../utils/formatters';

export interface CompactPriceBookEntry {
  description: string;
  size?: string;
  classRating?: string;
  shortCode?: string;
  rate: number;
  client?: string;
}

export interface ExtractedQuoteItem extends LineItem {
  priceSource?: string;
}

export interface ParsedRfqResponse {
  quoteType: QuoteType;
  client: string;
  attn?: string;
  location?: string;
  clientCode?: string;
  via?: string;
  svc?: string;
  dept?: string;
  spDept?: string;
  sub?: string;
  delivery?: string;
  service?: string;
  notes?: string;
  items: ExtractedQuoteItem[];
}

export interface VoiceQuoteResponse {
  transcript: string;
  extracted: ParsedRfqResponse | null;
}

export interface SuggestedItem extends LineItem {
  rationale: string;
  matchedFromPriceBook: boolean;
}

export interface SuggestItemsResponse {
  suggestedSub?: string;
  suggestedSvc?: string;
  suggestedDept?: string;
  items: SuggestedItem[];
}

export interface ResearchResponse {
  answer: string;
  sources: Array<{ title: string; uri: string }>;
  suggestedClause: string;
}

export interface PolishResponse {
  summaryOfChanges: string;
  sub?: string;
  delivery?: string;
  service?: string;
  intro: string;
  tc: string;
  closing: string;
  items: Array<{ index: number; d: string; rm?: string }>;
}

export interface AuditFinding {
  severity: 'critical' | 'warning' | 'suggestion';
  area: string;
  issue: string;
  recommendation: string;
}

export interface AuditResponse {
  overallAssessment: string;
  readyToSend: boolean;
  findings: AuditFinding[];
  suggestedFix?: {
    location?: string;
    attn?: string;
    delivery?: string;
    service?: string;
    vatNote?: string;
    itemRateFixes?: Array<{
      index: number;
      suggestedRate?: number;
      suggestedQty?: number;
      reason: string;
    }>;
  };
}

export interface DraftMessageResponse {
  subject: string;
  body: string;
}

export interface TtsBriefResponse {
  mimeType: string;
  audioBase64: string;
  script: string;
}

export function collectRelevantPriceBookItems(
  priceBooks: Record<string, CompanyPriceBook>,
  clientName: string
): CompactPriceBookEntry[] {
  const clientKey = cleanKey(clientName);
  const entries: CompactPriceBookEntry[] = [];

  if (clientKey && priceBooks[clientKey]) {
    Object.values(priceBooks[clientKey].items).forEach((item) => {
      entries.push({
        description: item.bd || item.d,
        size: item.sz,
        classRating: item.cl,
        shortCode: item.c,
        rate: item.r,
        client: priceBooks[clientKey].name,
      });
    });
  }

  // Include top cross-company references up to 120 total entries so AI also knows UIC baseline catalog
  if (entries.length < 120) {
    Object.entries(priceBooks).forEach(([key, book]) => {
      if (key === clientKey) return;
      Object.values(book.items).forEach((item) => {
        if (entries.length >= 120) return;
        entries.push({
          description: item.bd || item.d,
          size: item.sz,
          classRating: item.cl,
          shortCode: item.c,
          rate: item.r,
          client: book.name,
        });
      });
    });
  }

  return entries;
}

async function postAi<T>(endpoint: string, payload: unknown): Promise<T> {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    throw new Error(
      'AI features require an active server connection. Open the live web app or run the full-stack server ("npm run dev") to use Gemini AI.'
    );
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const raw = await res.text().catch(() => '');
    throw new Error(
      res.ok
        ? 'Unexpected server response format.'
        : `AI endpoint unavailable (${res.status}). ${raw.slice(0, 120)}`
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `AI request failed with status ${res.status}.`);
  }

  return data as T;
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file contents.'));
    reader.readAsDataURL(file);
  });
}

export const AiQuoteService = {
  parseRfq(params: {
    rawText?: string;
    file?: { mimeType: string; data: string };
    quoteTypeHint?: 'auto' | QuoteType;
    priceBookItems?: CompactPriceBookEntry[];
    estimateMissingRates?: boolean;
  }) {
    return postAi<ParsedRfqResponse>('/api/ai/parse-rfq', params);
  },

  voiceToQuote(params: {
    audioBase64: string;
    mimeType: string;
    quoteTypeHint?: 'auto' | QuoteType;
    priceBookItems?: CompactPriceBookEntry[];
  }) {
    return postAi<VoiceQuoteResponse>('/api/ai/voice-quote', params);
  },

  suggestItems(params: {
    scopePrompt: string;
    quoteType: QuoteType;
    clientName?: string;
    priceBookItems?: CompactPriceBookEntry[];
  }) {
    return postAi<SuggestItemsResponse>('/api/ai/suggest-items', params);
  },

  researchStandards(params: {
    query: string;
    quoteType: QuoteType;
    location?: string;
    useSearch?: boolean;
  }) {
    return postAi<ResearchResponse>('/api/ai/research', params);
  },

  polishQuote(params: {
    quote: Quotation;
    mode: 'enterprise_aramco' | 'technical_concise' | 'valve_compliance' | 'custom';
    customInstruction?: string;
  }) {
    return postAi<PolishResponse>('/api/ai/polish', params);
  },

  auditQuote(params: {
    quote: Quotation;
    priceBookItems?: CompactPriceBookEntry[];
  }) {
    return postAi<AuditResponse>('/api/ai/audit', params);
  },

  draftClientMessage(params: {
    quote: Quotation;
    totals: { subtotal: number; vatAmount: number; netTotal: number; totalQty: number };
    channel: 'email_submit' | 'email_followup' | 'whatsapp';
    signer?: string;
    role?: string;
  }) {
    return postAi<DraftMessageResponse>('/api/ai/draft-message', params);
  },

  generateVoiceBrief(params: {
    quote: Quotation;
    totals: { subtotal: number; vatAmount: number; netTotal: number; totalQty: number };
  }) {
    return postAi<TtsBriefResponse>('/api/ai/tts-brief', params);
  },
};

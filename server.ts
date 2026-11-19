import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_TEXT = 'gemini-4-hydrogen';
const MODEL_TRANSCRIBE = 'gemini-3.5-transcribe';
const MODEL_TTS = 'gemini-3.8-flash-lite-tts';

function createAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add a valid key in Settings > Secrets to enable AI quote features.'
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanErrorMessage(rawMessage: string): string {
  const trimmed = (rawMessage || '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore parse failure
    }
  }
  return trimmed;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number; statusCode?: number; message?: string };
      const code = e?.statusCode || e?.status || 0;
      const msg = e?.message || '';
      const isTransient = code === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 900 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

function handleAiError(res: Response, error: unknown, fallbackMessage: string) {
  const err = error as { status?: number; statusCode?: number; message?: string };
  const rawMessage = extractCleanErrorMessage(err?.message || fallbackMessage);
  const status = err?.statusCode || err?.status || 500;

  let friendlyMessage = rawMessage;
  if (rawMessage.includes('PERMISSION_DENIED') || status === 403 || rawMessage.includes('API_KEY_INVALID')) {
    friendlyMessage =
      'Gemini API authentication failed. Please check or update your GEMINI_API_KEY in Settings > Secrets.';
  } else if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    friendlyMessage = rawMessage.includes('quota')
      ? rawMessage
      : 'Gemini API rate limit or quota reached. Please wait a moment and try again, or check Settings > Secrets.';
  }

  console.error('[AI Route Error]', status, rawMessage);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: friendlyMessage,
  });
}

function safeJsonParse<T>(rawText: string | undefined, fallback: T): T {
  if (!rawText) return fallback;
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

interface CompactPriceBookEntry {
  description: string;
  size?: string;
  classRating?: string;
  shortCode?: string;
  rate: number;
  client?: string;
}

function formatPriceBookContext(items: CompactPriceBookEntry[] | undefined): string {
  if (!Array.isArray(items) || items.length === 0) {
    return 'No company price book items provided.';
  }
  return items
    .slice(0, 120)
    .map((it) => {
      const specs = [it.size, it.classRating].filter(Boolean).join(' ');
      const code = it.shortCode ? ` [code:${it.shortCode}]` : '';
      const client = it.client ? ` (${it.client})` : '';
      return `- ${it.description}${specs ? ` ${specs}` : ''}${code}: SAR ${it.rate}${client}`;
    })
    .join('\n');
}

const QUOTE_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    quoteType: {
      type: Type.STRING,
      description: "Must be 'valve' if the inquiry primarily involves valve testing/calibration (PSV, relief valves, safety valves, control valves, pressure class/size), otherwise 'std'.",
    },
    client: { type: Type.STRING, description: 'Client company name if present, else empty string.' },
    attn: { type: Type.STRING, description: 'Attention / recipient contact person name if present.' },
    location: { type: Type.STRING, description: 'Job site or city in Saudi Arabia (e.g., Jubail, Yanbu, Dammam, Riyadh, Ras Tanura).' },
    clientCode: { type: Type.STRING, description: 'Vendor/client reference or RFQ/PR code if mentioned.' },
    via: { type: Type.STRING, description: 'Channel mentioned (Email, WhatsApp, Call, Portal, Hand).' },
    svc: { type: Type.STRING, description: 'Primary service category (Inspection, Calibration, NDT, Lifting Gear, Valve Testing).' },
    dept: { type: Type.STRING, description: 'Department (Quality Control, Mechanical Testing, Lifting Gear, NDT).' },
    spDept: { type: Type.STRING, description: 'Specific plant, division, or unit name if present.' },
    sub: { type: Type.STRING, description: 'Concise subject line summarizing the quotation scope.' },
    delivery: { type: Type.STRING, description: 'Lead time or mobilization timeline if specified or sensible standard (e.g. "As per client schedule / 2-3 working days").' },
    service: { type: Type.STRING, description: 'Location of service execution (e.g. "At Client Site - Jubail" or "At UIC Lab").' },
    notes: { type: Type.STRING, description: 'Short extraction summary or assumptions noted for the estimator.' },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          d: { type: Type.STRING, description: 'Clear engineering line-item description.' },
          q: { type: Type.NUMBER, description: 'Numeric quantity (default 1 if unspecified).' },
          r: { type: Type.NUMBER, description: 'Unit rate in SAR. Use matching Price Book rate when found, otherwise 0 if unknown or market estimate if requested.' },
          sns: { type: Type.STRING, description: 'Comma or newline-separated serial numbers / tag numbers if mentioned, else empty string.' },
          sz: { type: Type.STRING, description: 'Valve or pipe size in inches (e.g., 2", 4", 6") if applicable.' },
          cl: { type: Type.STRING, description: 'Valve pressure class rating (e.g., 150#, 300#, 600#) if applicable.' },
          rm: { type: Type.STRING, description: 'Item remarks (e.g. "Pass or Fail", testing standard, witness note).' },
          priceSource: { type: Type.STRING, description: 'Brief label explaining rate origin, e.g. "Price Book Match", "Client Inquiry", or "Needs Rate".' },
        },
        required: ['d', 'q', 'r'],
      },
    },
  },
  required: ['quoteType', 'client', 'items'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  // 1. Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'uic-quotation-ai' });
  });

  // 2. Parse RFQ / Inquiry (Text, Image screenshot, or PDF document)
  app.post('/api/ai/parse-rfq', async (req: Request, res: Response) => {
    try {
      const { rawText, file, quoteTypeHint = 'auto', priceBookItems = [], estimateMissingRates = true } = req.body ?? {};
      if (!rawText?.trim() && !file?.data) {
        res.status(400).json({ error: 'Provide RFQ text, email content, or an uploaded PDF/image document.' });
        return;
      }

      const ai = createAiClient();
      const pbContext = formatPriceBookContext(priceBookItems);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (file?.data && file?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: String(file.mimeType),
            data: String(file.data),
          },
        });
      }

      parts.push({
        text: [
          `Analyze this client inquiry / RFQ for Universal Inspection Co. Ltd. (UIC, Saudi Arabia).`,
          `Requested quoteType hint: ${quoteTypeHint}.`,
          `Estimate missing rates policy: ${estimateMissingRates ? 'If a line matches the Price Book, use the exact Price Book SAR rate and mark priceSource="Price Book Match". If no match exists, provide a realistic Saudi industrial inspection/calibration/valve-testing SAR unit rate estimate and mark priceSource="AI Estimate (Verify)".' : 'Only use exact Price Book rates or prices explicitly stated in the inquiry; otherwise set r to 0 and priceSource="Needs Rate".'}`,
          `Saved Price Book reference:\n${pbContext}`,
          rawText?.trim() ? `Client Inquiry Text:\n${rawText.trim()}` : 'Extract all details from the attached document/image.',
        ].join('\n\n'),
      });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: { parts },
          config: {
            systemInstruction:
              'You are a senior quotation engineer at Universal Inspection Co. Ltd. (UIC) in Jubail, Saudi Arabia. Convert unstructured RFQs, WhatsApp messages, emails, scanned tables, and PDF inquiries into accurate structured quotation records in SAR. Always preserve tag/serial numbers cleanly.',
            responseMimeType: 'application/json',
            responseSchema: QUOTE_EXTRACTION_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const parsed = safeJsonParse(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned an unreadable extraction payload. Please refine the inquiry and try again.' });
        return;
      }
      res.json(parsed);
    } catch (error) {
      handleAiError(res, error, 'Failed to parse RFQ inquiry.');
    }
  });

  // 3. Voice-to-Quote Dictation (gemini-3.5-transcribe -> structured quote extraction)
  app.post('/api/ai/voice-quote', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType, priceBookItems = [], quoteTypeHint = 'auto' } = req.body ?? {};
      if (!audioBase64 || !mimeType) {
        res.status(400).json({ error: 'Audio recording data and MIME type are required.' });
        return;
      }

      const ai = createAiClient();
      const audioAi = createAiClient('v1beta');

      // Step 1: High-accuracy transcription using gemini-3.5-transcribe
      const transcribeRes = await withRetry(() =>
        audioAi.models.generateContent({
          model: MODEL_TRANSCRIBE,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: String(mimeType),
                  data: String(audioBase64),
                },
              },
              {
                text: 'Transcribe this spoken quotation request or field inspection voice note verbatim. Keep all numbers, quantities, valve sizes (inches), pressure classes (#), serial numbers, Saudi city names, company names, and SAR rates exact.',
              },
            ],
          },
        })
      );

      const transcript = (transcribeRes.text || '').trim();
      if (!transcript) {
        res.status(422).json({ error: 'No speech could be detected in the audio recording. Please speak clearly and try again.' });
        return;
      }

      // Step 2: Convert transcript to structured quotation fields with Price Book matching
      const pbContext = formatPriceBookContext(priceBookItems);
      const structureRes = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [
            `Convert this voice dictation transcript into a structured UIC quotation.`,
            `Quote type hint: ${quoteTypeHint}`,
            `Saved Price Book reference:\n${pbContext}`,
            `Transcript:\n"""${transcript}"""`,
          ].join('\n\n'),
          config: {
            systemInstruction:
              'You are a quotation engineer for Universal Inspection Co. Ltd. (UIC). Extract every requested item, quantity, size, pressure class, serial number, client name, and SAR rate from the transcript. Match saved Price Book rates where applicable, or provide realistic Saudi market SAR estimates marked "AI Estimate (Verify)".',
            responseMimeType: 'application/json',
            responseSchema: QUOTE_EXTRACTION_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const extracted = safeJsonParse(structureRes.text, null);
      res.json({ transcript, extracted });
    } catch (error) {
      handleAiError(res, error, 'Failed to process voice-to-quote dictation.');
    }
  });

  // 4. Smart Scope & Line-Item Recommender
  app.post('/api/ai/suggest-items', async (req: Request, res: Response) => {
    try {
      const { scopePrompt, quoteType = 'std', clientName = '', priceBookItems = [] } = req.body ?? {};
      if (!scopePrompt?.trim()) {
        res.status(400).json({ error: 'Describe the inspection, calibration, or valve testing scope first.' });
        return;
      }

      const ai = createAiClient();
      const pbContext = formatPriceBookContext(priceBookItems);

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [
            `Client: ${clientName || 'Prospective Client'}`,
            `Current Quote Mode: ${quoteType === 'valve' ? 'Valve Testing & Calibration (include Size in inches and Class rating like 150#, 300#)' : 'Standard Inspection / Calibration / NDT Services'}`,
            `Saved Price Book items:\n${pbContext}`,
            `User Scope Request:\n${scopePrompt.trim()}`,
          ].join('\n\n'),
        config: {
          systemInstruction:
            'You are a senior proposal engineer at Universal Inspection Co. Ltd. (UIC, Saudi Arabia). Break down the scope into practical, billable line items ready for a formal quotation. Reuse exact saved Price Book items and rates whenever similar services appear in the Price Book; otherwise suggest realistic SAR rates for Saudi third-party inspection/calibration work. Also suggest mobilization/certification line items if clearly warranted.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedSub: { type: Type.STRING, description: 'Recommended subject line or scope summary.' },
              suggestedSvc: { type: Type.STRING, description: 'Service type label e.g. Inspection, Calibration, NDT, Valve Testing.' },
              suggestedDept: { type: Type.STRING, description: 'Department label e.g. Quality Control, Lifting Gear, Mechanical Testing.' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    d: { type: Type.STRING, description: 'Technical line-item description.' },
                    q: { type: Type.NUMBER, description: 'Recommended quantity.' },
                    r: { type: Type.NUMBER, description: 'Recommended unit rate in SAR.' },
                    sz: { type: Type.STRING, description: 'Valve size if valve quote (e.g. 2", 4"), else empty.' },
                    cl: { type: Type.STRING, description: 'Valve pressure class if valve quote (e.g. 300#), else empty.' },
                    rm: { type: Type.STRING, description: 'Optional technical remark (e.g. API 527 / Pass or Fail).' },
                    rationale: { type: Type.STRING, description: 'Short 1-line note explaining why this item/rate is suggested.' },
                    matchedFromPriceBook: { type: Type.BOOLEAN, description: 'True if rate matched from saved Price Book.' },
                  },
                  required: ['d', 'q', 'r', 'rationale', 'matchedFromPriceBook'],
                },
              },
            },
            required: ['items'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
      );

      const parsed = safeJsonParse(response.text, { items: [] });
      res.json(parsed);
    } catch (error) {
      handleAiError(res, error, 'Failed to generate scope line items.');
    }
  });

  // 5. Standards & Equipment Research with optional Google Search Grounding
  app.post('/api/ai/research', async (req: Request, res: Response) => {
    try {
      const { query, quoteType = 'std', location = '', useSearch = true } = req.body ?? {};
      if (!query?.trim()) {
        res.status(400).json({ error: 'Enter a standard, valve spec, equipment type, or testing query.' });
        return;
      }

      const ai = createAiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [
            `Inspection / Calibration Context: ${quoteType === 'valve' ? 'Industrial Valve Testing & Calibration' : 'Industrial Inspection, NDT & Instrument Calibration'}`,
            location ? `Site / Region: ${location}, Saudi Arabia` : 'Region: Saudi Arabia (industrial & oil/gas standards)',
            `Query: ${query.trim()}`,
            `Respond concisely in Markdown with:\n1. Direct Technical Answer & Applicable Standards (ASME / API / ISO / BS / Saudi Aramco GI-SAEP where relevant)\n2. Recommended Quote Clause (one clean paragraph starting with "Suggested Clause:" that can be pasted into Quotation Terms or Remarks).`,
          ].join('\n\n'),
          config: useSearch
            ? {
                tools: [{ googleSearch: {} }],
              }
            : {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
        })
      );

      const text = (response.text || '').trim();
      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .map((c) => c?.web)
        .filter((w): w is { uri?: string; title?: string } => Boolean(w?.uri))
        .map((w) => ({
          title: w.title || w.uri || 'Reference Source',
          uri: String(w.uri),
        }));

      const clauseMatch = text.match(/Suggested Clause:\s*([\s\S]+?)(?:\n\n|$)/i);
      const suggestedClause = clauseMatch ? clauseMatch[1].replace(/^[>"*\s]+|[*"\s]+$/g, '').trim() : '';

      res.json({ answer: text, sources, suggestedClause });
    } catch (error) {
      handleAiError(res, error, 'Failed to look up standards via Google Search.');
    }
  });

  // 6. Polish Commercial Language & Technical Descriptions
  app.post('/api/ai/polish', async (req: Request, res: Response) => {
    try {
      const { quote, mode = 'enterprise_aramco', customInstruction = '' } = req.body ?? {};
      if (!quote) {
        res.status(400).json({ error: 'Quotation data is required.' });
        return;
      }

      const ai = createAiClient();
      const modeInstructions: Record<string, string> = {
        enterprise_aramco:
          'Elevate all wording to formal Saudi Aramco / SABIC Tier-1 vendor quotation quality: clear ISO/ASME professionalism, crisp scope clarity, unambiguous commercial conditions.',
        technical_concise:
          'Tighten descriptions and terms to be crisp, clear, and concise engineering bullet statements without fluff.',
        valve_compliance:
          'Strengthen valve testing descriptions and terms with clear hydro/pneumatic seat leakage, set-pressure verification, witness inspection, and Pass/Fail billing clarity (API 527 / API 598 style).',
        custom: customInstruction?.trim() || 'Improve clarity, formatting, and commercial professionalism.',
      };

      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: [
          `Target Polish Style (${mode}): ${modeInstructions[mode] || modeInstructions.enterprise_aramco}`,
          `Important Formatting Rule for Terms & Conditions (tc): Keep section headings on their own line ending with a colon (e.g. "Terms & Conditions:", "Payment Terms:", "Validity:") because our PDF generator renders colon headings with blue divider bars.`,
          `Current Quote Data:\n${JSON.stringify({
            type: quote.type,
            client: quote.client,
            location: quote.location,
            sub: quote.sub || '',
            delivery: quote.delivery || '',
            service: quote.service || '',
            intro: quote.intro || '',
            tc: quote.tc || '',
            closing: quote.closing || '',
            items: (quote.items || []).map((it: { d?: string; rm?: string }, idx: number) => ({
              index: idx,
              d: it.d || '',
              rm: it.rm || '',
            })),
          })}`,
        ].join('\n\n'),
        config: {
          systemInstruction:
            'You are a commercial proposals manager for Universal Inspection Co. Ltd. (UIC). Refine quotation copy while preserving all numeric values, client names, references, and colon-terminated headings.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryOfChanges: { type: Type.STRING, description: 'Concise 1-2 sentence summary of improvements made.' },
              sub: { type: Type.STRING },
              delivery: { type: Type.STRING },
              service: { type: Type.STRING },
              intro: { type: Type.STRING },
              tc: { type: Type.STRING },
              closing: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER },
                    d: { type: Type.STRING },
                    rm: { type: Type.STRING },
                  },
                  required: ['index', 'd'],
                },
              },
            },
            required: ['summaryOfChanges', 'intro', 'tc', 'closing', 'items'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = safeJsonParse(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'Could not parse polished output. Please try again.' });
        return;
      }
      res.json(parsed);
    } catch (error) {
      handleAiError(res, error, 'Failed to polish quotation text.');
    }
  });

  // 7. Pre-Send Quote Audit & Sanity Check
  app.post('/api/ai/audit', async (req: Request, res: Response) => {
    try {
      const { quote, priceBookItems = [] } = req.body ?? {};
      if (!quote) {
        res.status(400).json({ error: 'Quotation data is required for audit.' });
        return;
      }

      const ai = createAiClient();
      const pbContext = formatPriceBookContext(priceBookItems);

      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: [
          `Audit this UIC quotation draft before sending to the client.`,
          `Company Saved Price Book:\n${pbContext}`,
          `Draft Quotation:\n${JSON.stringify(quote)}`,
        ].join('\n\n'),
        config: {
          systemInstruction:
            'You are a QA & Commercial Proposal Reviewer at Universal Inspection Co. Ltd. Check for: (1) missing client, attn, location, ref, or empty descriptions; (2) zero-rate or zero-qty items; (3) serial numbers count mismatching item quantity; (4) deviations from saved company Price Book rates; (5) valve quotes missing size (sz) or class (cl); (6) missing VAT note or commercial terms; (7) grammar/clarity gaps. Provide actionable findings and optional clean patches (only include patch fields you actually recommend changing).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallAssessment: { type: Type.STRING, description: 'Clear 1-2 sentence assessment of readiness.' },
              readyToSend: { type: Type.BOOLEAN },
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, description: "'critical' | 'warning' | 'suggestion'" },
                    area: { type: Type.STRING, description: 'Section e.g. Header, Line Item #2, Pricing, Terms' },
                    issue: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                  },
                  required: ['severity', 'area', 'issue', 'recommendation'],
                },
              },
              suggestedFix: {
                type: Type.OBJECT,
                description: 'Optional safe auto-fix overrides for header metadata or Price Book rate sync.',
                properties: {
                  location: { type: Type.STRING },
                  attn: { type: Type.STRING },
                  delivery: { type: Type.STRING },
                  service: { type: Type.STRING },
                  vatNote: { type: Type.STRING },
                  itemRateFixes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        index: { type: Type.INTEGER },
                        suggestedRate: { type: Type.NUMBER },
                        suggestedQty: { type: Type.NUMBER },
                        reason: { type: Type.STRING },
                      },
                      required: ['index', 'reason'],
                    },
                  },
                },
              },
            },
            required: ['overallAssessment', 'readyToSend', 'findings'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });

      const parsed = safeJsonParse(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'Audit response could not be parsed. Please retry.' });
        return;
      }
      res.json(parsed);
    } catch (error) {
      handleAiError(res, error, 'Failed to audit quotation.');
    }
  });

  // 8. Draft Client Cover Email / PO Follow-Up / WhatsApp Summary
  app.post('/api/ai/draft-message', async (req: Request, res: Response) => {
    try {
      const { quote, totals, channel = 'email_submit', signer = '', role = '' } = req.body ?? {};
      if (!quote) {
        res.status(400).json({ error: 'Quotation details are required.' });
        return;
      }

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: [
          `Channel/Purpose: ${channel}`,
          `Signer: ${signer || 'Sales & Estimation Team'}${role ? ` (${role})` : ''}, Universal Inspection Co. Ltd. (UIC)`,
          `Totals (SAR): Subtotal=${totals?.subtotal ?? 0}, VAT=${totals?.vatAmount ?? 0}, Net Total=${totals?.netTotal ?? 0}`,
          `Quote Details:\n${JSON.stringify({
            ref: quote.ref,
            date: quote.date,
            type: quote.type,
            client: quote.client,
            attn: quote.attn,
            location: quote.location,
            sub: quote.sub,
            delivery: quote.delivery,
            service: quote.service,
            vat: quote.vat,
            status: quote.status,
            items: (quote.items || []).map((i: { d: string; q: number; r: number; sz?: string; cl?: string }) => ({
              description: i.d,
              size: i.sz,
              class: i.cl,
              qty: i.q,
              rate: i.r,
            })),
          })}`,
        ].join('\n\n'),
        config: {
          systemInstruction:
            'Draft clear, polite, B2B Saudi industrial correspondence on behalf of Universal Inspection Co. Ltd. (UIC). For email_submit: write a formal quotation cover email referencing the Ref #, scope highlights, net total in SAR, validity, and attachment. For email_followup: polite check-in regarding PO/approval. For whatsapp: clean formatted WhatsApp message with key figures and Ref #.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING, description: 'Email subject line (or header title for WhatsApp).' },
              body: { type: Type.STRING, description: 'Complete ready-to-send message body.' },
            },
            required: ['subject', 'body'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = safeJsonParse(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'Failed to draft message.' });
        return;
      }
      res.json(parsed);
    } catch (error) {
      handleAiError(res, error, 'Failed to draft client message.');
    }
  });

  // 9. Spoken Audio Verification Brief (gemini-3.8-flash-lite-tts)
  app.post('/api/ai/tts-brief', async (req: Request, res: Response) => {
    try {
      const { quote, totals } = req.body ?? {};
      if (!quote) {
        res.status(400).json({ error: 'Quotation details are required.' });
        return;
      }

      const ai = createAiClient('v1beta');
      const itemCount = Array.isArray(quote.items) ? quote.items.filter((i: { d?: string }) => i?.d?.trim()).length : 0;
      const net = Number(totals?.netTotal || 0).toFixed(2);
      const sub = Number(totals?.subtotal || 0).toFixed(2);
      const vatAmt = Number(totals?.vatAmount || 0).toFixed(2);

      const script = [
        `Quotation brief for reference ${quote.ref || 'draft'}.`,
        `Client: ${quote.client || 'not yet specified'}${quote.location ? `, located in ${quote.location}` : ''}.`,
        `${itemCount} ${itemCount === 1 ? 'line item' : 'line items'}, totaling ${totals?.totalQty ?? 0} units.`,
        `Subtotal is ${sub} Saudi Riyals, plus ${quote.vat ?? 15} percent VAT of ${vatAmt} Riyals, bringing the net total to ${net} Saudi Riyals.`,
        `Current pipeline status is ${quote.status || 'Draft'}.`,
      ].join(' ');

      const tryGenerateTts = async (includeSpeechMetadata: boolean, includeSpeechConfig: boolean) => {
        return ai.models.generateContent({
          model: MODEL_TTS,
          contents: includeSpeechMetadata
            ? [
                {
                  role: 'user',
                  parts: [
                    {
                      text: script,
                      speechMetadata: {
                        style: 'Clear, crisp, professional engineering briefing',
                      },
                    },
                  ],
                },
              ]
            : script,
          config: {
            responseModalities: ['AUDIO'],
            ...(includeSpeechConfig
              ? {
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                  },
                }
              : {}),
          },
        });
      };

      let response;
      try {
        response = await withRetry(() => tryGenerateTts(true, true));
      } catch (ttsErr) {
        const msg = (ttsErr as Error)?.message || '';
        if (msg.includes('Unknown name') || msg.includes('speechMetadata') || msg.includes('speechConfig')) {
          try {
            response = await withRetry(() => tryGenerateTts(false, true));
          } catch (ttsErr2) {
            const msg2 = (ttsErr2 as Error)?.message || '';
            if (msg2.includes('Unknown name') || msg2.includes('speechConfig')) {
              response = await withRetry(() => tryGenerateTts(false, false));
            } else {
              throw ttsErr2;
            }
          }
        } else {
          throw ttsErr;
        }
      }

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ error: 'Audio synthesis returned empty audio data.' });
        return;
      }

      res.json({
        mimeType: 'audio/wav',
        audioBase64,
        script,
      });
    } catch (error) {
      handleAiError(res, error, 'Failed to synthesize voice brief.');
    }
  });

  // Dev Vite middleware vs Production static serving
  const isProd =
    process.env.NODE_ENV === 'production' ||
    !fs.existsSync(path.resolve(__dirname, 'node_modules/vite'));

  if (!isProd) {
    const enableHmr = process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    if (!enableHmr) {
      process.env.DISABLE_HMR = 'true';
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr,
        ws: enableHmr ? undefined : false,
        watch: enableHmr ? {} : null,
      },
      appType: 'spa',
    });

    if (!enableHmr) {
      app.use('/@vite/client', (req: Request, res: Response, next) => {
        delete req.headers['accept-encoding'];
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        res.write = ((chunk: unknown) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          return true;
        }) as typeof res.write;
        res.end = ((chunk?: unknown) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === 304 || body.length === 0) {
            return origEnd();
          }
          const patched = body
            .replace(
              /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
              'let wsTransport = { connect() {}, disconnect() {}, send() {} };'
            )
            .replace('console.debug("[vite] connecting...");', '');
          res.setHeader('Content-Length', Buffer.byteLength(patched));
          return origEnd(patched);
        }) as typeof res.end;
        next();
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UIC Quotation Manager] Server running at http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

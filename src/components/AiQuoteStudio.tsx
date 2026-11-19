import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  FileSearch,
  Mic,
  Square,
  ListPlus,
  Globe,
  Wand2,
  ShieldCheck,
  Mail,
  Volume2,
  Upload,
  Check,
  Copy,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  CompanyPriceBook,
  LineItem,
  Quotation,
  QuoteType,
  Settings,
} from '../types/quotation';
import {
  AiQuoteService,
  AuditResponse,
  DraftMessageResponse,
  ExtractedQuoteItem,
  ParsedRfqResponse,
  PolishResponse,
  ResearchResponse,
  SuggestItemsResponse,
  collectRelevantPriceBookItems,
  fileToBase64,
} from '../services/aiQuoteService';
import { calculateTotals, formatCurrency } from '../utils/formatters';

export type AiStudioTab = 'rfq' | 'voice' | 'scope' | 'research' | 'polish' | 'outreach';

interface AiQuoteStudioProps {
  isOpen: boolean;
  activeTab: AiStudioTab;
  onChangeTab: (tab: AiStudioTab) => void;
  onClose: () => void;
  quote: Quotation;
  settings: Settings;
  priceBooks: Record<string, CompanyPriceBook>;
  onUpdateQuote: React.Dispatch<React.SetStateAction<Quotation>>;
}

const STUDIO_TABS: Array<{ id: AiStudioTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'rfq', label: 'RFQ Scanner', icon: FileSearch },
  { id: 'voice', label: 'Voice Dictate', icon: Mic },
  { id: 'scope', label: 'Scope Builder', icon: ListPlus },
  { id: 'research', label: 'Standards Search', icon: Globe },
  { id: 'polish', label: 'Polish & Audit', icon: ShieldCheck },
  { id: 'outreach', label: 'Email & Voice Brief', icon: Mail },
];

export const AiQuoteStudio: React.FC<AiQuoteStudioProps> = ({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  quote,
  settings,
  priceBooks,
  onUpdateQuote,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');

  // 1. RFQ Scanner State
  const [rfqText, setRfqText] = useState<string>('');
  const [rfqFile, setRfqFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [rfqTypeHint, setRfqTypeHint] = useState<'auto' | QuoteType>('auto');
  const [estimateMissingRates, setEstimateMissingRates] = useState<boolean>(true);
  const [rfqResult, setRfqResult] = useState<ParsedRfqResponse | null>(null);
  const [rfqSelectedIndices, setRfqSelectedIndices] = useState<Record<number, boolean>>({});
  const rfqFileInputRef = useRef<HTMLInputElement>(null);

  // 2. Voice-to-Quote State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceExtracted, setVoiceExtracted] = useState<ParsedRfqResponse | null>(null);
  const [voiceSelectedIndices, setVoiceSelectedIndices] = useState<Record<number, boolean>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // 3. Scope Builder State
  const [scopePrompt, setScopePrompt] = useState<string>('');
  const [scopeResult, setScopeResult] = useState<SuggestItemsResponse | null>(null);
  const [scopeSelectedIndices, setScopeSelectedIndices] = useState<Record<number, boolean>>({});

  // 4. Standards & Rate Search Grounding State
  const [researchQuery, setResearchQuery] = useState<string>('');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(true);
  const [researchResult, setResearchResult] = useState<ResearchResponse | null>(null);

  // 5. Polish & Audit State
  const [polishMode, setPolishMode] = useState<'enterprise_aramco' | 'technical_concise' | 'valve_compliance' | 'custom'>('enterprise_aramco');
  const [customPolishInstruction, setCustomPolishInstruction] = useState<string>('');
  const [polishResult, setPolishResult] = useState<PolishResponse | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);

  // 6. Outreach & Voice Brief State
  const [messageChannel, setMessageChannel] = useState<'email_submit' | 'email_followup' | 'whatsapp'>('email_submit');
  const [draftedMessage, setDraftedMessage] = useState<DraftMessageResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string>('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>('');
  const [ttsScript, setTtsScript] = useState<string>('');

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const totals = calculateTotals(quote);

  const notify = (msg: string) => {
    setErrorMsg('');
    setStatusMsg(msg);
  };

  const fail = (err: unknown, fallback: string) => {
    setStatusMsg('');
    setErrorMsg((err as Error)?.message || fallback);
  };

  // Helper to apply extracted quote data (from RFQ Scanner or Voice Dictation)
  const applyExtractedQuote = (
    data: ParsedRfqResponse,
    selectedMap: Record<number, boolean>,
    mode: 'replace' | 'append'
  ) => {
    const pickedItems: LineItem[] = (data.items || [])
      .filter((_, idx) => selectedMap[idx] !== false)
      .map((it: ExtractedQuoteItem) => ({
        d: it.d || '',
        q: Number(it.q) || 1,
        r: Number(it.r) || 0,
        sns: it.sns || '',
        sz: it.sz || (data.quoteType === 'valve' ? '2"' : ''),
        cl: it.cl || (data.quoteType === 'valve' ? '150#' : ''),
        rm: it.rm || '',
      }));

    if (pickedItems.length === 0 && mode === 'append') {
      setErrorMsg('Select at least one extracted line item to append.');
      return;
    }

    onUpdateQuote((prev) => {
      const targetType: QuoteType = data.quoteType === 'valve' ? 'valve' : data.quoteType === 'std' ? 'std' : prev.type;
      const shouldSwitchType = mode === 'replace' && targetType !== prev.type;
      const isBlankFirst =
        prev.items.length === 1 && !prev.items[0].d.trim() && !Number(prev.items[0].r);

      const nextItems =
        mode === 'replace'
          ? pickedItems.length > 0
            ? pickedItems
            : prev.items
          : isBlankFirst
          ? pickedItems
          : [...prev.items, ...pickedItems];

      const hasRemarks = nextItems.some((i) => Boolean(i.rm?.trim()));

      return {
        ...prev,
        type: mode === 'replace' ? targetType : prev.type,
        title: shouldSwitchType ? (targetType === 'valve' ? settings.titleV : settings.title) : prev.title,
        tc: shouldSwitchType ? (targetType === 'valve' ? settings.tcv : settings.tc) : prev.tc,
        client: data.client?.trim() ? (mode === 'replace' || !prev.client.trim() ? data.client.trim() : prev.client) : prev.client,
        attn: data.attn?.trim() ? (mode === 'replace' || !prev.attn.trim() ? data.attn.trim() : prev.attn) : prev.attn,
        location: data.location?.trim() ? (mode === 'replace' || !prev.location.trim() ? data.location.trim() : prev.location) : prev.location,
        clientCode: data.clientCode?.trim() ? (mode === 'replace' || !prev.clientCode?.trim() ? data.clientCode.trim() : prev.clientCode) : prev.clientCode,
        via: data.via?.trim() ? (mode === 'replace' || !prev.via?.trim() ? data.via.trim() : prev.via) : prev.via,
        svc: data.svc?.trim() ? (mode === 'replace' || !prev.svc?.trim() ? data.svc.trim() : prev.svc) : prev.svc,
        dept: data.dept?.trim() ? (mode === 'replace' || !prev.dept?.trim() ? data.dept.trim() : prev.dept) : prev.dept,
        spDept: data.spDept?.trim() ? (mode === 'replace' || !prev.spDept?.trim() ? data.spDept.trim() : prev.spDept) : prev.spDept,
        sub: data.sub?.trim() ? (mode === 'replace' || !prev.sub?.trim() ? data.sub.trim() : prev.sub) : prev.sub,
        delivery: data.delivery?.trim() && mode === 'replace' ? data.delivery.trim() : prev.delivery,
        service: data.service?.trim() && mode === 'replace' ? data.service.trim() : prev.service,
        notes: data.notes?.trim() && !prev.notes.trim() ? data.notes.trim() : prev.notes,
        showRm: hasRemarks || prev.showRm,
        items: nextItems,
      };
    });

    notify(
      mode === 'replace'
        ? `Populated quote draft with ${pickedItems.length} item(s) and extracted client details.`
        : `Appended ${pickedItems.length} item(s) to quote.`
    );
  };

  // --- Handlers ---
  const handleRfqFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setErrorMsg('');

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt') || lower.endsWith('.csv')) {
        const text = await file.text();
        setRfqText((prev) => (prev ? `${prev}\n\n${text}` : text));
        setRfqFile(null);
        notify(`Loaded text from ${file.name}. Click "Scan & Extract Quote" to run AI extraction.`);
        return;
      }

      const data = await fileToBase64(file);
      const mimeType =
        file.type ||
        (lower.endsWith('.pdf')
          ? 'application/pdf'
          : lower.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg');
      setRfqFile({ name: file.name, mimeType, data });
      notify(`Attached ${file.name} (${(file.size / 1024).toFixed(0)} KB). Ready to scan.`);
    } catch (err) {
      fail(err, 'Could not read attached RFQ file.');
    }
  };

  const handleRunRfqScan = async () => {
    if (!rfqText.trim() && !rfqFile) {
      setErrorMsg('Paste client RFQ text or attach a PDF/image inquiry first.');
      return;
    }
    setBusyAction('rfq');
    setErrorMsg('');
    setStatusMsg('');

    try {
      const pbItems = collectRelevantPriceBookItems(priceBooks, quote.client);
      const res = await AiQuoteService.parseRfq({
        rawText: rfqText,
        file: rfqFile ? { mimeType: rfqFile.mimeType, data: rfqFile.data } : undefined,
        quoteTypeHint: rfqTypeHint,
        priceBookItems: pbItems,
        estimateMissingRates,
      });
      setRfqResult(res);
      const sel: Record<number, boolean> = {};
      (res.items || []).forEach((_, idx) => {
        sel[idx] = true;
      });
      setRfqSelectedIndices(sel);
      notify(`Extracted ${res.items?.length || 0} line item(s) for ${res.client || 'draft quote'}.`);
    } catch (err) {
      fail(err, 'Failed to extract quote from RFQ.');
    } finally {
      setBusyAction(null);
    }
  };

  const processAudioBlob = async (blob: Blob, mimeType: string) => {
    setBusyAction('voice');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const audioBase64 = await fileToBase64(blob);
      const pbItems = collectRelevantPriceBookItems(priceBooks, quote.client);
      const res = await AiQuoteService.voiceToQuote({
        audioBase64,
        mimeType,
        quoteTypeHint: 'auto',
        priceBookItems: pbItems,
      });
      setVoiceTranscript(res.transcript || '');
      setVoiceExtracted(res.extracted || null);
      const sel: Record<number, boolean> = {};
      (res.extracted?.items || []).forEach((_, idx) => {
        sel[idx] = true;
      });
      setVoiceSelectedIndices(sel);
      notify(`Transcribed audio and extracted ${res.extracted?.items?.length || 0} line item(s).`);
    } catch (err) {
      fail(err, 'Voice transcription failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setErrorMsg('');
    setStatusMsg('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Microphone recording is not supported in this browser. Upload an audio file instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = recorder.mimeType?.split(';')[0] || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size > 0) {
          await processAudioBlob(blob, mime);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      fail(err, 'Microphone access was denied or unavailable.');
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processAudioBlob(file, file.type || 'audio/mp3');
  };

  const handleSuggestScope = async (overridePrompt?: string) => {
    const text = (overridePrompt ?? scopePrompt).trim();
    if (!text) {
      setErrorMsg('Describe the services, equipment, or valve sizes to quote.');
      return;
    }
    if (overridePrompt) setScopePrompt(overridePrompt);

    setBusyAction('scope');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const pbItems = collectRelevantPriceBookItems(priceBooks, quote.client);
      const res = await AiQuoteService.suggestItems({
        scopePrompt: text,
        quoteType: quote.type,
        clientName: quote.client,
        priceBookItems: pbItems,
      });
      setScopeResult(res);
      const sel: Record<number, boolean> = {};
      (res.items || []).forEach((_, idx) => {
        sel[idx] = true;
      });
      setScopeSelectedIndices(sel);
      notify(`Generated ${res.items?.length || 0} scope line item(s).`);
    } catch (err) {
      fail(err, 'Failed to generate scope items.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddScopeItems = () => {
    if (!scopeResult) return;
    const picked = scopeResult.items
      .filter((_, idx) => scopeSelectedIndices[idx] !== false)
      .map<LineItem>((it) => ({
        d: it.d,
        q: Number(it.q) || 1,
        r: Number(it.r) || 0,
        sns: '',
        sz: it.sz || '',
        cl: it.cl || '',
        rm: it.rm || '',
      }));

    if (!picked.length) {
      setErrorMsg('Select at least one suggested item.');
      return;
    }

    onUpdateQuote((prev) => {
      const isBlankFirst =
        prev.items.length === 1 && !prev.items[0].d.trim() && !Number(prev.items[0].r);
      const nextItems = isBlankFirst ? picked : [...prev.items, ...picked];
      const hasRm = nextItems.some((i) => Boolean(i.rm?.trim()));
      return {
        ...prev,
        sub: prev.sub?.trim() ? prev.sub : scopeResult.suggestedSub || prev.sub,
        svc: prev.svc?.trim() ? prev.svc : scopeResult.suggestedSvc || prev.svc,
        dept: prev.dept?.trim() ? prev.dept : scopeResult.suggestedDept || prev.dept,
        showRm: hasRm || prev.showRm,
        items: nextItems,
      };
    });
    notify(`Added ${picked.length} AI-recommended item(s) to quote.`);
  };

  const handleRunResearch = async (overrideQuery?: string, searchOverride?: boolean) => {
    const q = (overrideQuery ?? researchQuery).trim();
    if (!q) {
      setErrorMsg('Enter an inspection standard, calibration method, or technical query.');
      return;
    }
    if (overrideQuery) setResearchQuery(overrideQuery);
    const useSearch = searchOverride !== undefined ? searchOverride : useSearchGrounding;

    setBusyAction('research');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await AiQuoteService.researchStandards({
        query: q,
        quoteType: quote.type,
        location: quote.location,
        useSearch,
      });
      setResearchResult(res);
      notify(useSearch ? 'Retrieved web-grounded standards guidance and references.' : 'Retrieved engineering standards guidance.');
    } catch (err) {
      fail(err, 'Standards lookup failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunPolish = async () => {
    setBusyAction('polish');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await AiQuoteService.polishQuote({
        quote,
        mode: polishMode,
        customInstruction: customPolishInstruction,
      });
      setPolishResult(res);
      notify('Generated polished quotation wording preview.');
    } catch (err) {
      fail(err, 'Failed to polish quotation text.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyPolish = () => {
    if (!polishResult) return;
    onUpdateQuote((prev) => {
      const itemMap = new Map(polishResult.items.map((it) => [it.index, it]));
      const nextItems = prev.items.map((it, idx) => {
        const polished = itemMap.get(idx);
        if (!polished) return it;
        return {
          ...it,
          d: polished.d || it.d,
          rm: polished.rm !== undefined && polished.rm !== '' ? polished.rm : it.rm,
        };
      });

      return {
        ...prev,
        sub: polishResult.sub !== undefined && polishResult.sub !== '' ? polishResult.sub : prev.sub,
        delivery: polishResult.delivery || prev.delivery,
        service: polishResult.service || prev.service,
        intro: polishResult.intro || prev.intro,
        tc: polishResult.tc || prev.tc,
        closing: polishResult.closing || prev.closing,
        items: nextItems,
      };
    });
    notify('Applied polished wording to intro, line descriptions, terms, and closing.');
  };

  const handleRunAudit = async () => {
    setBusyAction('audit');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const pbItems = collectRelevantPriceBookItems(priceBooks, quote.client);
      const res = await AiQuoteService.auditQuote({
        quote,
        priceBookItems: pbItems,
      });
      setAuditResult(res);
      notify(res.readyToSend ? 'Pre-send audit passed with no critical blockers.' : 'Audit completed — review recommendations below.');
    } catch (err) {
      fail(err, 'Failed to audit quotation.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyAuditFixes = () => {
    if (!auditResult?.suggestedFix) return;
    const fix = auditResult.suggestedFix;
    onUpdateQuote((prev) => {
      const nextItems = [...prev.items];
      (fix.itemRateFixes || []).forEach((rf) => {
        if (nextItems[rf.index]) {
          nextItems[rf.index] = {
            ...nextItems[rf.index],
            ...(rf.suggestedRate !== undefined && rf.suggestedRate > 0 ? { r: rf.suggestedRate } : {}),
            ...(rf.suggestedQty !== undefined && rf.suggestedQty > 0 ? { q: rf.suggestedQty } : {}),
          };
        }
      });
      return {
        ...prev,
        location: !prev.location.trim() && fix.location ? fix.location : prev.location,
        attn: !prev.attn.trim() && fix.attn ? fix.attn : prev.attn,
        delivery: !prev.delivery.trim() && fix.delivery ? fix.delivery : prev.delivery,
        service: !prev.service.trim() && fix.service ? fix.service : prev.service,
        vatNote: !prev.vatNote?.trim() && fix.vatNote ? fix.vatNote : prev.vatNote,
        items: nextItems,
      };
    });
    notify('Applied recommended safe patches to draft quote.');
  };

  const handleDraftMessage = async (channelOverride?: 'email_submit' | 'email_followup' | 'whatsapp') => {
    const ch = channelOverride || messageChannel;
    if (channelOverride) setMessageChannel(channelOverride);
    setBusyAction('message');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await AiQuoteService.draftClientMessage({
        quote,
        totals,
        channel: ch,
        signer: settings.signer,
        role: settings.role,
      });
      setDraftedMessage(res);
      notify('Drafted client correspondence.');
    } catch (err) {
      fail(err, 'Failed to draft client message.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateTtsBrief = async () => {
    setBusyAction('tts');
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await AiQuoteService.generateVoiceBrief({
        quote,
        totals,
      });
      setTtsAudioUrl(`data:${res.mimeType};base64,${res.audioBase64}`);
      setTtsScript(res.script);
      notify('Spoken verification brief is ready to play.');
    } catch (err) {
      fail(err, 'Failed to synthesize voice brief.');
    } finally {
      setBusyAction(null);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(''), 1800);
    } catch {
      setErrorMsg('Clipboard access unavailable. Select and copy manually.');
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderExtractedPreview = (
    data: ParsedRfqResponse,
    selectedMap: Record<number, boolean>,
    setSelectedMap: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
  ) => (
    <div className="mt-4 pt-4 border-t border-[var(--border,rgba(148,163,184,0.25))] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-900">
            {data.client || 'Unspecified Client'}
            <span className="text-slate-400 font-normal mx-1.5">&middot;</span>
            <span className="font-mono text-blue-700 uppercase">
              {data.quoteType === 'valve' ? 'Valve Testing' : 'Standard Services'}
            </span>
          </div>
          <div className="text-slate-500">
            {[data.attn && `Attn: ${data.attn}`, data.location && `Site: ${data.location}`, data.sub]
              .filter(Boolean)
              .join(' · ') || 'Review extracted line items below before applying.'}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applyExtractedQuote(data, selectedMap, 'append')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            Append Selected
          </button>
          <button
            type="button"
            onClick={() => applyExtractedQuote(data, selectedMap, 'replace')}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-800 hover:bg-blue-900 text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Replace Draft &amp; Apply
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
              <th className="py-2 px-2.5 w-8 text-center">Use</th>
              <th className="py-2 px-2.5">Description</th>
              {data.quoteType === 'valve' && <th className="py-2 px-2.5 w-24">Size / Class</th>}
              <th className="py-2 px-2.5 w-16 text-center">Qty</th>
              <th className="py-2 px-2.5 w-28 text-right">Rate (SAR)</th>
              <th className="py-2 px-2.5 w-36">Rate Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data.items || []).map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60">
                <td className="py-2 px-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedMap[idx] !== false}
                    onChange={(e) =>
                      setSelectedMap((prev) => ({ ...prev, [idx]: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                </td>
                <td className="py-2 px-2.5 text-slate-900 font-medium">
                  <div>{item.d}</div>
                  {item.sns && (
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">S/N: {item.sns}</div>
                  )}
                </td>
                {data.quoteType === 'valve' && (
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    {[item.sz, item.cl].filter(Boolean).join(' ') || '—'}
                  </td>
                )}
                <td className="py-2 px-2.5 text-center font-mono tabular-nums text-slate-800">
                  {item.q}
                </td>
                <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(item.r)}
                </td>
                <td className="py-2 px-2.5 text-[11px] text-slate-500">
                  {item.priceSource || (item.r > 0 ? 'Extracted' : 'Needs Rate')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section
      aria-label="AI Quote Creation Studio"
      className="glass-panel rounded-2xl border border-[var(--border,rgba(148,163,184,0.3))] p-5 sm:p-6 shadow-sm space-y-4"
    >
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border,rgba(148,163,184,0.22))]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Quote Creation Studio</h3>
            <p className="text-xs text-slate-500">
              Extract RFQs, dictate voice notes, build scope from Price Book, verify standards, audit, and draft emails.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Hide Studio</span>
        </button>
      </div>

      {/* Interactive Feature Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STUDIO_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setErrorMsg('');
                onChangeTab(t.id);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status & Error Banners */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-900 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {statusMsg && !errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 text-xs font-medium">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* TAB 1: RFQ / DOCUMENT SCANNER */}
      {activeTab === 'rfq' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Paste Client RFQ, Email, WhatsApp Inquiry, or Equipment List
              </label>
              <textarea
                rows={5}
                value={rfqText}
                onChange={(e) => setRfqText(e.target.value)}
                placeholder="Example: Dear UIC, please quote inspection for 6 electric hoists (S/N 101-106) and 2 overhead cranes 15T at SABIC Jubail. Attn: Eng. Khalid..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Attach RFQ Screenshot or PDF (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => rfqFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-slate-50/70 hover:bg-blue-50/40 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-700" />
                  <span className="truncate">
                    {rfqFile ? rfqFile.name : 'Upload PDF / PNG / JPG / TXT'}
                  </span>
                </button>
                <input
                  ref={rfqFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  hidden
                  onChange={handleRfqFileSelect}
                />
                {rfqFile && (
                  <button
                    type="button"
                    onClick={() => setRfqFile(null)}
                    className="mt-1 text-[11px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Remove attached file
                  </button>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quote Format Hint</label>
                <select
                  value={rfqTypeHint}
                  onChange={(e) => setRfqTypeHint(e.target.value as 'auto' | QuoteType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-hidden font-medium"
                >
                  <option value="auto">Auto-Detect (Standard vs Valve)</option>
                  <option value="std">Standard Services</option>
                  <option value="valve">Valve Testing &amp; Calibration</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={estimateMissingRates}
                  onChange={(e) => setEstimateMissingRates(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span>Suggest SAR rates if not in Price Book</span>
              </label>

              <button
                type="button"
                onClick={handleRunRfqScan}
                disabled={busyAction === 'rfq'}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {busyAction === 'rfq' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSearch className="w-4 h-4" />
                )}
                <span>{busyAction === 'rfq' ? 'Scanning RFQ...' : 'Scan & Extract Quote'}</span>
              </button>
            </div>
          </div>

          {rfqResult && renderExtractedPreview(rfqResult, rfqSelectedIndices, setRfqSelectedIndices)}
        </div>
      )}

      {/* TAB 2: VOICE-TO-QUOTE DICTATION */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900">
                Hands-Free Voice Quotation ({isRecording ? `Recording ${formatDuration(recordingSeconds)}` : 'Ready'})
              </div>
              <p className="text-slate-600">
                Dictate client name, location, items, quantities, valve sizes, or serial numbers. Powered by audio transcription + Price Book matching.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={busyAction === 'voice'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-blue-800 hover:bg-blue-900 text-white'
                } disabled:opacity-60`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop &amp; Transcribe ({formatDuration(recordingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Mic Dictation</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                disabled={busyAction === 'voice' || isRecording}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Voice Note</span>
              </button>
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg"
                hidden
                onChange={handleAudioFileUpload}
              />
            </div>
          </div>

          {busyAction === 'voice' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 p-3 rounded-xl bg-blue-50/70 border border-blue-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Transcribing audio and matching line items to Price Book...</span>
            </div>
          )}

          {voiceTranscript && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Verbatim Transcript</label>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 leading-relaxed">
                {voiceTranscript}
              </div>
            </div>
          )}

          {voiceExtracted && renderExtractedPreview(voiceExtracted, voiceSelectedIndices, setVoiceSelectedIndices)}
        </div>
      )}

      {/* TAB 3: SCOPE & LINE-ITEM BUILDER */}
      {activeTab === 'scope' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Describe Job Scope (matches {quote.client ? `${quote.client}'s` : 'all'} saved Price Book rates automatically)
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    label: 'Lifting Gear',
                    prompt: 'Third-party annual lifting gear inspection for overhead cranes, electric hoists, shackles, and wire rope slings with load testing.',
                  },
                  {
                    label: 'Valve Hydro & PSV',
                    prompt: 'Safety relief valve pop-pressure testing & calibration (2 inch 150#, 3 inch 300#, 4 inch 600#) plus control valve hydrotest.',
                  },
                  {
                    label: 'Instrument Calibration',
                    prompt: 'Calibration of digital torque wrenches, hydraulic pressure gauges, multimeters, and clamp meters with traceable certificates.',
                  },
                  {
                    label: 'NDT Inspection',
                    prompt: 'Non-destructive testing package: Ultrasonic Thickness Gauging (UT), Magnetic Particle Testing (MT), and Dye Penetrant (PT) for weld joints.',
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSuggestScope(preset.prompt)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={scopePrompt}
                onChange={(e) => setScopePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSuggestScope();
                  }
                }}
                placeholder="e.g. Inspect 8 chain blocks 5T, 3 overhead cranes 20T, and calibrate 12 pressure gauges in Jubail..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleSuggestScope()}
                disabled={busyAction === 'scope'}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {busyAction === 'scope' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ListPlus className="w-4 h-4" />
                )}
                <span>{busyAction === 'scope' ? 'Generating...' : 'Generate Items'}</span>
              </button>
            </div>
          </div>

          {scopeResult && scopeResult.items.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-slate-600">
                  {scopeResult.suggestedSub && (
                    <span>
                      Suggested Subject: <b className="text-slate-900">{scopeResult.suggestedSub}</b>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddScopeItems}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Add Selected to Quote</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2 px-2.5 w-8 text-center">Add</th>
                      <th className="py-2 px-2.5">Description &amp; Rationale</th>
                      <th className="py-2 px-2.5 w-16 text-center">Qty</th>
                      <th className="py-2 px-2.5 w-28 text-right">Rate (SAR)</th>
                      <th className="py-2 px-2.5 w-28">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopeResult.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={scopeSelectedIndices[idx] !== false}
                            onChange={(e) =>
                              setScopeSelectedIndices((prev) => ({ ...prev, [idx]: e.target.checked }))
                            }
                            className="w-3.5 h-3.5 rounded text-blue-600"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900">
                            {item.d}
                            {(item.sz || item.cl) && (
                              <span className="font-mono text-blue-700 ml-1.5">
                                {[item.sz, item.cl].filter(Boolean).join(' ')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.rationale}</div>
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums">{item.q}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatCurrency(item.r)}
                        </td>
                        <td className="py-2 px-2.5 text-[11px] font-medium text-slate-600">
                          {item.matchedFromPriceBook ? 'Price Book' : 'Market Est.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STANDARDS & RATES SEARCH GROUNDING */}
      {activeTab === 'research' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              'API 527 vs API 598 seat leakage test criteria',
              'Saudi Aramco GI-7.028 crane and lifting equipment inspection requirements',
              'ASME B30.16 electric chain hoist periodic load test ratio',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleRunResearch(q)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 rounded-md transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRunResearch();
                }
              }}
              placeholder="Ask about ASME, API, ISO, BS, or Aramco inspection & valve testing standards..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-hidden"
            />
            <button
              type="button"
              onClick={() => handleRunResearch()}
              disabled={busyAction === 'research'}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {busyAction === 'research' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span>{busyAction === 'research' ? 'Searching...' : 'Search Standards'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={useSearchGrounding}
                onChange={(e) => setUseSearchGrounding(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600"
              />
              <span>Include live Google Search web grounding (requires Search quota)</span>
            </label>
            {errorMsg && researchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  setUseSearchGrounding(false);
                  handleRunResearch(researchQuery, false);
                }}
                className="text-[11px] font-bold text-blue-800 hover:underline cursor-pointer"
              >
                Query Standards Knowledge Without Web Search
              </button>
            )}
          </div>

          {researchResult && (
            <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
              <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                {researchResult.answer}
              </div>

              {researchResult.suggestedClause && (
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Insert recommended technical clause directly into this quotation:
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateQuote((prev) => ({
                          ...prev,
                          tc: `${prev.tc.trim()}\n\nApplicable Technical Standard:\n${researchResult.suggestedClause}`,
                        }));
                        notify('Appended technical clause to Terms & Conditions.');
                      }}
                      className="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-semibold cursor-pointer"
                    >
                      Add to Terms &amp; Conditions
                    </button>
                  </div>
                </div>
              )}

              {researchResult.sources.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Verified Web Sources
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {researchResult.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:border-blue-400 rounded-md text-[11px] text-blue-800 font-medium"
                      >
                        <span className="truncate max-w-[220px]">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMMERCIAL POLISH & PRE-SEND AUDIT */}
      {activeTab === 'polish' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Polish Panel */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-blue-700" />
                <span>Polish Copy &amp; Commercial Terms</span>
              </div>
              <button
                type="button"
                onClick={handleRunPolish}
                disabled={busyAction === 'polish'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white rounded-lg font-bold transition-colors cursor-pointer"
              >
                {busyAction === 'polish' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                <span>{busyAction === 'polish' ? 'Polishing...' : 'Polish Draft'}</span>
              </button>
            </div>

            <select
              value={polishMode}
              onChange={(e) =>
                setPolishMode(
                  e.target.value as 'enterprise_aramco' | 'technical_concise' | 'valve_compliance' | 'custom'
                )
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium outline-hidden"
            >
              <option value="enterprise_aramco">Enterprise Formal (Aramco / SABIC Vendor Grade)</option>
              <option value="technical_concise">Concise Technical Engineering</option>
              <option value="valve_compliance">Valve Testing &amp; API 527 / 598 Clauses</option>
              <option value="custom">Custom Rewrite Instruction</option>
            </select>

            {polishMode === 'custom' && (
              <input
                type="text"
                value={customPolishInstruction}
                onChange={(e) => setCustomPolishInstruction(e.target.value)}
                placeholder="e.g. Set net 30 days payment, mention 48h mobilization, and clarify VAT 15%..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-hidden"
              />
            )}

            {polishResult && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="text-slate-700 font-medium">{polishResult.summaryOfChanges}</div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto space-y-1.5 text-[11px] text-slate-700">
                  <div>
                    <b>Intro:</b> {polishResult.intro}
                  </div>
                  <div>
                    <b>Terms Preview:</b> {polishResult.tc.slice(0, 260)}
                    {polishResult.tc.length > 260 ? '...' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyPolish}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Apply Polished Copy to Quote
                </button>
              </div>
            )}
          </div>

          {/* Audit Panel */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Pre-Send Quote Audit</span>
              </div>
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={busyAction === 'audit'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg font-bold transition-colors cursor-pointer"
              >
                {busyAction === 'audit' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{busyAction === 'audit' ? 'Auditing...' : 'Run Audit'}</span>
              </button>
            </div>

            {!auditResult && (
              <p className="text-slate-500 leading-relaxed">
                Checks serial counts vs quantities, zero-rate rows, Price Book deviations, valve sizes/classes, VAT notes, and missing client fields before exporting PDF/Excel.
              </p>
            )}

            {auditResult && (
              <div className="space-y-2.5">
                <div className="font-semibold text-slate-900">
                  {auditResult.readyToSend ? 'Ready to Send' : 'Review Recommended'} &middot;{' '}
                  <span className="font-normal text-slate-600">{auditResult.overallAssessment}</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {auditResult.findings.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start gap-2"
                    >
                      {f.severity === 'critical' ? (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : f.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900">
                          {f.area} &middot; {f.issue}
                        </div>
                        <div className="text-slate-600 mt-0.5">{f.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {auditResult.suggestedFix &&
                  (auditResult.suggestedFix.location ||
                    auditResult.suggestedFix.attn ||
                    auditResult.suggestedFix.delivery ||
                    auditResult.suggestedFix.service ||
                    auditResult.suggestedFix.vatNote ||
                    (auditResult.suggestedFix.itemRateFixes?.length ?? 0) > 0) && (
                    <button
                      type="button"
                      onClick={handleApplyAuditFixes}
                      className="w-full py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      Apply Safe Auto-Fixes
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: CLIENT EMAIL, WHATSAPP & SPOKEN VERIFICATION BRIEF */}
      {activeTab === 'outreach' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-900">Client Submission &amp; Follow-Up Drafter</div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'email_submit' as const, label: 'Submit Quote Email' },
                  { id: 'email_followup' as const, label: 'PO Follow-Up' },
                  { id: 'whatsapp' as const, label: 'WhatsApp Summary' },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleDraftMessage(ch.id)}
                    disabled={busyAction === 'message'}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      messageChannel === ch.id && draftedMessage
                        ? 'bg-blue-800 text-white'
                        : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {busyAction === 'message' && (
              <div className="flex items-center gap-2 text-blue-800 font-semibold py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Drafting message for {quote.client || 'client'}...</span>
              </div>
            )}

            {draftedMessage ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftedMessage.subject}
                    onChange={(e) =>
                      setDraftedMessage((prev) => (prev ? { ...prev, subject: e.target.value } : prev))
                    }
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(draftedMessage.subject, 'subject')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    {copiedField === 'subject' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'subject' ? 'Copied' : 'Subject'}</span>
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={draftedMessage.body}
                  onChange={(e) =>
                    setDraftedMessage((prev) => (prev ? { ...prev, body: e.target.value } : prev))
                  }
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-hidden leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(draftedMessage.body, 'body')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold cursor-pointer"
                  >
                    {copiedField === 'body' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'body' ? 'Copied Message' : 'Copy Message Body'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">
                Choose a channel above to generate a client-ready email or WhatsApp summary with Ref #{quote.ref}, item count, and Net Total SAR {formatCurrency(totals.netTotal)}.
              </p>
            )}
          </div>

          {/* Spoken Audio Verification Brief (TTS) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-blue-700" />
              <span>Voice Verification Brief</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Generate an audio readout of client, Ref #, item count, subtotal, VAT ({quote.vat}%), and Net Total (SAR {formatCurrency(totals.netTotal)}) to double-check numbers before export.
            </p>
            <button
              type="button"
              onClick={handleGenerateTtsBrief}
              disabled={busyAction === 'tts'}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-bold transition-colors cursor-pointer"
            >
              {busyAction === 'tts' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span>{busyAction === 'tts' ? 'Synthesizing Audio...' : 'Listen to Quote Brief'}</span>
            </button>

            {ttsAudioUrl && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <audio controls src={ttsAudioUrl} className="w-full h-9" />
                {ttsScript && <p className="text-[11px] text-slate-500 leading-relaxed">{ttsScript}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

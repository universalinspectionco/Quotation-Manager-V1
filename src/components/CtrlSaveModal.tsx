import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  FileDown, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  HardDrive, 
  FolderCheck,
  AlertCircle,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Sparkles,
  Edit3,
  RotateCcw,
  Check,
  FileEdit,
  Save
} from 'lucide-react';
import { Quotation, Settings } from '../types/quotation';
import { PdfGeneratorService } from '../services/pdfGenerator';
import { ExcelGeneratorService } from '../services/excelGenerator';
import { FileStorageService } from '../services/fileStorageService';
import { sanitizeFilename } from '../utils/formatters';

interface CtrlSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quotation;
  settings: Settings;
  onContinueEditing?: () => void;
  onBackToList?: () => void;
}

// Clean filename helper to remove forbidden Windows characters while preserving custom naming
function sanitizeCustomFilingName(rawName: string, fallbackQuote: Quotation): string {
  let cleaned = rawName
    .trim()
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.(pdf|xlsx)$/i, '')
    .trim();
  
  if (!cleaned) {
    cleaned = sanitizeFilename(fallbackQuote);
  }
  return cleaned;
}

export const CtrlSaveModal: React.FC<CtrlSaveModalProps> = ({
  isOpen,
  onClose,
  quote,
  settings,
  onContinueEditing,
  onBackToList,
}) => {
  const defaultBaseName = sanitizeFilename(quote);
  const [customFilename, setCustomFilename] = useState<string>(defaultBaseName);
  const [hasUserEditedName, setHasUserEditedName] = useState<boolean>(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null);

  const [savingPdf, setSavingPdf] = useState<boolean>(true);
  const [pdfStatus, setPdfStatus] = useState<{ success: boolean; message: string; filename: string }>({
    success: false,
    message: 'Preparing PDF...',
    filename: '',
  });

  const [savingExcel, setSavingExcel] = useState<boolean>(true);
  const [excelStatus, setExcelStatus] = useState<{ success: boolean; message: string; filename: string }>({
    success: false,
    message: 'Preparing Excel...',
    filename: '',
  });

  const [connectedFolder, setConnectedFolder] = useState<string | null>(null);
  const [isSavingBoth, setIsSavingBoth] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [hasSavedOnce, setHasSavedOnce] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Compute active cleaned filename
  const activeBaseName = sanitizeCustomFilingName(customFilename, quote);
  const pdfFilename = `${activeBaseName}.pdf`;
  const excelFilename = `${activeBaseName}.xlsx`;

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset filename to default when a new quote is opened
  useEffect(() => {
    if (isOpen) {
      const initial = sanitizeFilename(quote);
      setCustomFilename(initial);
      setHasUserEditedName(false);
      setHasSavedOnce(false);
    }
  }, [isOpen, quote.id, quote.ref]);

  // Prepare PDF & Excel data on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let createdUrl: string | null = null;

    const prepareDocumentsAndCheckFolder = async () => {
      setSavingPdf(true);
      setSavingExcel(true);

      // 1. Generate PDF blob
      let currentPdfBlob: Blob | null = null;
      try {
        currentPdfBlob = PdfGeneratorService.getQuotePdfBlob(quote, settings);
        if (isMounted) {
          setPdfBlob(currentPdfBlob);
          createdUrl = URL.createObjectURL(currentPdfBlob);
          setPdfUrl(createdUrl);
          setSavingPdf(false);
          setPdfStatus({
            success: false,
            message: 'Ready to save',
            filename: pdfFilename,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setSavingPdf(false);
          setPdfStatus({
            success: false,
            message: `PDF generation failed: ${err?.message || 'Error'}`,
            filename: pdfFilename,
          });
        }
      }

      // 2. Generate Excel blob in parallel
      let currentExcelBlob: Blob | null = null;
      try {
        currentExcelBlob = await ExcelGeneratorService.generateQuoteExcel(quote, settings);
        if (isMounted) {
          setExcelBlob(currentExcelBlob);
          setSavingExcel(false);
          setExcelStatus({
            success: false,
            message: 'Ready to save',
            filename: excelFilename,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setSavingExcel(false);
          setExcelStatus({
            success: false,
            message: `Excel generation failed: ${err?.message || 'Error'}`,
            filename: excelFilename,
          });
        }
      }

      // 3. Detect connected folder handle
      try {
        const dirHandle = await FileStorageService.getActiveDirectoryHandle(false);
        if (dirHandle && isMounted) {
          setConnectedFolder(dirHandle.name);
        }
      } catch (e) {
        console.warn('Folder check failed:', e);
      }
    };

    prepareDocumentsAndCheckFolder();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, quote, settings]);

  if (!isOpen) return null;

  // Print PDF
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      printWindow?.focus();
      printWindow?.print();
    }
  };

  // Reset filename back to original default
  const handleResetFilename = () => {
    const orig = sanitizeFilename(quote);
    setCustomFilename(orig);
    setHasUserEditedName(false);
    nameInputRef.current?.focus();
  };

  // User Action: Save Both (PDF & Excel) with the active/renamed filename to default folder
  const handleSaveBothWithActiveName = async () => {
    setIsSavingBoth(true);
    const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
    const targetPdfFilename = `${targetBaseName}.pdf`;
    const targetExcelFilename = `${targetBaseName}.xlsx`;

    try {
      // Ensure blobs are ready
      const pBlob = pdfBlob || PdfGeneratorService.getQuotePdfBlob(quote, settings);
      const xBlob = excelBlob || (await ExcelGeneratorService.generateQuoteExcel(quote, settings));

      if (!pdfBlob) setPdfBlob(pBlob);
      if (!excelBlob) setExcelBlob(xBlob);

      let dirHandle = await FileStorageService.getActiveDirectoryHandle(false);
      
      // If no folder connected yet, prompt user to select one
      if (!dirHandle) {
        const picked = await FileStorageService.selectDefaultDirectory();
        if (!picked) {
          setIsSavingBoth(false);
          return;
        }
        dirHandle = picked.handle;
        setConnectedFolder(picked.name);
      }

      const dualRes = await FileStorageService.saveBothToDefaultDirectory(
        pBlob,
        targetPdfFilename,
        xBlob,
        targetExcelFilename
      );

      setConnectedFolder(dualRes.folderName || dirHandle.name);
      setPdfStatus({
        success: dualRes.pdfSaved,
        message: dualRes.pdfSaved
          ? `Saved to "${dualRes.folderName || dirHandle.name}"`
          : 'Failed to write PDF',
        filename: targetPdfFilename,
      });

      setExcelStatus({
        success: dualRes.excelSaved,
        message: dualRes.excelSaved
          ? `Saved to "${dualRes.folderName || dirHandle.name}"`
          : 'Failed to write Excel',
        filename: targetExcelFilename,
      });

      if (dualRes.pdfSaved && dualRes.excelSaved) {
        setHasSavedOnce(true);
      }
    } catch (e: any) {
      alert(`Save failed: ${e?.message || 'Error'}`);
    } finally {
      setIsSavingBoth(false);
    }
  };

  // User Action: Select or Change Default Folder and immediately save both files with current name
  const handleSelectFolderAndSaveBoth = async () => {
    setIsSavingBoth(true);
    const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
    const targetPdfFilename = `${targetBaseName}.pdf`;
    const targetExcelFilename = `${targetBaseName}.xlsx`;

    try {
      const dirRes = await FileStorageService.selectDefaultDirectory();
      if (!dirRes) {
        setIsSavingBoth(false);
        return;
      }

      setConnectedFolder(dirRes.name);

      const pBlob = pdfBlob || PdfGeneratorService.getQuotePdfBlob(quote, settings);
      const xBlob = excelBlob || (await ExcelGeneratorService.generateQuoteExcel(quote, settings));

      if (!pdfBlob) setPdfBlob(pBlob);
      if (!excelBlob) setExcelBlob(xBlob);

      const dualRes = await FileStorageService.saveBothToDefaultDirectory(
        pBlob,
        targetPdfFilename,
        xBlob,
        targetExcelFilename
      );

      setPdfStatus({
        success: dualRes.pdfSaved,
        message: dualRes.pdfSaved ? `Saved to "${dirRes.name}"` : 'Failed to write PDF',
        filename: targetPdfFilename,
      });

      setExcelStatus({
        success: dualRes.excelSaved,
        message: dualRes.excelSaved ? `Saved to "${dirRes.name}"` : 'Failed to write Excel',
        filename: targetExcelFilename,
      });

      if (dualRes.pdfSaved && dualRes.excelSaved) {
        setHasSavedOnce(true);
      }
    } catch (e: any) {
      alert(`Could not save to folder: ${e?.message || 'Error'}`);
    } finally {
      setIsSavingBoth(false);
    }
  };

  // Open Windows Save File Dialog for PDF with custom name
  const handleSavePdfDialog = async () => {
    try {
      const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
      const targetPdfFilename = `${targetBaseName}.pdf`;
      const pBlob = pdfBlob || PdfGeneratorService.getQuotePdfBlob(quote, settings);

      const res = await FileStorageService.openNativeSaveDialog(
        pBlob,
        targetPdfFilename,
        'application/pdf',
        '.pdf',
        'PDF Quotation Document'
      );
      if (res.success) {
        setPdfStatus({
          success: true,
          message: res.message,
          filename: res.filename,
        });
      }
    } catch (e: any) {
      alert(`Save PDF error: ${e?.message || 'Error'}`);
    }
  };

  // Open Windows Save File Dialog for Excel with custom name
  const handleSaveExcelDialog = async () => {
    try {
      const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
      const targetExcelFilename = `${targetBaseName}.xlsx`;
      const xBlob = excelBlob || (await ExcelGeneratorService.generateQuoteExcel(quote, settings));

      const res = await FileStorageService.openNativeSaveDialog(
        xBlob,
        targetExcelFilename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xlsx',
        'Excel Spreadsheet'
      );
      if (res.success) {
        setExcelStatus({
          success: true,
          message: res.message,
          filename: res.filename,
        });
      }
    } catch (e: any) {
      alert(`Save Excel error: ${e?.message || 'Error'}`);
    }
  };

  // Manual fallback download PDF with custom name
  const handleManualDownloadPdf = () => {
    const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
    const targetPdfFilename = `${targetBaseName}.pdf`;
    const pBlob = pdfBlob || PdfGeneratorService.getQuotePdfBlob(quote, settings);
    const url = URL.createObjectURL(pBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetPdfFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Manual fallback download Excel with custom name
  const handleManualDownloadExcel = async () => {
    const targetBaseName = sanitizeCustomFilingName(customFilename, quote);
    const targetExcelFilename = `${targetBaseName}.xlsx`;
    const xBlob = excelBlob || (await ExcelGeneratorService.generateQuoteExcel(quote, settings));
    const url = URL.createObjectURL(xBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetExcelFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const folderName = connectedFolder || settings.defaultFolderName || settings.defaultStoragePath || null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl h-[95vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-zinc-100">
        
        {/* Top Header Bar */}
        <div className="bg-slate-900 dark:bg-black text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              UIC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Quotation Saved &middot; Export Hub
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Ctrl + S
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {quote.ref} &middot; {quote.client || 'Untitled Client'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!pdfUrl}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Print PDF"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleSaveBothWithActiveName}
              disabled={isSavingBoth}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-97"
              title="Save both PDF and Excel with current name into your default folder"
            >
              {isSavingBoth ? (
                <Clock className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-white" />
              )}
              <span>{hasSavedOnce ? 'Save Again (PDF + Excel)' : 'Save Both (PDF + Excel)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2 cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RENAMING OPTION BANNER (Before saving to default folder) */}
        <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/80 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border-b border-blue-200/80 dark:border-zinc-800 px-5 py-3 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Renaming Input Control */}
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <FileEdit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide">
                  File Name:
                </span>
              </div>

              <div className="relative flex-1 max-w-2xl flex items-center">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={customFilename}
                  onChange={(e) => {
                    setCustomFilename(e.target.value);
                    setHasUserEditedName(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveBothWithActiveName();
                    }
                  }}
                  placeholder="Enter file name before saving..."
                  className="w-full px-3 py-1.5 pr-28 text-xs font-mono font-semibold bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-blue-300 dark:border-zinc-700 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  title="Edit quotation file name for system filing"
                />

                {/* Suffix Extensions Indicator inside input */}
                <div className="absolute right-2 flex items-center gap-1 pointer-events-none text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-medium">
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700/80 rounded text-slate-600 dark:text-zinc-300">
                    .pdf
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700/80 rounded text-slate-600 dark:text-zinc-300">
                    .xlsx
                  </span>
                </div>
              </div>

              {/* Reset to Default Name Button */}
              {hasUserEditedName && (
                <button
                  type="button"
                  onClick={handleResetFilename}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Revert back to default ref and client name"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Name</span>
                </button>
              )}
            </div>

            {/* Quick Save Action with Custom Name */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveBothWithActiveName}
                disabled={isSavingBoth}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-97 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Save both PDF and Excel directly with this custom file name"
              >
                {isSavingBoth ? (
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save to Folder with This Name</span>
              </button>
            </div>

          </div>

          {/* Micro Helper Note */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Filing formats will be generated as:</span>
            <span className="font-mono font-medium text-blue-700 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
              {pdfFilename}
            </span>
            <span>and</span>
            <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
              {excelFilename}
            </span>
            <span className="hidden sm:inline">&middot; Press <kbd className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.2 border border-slate-300 dark:border-zinc-700 rounded text-[10px]">Enter</kbd> to save immediately</span>
          </div>
        </div>

        {/* Dual Auto-Save & Folder Status Strip */}
        <div className="bg-slate-100/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Storage Target Folder Indicator */}
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-slate-600 dark:text-zinc-400 font-medium">Default Folder:</span>
              {folderName ? (
                <span className="font-semibold text-slate-900 dark:text-zinc-100 font-mono bg-white dark:bg-zinc-800 px-2.5 py-0.5 rounded-md border border-slate-300 dark:border-zinc-700 flex items-center gap-1.5 shadow-xs">
                  📁 {folderName}
                </span>
              ) : (
                <span className="text-amber-800 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                  Not Connected
                </span>
              )}

              <button
                type="button"
                onClick={handleSelectFolderAndSaveBoth}
                className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-md transition-colors cursor-pointer"
                title="Select or Change the folder where PDF and Excel files are saved"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{folderName ? 'Change Folder' : 'Connect Folder'}</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 hidden sm:block" />

            {/* PDF Status Pill */}
            <div className="flex items-center gap-1.5">
              {savingPdf ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                  <Clock className="w-3 h-3 animate-spin text-blue-600" />
                  Generating PDF...
                </span>
              ) : pdfStatus.success ? (
                <span 
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  title={pdfStatus.message}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  PDF: {pdfStatus.filename} ({pdfStatus.message})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
                  PDF: Ready ({pdfFilename})
                </span>
              )}
            </div>

            {/* Excel Status Pill */}
            <div className="flex items-center gap-1.5">
              {savingExcel ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                  <Clock className="w-3 h-3 animate-spin text-blue-600" />
                  Generating Excel...
                </span>
              ) : excelStatus.success ? (
                <span 
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  title={excelStatus.message}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Excel: {excelStatus.filename} ({excelStatus.message})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
                  Excel: Ready ({excelFilename})
                </span>
              )}
            </div>
          </div>

          {/* Quick Save Window Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePdfDialog}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs"
              title="Open Windows Save File Dialog in default folder for PDF"
            >
              <FileDown className="w-3 h-3" />
              <span>Save As PDF Window</span>
            </button>

            <button
              type="button"
              onClick={handleSaveExcelDialog}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-700 hover:bg-emerald-600 text-white transition-colors cursor-pointer shadow-xs"
              title="Open Windows Save File Dialog in default folder for Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Save As Excel Window</span>
            </button>

            {/* Zoom Controls for PDF preview */}
            <div className="flex items-center gap-1 ml-2 border-l border-slate-300 dark:border-zinc-700 pl-2">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="p-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 w-9 text-center font-semibold">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Interactive Live PDF Preview */}
        <div className="flex-1 bg-slate-200/90 dark:bg-zinc-950 overflow-auto p-4 flex items-center justify-center">
          {pdfUrl ? (
            <div 
              className="bg-white shadow-2xl transition-all duration-200 border border-slate-300 dark:border-zinc-700 rounded-sm"
              style={{
                width: `${Math.round(8.27 * zoomLevel * 10)}px`,
                maxWidth: '100%',
                height: '100%',
              }}
            >
              <iframe
                ref={iframeRef}
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-none rounded-sm"
                title={`Quotation PDF Preview - ${quote.ref}`}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-slate-200 dark:border-zinc-800 max-w-sm text-center">
              <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Rendering Official Quotation PDF</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Applying UIC dark navy corporate letterhead, item tables, pass/fail rates, and terms &amp; conditions...
              </p>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Strip */}
        <div className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <span>Press <kbd className="font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 border border-slate-300 dark:border-zinc-700 rounded font-bold text-slate-700 dark:text-zinc-300">Esc</kbd> anytime to return.</span>
            <span className="hidden md:inline">&middot;</span>
            <button
              type="button"
              onClick={handleManualDownloadPdf}
              className="hidden md:inline text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Download PDF ({pdfFilename})
            </button>
            <span className="hidden md:inline">&middot;</span>
            <button
              type="button"
              onClick={handleManualDownloadExcel}
              className="hidden md:inline text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Download Excel ({excelFilename})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {onContinueEditing && (
              <button
                type="button"
                onClick={onContinueEditing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                Continue Editing Quote
              </button>
            )}

            {onBackToList && (
              <button
                type="button"
                onClick={onBackToList}
                className="px-4 py-2 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Return to Quotes List
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Done &middot; Close Hub
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

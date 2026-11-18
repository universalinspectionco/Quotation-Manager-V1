import React, { useState, useEffect } from 'react';
import { X, Download, Printer, FileText, ExternalLink, Save, FolderCheck } from 'lucide-react';
import { Quotation, Settings } from '../types/quotation';
import { PdfGeneratorService } from '../services/pdfGenerator';
import { FileStorageService } from '../services/fileStorageService';
import { sanitizeFilename } from '../utils/formatters';

interface PdfPreviewModalProps {
  quotation: Quotation | null;
  settings: Settings;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  quotation,
  settings,
  isOpen,
  onClose,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !quotation) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    setIsGenerating(true);
    try {
      const blob = PdfGeneratorService.getQuotePdfBlob(quotation, settings);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      console.error('Failed to generate PDF preview:', e);
    } finally {
      setIsGenerating(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, quotation, settings]);

  if (!isOpen || !quotation) return null;

  const handleDownload = async (modeOverride?: 'dialog' | 'direct' | 'download') => {
    try {
      const blob = PdfGeneratorService.getQuotePdfBlob(quotation, settings);
      const filename = `${sanitizeFilename(quotation)}.pdf`;
      const res = await FileStorageService.saveFile({
        blob,
        filename,
        mimeType: 'application/pdf',
        description: 'PDF Quotation Document',
        extension: '.pdf',
        settings,
        modeOverride,
      });
      if (res.success) {
        setSaveStatus(res.message);
        setTimeout(() => setSaveStatus(null), 5000);
      }
    } catch (e: any) {
      alert(`Could not save PDF: ${e?.message || 'Error'}`);
    }
  };

  const handlePrint = () => {
    if (!blobUrl) return;
    const printWindow = window.open(blobUrl);
    if (printWindow) {
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                PDF Preview &middot; {quotation.ref}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {quotation.client} &middot; {quotation.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Print PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={() => handleDownload('dialog')}
              title="Open Windows Save As Dialog directly into your default storage folder"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-950" />
              <span>Save As... (Windows Dialog)</span>
            </button>

            <button
              onClick={() => handleDownload()}
              title="Save PDF using configured settings default"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Save Status Notification Banner */}
        {saveStatus && (
          <div className="bg-emerald-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0 shadow-inner">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4" />
              <span>{saveStatus}</span>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-xs text-emerald-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* PDF Viewer Frame */}
        <div className="flex-1 bg-slate-200 relative overflow-hidden">
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-slate-600">Generating official PDF document...</span>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0`}
              title="Quote PDF Preview"
              className="w-full h-full border-none"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Failed to load preview. Please use the download button above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

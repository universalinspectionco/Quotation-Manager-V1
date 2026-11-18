import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Download, ShieldCheck, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UIC Quotation Manager:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    if (window.confirm('Are you sure you want to reset your local database to initial defaults? Any unsaved local edits will be reset.')) {
      try {
        localStorage.removeItem('qm_uic_v2');
      } catch (e) {
        console.error('Failed to clear localStorage:', e);
      }
      window.location.reload();
    }
  };

  private handleExportBackup = () => {
    try {
      const raw = localStorage.getItem('qm_uic_v2') || '{}';
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uic_quotation_emergency_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert('Unable to export backup from storage: ' + String(e));
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Application Recovery</h1>
                <p className="text-xs text-slate-400">UIC Quotation Manager encountered an unexpected state</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-amber-300">Error Details:</div>
              <div className="text-xs font-mono text-slate-300 break-words max-h-32 overflow-y-auto">
                {this.state.error?.message || 'An unknown error occurred during rendering.'}
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              Your quotes and database can be safely recovered. You can reload the application, export an emergency backup of your local storage, or reset your cached local data to system defaults.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload App</span>
              </button>

              <button
                onClick={this.handleExportBackup}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all border border-slate-600 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save Backup</span>
              </button>

              <button
                onClick={this.handleResetData}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Data</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1 or ?', desc: 'Display this shortcuts cheat sheet' },
    { key: 'Alt + 1 ... 5', desc: 'Switch tabs: Quotes, New Quote, Report, Price Book, Settings' },
    { key: 'Alt + N', desc: 'Start a new quotation (opens type picker)' },
    { key: 'Alt + F', desc: 'Jump immediately to the search box' },
    { key: 'Ctrl + S', desc: 'Auto-save quote, show PDF preview & save both PDF & Excel to default folder' },
    { key: 'Ctrl + Enter or Alt + I', desc: 'Add new line item row and start typing' },
    { key: 'Enter in Description', desc: 'Autofill saved item or short code, then move to Qty' },
    { key: 'Enter in Qty', desc: 'Move to Unit Rate' },
    { key: 'Enter in Rate', desc: 'Jump to next row (adds new row automatically if on last)' },
    { key: 'Alt + Delete', desc: 'Delete the row you are currently editing' },
    { key: 'Alt + P', desc: 'Preview or download official PDF' },
    { key: 'Esc', desc: 'Close any open dialog or popup' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 text-xs">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
              <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-800 shrink-0">
                {s.key}
              </kbd>
              <span className="text-slate-600 text-right font-medium">{s.desc}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950">
          <b>Pro-Tip on Short Codes:</b> In the Price Book, assign codes to common items (e.g., <code className="font-bold">eh</code> for Electric Hoist, <code className="font-bold">pg</code> for Pressure Gauge). In the quote editor, simply type the code in the Description box and hit <kbd className="font-bold">Enter</kbd> to automatically populate the item name and customer rate!
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

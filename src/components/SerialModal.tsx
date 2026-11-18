import React, { useState, useEffect } from 'react';
import { X, Hash, ListFilter, Check, Sparkles } from 'lucide-react';
import { LineItem } from '../types/quotation';
import { parseSerialNumbers } from '../utils/formatters';

interface SerialModalProps {
  itemIndex: number;
  item: LineItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (serialsString: string, updateQty: boolean) => void;
}

export const SerialModal: React.FC<SerialModalProps> = ({
  itemIndex,
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const [text, setText] = useState<string>('');
  const [prefix, setPrefix] = useState<string>('SN-');
  const [fromNum, setFromNum] = useState<number>(1);
  const [toNum, setToNum] = useState<number>(item ? item.q || 1 : 1);
  const [digits, setDigits] = useState<number>(4);

  useEffect(() => {
    if (item) {
      const serials = parseSerialNumbers(item.sns);
      setText(serials.join('\n'));
      setToNum(item.q || 1);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentSerials = parseSerialNumbers(text);
  const count = currentSerials.length;
  const targetQty = Number(item.q) || 0;

  const handleGenerate = () => {
    if (fromNum > toNum) {
      alert('The "From" number cannot exceed the "To" number.');
      return;
    }
    if (toNum - fromNum > 1000) {
      alert('Maximum 1,000 serial numbers can be generated at once.');
      return;
    }

    const generated: string[] = [];
    for (let i = fromNum; i <= toNum; i++) {
      const padded = String(i).padStart(digits, '0');
      generated.push(`${prefix}${padded}`);
    }

    setText(generated.join('\n'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-700" />
              <span>Serial Numbers &middot; Item {itemIndex + 1}</span>
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-sm font-medium">
              {item.d || 'Untitled Line Item'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Paste or Type Serials (One per line or comma-separated)
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold ${count === targetQty ? 'text-blue-700' : 'text-amber-700'}`}>
                  {count} entered
                </span>
                <span className="text-slate-400">&middot;</span>
                <span className="text-slate-600">Quote Qty: {targetQty}</span>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g.&#10;0001&#10;125515&#10;5416161"
              rows={7}
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-hidden transition-all"
            />
            {count > 8 && (
              <p className="text-[11px] text-blue-700 font-medium mt-1">
                Note: Because this item has more than 8 serial numbers, they will be formatted automatically into a dedicated "Annexure – Serial Numbers" page.
              </p>
            )}
          </div>

          {/* Range Generator */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span>Batch Serial Range Generator</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Prefix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g. SN-"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">From</label>
                <input
                  type="number"
                  value={fromNum}
                  onChange={(e) => setFromNum(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">To</label>
                <input
                  type="number"
                  value={toNum}
                  onChange={(e) => setToNum(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Digits Padding</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={digits}
                  onChange={(e) => setDigits(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Generate Range
              </button>
              <button
                type="button"
                onClick={() => setText('')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-semibold transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSave(text, false)}
              className="px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              Save Serials
            </button>
            <button
              type="button"
              onClick={() => onSave(text, true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Sync Quantity ({count})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { X, Wrench, Gauge, ArrowRight } from 'lucide-react';
import { QuoteType } from '../types/quotation';

interface TypePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: QuoteType) => void;
}

export const TypePickerModal: React.FC<TypePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        onSelectType('std');
      } else if (e.key === '2') {
        e.preventDefault();
        onSelectType('valve');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSelectType, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">What are you quoting?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The quotation layout and fields configure automatically. Press <b>1</b> or <b>2</b> on keyboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* Option 1: Standard Services */}
          <button
            onClick={() => onSelectType('std')}
            className="group relative flex flex-col text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50/50 transition-all cursor-pointer shadow-xs"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
                1 &middot; Standard Services
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Calibration, inspection, NDT, lifting gear, pressure gauges, electrical &amp; torque instruments with optional item serial numbers.
            </p>
          </button>

          {/* Option 2: Valve Test Services */}
          <button
            onClick={() => onSelectType('valve')}
            className="group relative flex flex-col text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50/50 transition-all cursor-pointer shadow-xs"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
                2 &middot; Valve Test Services
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Valve testing &amp; calibration with dedicated Size (inch), Class rating, Pass/Fail rate notes, remarks, and revision controls.
            </p>
          </button>
        </div>

        <div className="flex justify-end pt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};

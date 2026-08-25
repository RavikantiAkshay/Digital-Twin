import React from 'react';
import { X, PlusCircle, Sparkles, ArrowRight, Info } from 'lucide-react';

export default function CustomNetworkModal({ isOpen, onClose, onLaunchDefaultCase }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0c1326] border border-purple-500/30 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <PlusCircle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Custom Network Builder</h2>
              <p className="text-xs text-slate-400">Interactive Circuit Design Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="my-6 space-y-4 text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex items-start gap-3">
            <Info size={20} className="text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-purple-200 block text-sm mb-1">Custom Builder Phase Status</strong>
              Custom Network Builder mode allows interactive creation of custom buses, generators, and transmission line impedances.
              Currently, you can explore all PyPOWER benchmark IEEE grid test cases (IEEE 9, 14, 30, 39, 57, 118, and 300 bus networks) with full AC power flow visual telemetry!
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Would you like to launch the standard IEEE 14-bus or select from existing source networks?
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Back
          </button>
          <button
            onClick={() => {
              onClose();
              onLaunchDefaultCase('case14');
            }}
            className="btn-primary text-xs bg-purple-600 hover:bg-purple-700 border-purple-400/30"
          >
            <span>Launch IEEE-14 Twin</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { 
  ArrowLeft,
  RotateCw, 
  Loader2
} from 'lucide-react';

export default function TopBar({ 
  onHomeClick, 
  onRefreshClick, 
  isLoading 
}) {
  return (
    <header className="h-14 bg-[#FAF8F4] border-b border-[#E3DFD5] px-4 md:px-6 flex items-center justify-between relative z-30 font-sans">
      
      {/* LEFT: BACK BUTTON & CLEAN BRANDING */}
      <div className="flex items-center gap-3">
        <button
          onClick={onHomeClick}
          className="p-2 rounded-lg text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-all"
          title="Return to Grid Selector"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex flex-col">
          <span className="text-[10px] font-mono tracking-widest text-[#7A766D] uppercase font-bold leading-none">
            IEEE POWER NETWORK
          </span>
          <span className="text-sm font-bold text-[#1C1B18] leading-tight">
            Digital Twin
          </span>
        </div>
      </div>

      {/* CENTER: CLEAN EMPTY (NO REDUNDANT NETWORK NAME OR BADGES) */}
      <div />

      {/* RIGHT: REFRESH / SOLVE BUTTON */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshClick}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-lg bg-[#FAF8F4] hover:bg-[#ECE8DF] border border-[#DDD8CD] text-[#1C1B18] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          title="Re-run AC Power Flow"
        >
          {isLoading ? (
            <Loader2 size={13} className="animate-spin text-[#244B43]" />
          ) : (
            <RotateCw size={13} className="text-[#244B43]" />
          )}
          <span>Solve</span>
        </button>
      </div>

    </header>
  );
}

import React from 'react';
import { 
  Zap, 
  Home, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  XOctagon, 
  ChevronDown,
  Plus
} from 'lucide-react';

export default function TopBar({ 
  cases, 
  selectedCaseId, 
  onSelectCase, 
  summary, 
  onHomeClick, 
  onRefreshClick, 
  onOpenCustomModal,
  isLoading 
}) {
  const getHealthBadge = (health) => {
    if (health === 'SAFE') {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
          <ShieldCheck size={13} />
          <span>SAFE</span>
        </span>
      );
    }
    if (health === 'ALERT') {
      return (
        <span className="px-3 py-1 rounded-full bg-[#FFD369]/10 border border-[#FFD369]/30 text-[#FFD369] text-xs font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,211,105,0.15)]">
          <AlertTriangle size={13} />
          <span>ALERT</span>
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse">
        <XOctagon size={13} />
        <span>OVERLOAD</span>
      </span>
    );
  };

  return (
    <header className="h-14 bg-[#131316]/95 border-b border-[#2D333B] px-4 md:px-6 flex items-center justify-between relative z-30 backdrop-blur-md">
      
      {/* ========================================================================= */}
      {/* LEFT CLUSTER: BRANDING & CASE SELECTION                                   */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-3">
        <button
          onClick={onHomeClick}
          className="p-1.5 px-2.5 rounded-xl bg-[#1f1f22] text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] transition-all flex items-center gap-1.5 border border-[#2D333B] text-xs font-medium"
          title="Return to Network Selector"
        >
          <Home size={14} />
          <span className="hidden sm:inline">Selector</span>
        </button>

        <div className="h-4 w-[1px] bg-[#2D333B]" />

        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-[#00adb5]/10 text-[#55d8e1] border border-[#00adb5]/30">
            <Zap size={15} />
          </div>
          <span className="text-xs font-bold text-[#e4e1e5] tracking-wide font-sans hidden md:inline">
            IEEE Digital Twin
          </span>
        </div>

        {/* Case Dropdown */}
        <div className="relative">
          <select
            value={selectedCaseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="appearance-none bg-[#1f1f22] border border-[#2D333B] text-[#55d8e1] text-xs font-bold rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#55d8e1] cursor-pointer hover:border-[#00adb5]/50 transition-colors max-w-[220px] sm:max-w-[300px] truncate"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#131316] text-[#e4e1e5]">
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-[#bbc9ca] pointer-events-none" />
        </div>

        {/* Custom Builder Shortcut */}
        {onOpenCustomModal && (
          <button
            onClick={onOpenCustomModal}
            className="p-1.5 px-2 rounded-xl bg-[#1f1f22] border border-[#2D333B] text-[#55d8e1] hover:border-[#55d8e1]/50 hover:bg-[#2a2a2d] transition-all flex items-center gap-1 text-xs font-semibold"
            title="Create / Upload Custom Power Grid"
          >
            <Plus size={14} />
            <span className="hidden lg:inline">Custom Grid</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CENTER: ABSOLUTELY CENTERED SECURITY BADGE                                */}
      {/* ========================================================================= */}
      {summary && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          {getHealthBadge(summary.grid_health)}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RIGHT CLUSTER: RESOLVE POWER FLOW                                         */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshClick}
          disabled={isLoading}
          className="bg-[#1f1f22] border border-[#2D333B] text-[#e4e1e5] hover:text-[#55d8e1] hover:border-[#00adb5] text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-medium"
          title="Re-solve AC Newton-Raphson Power Flow"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Solve</span>
        </button>
      </div>

    </header>
  );
}

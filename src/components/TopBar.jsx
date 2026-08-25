import React from 'react';
import { 
  Zap, 
  Home, 
  RefreshCw, 
  Table, 
  ShieldCheck, 
  AlertTriangle, 
  XOctagon, 
  ChevronDown,
  Sliders
} from 'lucide-react';

export default function TopBar({ 
  cases, 
  selectedCaseId, 
  onSelectCase, 
  summary, 
  onHomeClick, 
  onRefreshClick, 
  onOpenDataTable,
  onToggleStressPanel,
  isStressPanelOpen,
  isLoading 
}) {
  const getHealthBadge = (health) => {
    if (health === 'SAFE') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <ShieldCheck size={13} />
          SAFE
        </span>
      );
    }
    if (health === 'ALERT') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-[#FFD369]/10 border border-[#FFD369]/30 text-[#FFD369] text-xs font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,211,105,0.2)]">
          <AlertTriangle size={13} />
          ALERT
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse">
        <XOctagon size={13} />
        OVERLOAD
      </span>
    );
  };

  return (
    <header className="h-14 bg-[#131316] border-b border-[#2D333B] px-4 md:px-6 flex items-center justify-between relative z-30 backdrop-blur-md">
      
      {/* Left: Navigation & Active Case Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onHomeClick}
          className="p-1.5 rounded-lg bg-[#1f1f22] text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] transition-all flex items-center gap-1.5 border border-[#2D333B] text-xs font-medium"
          title="Return to Network Selector"
        >
          <Home size={16} />
          <span className="hidden sm:inline">Selector</span>
        </button>

        <div className="h-5 w-[1px] bg-[#2D333B]" />

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#00adb5]/10 text-[#55d8e1] border border-[#00adb5]/30">
            <Zap size={16} />
          </div>
          <span className="text-sm font-bold text-[#e4e1e5] tracking-wide font-sans hidden md:inline">
            IEEE Digital Twin
          </span>
        </div>

        {/* Case Dropdown */}
        <div className="relative">
          <select
            value={selectedCaseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="appearance-none bg-[#1f1f22] border border-[#2D333B] text-[#55d8e1] text-xs font-bold rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-[#55d8e1] cursor-pointer hover:border-[#00adb5]/50 transition-colors"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#131316] text-[#e4e1e5]">
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-2 text-[#bbc9ca] pointer-events-none" />
        </div>
      </div>

      {/* Middle: Clean Telemetry Summary */}
      {summary && (
        <div className="hidden xl:flex items-center gap-4 text-xs font-mono">
          {getHealthBadge(summary.grid_health)}

          <div className="h-4 w-[1px] bg-[#2D333B]" />

          <div className="flex items-center gap-4 text-[#bbc9ca]">
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Buses:</span>
              <span className="font-bold text-[#e4e1e5]">{summary.n_bus}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Gen:</span>
              <span className="font-bold text-[#55d8e1]">{summary.total_gen_mw} MW</span>
            </div>
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Load:</span>
              <span className="font-bold text-emerald-400">{summary.total_load_mw} MW</span>
            </div>
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Loss:</span>
              <span className="font-bold text-[#FFD369]">{summary.total_losses_mw} MW</span>
            </div>
          </div>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleStressPanel}
          className={`text-xs px-3 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1.5 border ${
            isStressPanelOpen
              ? 'bg-[#FFD369] text-[#1f1f22] border-[#FFD369] shadow-[0_0_12px_rgba(255,211,105,0.3)]'
              : 'bg-[#1f1f22] border-[#2D333B] text-[#FFD369] hover:border-[#FFD369]/50'
          }`}
          title="Open Load Scaling & Stress Test Panel"
        >
          <Sliders size={14} />
          <span>Stress Test</span>
        </button>

        <button
          onClick={onRefreshClick}
          disabled={isLoading}
          className="bg-[#1f1f22] border border-[#2D333B] text-[#e4e1e5] hover:text-[#55d8e1] hover:border-[#00adb5] text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-medium"
          title="Re-solve AC Newton-Raphson Power Flow"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Solve</span>
        </button>

        <button
          onClick={onOpenDataTable}
          className="bg-[#55d8e1] text-[#003739] hover:bg-[#55d8e1]/90 text-xs px-3.5 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(85,216,225,0.25)]"
        >
          <Table size={14} />
          <span>Matrix Table</span>
        </button>
      </div>

    </header>
  );
}

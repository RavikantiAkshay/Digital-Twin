import React from 'react';
import { 
  Zap, 
  Home, 
  RefreshCw, 
  Table, 
  ShieldCheck, 
  AlertTriangle, 
  XOctagon, 
  Activity,
  Cpu,
  ChevronDown
} from 'lucide-react';

export default function TopBar({ 
  cases, 
  selectedCaseId, 
  onSelectCase, 
  summary, 
  onHomeClick, 
  onRefreshClick, 
  onOpenDataTable,
  isLoading 
}) {
  const getHealthBadge = (health) => {
    if (health === 'SAFE') {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 glow-success">
          <ShieldCheck size={14} />
          SAFE
        </span>
      );
    }
    if (health === 'ALERT') {
      return (
        <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5 glow-warning">
          <AlertTriangle size={14} />
          ALERT
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 glow-danger">
        <XOctagon size={14} />
        CRITICAL
      </span>
    );
  };

  return (
    <header className="h-16 bg-[#0c1222]/90 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between relative z-30 backdrop-blur-md">
      {/* Brand & Mode Switcher */}
      <div className="flex items-center gap-4">
        <button
          onClick={onHomeClick}
          className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2 border border-slate-700"
          title="Return to Selection Screen"
        >
          <Home size={18} />
          <span className="hidden sm:inline text-xs font-semibold">Home</span>
        </button>

        <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Zap size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              VOLT-TWIN <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">AC PF</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-light">Interactive Grid Visualizer</p>
          </div>
        </div>

        {/* Case Selector Dropdown */}
        <div className="relative ml-2">
          <select
            value={selectedCaseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id.toUpperCase()})
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Live System Telemetry Summary Pills */}
      {summary && (
        <div className="hidden lg:flex items-center gap-4">
          {/* Health Badge */}
          {getHealthBadge(summary.grid_health)}

          <div className="h-6 w-[1px] bg-slate-800" />

          {/* Stats Pills */}
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL BUSES</span>
              <span className="font-mono font-bold text-slate-200">{summary.n_bus}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL LINES</span>
              <span className="font-mono font-bold text-slate-200">{summary.n_branch}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">GEN POWER</span>
              <span className="font-mono font-bold text-cyan-400">{summary.total_gen_mw} MW</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">GRID LOAD</span>
              <span className="font-mono font-bold text-emerald-400">{summary.total_load_mw} MW</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">LOSSES</span>
              <span className="font-mono font-bold text-amber-400">{summary.total_losses_mw} MW</span>
            </div>
          </div>
        </div>
      )}

      {/* Right Controls & Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshClick}
          disabled={isLoading}
          className="btn-secondary text-xs px-3 py-1.5"
          title="Re-run AC Power Flow"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden md:inline">Run PF</span>
        </button>

        <button
          onClick={onOpenDataTable}
          className="btn-primary text-xs px-3 py-1.5"
        >
          <Table size={14} />
          <span className="hidden md:inline">Data Table</span>
        </button>
      </div>
    </header>
  );
}

import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Zap, 
  AlertTriangle, 
  ShieldCheck, 
  XOctagon, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Flame,
  Activity,
  CheckSquare,
  Square,
  Search,
  CheckCircle2,
  Filter
} from 'lucide-react';

export default function StressTestPanel({ 
  isOpen, 
  onClose, 
  summary, 
  nodes = [], 
  violations = [], 
  onApplyStress, 
  isLoading 
}) {
  // Array of load rules: [{ id: 'rule_1', multiplier: 3.5, targetBuses: [9, 10, 14] }]
  const [loadGroups, setLoadGroups] = useState([]);
  
  // Current Rule Creation Form State
  const [multiplierInput, setMultiplierInput] = useState(2.0);
  const [selectedBuses, setSelectedBuses] = useState([]);
  const [busSearchQuery, setBusSearchQuery] = useState('');
  const [busTypeFilter, setBusTypeFilter] = useState('all'); // 'all' | 'pq' | 'pv'

  if (!isOpen) return null;

  // Filter nodes based on search & bus type
  const filteredNodes = nodes.filter(n => {
    const matchesSearch = n.label.toLowerCase().includes(busSearchQuery.toLowerCase()) ||
                          n.id.toString().includes(busSearchQuery);
    if (!matchesSearch) return false;

    if (busTypeFilter === 'pq') return n.type === 'pq' || n.pd > 0;
    if (busTypeFilter === 'pv') return n.type === 'pv' || n.type === 'slack';
    return true;
  });

  // Toggle single bus selection
  const handleToggleBus = (busId) => {
    setSelectedBuses(prev => 
      prev.includes(busId) 
        ? prev.filter(id => id !== busId) 
        : [...prev, busId]
    );
  };

  // Select all visible filtered buses
  const handleSelectAllVisible = () => {
    const visibleIds = filteredNodes.map(n => n.id);
    const allSelected = visibleIds.every(id => selectedBuses.includes(id));
    
    if (allSelected) {
      // Unselect all visible
      setSelectedBuses(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible
      setSelectedBuses(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Clear current selection
  const handleClearSelection = () => {
    setSelectedBuses([]);
  };

  // Save Load Rule
  const handleSaveGroup = () => {
    if (selectedBuses.length === 0) return;
    
    const newRule = {
      id: `rule_${Date.now()}`,
      multiplier: parseFloat(multiplierInput),
      targetBuses: [...selectedBuses].sort((a, b) => a - b)
    };

    setLoadGroups(prev => [...prev, newRule]);
    setSelectedBuses([]);
  };

  // Delete Load Rule
  const handleDeleteGroup = (ruleId) => {
    setLoadGroups(prev => prev.filter(g => g.id !== ruleId));
  };

  // Reset all load rules
  const handleResetAll = () => {
    setLoadGroups([]);
    setSelectedBuses([]);
    onApplyStress({});
  };

  // Submit all active load rules to solve power flow
  const handleRunPowerFlow = () => {
    const compiledScales = {};
    loadGroups.forEach(rule => {
      rule.targetBuses.forEach(bId => {
        compiledScales[bId] = rule.multiplier;
      });
    });

    onApplyStress(compiledScales);
  };

  const getHealthBadge = (health) => {
    if (health === 'SAFE') {
      return (
        <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <ShieldCheck size={15} />
          SAFE SYSTEM
        </span>
      );
    }
    if (health === 'ALERT') {
      return (
        <span className="px-3.5 py-1 rounded-full bg-[#FFD369]/10 border border-[#FFD369]/30 text-[#FFD369] text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,211,105,0.2)]">
          <AlertTriangle size={15} />
          ALERT CONDITION
        </span>
      );
    }
    return (
      <span className="px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_14px_rgba(239,68,68,0.3)] animate-pulse">
        <XOctagon size={15} />
        CRITICAL OVERLOAD
      </span>
    );
  };

  return (
    <aside className="w-full sm:w-[540px] md:w-[600px] lg:w-[640px] bg-[#18181b]/98 border-l border-[#2D333B] h-[calc(100vh-3.5rem)] fixed top-14 right-0 z-30 flex flex-col justify-between overflow-y-auto shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-300">
      
      <div className="p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2D333B]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30">
              <Sliders size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e4e1e5] uppercase tracking-wide font-sans">
                Bus Load Stress Manager
              </h2>
              <p className="text-xs text-[#869394]">Configure & Execute Multi-Bus Stress Load Scenarios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* SECTION 1: CREATE LOAD STRESS RULE */}
        <div className="space-y-5 p-5 rounded-2xl bg-[#131316] border border-[#2D333B] shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#55d8e1] uppercase tracking-wider flex items-center gap-2">
              <Plus size={16} />
              1. Define Load Stress Rule
            </span>
          </div>

          {/* Multiplier Presets & Custom Input */}
          <div className="space-y-2">
            <label className="text-xs text-[#bbc9ca] font-medium block">
              Set Load Multiplier (Shedding: &lt;1.0x, Heavy Load: &gt;1.0x):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative w-full sm:w-36">
                <input
                  type="number"
                  min="0.05"
                  max="10.0"
                  step="0.05"
                  value={multiplierInput}
                  onChange={(e) => setMultiplierInput(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#1f1f22] border border-[#2D333B] text-[#55d8e1] font-mono text-base font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-[#55d8e1]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-mono font-bold text-[#869394]">x</span>
              </div>

              <div className="flex-1 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[0.3, 0.5, 0.7, 0.8, 1.5, 2.0, 3.0, 5.0].map(m => (
                  <button
                    key={m}
                    onClick={() => setMultiplierInput(m)}
                    className={`py-2 text-xs font-bold font-mono rounded-xl border transition-all ${
                      multiplierInput === m
                        ? 'bg-[#55d8e1] text-[#003739] border-[#55d8e1] shadow-[0_0_10px_rgba(85,216,225,0.3)]'
                        : 'bg-[#1f1f22] text-[#bbc9ca] border-[#2D333B] hover:border-[#55d8e1]/50'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Buses Multi-Select Header */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#e4e1e5] font-semibold flex items-center gap-1.5">
                Target Buses ({selectedBuses.length} Selected)
              </span>

              <div className="flex items-center gap-2">
                {/* Type Filters */}
                <div className="flex bg-[#1f1f22] p-1 rounded-xl border border-[#2D333B] text-[11px] font-mono">
                  <button
                    onClick={() => setBusTypeFilter('all')}
                    className={`px-2 py-0.5 rounded-lg transition-colors ${busTypeFilter === 'all' ? 'bg-[#2a2a2d] text-[#55d8e1] font-bold' : 'text-[#869394]'}`}
                  >
                    All ({nodes.length})
                  </button>
                  <button
                    onClick={() => setBusTypeFilter('pq')}
                    className={`px-2 py-0.5 rounded-lg transition-colors ${busTypeFilter === 'pq' ? 'bg-[#2a2a2d] text-[#55d8e1] font-bold' : 'text-[#869394]'}`}
                  >
                    Loads ({nodes.filter(n => n.pd > 0 || n.type === 'pq').length})
                  </button>
                </div>

                <button
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1 rounded-xl bg-[#55d8e1]/10 text-[#55d8e1] hover:bg-[#55d8e1]/20 border border-[#55d8e1]/30 text-[11px] font-bold transition-all"
                >
                  Select All Visible
                </button>
                {selectedBuses.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-2.5 py-1 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-[11px] font-bold transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by bus number or label (e.g., Bus 14)..."
                value={busSearchQuery}
                onChange={(e) => setBusSearchQuery(e.target.value)}
                className="w-full bg-[#1f1f22] border border-[#2D333B] text-[#e4e1e5] text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-[#55d8e1]"
              />
              <Search size={15} className="absolute left-3 top-2.5 text-[#869394]" />
            </div>

            {/* SPACIOUS 2-COLUMN / 3-COLUMN BUS GRID */}
            <div className="max-h-64 overflow-y-auto bg-[#1a1a1d] border border-[#2D333B] rounded-2xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredNodes.map(n => {
                const isChecked = selectedBuses.includes(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleToggleBus(n.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                      isChecked
                        ? 'bg-[#55d8e1]/15 border-[#55d8e1] text-[#55d8e1] shadow-[0_0_10px_rgba(85,216,225,0.15)] font-bold'
                        : 'bg-[#1f1f22] border-[#2D333B] text-[#bbc9ca] hover:border-[#55d8e1]/40 hover:bg-[#252528]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                        {isChecked ? (
                          <CheckCircle2 size={15} className="text-[#55d8e1]" />
                        ) : (
                          <Square size={15} className="text-[#869394]" />
                        )}
                        <span>Bus {n.id}</span>
                      </div>
                      <span className={`text-[9px] uppercase px-1 py-0.2 rounded font-mono font-bold ${
                        n.type === 'slack' ? 'bg-amber-500/20 text-amber-400' :
                        n.type === 'pv' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {n.type}
                      </span>
                    </div>

                    <div className="mt-1 flex justify-between items-center text-[10px] font-mono text-[#869394]">
                      <span>Demand:</span>
                      <span className="font-bold text-[#e4e1e5]">{n.pd} MW</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Rule Button */}
          <button
            onClick={handleSaveGroup}
            disabled={selectedBuses.length === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-[#55d8e1]/20 border border-[#55d8e1]/50 text-[#55d8e1] hover:bg-[#55d8e1] hover:text-[#003739] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(85,216,225,0.2)]"
          >
            <Plus size={16} />
            <span>Save Load Rule ({selectedBuses.length} Target Buses @ {multiplierInput}x)</span>
          </button>
        </div>

        {/* SECTION 2: ACTIVE LOAD RULES LIST */}
        <div className="space-y-3 p-5 rounded-2xl bg-[#131316] border border-[#2D333B]">
          <div className="flex justify-between items-center text-xs font-bold text-[#e4e1e5] uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <Flame size={16} className="text-[#FFD369]" />
              2. Configured Load Rules
            </span>
            <span className="font-mono text-[#FFD369] font-bold text-xs bg-[#FFD369]/10 px-2.5 py-0.5 rounded-lg border border-[#FFD369]/30">
              {loadGroups.length} Active Rules
            </span>
          </div>

          {loadGroups.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#869394] font-mono border border-dashed border-[#2D333B] rounded-2xl">
              No stress rules added yet. Grid is running with standard IEEE benchmark loads (1.0x).
            </div>
          ) : (
            <div className="space-y-2.5">
              {loadGroups.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-2xl bg-[#1f1f22] border border-[#2D333B] flex items-start justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 font-sans font-bold text-[#e4e1e5]">
                      <span>Rule #{idx + 1}:</span>
                      <span className="text-[#FFD369] bg-[#FFD369]/10 px-2.5 py-0.5 rounded-lg border border-[#FFD369]/30 text-xs">
                        {rule.multiplier}x Load Multiplier
                      </span>
                    </div>

                    <div className="text-[11px] text-[#869394]">
                      Target Buses ({rule.targetBuses.length}):
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
                      {rule.targetBuses.map(b => (
                        <span key={b} className="px-2 py-0.5 rounded-md bg-[#2a2a2d] text-[#55d8e1] font-bold text-[10px]">
                          Bus {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteGroup(rule.id)}
                    className="p-2 rounded-xl text-[#869394] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove Load Rule"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: RUN POWER FLOW ACTION */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleRunPowerFlow}
            disabled={isLoading}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-[#55d8e1] text-[#003739] hover:bg-[#55d8e1]/90 disabled:opacity-50 transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(85,216,225,0.35)]"
          >
            <Zap size={18} className={isLoading ? 'animate-spin' : ''} />
            <span>Run Power Flow ⚡</span>
          </button>

          <button
            onClick={handleResetAll}
            disabled={isLoading}
            className="p-3.5 rounded-2xl bg-[#1f1f22] text-[#bbc9ca] hover:text-[#e4e1e5] border border-[#2D333B] hover:border-[#55d8e1]/50 transition-all"
            title="Reset All Load Rules to Base IEEE Model"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* SECTION 4: SECURITY CLASSIFICATION & TELEMETRY */}
        <div className="space-y-4 p-5 rounded-2xl bg-[#131316] border border-[#2D333B]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#e4e1e5] uppercase tracking-wider font-sans">
              Network Security State
            </span>
            {summary && getHealthBadge(summary.grid_health)}
          </div>

          {/* Summary Telemetry */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-2xl bg-[#1f1f22] border border-[#2D333B]">
                <span className="text-[10px] text-[#869394] block uppercase">Total Grid Demand</span>
                <span className="font-bold text-base text-[#55d8e1]">{summary.total_load_mw} MW</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#1f1f22] border border-[#2D333B]">
                <span className="text-[10px] text-[#869394] block uppercase">Total System Losses</span>
                <span className="font-bold text-base text-[#FFD369]">{summary.total_losses_mw} MW</span>
              </div>
            </div>
          )}

          {/* Active Violations Feed */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#e4e1e5]">Active Violations Feed</span>
              <span className="font-mono text-xs text-[#869394]">{violations.length} recorded</span>
            </div>

            {violations.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium">
                No voltage or thermal violations detected. Network operating within safe limits.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {violations.map((v, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-2xl border flex items-center justify-between ${
                      v.severity === 'critical'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-[#FFD369]/10 border-[#FFD369]/30 text-[#FFD369]'
                    }`}
                  >
                    <div>
                      <div className="font-bold font-sans">{v.element}</div>
                      <div className="text-[11px] opacity-80">{v.category}: {v.value}</div>
                    </div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-lg font-bold bg-black/40 border border-current">
                      {v.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="p-4 border-t border-[#2D333B] text-[11px] text-[#869394] text-center font-mono">
        IEEE Newton-Raphson Load Stress Engine
      </div>
    </aside>
  );
}

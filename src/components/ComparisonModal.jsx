import React, { useState, useMemo } from 'react';
import { 
  X, 
  GitCompare, 
  Zap, 
  Network, 
  Sliders, 
  ShieldCheck, 
  AlertTriangle, 
  XOctagon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  RotateCcw, 
  Search, 
  Table, 
  Activity,
  CheckCircle2,
  Minus
} from 'lucide-react';

export default function ComparisonModal({ 
  isOpen, 
  onClose, 
  baselineData, 
  networkData, 
  onResetStress 
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'buses' | 'branches' | 'violations'
  const [searchFilter, setSearchFilter] = useState('');
  const [onlyChangedFilter, setOnlyChangedFilter] = useState(false);

  // Compute Delta Calculations unconditionally
  const comparison = useMemo(() => {
    if (!baselineData || !networkData) {
      return null;
    }

    const baseSummary = baselineData.summary || {};
    const stressSummary = networkData.summary || {};

    const baseNodes = baselineData.nodes || [];
    const stressNodes = networkData.nodes || [];

    const baseEdges = baselineData.edges || [];
    const stressEdges = networkData.edges || [];

    const baseViolations = baselineData.violations || [];
    const stressViolations = networkData.violations || [];

    // 1. Summary Deltas
    const deltaLoadMw = (stressSummary.total_load_mw || 0) - (baseSummary.total_load_mw || 0);
    const deltaLoadPct = baseSummary.total_load_mw > 0 
      ? ((deltaLoadMw / baseSummary.total_load_mw) * 100) 
      : 0;

    const deltaGenMw = (stressSummary.total_gen_mw || 0) - (baseSummary.total_gen_mw || 0);
    const deltaGenPct = baseSummary.total_gen_mw > 0 
      ? ((deltaGenMw / baseSummary.total_gen_mw) * 100) 
      : 0;

    const deltaLossMw = (stressSummary.total_losses_mw || 0) - (baseSummary.total_losses_mw || 0);
    const deltaLossPct = baseSummary.total_losses_mw > 0 
      ? ((deltaLossMw / baseSummary.total_losses_mw) * 100) 
      : 0;

    const deltaViolations = (stressSummary.total_violations_count || 0) - (baseSummary.total_violations_count || 0);

    // Max branch loading
    const maxBaseLoading = baseEdges.length > 0 ? Math.max(...baseEdges.map(e => e.loading_pct || 0)) : 0;
    const maxStressLoading = stressEdges.length > 0 ? Math.max(...stressEdges.map(e => e.loading_pct || 0)) : 0;
    const deltaMaxLoading = maxStressLoading - maxBaseLoading;

    // 2. Bus-by-Bus Diff Mapping
    const baseNodeMap = new Map(baseNodes.map(n => [n.id, n]));
    const busesDiff = stressNodes.map(sNode => {
      const bNode = baseNodeMap.get(sNode.id) || sNode;
      const deltaVm = (sNode.vm || 0) - (bNode.vm || 0);
      const deltaPd = (sNode.pd || 0) - (bNode.pd || 0);
      const deltaQd = (sNode.qd || 0) - (bNode.qd || 0);
      const isChanged = Math.abs(deltaVm) > 0.0001 || Math.abs(deltaPd) > 0.01;

      return {
        id: sNode.id,
        label: sNode.label || `Bus ${sNode.id}`,
        type: sNode.type,
        base_vm: bNode.vm,
        stress_vm: sNode.vm,
        delta_vm: deltaVm,
        base_pd: bNode.pd,
        stress_pd: sNode.pd,
        delta_pd: deltaPd,
        base_qd: bNode.qd,
        stress_qd: sNode.qd,
        delta_qd: deltaQd,
        base_status: bNode.v_status || 'safe',
        stress_status: sNode.v_status || 'safe',
        is_targeted: sNode.is_targeted,
        multiplier: sNode.load_multiplier || 1.0,
        isChanged
      };
    });

    // 3. Branch-by-Branch Diff Mapping
    const baseEdgeMap = new Map(baseEdges.map(e => [e.id || `${e.from_bus}-${e.to_bus}`, e]));
    const branchesDiff = stressEdges.map(sEdge => {
      const bEdge = baseEdgeMap.get(sEdge.id || `${sEdge.from_bus}-${sEdge.to_bus}`) || sEdge;
      const deltaFlow = (sEdge.s_flow || 0) - (bEdge.s_flow || 0);
      const deltaLoading = (sEdge.loading_pct || 0) - (bEdge.loading_pct || 0);
      const deltaLoss = (sEdge.p_loss || 0) - (bEdge.p_loss || 0);
      const isChanged = Math.abs(deltaLoading) > 0.1 || Math.abs(deltaFlow) > 0.05;

      return {
        id: sEdge.id,
        from_bus: sEdge.from_bus,
        to_bus: sEdge.to_bus,
        rate_a: sEdge.rate_a,
        base_flow: bEdge.s_flow,
        stress_flow: sEdge.s_flow,
        delta_flow: deltaFlow,
        base_loading: bEdge.loading_pct,
        stress_loading: sEdge.loading_pct,
        delta_loading: deltaLoading,
        base_loss: bEdge.p_loss,
        stress_loss: sEdge.p_loss,
        delta_loss: deltaLoss,
        base_status: bEdge.thermal_status || 'normal',
        stress_status: sEdge.thermal_status || 'normal',
        isChanged
      };
    });

    // 4. New Violations (Present in stress but not in base)
    const baseViolationKeys = new Set(baseViolations.map(v => `${v.category}_${v.element}_${v.type}`));
    const newViolations = stressViolations.filter(v => !baseViolationKeys.has(`${v.category}_${v.element}_${v.type}`));

    return {
      summary: {
        case_id: stressSummary.case_id || 'network',
        base_health: baseSummary.grid_health || 'SAFE',
        stress_health: stressSummary.grid_health || 'SAFE',
        base_load_mw: baseSummary.total_load_mw || 0,
        stress_load_mw: stressSummary.total_load_mw || 0,
        delta_load_mw: deltaLoadMw,
        delta_load_pct: deltaLoadPct,
        base_gen_mw: baseSummary.total_gen_mw || 0,
        stress_gen_mw: stressSummary.total_gen_mw || 0,
        delta_gen_mw: deltaGenMw,
        delta_gen_pct: deltaGenPct,
        base_loss_mw: baseSummary.total_losses_mw || 0,
        stress_loss_mw: stressSummary.total_losses_mw || 0,
        delta_loss_mw: deltaLossMw,
        delta_loss_pct: deltaLossPct,
        base_violations: baseSummary.total_violations_count || 0,
        stress_violations: stressSummary.total_violations_count || 0,
        delta_violations: deltaViolations,
        max_base_loading: maxBaseLoading,
        max_stress_loading: maxStressLoading,
        delta_max_loading: deltaMaxLoading
      },
      busesDiff,
      branchesDiff,
      newViolations,
      allStressViolations: stressViolations
    };
  }, [baselineData, networkData]);

  if (!isOpen || !comparison) return null;

  const { summary: s, busesDiff, branchesDiff, newViolations } = comparison;

  // Filtered bus lists
  const filteredBuses = busesDiff.filter(b => {
    const matchesSearch = b.id.toString().includes(searchFilter) || b.label.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (onlyChangedFilter) return b.isChanged;
    return true;
  });

  // Filtered branch lists
  const filteredBranches = branchesDiff.filter(br => {
    const matchesSearch = br.from_bus.toString().includes(searchFilter) || 
                          br.to_bus.toString().includes(searchFilter) || 
                          br.id.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (onlyChangedFilter) return br.isChanged;
    return true;
  });

  // Export Comparison Data
  const handleExportJson = () => {
    const exportObj = {
      timestamp: new Date().toISOString(),
      case_id: s.case_id,
      summary_comparison: s,
      buses_delta: busesDiff,
      branches_delta: branchesDiff,
      new_violations: newViolations
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grid_comparison_${s.case_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderHealthBadge = (health) => {
    if (health === 'SAFE') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
          <ShieldCheck size={12} />
          SAFE
        </span>
      );
    }
    if (health === 'ALERT') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#FFD369]/10 border border-[#FFD369]/30 text-[#FFD369] text-xs font-bold flex items-center gap-1">
          <AlertTriangle size={12} />
          ALERT
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1">
        <XOctagon size={12} />
        OVERLOAD
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-[#19191c] border border-[#2D333B] rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-[#2D333B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1f1f22]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30">
              <GitCompare size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#e4e1e5]">
                  Base Case vs. Stressed Model Comparison
                </h2>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#55d8e1]/10 border border-[#55d8e1]/30 text-[#55d8e1]">
                  {s.case_id.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#bbc9ca]">
                Differential telemetry analysis between normal baseline (1.0x) and active stressed grid
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onResetStress && (
              <button
                onClick={() => {
                  onResetStress();
                  onClose();
                }}
                className="bg-[#1b1b1e] border border-[#2D333B] text-[#bbc9ca] hover:text-white hover:border-[#55d8e1] text-xs px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5"
                title="Reset network to unscaled baseline"
              >
                <RotateCcw size={13} />
                <span>Reset to Base</span>
              </button>
            )}

            <button
              onClick={handleExportJson}
              className="bg-[#1b1b1e] border border-[#2D333B] text-[#55d8e1] hover:border-[#55d8e1]/50 hover:bg-[#2a2a2d] text-xs px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5"
              title="Download JSON comparison report"
            >
              <Download size={13} />
              <span>Export Diff</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#bbc9ca] hover:text-white hover:bg-[#2a2a2d] transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS & SEARCH BAR                                              */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 border-b border-[#2D333B] bg-[#131316] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1b1b1e] border border-[#2D333B] text-[#bbc9ca] hover:text-white'
              }`}
            >
              <Activity size={14} />
              <span>Executive Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('buses')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'buses'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1b1b1e] border border-[#2D333B] text-[#bbc9ca] hover:text-white'
              }`}
            >
              <Network size={14} />
              <span>Buses Delta ({busesDiff.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'branches'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1b1b1e] border border-[#2D333B] text-[#bbc9ca] hover:text-white'
              }`}
            >
              <Sliders size={14} />
              <span>Branches Delta ({branchesDiff.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('violations')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'violations'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1b1b1e] border border-[#2D333B] text-[#bbc9ca] hover:text-white'
              }`}
            >
              <AlertTriangle size={14} className={newViolations.length > 0 ? 'text-[#FFD369]' : ''} />
              <span>New Violations ({newViolations.length})</span>
            </button>
          </div>

          {/* Search & Changed Filter */}
          {activeTab !== 'summary' && activeTab !== 'violations' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="flex items-center gap-1.5 text-[11px] text-[#bbc9ca] cursor-pointer mr-1">
                <input
                  type="checkbox"
                  checked={onlyChangedFilter}
                  onChange={(e) => setOnlyChangedFilter(e.target.checked)}
                  className="rounded border-[#2D333B] text-[#55d8e1] focus:ring-0 bg-[#1b1b1e]"
                />
                <span>Only Changed Rows</span>
              </label>

              <div className="relative w-full sm:w-56">
                <Search size={13} className="absolute left-2.5 top-2 text-[#869394]" />
                <input
                  type="text"
                  placeholder="Filter by Bus/Line ID..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#1b1b1e] border border-[#2D333B] text-xs text-[#e4e1e5] rounded-lg pl-7 pr-2.5 py-1 focus:outline-none focus:border-[#55d8e1] font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY WORKSPACE                                                       */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE SUMMARY DIFF CARDS                                       */}
          {/* ========================================================================= */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              
              {/* Top Security Shift Banner */}
              <div className="p-4 rounded-2xl bg-[#1f1f22] border border-[#2D333B] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30">
                    <Activity size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#e4e1e5]">
                      System Operating Security Shift
                    </h3>
                    <p className="text-xs text-[#bbc9ca]">
                      Transition from unscaled base operating state to active contingency / load stress state
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#869394] text-[11px]">BASE:</span>
                    {renderHealthBadge(s.base_health)}
                  </div>
                  <div className="text-[#869394]">→</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#869394] text-[11px]">STRESSED:</span>
                    {renderHealthBadge(s.stress_health)}
                  </div>
                </div>
              </div>

              {/* 4 Core Metric Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* CARD 1: TOTAL LOAD DEMAND */}
                <div className="p-4 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] flex flex-col justify-between">
                  <div className="text-[11px] text-[#869394] uppercase tracking-wider font-semibold">
                    Total Load Demand
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-bold font-mono text-[#e4e1e5]">
                      {s.stress_load_mw.toFixed(1)} <span className="text-xs text-[#869394]">MW</span>
                    </div>
                    <div className="text-xs text-[#bbc9ca] font-mono mt-0.5">
                      Base: <span className="text-emerald-400 font-semibold">{s.base_load_mw.toFixed(1)} MW</span>
                    </div>
                  </div>
                  <div className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    s.delta_load_mw > 0 ? 'text-[#55d8e1]' : s.delta_load_mw < 0 ? 'text-emerald-400' : 'text-[#869394]'
                  }`}>
                    {s.delta_load_mw > 0 ? <ArrowUpRight size={14} /> : s.delta_load_mw < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                    <span>{s.delta_load_mw >= 0 ? `+${s.delta_load_mw.toFixed(1)}` : s.delta_load_mw.toFixed(1)} MW ({s.delta_load_pct >= 0 ? `+${s.delta_load_pct.toFixed(1)}%` : `${s.delta_load_pct.toFixed(1)}%`})</span>
                  </div>
                </div>

                {/* CARD 2: TOTAL GENERATION */}
                <div className="p-4 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] flex flex-col justify-between">
                  <div className="text-[11px] text-[#869394] uppercase tracking-wider font-semibold">
                    Total Active Generation
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-bold font-mono text-[#55d8e1]">
                      {s.stress_gen_mw.toFixed(1)} <span className="text-xs text-[#869394]">MW</span>
                    </div>
                    <div className="text-xs text-[#bbc9ca] font-mono mt-0.5">
                      Base: <span className="text-[#55d8e1]/80 font-semibold">{s.base_gen_mw.toFixed(1)} MW</span>
                    </div>
                  </div>
                  <div className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    s.delta_gen_mw > 0 ? 'text-[#55d8e1]' : 'text-[#869394]'
                  }`}>
                    {s.delta_gen_mw > 0 ? <ArrowUpRight size={14} /> : <Minus size={14} />}
                    <span>{s.delta_gen_mw >= 0 ? `+${s.delta_gen_mw.toFixed(1)}` : s.delta_gen_mw.toFixed(1)} MW ({s.delta_gen_pct >= 0 ? `+${s.delta_gen_pct.toFixed(1)}%` : `${s.delta_gen_pct.toFixed(1)}%`})</span>
                  </div>
                </div>

                {/* CARD 3: TRANSMISSION LOSSES */}
                <div className="p-4 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] flex flex-col justify-between">
                  <div className="text-[11px] text-[#869394] uppercase tracking-wider font-semibold">
                    Transmission Losses ($I^2R$)
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-bold font-mono text-[#FFD369]">
                      {s.stress_loss_mw.toFixed(2)} <span className="text-xs text-[#869394]">MW</span>
                    </div>
                    <div className="text-xs text-[#bbc9ca] font-mono mt-0.5">
                      Base: <span className="text-[#FFD369]/80 font-semibold">{s.base_loss_mw.toFixed(2)} MW</span>
                    </div>
                  </div>
                  <div className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    s.delta_loss_mw > 0 ? 'text-[#FFD369]' : 'text-emerald-400'
                  }`}>
                    {s.delta_loss_mw > 0 ? <ArrowUpRight size={14} /> : <Minus size={14} />}
                    <span>{s.delta_loss_mw >= 0 ? `+${s.delta_loss_mw.toFixed(2)}` : s.delta_loss_mw.toFixed(2)} MW ({s.delta_loss_pct >= 0 ? `+${s.delta_loss_pct.toFixed(1)}%` : `${s.delta_loss_pct.toFixed(1)}%`})</span>
                  </div>
                </div>

                {/* CARD 4: MAXIMUM LINE LOADING */}
                <div className="p-4 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] flex flex-col justify-between">
                  <div className="text-[11px] text-[#869394] uppercase tracking-wider font-semibold">
                    Max Line Thermal Loading
                  </div>
                  <div className="my-2">
                    <div className={`text-2xl font-bold font-mono ${
                      s.max_stress_loading > 100 ? 'text-red-400' : 'text-[#e4e1e5]'
                    }`}>
                      {s.max_stress_loading.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#bbc9ca] font-mono mt-0.5">
                      Base: <span className="font-semibold text-[#e4e1e5]">{s.max_base_loading.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    s.delta_max_loading > 0 ? (s.max_stress_loading > 100 ? 'text-red-400' : 'text-[#FFD369]') : 'text-emerald-400'
                  }`}>
                    {s.delta_max_loading > 0 ? <ArrowUpRight size={14} /> : <Minus size={14} />}
                    <span>{s.delta_max_loading >= 0 ? `+${s.delta_max_loading.toFixed(1)}%` : `${s.delta_max_loading.toFixed(1)}%`} shift</span>
                  </div>
                </div>

              </div>

              {/* Key Impact Summary Highlights */}
              <div className="p-4 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] space-y-3">
                <h4 className="text-xs font-bold text-[#e4e1e5] uppercase tracking-wider">
                  Contingency & Stress Assessment Findings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                    <div className="text-[#869394] text-[11px]">Active Violations Delta</div>
                    <div className="text-base font-bold font-mono text-[#e4e1e5] mt-1">
                      {s.base_violations} → <span className={s.stress_violations > s.base_violations ? 'text-red-400' : 'text-emerald-400'}>{s.stress_violations}</span>
                    </div>
                    <div className="text-[11px] text-[#bbc9ca] mt-0.5">
                      {s.delta_violations > 0 ? `+${s.delta_violations} new limit excursions` : 'No additional violations created'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                    <div className="text-[#869394] text-[11px]">Buses Experiencing Voltage Sag</div>
                    <div className="text-base font-bold font-mono text-[#55d8e1] mt-1">
                      {busesDiff.filter(b => b.delta_vm < -0.01).length} / {busesDiff.length} Buses
                    </div>
                    <div className="text-[11px] text-[#bbc9ca] mt-0.5">
                      Voltage deviation greater than 0.01 p.u.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                    <div className="text-[#869394] text-[11px]">Branches with Increased Flow</div>
                    <div className="text-base font-bold font-mono text-[#00adb5] mt-1">
                      {branchesDiff.filter(br => br.delta_flow > 0.5).length} / {branchesDiff.length} Lines
                    </div>
                    <div className="text-[11px] text-[#bbc9ca] mt-0.5">
                      Corridors carrying higher throughput
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BUSES DELTA MATRIX TABLE                                           */}
          {/* ========================================================================= */}
          {activeTab === 'buses' && (
            <div className="border border-[#2D333B] rounded-xl overflow-hidden bg-[#1f1f22]">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-[#131316] text-[#869394] border-b border-[#2D333B] text-[11px] sticky top-0 z-10 font-sans">
                      <th className="p-2.5">Bus</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Base Vm (p.u.)</th>
                      <th className="p-2.5">Stressed Vm</th>
                      <th className="p-2.5">Delta Vm</th>
                      <th className="p-2.5">Base Pd (MW)</th>
                      <th className="p-2.5">Stressed Pd</th>
                      <th className="p-2.5">Delta Pd</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D333B]/60">
                    {filteredBuses.map((b) => (
                      <tr 
                        key={b.id} 
                        className={`hover:bg-[#2a2a2d]/40 transition-colors ${
                          b.is_targeted ? 'bg-[#55d8e1]/5' : ''
                        }`}
                      >
                        <td className="p-2.5 font-bold text-[#e4e1e5]">
                          <span className="text-[#55d8e1]">Bus {b.id}</span>
                          {b.is_targeted && (
                            <span className="ml-1.5 text-[10px] font-sans px-1.5 py-0.5 rounded bg-[#FFD369]/10 text-[#FFD369] border border-[#FFD369]/30">
                              {b.multiplier}x
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 uppercase text-[11px] text-[#bbc9ca] font-sans">
                          {b.type}
                        </td>
                        <td className="p-2.5 text-[#bbc9ca]">
                          {b.base_vm.toFixed(4)}
                        </td>
                        <td className="p-2.5 font-bold text-[#e4e1e5]">
                          {b.stress_vm.toFixed(4)}
                        </td>
                        <td className={`p-2.5 font-bold ${
                          b.delta_vm < -0.02 ? 'text-red-400' : b.delta_vm < -0.005 ? 'text-[#FFD369]' : b.delta_vm > 0.005 ? 'text-emerald-400' : 'text-[#869394]'
                        }`}>
                          {b.delta_vm >= 0 ? `+${b.delta_vm.toFixed(4)}` : b.delta_vm.toFixed(4)}
                        </td>
                        <td className="p-2.5 text-[#bbc9ca]">
                          {b.base_pd.toFixed(1)}
                        </td>
                        <td className="p-2.5 font-bold text-emerald-400">
                          {b.stress_pd.toFixed(1)}
                        </td>
                        <td className={`p-2.5 font-bold ${
                          b.delta_pd > 0 ? 'text-[#55d8e1]' : 'text-[#869394]'
                        }`}>
                          {b.delta_pd >= 0 ? `+${b.delta_pd.toFixed(1)}` : b.delta_pd.toFixed(1)}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          {b.stress_status === 'critical' ? (
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/30">
                              CRITICAL
                            </span>
                          ) : b.stress_status === 'alert' ? (
                            <span className="px-2 py-0.5 rounded bg-[#FFD369]/10 text-[#FFD369] text-[10px] font-bold border border-[#FFD369]/30">
                              ALERT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              SAFE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BRANCHES DELTA MATRIX TABLE                                        */}
          {/* ========================================================================= */}
          {activeTab === 'branches' && (
            <div className="border border-[#2D333B] rounded-xl overflow-hidden bg-[#1f1f22]">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-[#131316] text-[#869394] border-b border-[#2D333B] text-[11px] sticky top-0 z-10 font-sans">
                      <th className="p-2.5">Corridor</th>
                      <th className="p-2.5">Rating (MVA)</th>
                      <th className="p-2.5">Base Flow</th>
                      <th className="p-2.5">Stressed Flow</th>
                      <th className="p-2.5">Delta Flow</th>
                      <th className="p-2.5">Base Loading</th>
                      <th className="p-2.5">Stressed Loading</th>
                      <th className="p-2.5">Delta Loading</th>
                      <th className="p-2.5 text-center">Thermal State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D333B]/60">
                    {filteredBranches.map((br) => (
                      <tr 
                        key={br.id} 
                        className={`hover:bg-[#2a2a2d]/40 transition-colors ${
                          br.stress_status === 'overload' ? 'bg-red-950/20' : br.stress_status === 'warning' ? 'bg-[#FFD369]/5' : ''
                        }`}
                      >
                        <td className="p-2.5 font-bold text-[#e4e1e5]">
                          Line {br.from_bus} → {br.to_bus}
                        </td>
                        <td className="p-2.5 text-[#bbc9ca]">
                          {br.rate_a > 0 ? `${br.rate_a} MVA` : 'Continuous'}
                        </td>
                        <td className="p-2.5 text-[#bbc9ca]">
                          {br.base_flow.toFixed(1)} MVA
                        </td>
                        <td className="p-2.5 font-bold text-[#55d8e1]">
                          {br.stress_flow.toFixed(1)} MVA
                        </td>
                        <td className={`p-2.5 font-bold ${
                          br.delta_flow > 0 ? 'text-[#55d8e1]' : 'text-[#869394]'
                        }`}>
                          {br.delta_flow >= 0 ? `+${br.delta_flow.toFixed(1)}` : br.delta_flow.toFixed(1)}
                        </td>
                        <td className="p-2.5 text-[#bbc9ca]">
                          {br.base_loading.toFixed(1)}%
                        </td>
                        <td className={`p-2.5 font-bold ${
                          br.stress_loading > 120 ? 'text-red-400' : br.stress_loading > 100 ? 'text-[#FFD369]' : 'text-emerald-400'
                        }`}>
                          {br.stress_loading.toFixed(1)}%
                        </td>
                        <td className={`p-2.5 font-bold ${
                          br.delta_loading > 10 ? 'text-red-400' : br.delta_loading > 0 ? 'text-[#FFD369]' : 'text-emerald-400'
                        }`}>
                          {br.delta_loading >= 0 ? `+${br.delta_loading.toFixed(1)}%` : `${br.delta_loading.toFixed(1)}%`}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          {br.stress_status === 'overload' ? (
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/30">
                              OVERLOAD
                            </span>
                          ) : br.stress_status === 'warning' ? (
                            <span className="px-2 py-0.5 rounded bg-[#FFD369]/10 text-[#FFD369] text-[10px] font-bold border border-[#FFD369]/30">
                              WARNING
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              NORMAL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: NEW VIOLATIONS TRACKER                                             */}
          {/* ========================================================================= */}
          {activeTab === 'violations' && (
            <div className="space-y-3">
              {newViolations.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-[#e4e1e5]">
                    No New Limit Excursions Detected
                  </h4>
                  <p className="text-xs text-[#bbc9ca] mt-1 max-w-sm">
                    The applied load adjustments operate safely within ANSI voltage criteria and continuous line thermal ratings.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-[#FFD369] font-semibold flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={15} />
                    <span>{newViolations.length} New Limit Violations Triggered by Active Scaling</span>
                  </div>

                  {newViolations.map((v, i) => (
                    <div 
                      key={i}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        v.severity === 'critical'
                          ? 'bg-red-950/20 border-red-500/40 text-red-200'
                          : 'bg-[#FFD369]/10 border-[#FFD369]/30 text-[#FFD369]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {v.severity === 'critical' ? (
                          <XOctagon size={16} className="text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={16} className="text-[#FFD369] shrink-0" />
                        )}
                        <div>
                          <strong className="text-[#e4e1e5] block">{v.category} • {v.element}</strong>
                          <span className="text-[11px] text-[#bbc9ca]">
                            Measured: <span className="font-mono font-bold text-white">{v.value}</span> (Limit: {v.limit})
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        v.severity === 'critical'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-[#FFD369]/20 text-[#FFD369] border border-[#FFD369]/40'
                      }`}>
                        {v.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER                                                              */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-[#2D333B] bg-[#1f1f22] flex items-center justify-between">
          <div className="text-xs text-[#869394] font-mono">
            PyPOWER AC Newton-Raphson Delta Telemetry Engine
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#55d8e1] text-[#003739] text-xs font-bold hover:bg-[#55d8e1]/90 transition-all shadow-[0_0_12px_rgba(85,216,225,0.25)]"
          >
            Close Comparison
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  X, 
  GitCompare, 
  Network, 
  Sliders, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  RotateCcw, 
  Search, 
  Activity,
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

  // Compute Delta Calculations
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
    const baseEdgeMap = new Map(baseEdges.map(e => [`${e.from_bus}-${e.to_bus}`, e]));
    const branchesDiff = stressEdges.map(sEdge => {
      const bEdge = baseEdgeMap.get(`${sEdge.from_bus}-${sEdge.to_bus}`) || sEdge;
      const sPflow = sEdge.pf !== undefined ? sEdge.pf : (sEdge.p_flow || 0);
      const bPflow = bEdge.pf !== undefined ? bEdge.pf : (bEdge.p_flow || 0);
      const deltaLoading = (sEdge.loading_pct || 0) - (bEdge.loading_pct || 0);
      const deltaPflow = sPflow - bPflow;
      const isChanged = Math.abs(deltaLoading) > 0.1 || Math.abs(deltaPflow) > 0.1;

      return {
        id: sEdge.id || `${sEdge.from_bus}-${sEdge.to_bus}`,
        from_bus: sEdge.from_bus,
        to_bus: sEdge.to_bus,
        rate_a: sEdge.rate_a,
        base_loading: bEdge.loading_pct,
        stress_loading: sEdge.loading_pct,
        delta_loading: deltaLoading,
        base_pflow: bPflow,
        stress_pflow: sPflow,
        delta_pflow: deltaPflow,
        base_status: bEdge.thermal_status || 'normal',
        stress_status: sEdge.thermal_status || 'normal',
        is_tripped: sEdge.is_tripped,
        isChanged
      };
    });

    // 4. Violation Diff List
    const baseViolSet = new Set(baseViolations.map(v => `${v.element_type}-${v.element_id}-${v.type}`));
    const newViolations = stressViolations.filter(v => !baseViolSet.has(`${v.element_type}-${v.element_id}-${v.type}`));

    return {
      summaryDeltas: {
        baseSummary,
        stressSummary,
        deltaLoadMw,
        deltaLoadPct,
        deltaGenMw,
        deltaGenPct,
        deltaLossMw,
        deltaLossPct,
        deltaViolations,
        maxBaseLoading,
        maxStressLoading,
        deltaMaxLoading
      },
      busesDiff,
      branchesDiff,
      newViolations,
      baseViolations,
      stressViolations
    };
  }, [baselineData, networkData]);

  if (!isOpen || !comparison) return null;

  const { summaryDeltas, busesDiff, branchesDiff, newViolations } = comparison;
  const s = summaryDeltas.stressSummary;

  // Filtered bus rows
  const filteredBuses = busesDiff.filter(b => {
    if (onlyChangedFilter && !b.isChanged) return false;
    if (!searchFilter) return true;
    return b.id.toString().includes(searchFilter) || b.type.toLowerCase().includes(searchFilter.toLowerCase());
  });

  // Filtered branch rows
  const filteredBranches = branchesDiff.filter(br => {
    if (onlyChangedFilter && !br.isChanged) return false;
    if (!searchFilter) return true;
    return br.from_bus.toString().includes(searchFilter) || br.to_bus.toString().includes(searchFilter);
  });

  // Export Diff Report
  const handleExportJson = () => {
    const dataStr = JSON.stringify(comparison, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diff_${s.case_id || 'grid'}_comparison.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-150 font-sans">
      <div className="bg-[#FAF8F4] border border-[#E3DFD5] rounded-2xl w-full max-w-6xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-[#1C1B18]">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-[#E3DFD5] flex items-center justify-between bg-[#FAF8F4]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
              <GitCompare size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1B18] flex items-center gap-2">
                Grid State Comparison
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#ECE8DF] border border-[#DDD8CD] text-[#5C5950] uppercase">
                  Baseline (1.0x) vs. Stressed
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onResetStress && (
              <button
                onClick={() => {
                  onResetStress();
                  onClose();
                }}
                className="bg-[#ECE8DF] hover:bg-[#E2DDD2] border border-[#DDD8CD] text-[#5C5950] hover:text-[#1C1B18] text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Reset to Base</span>
              </button>
            )}

            <button
              onClick={handleExportJson}
              className="bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download size={13} />
              <span>Export Diff</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7A766D] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TABS & FILTERS                                                            */}
        {/* ========================================================================= */}
        <div className="px-6 py-2.5 border-b border-[#E3DFD5] bg-[#F4F1EA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-[#ECE8DF] border border-[#DDD8CD] p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <Activity size={13} />
              <span>Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('buses')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'buses'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <Network size={13} />
              <span>Buses ({busesDiff.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'branches'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <Sliders size={13} />
              <span>Branches ({branchesDiff.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('violations')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'violations'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <AlertTriangle size={13} className={newViolations.length > 0 ? 'text-[#A67C33]' : ''} />
              <span>New Violations ({newViolations.length})</span>
            </button>
          </div>

          {/* Search and filter */}
          {activeTab !== 'summary' && activeTab !== 'violations' && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-[#5C5950] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyChangedFilter}
                  onChange={(e) => setOnlyChangedFilter(e.target.checked)}
                  className="rounded border-[#DDD8CD] text-[#244B43] focus:ring-0"
                />
                <span>Changed only</span>
              </label>

              <div className="relative w-48">
                <input
                  type="text"
                  placeholder="Filter..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] rounded-lg pl-7 pr-2 py-0.5 text-xs focus:outline-none focus:border-[#244B43]"
                />
                <Search size={12} className="absolute left-2 top-1.5 text-[#7A766D] pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTENTS                                                              */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-auto p-6">
          
          {/* 1. EXECUTIVE SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="space-y-6 font-sans">
              
              {/* Top 4 KPI Delta Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Load */}
                <div className="p-4 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-[#7A766D] font-bold">Total Demand</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold font-mono text-[#1C1B18]">
                      {summaryDeltas.stressSummary.total_load_mw?.toFixed(1)} MW
                    </span>
                    <span className={`text-xs font-mono font-bold flex items-center ${
                      summaryDeltas.deltaLoadMw >= 0 ? 'text-[#244B43]' : 'text-blue-600'
                    }`}>
                      {summaryDeltas.deltaLoadMw >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {summaryDeltas.deltaLoadMw >= 0 ? '+' : ''}{summaryDeltas.deltaLoadMw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C5950] font-mono">
                    Baseline: {summaryDeltas.baseSummary.total_load_mw?.toFixed(1)} MW ({summaryDeltas.deltaLoadPct >= 0 ? '+' : ''}{summaryDeltas.deltaLoadPct.toFixed(1)}%)
                  </div>
                </div>

                {/* Total Generation */}
                <div className="p-4 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-[#7A766D] font-bold">Total Generation</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold font-mono text-[#1C1B18]">
                      {summaryDeltas.stressSummary.total_gen_mw?.toFixed(1)} MW
                    </span>
                    <span className={`text-xs font-mono font-bold flex items-center ${
                      summaryDeltas.deltaGenMw >= 0 ? 'text-[#244B43]' : 'text-blue-600'
                    }`}>
                      {summaryDeltas.deltaGenMw >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {summaryDeltas.deltaGenMw >= 0 ? '+' : ''}{summaryDeltas.deltaGenMw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C5950] font-mono">
                    Baseline: {summaryDeltas.baseSummary.total_gen_mw?.toFixed(1)} MW
                  </div>
                </div>

                {/* System Losses */}
                <div className="p-4 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-[#7A766D] font-bold">Active Losses</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold font-mono text-[#1C1B18]">
                      {summaryDeltas.stressSummary.total_losses_mw?.toFixed(1)} MW
                    </span>
                    <span className={`text-xs font-mono font-bold flex items-center ${
                      summaryDeltas.deltaLossMw > 0 ? 'text-[#A67C33]' : 'text-[#244B43]'
                    }`}>
                      {summaryDeltas.deltaLossMw >= 0 ? '+' : ''}{summaryDeltas.deltaLossMw.toFixed(1)} MW
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C5950] font-mono">
                    Baseline: {summaryDeltas.baseSummary.total_losses_mw?.toFixed(1)} MW
                  </div>
                </div>

                {/* Total Violations */}
                <div className="p-4 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-[#7A766D] font-bold">Violations</span>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-bold font-mono ${
                      summaryDeltas.stressSummary.total_violations_count > 0 ? 'text-red-700' : 'text-[#244B43]'
                    }`}>
                      {summaryDeltas.stressSummary.total_violations_count || 0}
                    </span>
                    <span className="text-xs font-mono font-bold text-red-700">
                      +{summaryDeltas.deltaViolations} new
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C5950] font-mono">
                    Baseline: {summaryDeltas.baseSummary.total_violations_count || 0}
                  </div>
                </div>
              </div>

              {/* Status comparison bar */}
              <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#DDD8CD] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#5C5950] block">Grid Security Classification</span>
                  <div className="flex items-center gap-3 mt-1 font-bold text-sm">
                    <span className="text-[#244B43]">{summaryDeltas.baseSummary.grid_health || 'SAFE'}</span>
                    <span className="text-[#7A766D]">→</span>
                    <span className={s.grid_health === 'SAFE' ? 'text-[#244B43]' : 'text-red-700'}>
                      {s.grid_health || 'SAFE'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-[#5C5950] block">Peak Line Loading</span>
                  <div className="flex items-center gap-3 mt-1 font-mono font-bold text-sm">
                    <span className="text-[#1C1B18]">{summaryDeltas.maxBaseLoading.toFixed(1)}%</span>
                    <span className="text-[#7A766D]">→</span>
                    <span className={summaryDeltas.maxStressLoading > 100 ? 'text-red-700' : 'text-[#244B43]'}>
                      {summaryDeltas.maxStressLoading.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 2. BUSES DIFF TABLE */}
          {activeTab === 'buses' && (
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#ECE8DF] text-[#5C5950] border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                  <th className="p-2">Bus ID</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Base Vm</th>
                  <th className="p-2">Stressed Vm</th>
                  <th className="p-2">Delta Vm</th>
                  <th className="p-2">Base Pd</th>
                  <th className="p-2">Stressed Pd</th>
                  <th className="p-2">Delta Pd</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DFD5]">
                {filteredBuses.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F2EFE8] transition-colors">
                    <td className="p-2 font-bold text-[#244B43]">Bus {b.id}</td>
                    <td className="p-2 uppercase text-[10px] text-[#5C5950]">{b.type}</td>
                    <td className="p-2 text-[#5C5950]">{b.base_vm?.toFixed(4)} pu</td>
                    <td className="p-2 font-bold text-[#1C1B18]">{b.stress_vm?.toFixed(4)} pu</td>
                    <td className={`p-2 font-bold ${
                      b.delta_vm < -0.02 ? 'text-red-700' : Math.abs(b.delta_vm) > 0.001 ? 'text-[#A67C33]' : 'text-[#7A766D]'
                    }`}>
                      {b.delta_vm >= 0 ? '+' : ''}{b.delta_vm.toFixed(4)}
                    </td>
                    <td className="p-2 text-[#5C5950]">{b.base_pd?.toFixed(1)} MW</td>
                    <td className="p-2 font-bold text-[#1C1B18]">{b.stress_pd?.toFixed(1)} MW</td>
                    <td className={`p-2 font-bold ${b.delta_pd > 0 ? 'text-[#244B43]' : 'text-[#7A766D]'}`}>
                      {b.delta_pd >= 0 ? '+' : ''}{b.delta_pd.toFixed(1)}
                    </td>
                    <td className="p-2 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        b.stress_status === 'critical' 
                          ? 'bg-red-100 text-red-700' 
                          : b.stress_status === 'alert' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-[#E3ECE6] text-[#244B43]'
                      }`}>
                        {b.stress_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 3. BRANCHES DIFF TABLE */}
          {activeTab === 'branches' && (
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#ECE8DF] text-[#5C5950] border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                  <th className="p-2">Corridor</th>
                  <th className="p-2">Rating</th>
                  <th className="p-2">Base Load %</th>
                  <th className="p-2">Stressed Load %</th>
                  <th className="p-2">Delta Load %</th>
                  <th className="p-2">Base Flow</th>
                  <th className="p-2">Stressed Flow</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DFD5]">
                {filteredBranches.map((br) => (
                  <tr key={br.id} className="hover:bg-[#F2EFE8] transition-colors">
                    <td className="p-2 font-bold text-[#1C1B18]">Bus {br.from_bus} → Bus {br.to_bus}</td>
                    <td className="p-2 text-[#7A766D]">{br.rate_a || 100} MVA</td>
                    <td className="p-2 text-[#5C5950]">{br.base_loading?.toFixed(1)}%</td>
                    <td className="p-2 font-bold text-[#1C1B18]">{br.stress_loading?.toFixed(1)}%</td>
                    <td className={`p-2 font-bold ${
                      br.delta_loading > 15 ? 'text-red-700' : br.delta_loading > 0 ? 'text-[#A67C33]' : 'text-[#244B43]'
                    }`}>
                      {br.delta_loading >= 0 ? '+' : ''}{br.delta_loading.toFixed(1)}%
                    </td>
                    <td className="p-2 text-[#5C5950]">{br.base_pflow?.toFixed(1)} MW</td>
                    <td className="p-2 font-bold text-[#1C1B18]">{br.stress_pflow?.toFixed(1)} MW</td>
                    <td className="p-2 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        br.stress_status === 'overload' || br.is_tripped 
                          ? 'bg-red-100 text-red-700' 
                          : br.stress_status === 'warning' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-[#E3ECE6] text-[#244B43]'
                      }`}>
                        {br.is_tripped ? 'TRIPPED' : (br.stress_status || 'normal').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 4. NEW VIOLATIONS TAB */}
          {activeTab === 'violations' && (
            <div className="space-y-3 font-mono">
              {newViolations.length === 0 ? (
                <div className="p-8 text-center bg-[#ECE8DF] rounded-xl text-[#244B43] font-sans font-semibold text-xs border border-[#DDD8CD]">
                  No new voltage or thermal violations introduced. Grid remains secure.
                </div>
              ) : (
                newViolations.map((v, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-red-800 uppercase block">
                        {v.type === 'voltage' ? `Bus ${v.element_id} Voltage Violation` : `Branch ${v.element_id} Overload`}
                      </span>
                      <span className="text-[11px] text-red-600">
                        {v.message || `Value: ${v.value} (Limit: ${v.limit})`}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 text-[10px] font-bold uppercase font-sans">
                      CRITICAL
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* FOOTER                                                                    */}
        {/* ========================================================================= */}
        <div className="px-6 py-3 border-t border-[#E3DFD5] bg-[#FAF8F4] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs font-bold transition-all shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

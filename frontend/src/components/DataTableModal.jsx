import React, { useState, useMemo } from 'react';
import { X, Search, Table, Sliders, Network, Flame } from 'lucide-react';

export default function DataTableModal({ networkData, onClose }) {
  const [activeTab, setActiveTab] = useState('buses'); // 'buses' | 'branches' | 'losses'
  const [searchFilter, setSearchFilter] = useState('');

  if (!networkData) return null;

  const { summary, nodes, edges } = networkData;

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!searchFilter) return nodes;
    const query = searchFilter.toLowerCase();
    return nodes.filter(n => 
      String(n.id).includes(query) || 
      String(n.type).toLowerCase().includes(query) ||
      String(n.v_status).toLowerCase().includes(query)
    );
  }, [nodes, searchFilter]);

  // Filtered edges
  const filteredEdges = useMemo(() => {
    if (!searchFilter) return edges;
    const query = searchFilter.toLowerCase();
    return edges.filter(e => 
      String(e.from_bus).includes(query) || 
      String(e.to_bus).includes(query) ||
      String(e.id || '').toLowerCase().includes(query) ||
      String(e.thermal_status || '').toLowerCase().includes(query)
    );
  }, [edges, searchFilter]);

  // Calculated losses per branch
  const branchLosses = useMemo(() => {
    const totalLoss = summary.total_losses_mw || 1.0;
    const list = edges.map((e, idx) => {
      // Calculate realistic branch active loss if not explicitly provided
      const pFlow = e.pf !== undefined ? e.pf : (e.p_flow !== undefined ? e.p_flow : 0);
      const qFlow = e.qf !== undefined ? e.qf : (e.q_flow !== undefined ? e.q_flow : 0);
      const sFlow = e.s_flow !== undefined ? e.s_flow : Math.sqrt(pFlow * pFlow + qFlow * qFlow);
      const r = Number(e.r) || 0.02;
      const baseMva = Number(summary.base_mva) || 100;
      let pLoss = e.p_loss_mw !== undefined ? e.p_loss_mw : e.p_loss;
      if (pLoss === undefined || pLoss === null) {
        pLoss = Math.pow(sFlow / baseMva, 2) * r * baseMva;
      }
      pLoss = Math.max(0.01, Number(pLoss) || 0.01);
      const lossSharePct = Math.min(100, (pLoss / totalLoss) * 100);

      return {
        id: e.id || `Line ${e.from_bus}→${e.to_bus}`,
        from_bus: e.from_bus,
        to_bus: e.to_bus,
        p_loss: pLoss,
        s_flow: sFlow,
        lossSharePct: lossSharePct,
        status: e.is_tripped || e.status === 0 ? 'tripped' : e.thermal_status || 'normal'
      };
    });

    // Sort descending by highest loss
    list.sort((a, b) => b.p_loss - a.p_loss);

    if (!searchFilter) return list;
    const query = searchFilter.toLowerCase();
    return list.filter(item => 
      String(item.from_bus).includes(query) || 
      String(item.to_bus).includes(query) ||
      String(item.id).toLowerCase().includes(query)
    );
  }, [edges, summary, searchFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-150 font-sans">
      <div className="bg-[#FAF8F4] border border-[#E3DFD5] rounded-2xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#1C1B18]">
        
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-[#E3DFD5] flex items-center justify-between bg-[#FAF8F4]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
              <Table size={18} />
            </div>
            <h2 className="text-sm font-bold text-[#1C1B18]">
              Grid Telemetry Data Matrix
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A766D] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTROLS & SEARCH BAR                                                 */}
        {/* ========================================================================= */}
        <div className="px-6 py-2.5 border-b border-[#E3DFD5] bg-[#F4F1EA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* 3 CLEAN TABS: Buses, Branches, Losses */}
          <div className="flex items-center gap-1.5 bg-[#ECE8DF] border border-[#DDD8CD] p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('buses')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'buses'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <Network size={13} />
              <span>Buses ({nodes.length})</span>
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
              <span>Branches ({edges.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('losses')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'losses'
                  ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                  : 'text-[#5C5950] hover:text-[#1C1B18]'
              }`}
            >
              <Flame size={13} className={activeTab === 'losses' ? 'text-[#FAF8F4]' : 'text-[#A67C33]'} />
              <span>Losses</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-[#244B43]"
            />
            <Search size={13} className="absolute left-2.5 top-2 text-[#7A766D] pointer-events-none" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTENTS                                                              */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-auto p-6">
          
          {/* TAB 1: BUSES (INCLUDES VOLTAGES, POWERS, SECURITY) */}
          {activeTab === 'buses' && (
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#ECE8DF] text-[#5C5950] border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                  <th className="p-2">Bus ID</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Vm (p.u.)</th>
                  <th className="p-2">Va (deg)</th>
                  <th className="p-2">Pd (MW)</th>
                  <th className="p-2">Qd (MVAr)</th>
                  <th className="p-2">Pg (MW)</th>
                  <th className="p-2">Qg (MVAr)</th>
                  <th className="p-2">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DFD5]">
                {filteredNodes.map((n) => (
                  <tr key={n.id} className="hover:bg-[#F2EFE8] transition-colors">
                    <td className="p-2 font-bold text-[#244B43]">{n.id}</td>
                    <td className="p-2 uppercase font-sans text-xs font-semibold">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        n.type === 'slack' 
                          ? 'bg-[#EDE9FE] text-[#5B21B6]' 
                          : n.type === 'pv' 
                          ? 'bg-[#D1FAE5] text-[#065F46]' 
                          : 'bg-[#F1F5F9] text-[#1E293B]'
                      }`}>
                        {n.type}
                      </span>
                    </td>
                    <td className="p-2 font-bold text-[#1C1B18]">{n.vm.toFixed(4)}</td>
                    <td className="p-2 text-[#5C5950]">{n.va !== undefined ? n.va.toFixed(2) : '0.00'}°</td>
                    <td className="p-2 text-[#1C1B18]">{n.pd.toFixed(1)}</td>
                    <td className="p-2 text-[#5C5950]">{n.qd.toFixed(1)}</td>
                    <td className="p-2 font-bold text-[#244B43]">{n.pg.toFixed(1)}</td>
                    <td className="p-2 text-[#5C5950]">{n.qg.toFixed(1)}</td>
                    <td className="p-2 font-sans font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        n.v_status === 'critical' 
                          ? 'bg-red-100 text-red-700 font-bold' 
                          : n.v_status === 'alert' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-[#E3ECE6] text-[#244B43]'
                      }`}>
                        {n.v_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 2: BRANCHES */}
          {activeTab === 'branches' && (
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#ECE8DF] text-[#5C5950] border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                  <th className="p-2">Branch ID</th>
                  <th className="p-2">From → To</th>
                  <th className="p-2">P Flow (MW)</th>
                  <th className="p-2">Q Flow (MVAr)</th>
                  <th className="p-2">S Flow (MVA)</th>
                  <th className="p-2">Rating (MVA)</th>
                  <th className="p-2">Loading %</th>
                  <th className="p-2">Thermal Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DFD5]">
                {filteredEdges.map((e, idx) => {
                  const pFlow = e.pf !== undefined ? e.pf : (e.p_flow !== undefined ? e.p_flow : 0);
                  const qFlow = e.qf !== undefined ? e.qf : (e.q_flow !== undefined ? e.q_flow : 0);
                  const sFlow = e.s_flow !== undefined ? e.s_flow : Math.sqrt(pFlow * pFlow + qFlow * qFlow);

                  return (
                    <tr key={idx} className="hover:bg-[#F2EFE8] transition-colors">
                      <td className="p-2 text-[#7A766D]">{e.id || `${e.from_bus}-${e.to_bus}`}</td>
                      <td className="p-2 font-bold text-[#1C1B18]">Bus {e.from_bus} → Bus {e.to_bus}</td>
                      <td className="p-2 text-[#1C1B18]">{pFlow.toFixed(1)}</td>
                      <td className="p-2 text-[#5C5950]">{qFlow.toFixed(1)}</td>
                      <td className="p-2 font-semibold text-[#1C1B18]">{sFlow.toFixed(1)}</td>
                      <td className="p-2 text-[#7A766D]">{e.rate_a || 100}</td>
                      <td className="p-2 font-bold text-[#244B43]">{e.loading_pct !== undefined ? e.loading_pct.toFixed(1) : 0}%</td>
                      <td className="p-2 font-sans font-semibold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          e.thermal_status === 'overload' || e.is_tripped 
                            ? 'bg-red-100 text-red-700 font-bold' 
                            : e.thermal_status === 'warning' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-[#E3ECE6] text-[#244B43]'
                        }`}>
                          {e.is_tripped ? 'TRIPPED' : (e.thermal_status || 'normal').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TAB 3: LOSSES (BRANCH BY BRANCH POWER DISSIPATION) */}
          {activeTab === 'losses' && (
            <div className="space-y-4 font-mono">
              <div className="p-3 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] flex items-center justify-between text-xs">
                <span className="text-[#5C5950] font-sans font-medium">Total Active System Losses:</span>
                <span className="font-bold text-sm text-[#A67C33]">{summary.total_losses_mw} MW</span>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#ECE8DF] text-[#5C5950] border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                    <th className="p-2">Branch Corridor</th>
                    <th className="p-2">Apparent Flow</th>
                    <th className="p-2">Loss (MW)</th>
                    <th className="p-2 w-48">Share of System Loss</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DFD5]">
                  {branchLosses.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#F2EFE8] transition-colors">
                      <td className="p-2 font-bold text-[#1C1B18]">
                        Bus {item.from_bus} → Bus {item.to_bus}
                      </td>
                      <td className="p-2 text-[#5C5950]">
                        {item.s_flow.toFixed(1)} MVA
                      </td>
                      <td className="p-2 font-bold text-[#A67C33]">
                        {item.p_loss.toFixed(2)} MW
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#DDD8CD] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#A67C33] rounded-full"
                              style={{ width: `${Math.min(100, item.lossSharePct * 3)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#7A766D] w-10 text-right">
                            {item.lossSharePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'overload' || item.status === 'tripped'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-[#E3ECE6] text-[#244B43]'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

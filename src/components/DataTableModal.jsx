import React, { useState } from 'react';
import { X, Search, Table } from 'lucide-react';

export default function DataTableModal({ networkData, onClose }) {
  const [activeTab, setActiveTab] = useState('buses'); // 'buses', 'edges', 'summary'
  const [searchFilter, setSearchFilter] = useState('');

  if (!networkData) return null;

  const { summary, nodes, edges } = networkData;

  const filteredNodes = nodes.filter(n => 
    n.id.toString().includes(searchFilter) || n.type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredEdges = edges.filter(e => 
    e.from_bus.toString().includes(searchFilter) || 
    e.to_bus.toString().includes(searchFilter) ||
    e.id.includes(searchFilter)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-[#19191c] border border-[#2D333B] rounded-2xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#2D333B] flex items-center justify-between bg-[#1f1f22]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00adb5]/10 text-[#55d8e1] border border-[#00adb5]/30">
              <Table size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e4e1e5] flex items-center gap-2">
                Grid Telemetry Data Matrix
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-[#55d8e1]/10 border border-[#55d8e1]/30 text-[#55d8e1]">
                  {summary.case_id.toUpperCase()}
                </span>
              </h2>
              <p className="text-xs text-[#bbc9ca]">Full AC Power Flow Telemetry & Matrix Solution</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Controls & Search Bar */}
        <div className="p-4 border-b border-[#2D333B] bg-[#131316] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('buses')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'buses'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1f1f22] text-[#bbc9ca] hover:text-white border border-[#2D333B]'
              }`}
            >
              Buses Matrix ({nodes.length})
            </button>
            <button
              onClick={() => setActiveTab('edges')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'edges'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1f1f22] text-[#bbc9ca] hover:text-white border border-[#2D333B]'
              }`}
            >
              Branches Matrix ({edges.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'summary'
                  ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                  : 'bg-[#1f1f22] text-[#bbc9ca] hover:text-white border border-[#2D333B]'
              }`}
            >
              Executive Summary
            </button>
          </div>

          {/* Search */}
          {activeTab !== 'summary' && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-[#bbc9ca]" />
              <input
                type="text"
                placeholder="Filter by ID or type..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#131316] border border-[#2D333B] text-xs text-[#e4e1e5] rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#55d8e1] font-mono"
              />
            </div>
          )}
        </div>

        {/* Tab Content Table */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'buses' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2D333B] text-[#bbc9ca] text-[11px] uppercase bg-[#1f1f22]">
                  <th className="p-3">Bus ID</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Voltage |V| (p.u.)</th>
                  <th className="p-3">Angle θ (deg)</th>
                  <th className="p-3">Active Gen (MW)</th>
                  <th className="p-3">Active Load (MW)</th>
                  <th className="p-3">Reactive Load (MVAr)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D333B]">
                {filteredNodes.map((n) => (
                  <tr key={n.id} className="hover:bg-[#2a2a2d] transition-colors">
                    <td className="p-3 font-bold text-[#e4e1e5]">Bus {n.id}</td>
                    <td className="p-3 uppercase">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        n.type === 'slack' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        (n.type === 'pv' ? 'bg-[#55d8e1]/20 text-[#55d8e1] border border-[#55d8e1]/30' : 'bg-[#2a2a2d] text-[#bbc9ca]')
                      }`}>
                        {n.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-[#55d8e1]">{n.vm.toFixed(4)}</td>
                    <td className="p-3 text-[#bbc9ca]">{n.va.toFixed(2)}°</td>
                    <td className="p-3 text-[#55d8e1]">{n.pg}</td>
                    <td className="p-3 text-emerald-400">{n.pd}</td>
                    <td className="p-3 text-emerald-400">{n.qd}</td>
                    <td className="p-3 uppercase font-bold text-[10px]">
                      <span className={n.v_status === 'critical' ? 'text-red-400' : (n.v_status === 'alert' ? 'text-[#FFD369]' : 'text-emerald-400')}>
                        {n.v_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'edges' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2D333B] text-[#bbc9ca] text-[11px] uppercase bg-[#1f1f22]">
                  <th className="p-3">From Bus</th>
                  <th className="p-3">To Bus</th>
                  <th className="p-3">Active Flow P (MW)</th>
                  <th className="p-3">Reactive Flow Q (MVAr)</th>
                  <th className="p-3">Apparent S (MVA)</th>
                  <th className="p-3">Rating (MVA)</th>
                  <th className="p-3">Loading %</th>
                  <th className="p-3">Loss (MW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D333B]">
                {filteredEdges.map((e) => (
                  <tr key={e.id} className="hover:bg-[#2a2a2d] transition-colors">
                    <td className="p-3 text-[#e4e1e5] font-bold">Bus {e.from_bus}</td>
                    <td className="p-3 text-[#e4e1e5] font-bold">Bus {e.to_bus}</td>
                    <td className="p-3 text-[#55d8e1]">{e.pf}</td>
                    <td className="p-3 text-[#55d8e1]">{e.qf}</td>
                    <td className="p-3 text-purple-400">{e.s_flow}</td>
                    <td className="p-3 text-[#bbc9ca]">{e.rate_a > 0 ? e.rate_a : 'Unconstrained'}</td>
                    <td className="p-3 font-bold">
                      <span className={e.loading_pct > 100 ? 'text-red-400' : (e.loading_pct > 80 ? 'text-[#FFD369]' : 'text-[#55d8e1]')}>
                        {e.loading_pct}%
                      </span>
                    </td>
                    <td className="p-3 text-[#FFD369]">{e.p_loss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
              <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B] space-y-3">
                <h3 className="font-bold text-[#e4e1e5] text-sm uppercase">Grid Architecture Summary</h3>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">CASE NAME</span>
                    <span className="text-[#55d8e1] font-bold">{summary.case_id.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">BASE MVA</span>
                    <span className="text-[#e4e1e5] font-bold">{summary.base_mva} MVA</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">TOTAL BUSES</span>
                    <span className="text-[#e4e1e5]">{summary.n_bus}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">TOTAL BRANCHES</span>
                    <span className="text-[#e4e1e5]">{summary.n_branch}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B] space-y-3">
                <h3 className="font-bold text-[#e4e1e5] text-sm uppercase">Active Power Flow Balance</h3>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">TOTAL GENERATION</span>
                    <span className="text-[#55d8e1] font-bold">{summary.total_gen_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">TOTAL DEMAND LOAD</span>
                    <span className="text-emerald-400 font-bold">{summary.total_load_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">TRANSMISSION LOSSES</span>
                    <span className="text-[#FFD369] font-bold">{summary.total_losses_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#bbc9ca] block">GRID SECURITY</span>
                    <span className={`font-bold ${summary.grid_health === 'SAFE' ? 'text-emerald-400' : 'text-[#FFD369]'}`}>
                      {summary.grid_health}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#2D333B] bg-[#131316] flex items-center justify-between text-xs">
          <div className="text-[#bbc9ca] font-mono">
            PyPOWER AC Newton-Raphson Matrix Stream
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1f1f22] border border-[#2D333B] text-[#e4e1e5] hover:text-[#55d8e1] hover:border-[#00adb5] transition-all font-semibold"
          >
            Close Matrix Table
          </button>
        </div>
      </div>
    </div>
  );
}

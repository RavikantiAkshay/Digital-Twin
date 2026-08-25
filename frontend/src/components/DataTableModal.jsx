import React, { useState } from 'react';
import { X, Search, Table, Download, CheckCircle2, AlertTriangle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Table size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Grid Telemetry Data Table
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  {summary.case_id.toUpperCase()}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Full AC Power Flow Telemetry & Matrix Solution</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Controls & Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('buses')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'buses'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Buses Matrix ({nodes.length})
            </button>
            <button
              onClick={() => setActiveTab('edges')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'edges'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Branches Matrix ({edges.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              System Executive Summary
            </button>
          </div>

          {/* Search */}
          {activeTab !== 'summary' && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by ID or type..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          )}
        </div>

        {/* Tab Content Table */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'buses' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase bg-slate-900/50">
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
              <tbody className="divide-y divide-slate-800/50">
                {filteredNodes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">Bus {n.id}</td>
                    <td className="p-3 uppercase">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        n.type === 'slack' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        (n.type === 'pv' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-300')
                      }`}>
                        {n.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">{n.vm.toFixed(4)}</td>
                    <td className="p-3 text-slate-300">{n.va.toFixed(2)}°</td>
                    <td className="p-3 text-cyan-400">{n.pg}</td>
                    <td className="p-3 text-emerald-400">{n.pd}</td>
                    <td className="p-3 text-emerald-400">{n.qd}</td>
                    <td className="p-3 uppercase font-bold text-[10px]">
                      <span className={n.v_status === 'critical' ? 'text-red-400' : (n.v_status === 'alert' ? 'text-amber-400' : 'text-emerald-400')}>
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
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase bg-slate-900/50">
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
              <tbody className="divide-y divide-slate-800/50">
                {filteredEdges.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-white font-bold">Bus {e.from_bus}</td>
                    <td className="p-3 text-white font-bold">Bus {e.to_bus}</td>
                    <td className="p-3 text-blue-400">{e.pf}</td>
                    <td className="p-3 text-cyan-400">{e.qf}</td>
                    <td className="p-3 text-purple-400">{e.s_flow}</td>
                    <td className="p-3 text-slate-300">{e.rate_a > 0 ? e.rate_a : 'Unconstrained'}</td>
                    <td className="p-3 font-bold">
                      <span className={e.loading_pct > 100 ? 'text-red-400' : (e.loading_pct > 80 ? 'text-amber-400' : 'text-emerald-400')}>
                        {e.loading_pct}%
                      </span>
                    </td>
                    <td className="p-3 text-amber-400">{e.p_loss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase">Grid Architecture Summary</h3>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">CASE NAME</span>
                    <span className="text-white font-bold">{summary.case_id.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">BASE MVA</span>
                    <span className="text-white font-bold">{summary.base_mva} MVA</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TOTAL BUSES</span>
                    <span className="text-slate-200">{summary.n_bus}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TOTAL BRANCHES</span>
                    <span className="text-slate-200">{summary.n_branch}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase">Active Power Flow Balance</h3>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">TOTAL GENERATION</span>
                    <span className="text-cyan-400 font-bold">{summary.total_gen_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TOTAL DEMAND LOAD</span>
                    <span className="text-emerald-400 font-bold">{summary.total_load_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TRANSMISSION LOSSES</span>
                    <span className="text-amber-400 font-bold">{summary.total_losses_mw} MW</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">GRID SECURITY</span>
                    <span className={`font-bold ${summary.grid_health === 'SAFE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {summary.grid_health}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-mono">
            PyPOWER AC Newton-Raphson Matrix Stream
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close Table
          </button>
        </div>
      </div>
    </div>
  );
}

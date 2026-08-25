import React from 'react';
import { 
  X, 
  Zap, 
  Activity, 
  Gauge, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  ArrowRightLeft, 
  Sliders,
  Info
} from 'lucide-react';

export default function InspectorPanel({ element, onClose, summary }) {
  if (!element) return null;

  const { type, data } = element;

  return (
    <aside className="w-80 md:w-96 bg-[#0d1527]/95 border-l border-slate-800/80 h-full fixed top-16 right-0 z-30 p-5 flex flex-col justify-between overflow-y-auto glass-panel shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${type === 'bus' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'}`}>
              {type === 'bus' ? <Cpu size={20} /> : <ArrowRightLeft size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                {type === 'bus' ? `Bus Telemetry (${data.label})` : `Transmission Line (${data.from_bus} → ${data.to_bus})`}
              </h2>
              <p className="text-[11px] text-slate-400">AC Power Flow Real-Time Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* BUS INSPECTION */}
        {type === 'bus' && (
          <div className="mt-5 space-y-5 text-xs">
            {/* Type & Status Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1 uppercase">BUS TYPE</span>
                <span className="font-bold text-sm text-white uppercase">
                  {data.type} {data.type === 'slack' ? '⚡ (Slack)' : (data.type === 'pv' ? '⚙️ (Gen)' : '🏠 (Load)')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1 uppercase">VOLTAGE SECURITY</span>
                <span className={`font-bold text-sm uppercase ${data.v_status === 'critical' ? 'text-red-400' : (data.v_status === 'alert' ? 'text-amber-400' : 'text-emerald-400')}`}>
                  {data.v_status}
                </span>
              </div>
            </div>

            {/* Voltage Telemetry Gauge */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Gauge size={14} className="text-blue-400" />
                  Voltage Magnitude |V|
                </span>
                <span className="font-mono font-bold text-sm text-white">{data.vm.toFixed(4)} p.u.</span>
              </div>

              {/* Progress Bar (0.80 to 1.20 range) */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-500 ${
                    data.v_status === 'critical' ? 'bg-red-500' : (data.v_status === 'alert' ? 'bg-amber-500' : 'bg-emerald-500')
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, ((data.vm - 0.80) / 0.40) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
                <span>0.90 (Min)</span>
                <span>1.00 (Nom)</span>
                <span>1.10 (Max)</span>
              </div>
            </div>

            {/* Voltage Angle & Base KV */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">VOLTAGE ANGLE θ</span>
                <span className="font-mono font-bold text-slate-200 text-sm">{data.va.toFixed(2)}°</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">BASE VOLTAGE</span>
                <span className="font-mono font-bold text-slate-200 text-sm">{data.base_kv} kV</span>
              </div>
            </div>

            {/* Bus Load Demand */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity size={14} className="text-emerald-400" />
                <span>Bus Demand Load</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">ACTIVE LOAD (P_d)</span>
                  <span className="text-sm font-bold text-emerald-400">{data.pd} MW</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">REACTIVE LOAD (Q_d)</span>
                  <span className="text-sm font-bold text-emerald-400">{data.qd} MVAr</span>
                </div>
              </div>
            </div>

            {/* Generators at this Bus */}
            {data.generators && data.generators.length > 0 && (
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 space-y-3">
                <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Zap size={14} className="text-blue-400" />
                  <span>Connected Generators ({data.generators.length})</span>
                </div>
                {data.generators.map((g, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between font-bold text-white">
                      <span>Gen ID: {g.gen_id}</span>
                      <span className="text-emerald-400">{g.pg} MW</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Reactive (Qg): {g.qg} MVAr</span>
                      <span>Max Cap: {g.pmax} MW</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINE INSPECTION */}
        {type === 'line' && (
          <div className="mt-5 space-y-5 text-xs">
            {/* Status & Thermal Loading */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-400" />
                  Thermal Loading %
                </span>
                <span className={`font-mono font-bold text-sm ${data.loading_pct > 100 ? 'text-red-400' : (data.loading_pct > 80 ? 'text-amber-400' : 'text-emerald-400')}`}>
                  {data.loading_pct}%
                </span>
              </div>

              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    data.loading_pct > 100 ? 'bg-red-500' : (data.loading_pct > 80 ? 'bg-amber-500' : 'bg-emerald-500')
                  }`}
                  style={{ width: `${Math.min(100, data.loading_pct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
                <span>0%</span>
                <span>Rating: {data.rate_a > 0 ? `${data.rate_a} MVA` : 'Unconstrained'}</span>
                <span>100%</span>
              </div>
            </div>

            {/* Power Flows */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
                <Activity size={14} className="text-blue-400" />
                <span>Line Power Flows (From → To)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 block">ACTIVE FLOW (P_f)</span>
                  <span className="text-sm font-bold text-blue-400">{data.pf} MW</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">REACTIVE FLOW (Q_f)</span>
                  <span className="text-sm font-bold text-cyan-400">{data.qf} MVAr</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">APPARENT (S_flow)</span>
                  <span className="text-sm font-bold text-purple-400">{data.s_flow} MVA</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">LINE LOSS (P_loss)</span>
                  <span className="text-sm font-bold text-amber-400">{data.p_loss} MW</span>
                </div>
              </div>
            </div>

            {/* Branch Impedance Data */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 font-mono">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
                <Info size={14} className="text-slate-400" />
                <span>Impedance Parameters (p.u.)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-500 block">RESISTANCE (R)</span>
                  <span className="text-slate-200">{data.r}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">REACTANCE (X)</span>
                  <span className="text-slate-200">{data.x}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">SUSCEPTANCE (B)</span>
                  <span className="text-slate-200">{data.b}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">TAP RATIO</span>
                  <span className="text-slate-200">{data.tap}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center font-mono">
        EEQ401 Telemetry Stream • AC Newton-Raphson
      </div>
    </aside>
  );
}

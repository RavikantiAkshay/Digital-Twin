import React from 'react';
import { 
  X, 
  Zap, 
  Activity, 
  Gauge, 
  Cpu, 
  ArrowRightLeft, 
  Sliders,
  Info,
  Power,
  RotateCcw,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';

export default function InspectorPanel({ 
  element, 
  onClose, 
  summary,
  onToggleLineTrip,
  isLoading
}) {
  if (!element) return null;

  const { type, data } = element;
  const isLineTripped = type === 'line' && (data.is_tripped || data.status === 0 || data.thermal_status === 'tripped');

  return (
    <aside className="w-80 md:w-96 bg-[#19191c]/95 border-l border-[#2D333B] h-full fixed top-14 right-0 z-30 p-5 flex flex-col justify-between overflow-y-auto shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300 font-sans">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2D333B]">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${type === 'bus' ? 'bg-[#00adb5]/10 text-[#55d8e1] border border-[#00adb5]/30' : isLineTripped ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'}`}>
              {type === 'bus' ? <Cpu size={20} /> : <ArrowRightLeft size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#e4e1e5] uppercase tracking-wide">
                {type === 'bus' ? `Bus Telemetry (${data.label})` : `Line ${data.from_bus} → ${data.to_bus}`}
              </h2>
              <p className="text-[11px] text-[#bbc9ca]">AC Power Flow Real-Time Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* BUS INSPECTION */}
        {type === 'bus' && (
          <div className="mt-5 space-y-5 text-xs">
            {/* Type & Status Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                <span className="text-[10px] text-[#bbc9ca] block mb-1 uppercase">BUS TYPE</span>
                <span className="font-bold text-sm text-[#e4e1e5] uppercase">
                  {data.type} {data.type === 'slack' ? ' (Slack)' : (data.type === 'pv' ? ' (Gen)' : ' (Load)')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                <span className="text-[10px] text-[#bbc9ca] block mb-1 uppercase">VOLTAGE SECURITY</span>
                <span className={`font-bold text-sm uppercase ${data.v_status === 'critical' ? 'text-red-400' : (data.v_status === 'alert' ? 'text-[#FFD369]' : 'text-emerald-400')}`}>
                  {data.v_status}
                </span>
              </div>
            </div>

            {/* Voltage Telemetry Gauge */}
            <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#bbc9ca] flex items-center gap-1.5">
                  <Gauge size={14} className="text-[#55d8e1]" />
                  Voltage Magnitude |V|
                </span>
                <span className="font-mono font-bold text-sm text-[#55d8e1]">{data.vm.toFixed(4)} p.u.</span>
              </div>

              {/* Progress Bar (0.80 to 1.20 range) */}
              <div className="w-full bg-[#2a2a2d] h-2.5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-500 ${
                    data.v_status === 'critical' ? 'bg-red-500' : (data.v_status === 'alert' ? 'bg-[#FFD369]' : 'bg-[#55d8e1]')
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, ((data.vm - 0.80) / 0.40) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#bbc9ca] mt-1.5 font-mono">
                <span>0.90 (Min)</span>
                <span>1.00 (Nom)</span>
                <span>1.10 (Max)</span>
              </div>
            </div>

            {/* Voltage Angle & Base KV */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                <span className="text-[10px] text-[#bbc9ca] block mb-0.5">VOLTAGE ANGLE θ</span>
                <span className="font-mono font-bold text-[#e4e1e5] text-sm">{data.va.toFixed(2)}°</span>
              </div>
              <div className="p-3 rounded-xl bg-[#131316] border border-[#2D333B]">
                <span className="text-[10px] text-[#bbc9ca] block mb-0.5">BASE VOLTAGE</span>
                <span className="font-mono font-bold text-[#e4e1e5] text-sm">{data.base_kv} kV</span>
              </div>
            </div>

            {/* Bus Load Demand */}
            <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B] space-y-2">
              <div className="font-semibold text-[#e4e1e5] flex items-center gap-1.5">
                <Activity size={14} className="text-[#55d8e1]" />
                <span>Bus Demand Load</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">ACTIVE LOAD (P_d)</span>
                  <span className="text-sm font-bold text-[#55d8e1]">{data.pd} MW</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">REACTIVE LOAD (Q_d)</span>
                  <span className="text-sm font-bold text-[#55d8e1]">{data.qd} MVAr</span>
                </div>
              </div>
            </div>

            {/* Generators at this Bus */}
            {data.generators && data.generators.length > 0 && (
              <div className="p-4 rounded-xl bg-[#00adb5]/10 border border-[#00adb5]/30 space-y-3">
                <div className="font-semibold text-[#55d8e1] flex items-center gap-1.5">
                  <Zap size={14} />
                  <span>Connected Generators ({data.generators.length})</span>
                </div>
                {data.generators.map((g, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#131316] border border-[#2D333B] space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between font-bold text-[#e4e1e5]">
                      <span>Gen ID: {g.gen_id}</span>
                      <span className="text-[#55d8e1]">{g.pg} MW</span>
                    </div>
                    <div className="flex justify-between text-[#bbc9ca] text-[10px]">
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
          <div className="mt-5 space-y-4 text-xs">
            
            {/* BREAKER CONTINGENCY SWITCHING CARD */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isLineTripped
                ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                : 'bg-[#131316] border-[#2D333B]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Power size={16} className={isLineTripped ? 'text-red-400' : 'text-emerald-400'} />
                  <span className="font-bold text-[#e4e1e5]">Circuit Breaker State</span>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  isLineTripped 
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {isLineTripped ? 'TRIPPED (OPEN)' : 'IN-SERVICE (CLOSED)'}
                </span>
              </div>

              {onToggleLineTrip && (
                <button
                  onClick={() => onToggleLineTrip(data.id, data.from_bus, data.to_bus)}
                  disabled={isLoading}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                    isLineTripped
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-[#002b1b] shadow-emerald-500/20'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 hover:border-red-500 shadow-red-500/10'
                  }`}
                >
                  {isLineTripped ? (
                    <>
                      <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                      <span>Close Breaker & Restore Line</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className={isLoading ? 'animate-spin' : ''} />
                      <span>Trip Line (Open Breaker)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Status & Thermal Loading */}
            <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#bbc9ca] flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-400" />
                  Thermal Loading %
                </span>
                <span className={`font-mono font-bold text-sm ${
                  isLineTripped 
                    ? 'text-red-400' 
                    : (data.loading_pct > 100 ? 'text-red-400' : (data.loading_pct > 80 ? 'text-[#FFD369]' : 'text-[#55d8e1]'))
                }`}>
                  {isLineTripped ? '0.0% (Tripped)' : `${data.loading_pct}%`}
                </span>
              </div>

              <div className="w-full bg-[#2a2a2d] h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    isLineTripped ? 'bg-red-500/30' : (data.loading_pct > 100 ? 'bg-red-500' : (data.loading_pct > 80 ? 'bg-[#FFD369]' : 'bg-[#55d8e1]'))
                  }`}
                  style={{ width: isLineTripped ? '0%' : `${Math.min(100, data.loading_pct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#bbc9ca] mt-1.5 font-mono">
                <span>0%</span>
                <span>Rating: {data.rate_a > 0 ? `${data.rate_a} MVA` : 'Continuous'}</span>
                <span>100%</span>
              </div>
            </div>

            {/* Power Flows */}
            <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B] space-y-3 font-mono">
              <div className="font-semibold text-[#e4e1e5] flex items-center gap-1.5 font-sans">
                <Activity size={14} className="text-[#55d8e1]" />
                <span>Line Power Flows (From → To)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">ACTIVE FLOW (P_f)</span>
                  <span className="text-sm font-bold text-[#55d8e1]">{isLineTripped ? '0.00' : data.pf} MW</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">REACTIVE FLOW (Q_f)</span>
                  <span className="text-sm font-bold text-[#55d8e1]">{isLineTripped ? '0.00' : data.qf} MVAr</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block font-sans">APPARENT (S_flow)</span>
                  <span className="text-sm font-bold text-purple-400">{isLineTripped ? '0.00' : data.s_flow} MVA</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block font-sans">LINE LOSS (P_loss)</span>
                  <span className="text-sm font-bold text-[#FFD369]">{isLineTripped ? '0.00' : data.p_loss} MW</span>
                </div>
              </div>
            </div>

            {/* Branch Impedance Data */}
            <div className="p-4 rounded-xl bg-[#131316] border border-[#2D333B] space-y-2 font-mono">
              <div className="font-semibold text-[#e4e1e5] flex items-center gap-1.5 font-sans">
                <Info size={14} className="text-[#bbc9ca]" />
                <span>Impedance Parameters (p.u.)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">RESISTANCE (R)</span>
                  <span className="text-[#e4e1e5]">{data.r}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">REACTANCE (X)</span>
                  <span className="text-[#e4e1e5]">{data.x}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block">SUSCEPTANCE (B)</span>
                  <span className="text-[#e4e1e5]">{data.b}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#bbc9ca] block font-sans">TAP RATIO</span>
                  <span className="text-[#e4e1e5]">{data.tap}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#2D333B] text-[10px] text-[#bbc9ca] text-center font-mono">
        EEQ401 Telemetry Stream • AC Newton-Raphson
      </div>
    </aside>
  );
}

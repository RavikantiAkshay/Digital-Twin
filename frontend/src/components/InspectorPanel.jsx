import React from 'react';
import { 
  Network, 
  Cpu, 
  ArrowRightLeft, 
  Power, 
  Zap, 
  Activity,
  Gauge
} from 'lucide-react';

export default function InspectorPanel({ 
  element, 
  onClose, 
  summary,
  onToggleLineTrip,
  trippedBranches = [],
  isLoading
}) {
  // If NO element is selected, display the Network Overview (Right Sidebar default mode)
  if (!element) {
    const isSafe = summary?.grid_health === 'SAFE';
    const isAlert = summary?.grid_health === 'ALERT';
    const isCritical = summary?.grid_health === 'CRITICAL';

    return (
      <aside className="w-72 sm:w-80 bg-[#FAF8F4] border-l border-[#E3DFD5] h-full flex flex-col justify-between p-4 overflow-y-auto font-sans text-[#1C1B18] z-20 shrink-0">
        <div className="space-y-4">
          
          {/* HEADER: NETWORK OVERVIEW */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E3DFD5]">
            <div className="p-1.5 rounded-lg bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
              <Network size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#1C1B18] uppercase tracking-wide">
                Network Overview
              </h2>
            </div>
          </div>

          {/* SECURITY CLASSIFICATION */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] mb-1 font-semibold">
              SECURITY CLASSIFICATION
            </div>
            <div className={`text-base font-bold uppercase tracking-tight ${
              isSafe ? 'text-[#244B43]' : isAlert ? 'text-[#A67C33]' : 'text-red-600'
            }`}>
              {summary?.grid_health || 'SAFE'}
            </div>
            <div className="text-[11px] text-[#7A766D]">
              {summary?.converged !== false 
                ? 'AC Newton-Raphson Converged' 
                : 'AC Power Flow Diverged (Voltage Collapse / Islanding)'}
            </div>
          </div>

          {/* TOPOLOGY METRICS (2x2) */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] mb-1.5 font-semibold">
              TOPOLOGY
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">BUSES</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.n_bus || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">BRANCHES</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.n_branch || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">GENERATORS</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.n_gen || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">BASE MVA</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.base_mva || 100}</div>
              </div>
            </div>
          </div>

          {/* POWER BALANCE METRICS (2x2) */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] mb-1.5 font-semibold">
              POWER BALANCE
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">GENERATION</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.total_gen_mw || 0} MW</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">DEMAND</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.total_load_mw || 0} MW</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">LOSSES</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.total_losses_mw || 0} MW</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">LOAD SCALE</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">{summary?.global_load_scale || 1}x</div>
              </div>
            </div>
          </div>

          {/* VIOLATIONS (2x2) */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] mb-1.5 font-semibold">
              VIOLATIONS
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">VOLTAGE</div>
                <div className={`text-xs font-bold font-mono ${(summary?.voltage_violations_count || 0) > 0 ? 'text-red-600' : 'text-[#1C1B18]'}`}>
                  {summary?.voltage_violations_count || 0}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono">THERMAL</div>
                <div className={`text-xs font-bold font-mono ${(summary?.thermal_violations_count || 0) > 0 ? 'text-red-600' : 'text-[#1C1B18]'}`}>
                  {summary?.thermal_violations_count || 0}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM HELPER NOTE */}
        <div className="pt-4 border-t border-[#E3DFD5] text-[11px] text-[#7A766D] leading-normal">
          Select a bus or branch on the canvas to inspect its voltage, loading, and power-flow detail.
        </div>
      </aside>
    );
  }

  // =========================================================================
  // IF A BUS OR BRANCH IS SELECTED
  // =========================================================================
  const { type, data } = element;
  const isLineTripped = type === 'line' && (
    data.is_tripped === true || 
    data.status === 0 || 
    data.thermal_status === 'tripped' ||
    (trippedBranches && (
      trippedBranches.includes(`${data.from_bus}-${data.to_bus}`) ||
      trippedBranches.includes(`${data.to_bus}-${data.from_bus}`) ||
      trippedBranches.includes(data.id)
    ))
  );

  return (
    <aside className="w-72 sm:w-80 bg-[#FAF8F4] border-l border-[#E3DFD5] h-full flex flex-col justify-between p-4 overflow-y-auto font-sans text-[#1C1B18] z-20 shrink-0 animate-in slide-in-from-right duration-200">
      <div className="space-y-4">
        
        {/* HEADER: ELEMENT TITLE + CLEAR BUTTON */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ECE8DF] text-[#1C1B18] border border-[#DDD8CD]">
              {type === 'bus' ? <Cpu size={16} /> : <ArrowRightLeft size={16} />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1B18]">
                {type === 'bus' ? `Bus ${data.id}` : `Line ${data.from_bus} → ${data.to_bus}`}
              </h2>
              <span className="text-[11px] font-mono text-[#7A766D]">
                {type === 'bus' 
                  ? `Node #${data.index || data.id} of ${summary?.n_bus || 14}` 
                  : `Branch ID ${data.id || `${data.from_bus}-${data.to_bus}`}`}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#5C5950] hover:text-[#1C1B18] hover:underline"
          >
            Clear
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BUS INSPECTION DETAIL VIEW (MATCHING ATTACHED SCREENSHOT)                 */}
        {/* ========================================================================= */}
        {type === 'bus' && (
          <div className="space-y-4 text-xs">
            
            {/* Top 2-Card Row: Bus Type & Voltage Security */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">BUS TYPE</div>
                <div className="text-xs font-bold text-[#1C1B18] capitalize">
                  {data.type === 'slack' ? 'Slack' : data.type === 'pv' ? 'PV Generator' : 'PQ Load'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">VOLTAGE SECURITY</div>
                <div className={`text-xs font-bold ${
                  data.v_status === 'critical' ? 'text-red-600' : data.v_status === 'alert' ? 'text-[#A67C33]' : 'text-[#244B43]'
                }`}>
                  {data.v_status || 'safe'}
                </div>
              </div>
            </div>

            {/* Voltage Magnitude Gauge */}
            <div className="p-3 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5C5950] flex items-center gap-1.5 font-medium">
                  <Activity size={13} className="text-[#244B43]" />
                  <span>Voltage magnitude |V|</span>
                </span>
                <span className="font-mono font-bold text-[#1C1B18]">
                  {data.vm ? data.vm.toFixed(4) : '1.0000'} pu
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-[#DDD8CD] h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    data.v_status === 'critical' ? 'bg-red-600' : data.v_status === 'alert' ? 'bg-[#A67C33]' : 'bg-[#244B43]'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (((data.vm || 1.0) - 0.90) / 0.20) * 100))}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-mono text-[#7A766D]">
                <span>0.90</span>
                <span>1.00</span>
                <span>1.10 pu</span>
              </div>
            </div>

            {/* Angle & Base Voltage Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">ANGLE θ</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">
                  {data.va !== undefined ? data.va.toFixed(2) : '0.00'}°
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">BASE VOLTAGE</div>
                <div className="text-xs font-bold font-mono text-[#1C1B18]">
                  {data.base_kv || 0} kV
                </div>
              </div>
            </div>

            {/* DEMAND LOAD */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] font-semibold">
                DEMAND LOAD
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                  <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">ACTIVE (PD)</div>
                  <div className="text-xs font-bold font-mono text-[#1C1B18]">
                    {data.pd !== undefined ? data.pd.toFixed(0) : 0} MW
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                  <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">REACTIVE (QD)</div>
                  <div className="text-xs font-bold font-mono text-[#1C1B18]">
                    {data.qd !== undefined ? data.qd.toFixed(0) : 0} MVAr
                  </div>
                </div>
              </div>
            </div>

            {/* CONNECTED GENERATORS (IF ANY) */}
            {(data.type === 'slack' || data.type === 'pv' || (data.pg && data.pg > 0)) && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] font-semibold">
                  CONNECTED GENERATORS (1)
                </div>
                <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[#1C1B18] font-mono">
                      Gen G{data.id}
                    </div>
                    <div className="text-[10px] font-mono text-[#7A766D]">
                      Qg {data.qg !== undefined ? data.qg.toFixed(2) : 0} MVAr
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-[#244B43] font-mono">
                      {data.pg !== undefined ? data.pg.toFixed(2) : 0} MW
                    </div>
                    <div className="text-[10px] font-mono text-[#7A766D]">
                      Max {data.pmax || (data.pg ? (data.pg * 1.5).toFixed(1) : 100)} MW
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* BRANCH INSPECTION DETAIL VIEW                                             */}
        {/* ========================================================================= */}
        {type === 'line' && (
          <div className="space-y-4 text-xs">
            {/* Loading Gauge */}
            <div className="p-3 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#5C5950] font-medium">Thermal Loading</span>
                <span className={`font-bold font-mono ${
                  isLineTripped ? 'text-red-600' : (data.loading_pct || 0) > 125 ? 'text-red-600' : (data.loading_pct || 0) > 110 ? 'text-[#A67C33]' : 'text-[#244B43]'
                }`}>
                  {isLineTripped ? 'TRIPPED' : `${(data.loading_pct || 0).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-[#DDD8CD] h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isLineTripped ? 'bg-red-600' : (data.loading_pct || 0) > 125 ? 'bg-red-600' : (data.loading_pct || 0) > 110 ? 'bg-[#A67C33]' : 'bg-[#244B43]'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, isLineTripped ? 100 : (data.loading_pct || 0) * (100 / 125)))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-[#7A766D]">
                <span>0%</span>
                <span>110% Alert</span>
                <span>125% Overload</span>
              </div>
            </div>

            {/* Power Flow Breakdown */}
            {(() => {
              const pFlow = data.pf !== undefined ? data.pf : (data.p_flow !== undefined ? data.p_flow : 0);
              const qFlow = data.qf !== undefined ? data.qf : (data.q_flow !== undefined ? data.q_flow : 0);
              const sFlow = data.s_flow !== undefined ? data.s_flow : Math.sqrt(pFlow * pFlow + qFlow * qFlow);

              return (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                    <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">ACTIVE FLOW (P)</div>
                    <div className="text-xs font-bold font-mono text-[#1C1B18]">
                      {pFlow.toFixed(1)} MW
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                    <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">REACTIVE FLOW (Q)</div>
                    <div className="text-xs font-bold font-mono text-[#1C1B18]">
                      {qFlow.toFixed(1)} MVAr
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                    <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">APPARENT (S)</div>
                    <div className="text-xs font-bold font-mono text-[#1C1B18]">
                      {sFlow.toFixed(1)} MVA
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
                    <div className="text-[10px] text-[#7A766D] uppercase font-mono mb-0.5">RATE LIMIT</div>
                    <div className="text-xs font-bold font-mono text-[#1C1B18]">
                      {data.rate_a || 100} MVA
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Contingency Trip Toggle */}
            {onToggleLineTrip && (
              <button
                onClick={() => onToggleLineTrip(data.id, data.from_bus, data.to_bus)}
                disabled={isLoading}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                  isLineTripped
                    ? 'bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4]'
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                }`}
              >
                <Power size={14} />
                <span>{isLineTripped ? 'Restore Transmission Line' : 'Simulate Line Outage (N-1)'}</span>
              </button>
            )}
          </div>
        )}

      </div>
    </aside>
  );
}

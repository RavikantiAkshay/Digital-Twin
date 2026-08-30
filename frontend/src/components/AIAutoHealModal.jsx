import React from 'react';
import { 
  X, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

export default function AIAutoHealModal({ 
  isOpen, 
  onClose, 
  aiResult, 
  onApplyHeal, 
  isLoading 
}) {
  if (!isOpen || !aiResult) return null;

  const {
    pre_health = 'ALERT',
    post_health = 'SAFE',
    max_loading_before_pct = 0.0,
    max_loading_after_pct = 0.0,
    pre_violations_count = 0,
    post_violations_count = 0,
    ai_actions = [],
    reward_breakdown = {},
    no_action_needed = false
  } = aiResult;

  const isIdle = no_action_needed || ai_actions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 font-sans text-[#1C1B18]">
      <div className="relative w-full max-w-2xl bg-[#FAF8F4] border border-[#E3DFD5] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD5] bg-[#FAF8F4]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1B18]">
                Grid Remediation Plan
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A766D] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BODY                                                                      */}
        {/* ========================================================================= */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          
          {/* Health & Loading Transformation Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD]">
            {/* Initial State */}
            <div>
              <span className="text-[10px] font-mono font-bold text-[#7A766D] uppercase block mb-1">
                CURRENT STATE
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                  pre_health === 'SAFE' ? 'bg-[#E3ECE6] text-[#244B43]' : 'bg-red-100 text-red-700'
                }`}>
                  {pre_health}
                </span>
                <span className="text-[11px] text-[#5C5950] font-mono">
                  {pre_violations_count} violations · {max_loading_before_pct.toFixed(1)}% peak load
                </span>
              </div>
            </div>

            {/* Predicted State */}
            <div>
              <span className="text-[10px] font-mono font-bold text-[#7A766D] uppercase block mb-1">
                PREDICTED REMEDIATION
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                  post_health === 'SAFE' ? 'bg-[#E3ECE6] text-[#244B43]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {post_health}
                </span>
                <span className="text-[11px] text-[#5C5950] font-mono">
                  {post_violations_count} violations · {max_loading_after_pct.toFixed(1)}% peak load
                </span>
              </div>
            </div>
          </div>

          {/* Generator Redispatch Action Cards */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-[#7A766D] uppercase tracking-wider block">
              REQUIRED GENERATOR ADJUSTMENTS
            </span>

            {isIdle ? (
              <div className="p-6 text-center rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] text-[#244B43] font-semibold">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-[#244B43]" />
                All branches and voltages are within secure limits. No redispatch required.
              </div>
            ) : (
              <div className="space-y-2">
                {ai_actions.map((act, idx) => {
                  const isUp = (act.delta_mw || 0) >= 0;
                  return (
                    <div 
                      key={idx} 
                      className="p-3 rounded-xl bg-[#FAF8F4] border border-[#DDD8CD] flex items-center justify-between font-mono"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1C1B18]">
                            Gen {act.gen_id} (Bus {act.bus_id})
                          </span>
                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-[#ECE8DF] text-[#5C5950]">
                            {act.is_slack ? 'SLACK' : 'PV UNIT'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5C5950] mt-0.5">
                          {act.current_pg?.toFixed(1)} MW → {act.target_pg?.toFixed(1)} MW
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg inline-block ${
                          isUp 
                            ? 'bg-[#E3ECE6] text-[#244B43]' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isUp ? `+${act.delta_mw?.toFixed(1)} MW` : `${act.delta_mw?.toFixed(1)} MW`}
                        </span>
                        <div className="text-[10px] text-[#7A766D] mt-0.5">
                          Limits: 0 - {act.pmax || 100} MW
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* FOOTER                                                                    */}
        {/* ========================================================================= */}
        <div className="px-6 py-3 border-t border-[#E3DFD5] bg-[#FAF8F4] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#DDD8CD] bg-[#ECE8DF] hover:bg-[#E2DDD2] text-[#5C5950] hover:text-[#1C1B18] text-xs font-semibold transition-colors"
          >
            Dismiss
          </button>

          {!isIdle && onApplyHeal && (
            <button
              onClick={() => {
                onApplyHeal(ai_actions);
                onClose();
              }}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>Apply Redispatch</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

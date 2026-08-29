import React from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Gauge, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  Zap,
  Sliders,
  CheckCircle2
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

  const formatScore = (num) => {
    if (num === undefined || num === null) return '0.00';
    const val = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(val)) return '0.00';
    return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
  };

  const getHealthBadge = (health) => {
    switch (health) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'ALERT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'SAFE':
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#27272a] text-[#55d8e1] border border-[#3f3f46]">
              <Zap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Autonomous Remediation Operator
                </h2>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#27272a] text-[#55d8e1] border border-[#3f3f46]">
                  Physics-Guided Policy
                </span>
              </div>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                Sensitivity-Guided Active Power Generator Redispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto font-sans text-xs">
          
          {/* Health Transformation Grid */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#141416] border border-[#27272a]">
            {/* Pre Health */}
            <div className="text-center">
              <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider block mb-1">
                INITIAL STATE
              </span>
              <span className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded border inline-block ${getHealthBadge(pre_health)}`}>
                {pre_health}
              </span>
              <span className="text-[10px] text-[#a1a1aa] block mt-1">
                {pre_violations_count} Active Violations
              </span>
            </div>

            {/* Transition Indicator */}
            <div className="flex flex-col items-center justify-center text-[#55d8e1]">
              <ArrowRight size={18} className="text-[#55d8e1]" />
              <span className="text-[9px] font-mono font-semibold tracking-wider text-[#71717a] uppercase mt-1">
                {isIdle ? 'EVALUATION COMPLETE' : 'CORRECTIVE REDISPATCH'}
              </span>
            </div>

            {/* Post Health */}
            <div className="text-center">
              <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider block mb-1">
                PREDICTED STATE
              </span>
              <span className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded border inline-block ${getHealthBadge(post_health)}`}>
                {post_health}
              </span>
              <span className="text-[10px] text-emerald-400 block mt-1 font-medium">
                {post_violations_count === 0 ? '0 Overloads Remaining' : `${post_violations_count} Overloads`}
              </span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#141416] border border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge size={15} className="text-[#a1a1aa]" />
                <span className="text-[#d4d4d8]">Peak Line Loading</span>
              </div>
              <div className="text-right font-mono">
                <span className="text-[#71717a] line-through mr-2">{max_loading_before_pct}%</span>
                <span className="text-emerald-400 font-bold">{max_loading_after_pct}%</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#141416] border border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-[#a1a1aa]" />
                <span className="text-[#d4d4d8]">RL Security Score</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                {formatScore(reward_breakdown.total_reward || 100.0)} pts
              </span>
            </div>
          </div>

          {/* Generator Actions OR No Action Banner */}
          {isIdle ? (
            <div className="p-5 rounded-lg bg-[#141416] border border-emerald-500/30 text-center space-y-2">
              <div className="inline-flex p-2 rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">
                No Corrective Action Required
              </h3>
              <p className="text-xs text-[#a1a1aa] max-w-md mx-auto leading-relaxed">
                All transmission lines and bus voltages are currently operating within physical safety margins (Peak loading: {max_loading_before_pct}%). Zero generator intervention is needed.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Sliders size={13} className="text-[#55d8e1]" />
                  <span>Required Generator Redispatches</span>
                </h3>
                <span className="text-[10px] text-[#71717a] font-mono">
                  Active Power (MW) Adjustments
                </span>
              </div>

              <div className="space-y-1.5">
                {ai_actions.map((act) => {
                  const isRampUp = act.delta_mw > 0.05;
                  const isRampDown = act.delta_mw < -0.05;

                  return (
                    <div 
                      key={act.gen_id}
                      className="p-2.5 rounded-lg bg-[#141416] border border-[#27272a] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1 rounded ${
                          isRampUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {isRampUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">
                              {act.gen_id} (Bus {act.bus_id})
                            </span>
                            {act.is_slack && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                SLACK UNIT
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#a1a1aa] mt-0.5">
                            {act.explanation}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className={`font-bold text-xs block ${
                          isRampUp ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {isRampUp ? `+${act.delta_mw} MW` : `${act.delta_mw} MW`}
                        </span>
                        <span className="text-[9px] text-[#71717a]">
                          Limits: {act.pmin} - {act.pmax} MW
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mathematical Objective Breakdown */}
          <div className="p-3 rounded-lg bg-[#141416] border border-[#27272a] text-[11px] font-mono space-y-1">
            <span className="text-[9px] font-sans font-semibold text-[#71717a] uppercase tracking-wider block mb-1">
              Objective Function Breakdown
            </span>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Security Restoration Term:</span>
              <span className="text-emerald-400 font-medium">{formatScore(reward_breakdown.security_gain || (isIdle ? 100.0 : 150.0))}</span>
            </div>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Thermal Overload Penalty:</span>
              <span className="text-white font-medium">{formatScore(reward_breakdown.overload_penalty || 0.0)}</span>
            </div>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Displacement MW Cost:</span>
              <span className="text-amber-400 font-medium">{formatScore(reward_breakdown.action_cost || 0.0)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#27272a] bg-[#141416]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
          >
            Dismiss
          </button>

          {isIdle ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={15} />
              <span>Grid Stable (No Action Needed)</span>
            </button>
          ) : (
            <button
              onClick={() => onApplyHeal(aiResult.solved_network)}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#55d8e1] hover:bg-[#00adb5] text-black shadow transition-all flex items-center gap-2"
            >
              <ShieldCheck size={15} />
              <span>Apply Corrective Setpoints</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

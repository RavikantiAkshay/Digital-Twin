import React, { useState } from 'react';
import { 
  Zap, 
  Layers, 
  PlusCircle, 
  ArrowRight, 
  Activity, 
  Cpu, 
  CheckCircle2, 
  Info, 
  Sparkles,
  Server,
  ShieldCheck
} from 'lucide-react';

export default function ModeSelection({ cases, onSelectCase, onOpenCustomModal }) {
  const [selectedCaseId, setSelectedCaseId] = useState('case14');

  const getDifficultyColor = (nBus) => {
    if (nBus <= 14) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (nBus <= 39) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (nBus <= 57) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col justify-between grid-bg p-6 md:p-12 relative overflow-hidden">
      {/* Background Decorative Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Section */}
      <header className="max-w-7xl mx-auto w-full mb-10 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles size={14} className="animate-spin-slow" />
          EEQ401 Digital Twin Circuit Simulator
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-4">
          Power Grid Security & Contingency Twin
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
          Interactive AC Newton-Raphson Power Flow Visualizer and Circuit Analysis Engine.
          Select an entry mode below to launch the digital twin.
        </p>
      </header>

      {/* Main Options Grid */}
      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 my-auto">
        
        {/* OPTION 1: Use Existing Benchmark Network */}
        <div className="lg:col-span-7 glass-panel p-6 md:p-8 flex flex-col justify-between border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 shadow-2xl">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Server size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Use Existing Benchmark Network
                  </h2>
                  <p className="text-xs text-slate-400">PyPOWER Case Source Datasets (AC Newton-Raphson)</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                Ready to Load
              </span>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Load standard PyPOWER IEEE grid cases. Solves AC power flow telemetry, bus voltage profiles, line thermal loading, and generator outputs.
            </p>

            {/* Network Selector Cards */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = selectedCaseId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/80 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-400 font-light mt-0.5">
                          {c.description}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getDifficultyColor(c.id === 'case118' ? 118 : (c.id === 'case300' ? 300 : 14))}`}>
                        {c.id.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-blue-400" />
              Includes 9, 14, 30, 39, 57, 118, 300 Bus IEEE Cases
            </div>
            <button
              onClick={() => onSelectCase(selectedCaseId)}
              className="btn-primary"
            >
              <span>Launch Visualizer</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* OPTION 2: Create Custom Network */}
        <div className="lg:col-span-5 glass-panel p-6 md:p-8 flex flex-col justify-between border-slate-800 hover:border-purple-500/40 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <PlusCircle size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Create Custom Network
                  </h2>
                  <p className="text-xs text-slate-400">Interactive Circuit Builder</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                Custom Mode
              </span>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Design a custom transmission grid from scratch. Add custom buses, set load demands, position generators, define line impedances, and simulate AC power flow.
            </p>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <Layers size={16} className="text-purple-400 mt-0.5 shrink-0" />
                <span>Drag-and-drop custom buses (Slack, PV, PQ)</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <Activity size={16} className="text-purple-400 mt-0.5 shrink-0" />
                <span>Custom line R, X, B impedance and MVA thermal limits</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <Cpu size={16} className="text-purple-400 mt-0.5 shrink-0" />
                <span>Live AC Newton-Raphson solver integration</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Info size={14} className="text-purple-400" />
              <span>Interactive network builder</span>
            </div>
            <button
              onClick={onOpenCustomModal}
              className="btn-secondary text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
            >
              <span>Create Custom</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full mt-10 pt-4 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 relative z-10 gap-2">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-blue-400" />
          <span>EEQ401 Contingency Analysis & Digital Twin Engine</span>
        </div>
        <div>
          <span>PyPOWER 5.1.21 • FastAPI • D3 Canvas Layout</span>
        </div>
      </footer>
    </div>
  );
}

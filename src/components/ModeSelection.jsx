import React, { useState } from 'react';
import CircuitThumbnail from './CircuitThumbnail';
import { 
  Network, 
  PlusCircle, 
  Search, 
  Play, 
  CheckCircle2, 
  ArrowRight, 
  FolderOpen, 
  Upload, 
  Cpu, 
  Zap, 
  Sliders, 
  Layers, 
  Columns,
  Activity
} from 'lucide-react';

const CASE_STATS = {
  case9: { buses: 9, branches: 9, gens: 3, loads: 6, status: 'Offline', delay: '--' },
  case14: { buses: 14, branches: 20, gens: 5, loads: 11, status: 'Standby', delay: '8 ms' },
  case30: { buses: 30, branches: 41, gens: 6, loads: 21, status: 'Offline', delay: '--' },
  case39: { buses: 39, branches: 46, gens: 10, loads: 29, status: 'Offline', delay: '--' },
  case57: { buses: 57, branches: 80, gens: 7, loads: 42, status: 'Offline', delay: '--' },
  case118: { buses: 118, branches: 186, gens: 54, loads: 99, status: 'Standby', delay: '12 ms' },
  case300: { buses: 300, branches: 411, gens: 69, loads: 201, status: 'Offline', delay: '--' }
};

export default function ModeSelection({ cases, onSelectCase, onOpenCustomModal }) {
  // 'none' = equal 50/50 split; 'existing' = left expanded; 'custom' = right expanded
  const [activeSection, setActiveSection] = useState('none');
  const [selectedCaseId, setSelectedCaseId] = useState('case14');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCases = cases.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#131316] text-[#e4e1e5] p-4 sm:p-6 lg:p-8 flex flex-col font-sans">
      
      {/* Workspace Header */}
      <div className="max-w-7xl mx-auto w-full mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D333B]">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#bbc9ca] font-medium mb-1">
            <span>System Root</span>
            <span className="text-[#3c494a]">/</span>
            <span className="text-[#55d8e1]">Network Configuration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e4e1e5] tracking-tight">
            IEEE Digital Twin • Network Selector
          </h1>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center bg-[#1b1b1e] border border-[#2D333B] p-1 rounded-xl self-start sm:self-auto gap-1">
          <button
            onClick={() => setActiveSection('none')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeSection === 'none'
                ? 'bg-[#2a2a2d] text-[#55d8e1] border border-[#55d8e1]/30 shadow-sm'
                : 'text-[#bbc9ca] hover:text-white'
            }`}
            title="50/50 Equal Split View"
          >
            <Columns size={15} />
            <span>50 / 50 View</span>
          </button>

          <button
            onClick={() => setActiveSection('existing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeSection === 'existing'
                ? 'bg-[#00adb5] text-[#002022] shadow-[0_0_12px_rgba(85,216,225,0.3)]'
                : 'text-[#bbc9ca] hover:text-white'
            }`}
          >
            <Network size={15} />
            <span>IEEE Benchmarks</span>
          </button>

          <button
            onClick={() => setActiveSection('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeSection === 'custom'
                ? 'bg-[#55d8e1] text-[#002022] shadow-[0_0_12px_rgba(85,216,225,0.3)]'
                : 'text-[#bbc9ca] hover:text-white'
            }`}
          >
            <PlusCircle size={15} />
            <span>Custom Builder</span>
          </button>
        </div>
      </div>

      {/* Main 50 / 50 Split Interactive Grid Container */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 min-h-[600px] items-stretch">
        
        {/* ========================================================================= */}
        {/* CARD 1: EXISTING IEEE BENCHMARK NETWORKS                                   */}
        {/* ========================================================================= */}
        <div
          onClick={() => {
            if (activeSection === 'none') setActiveSection('existing');
          }}
          className={`rounded-2xl border transition-all duration-500 flex flex-col overflow-hidden ${
            activeSection === 'none'
              ? 'lg:flex-1 border-[#2D333B] bg-[#1f1f22] hover:border-[#00adb5]/50 shadow-lg cursor-pointer group'
              : activeSection === 'existing'
              ? 'lg:flex-[3.5] border-[#00adb5] bg-[#1f1f22] shadow-[0_0_30px_rgba(0,173,181,0.1)]'
              : 'lg:flex-[0.8] border-[#2D333B] bg-[#1b1b1e] hover:border-[#00adb5]/40 hover:bg-[#1f1f22] cursor-pointer'
          }`}
        >
          {/* STATE A: DEFAULT 50/50 SPLIT CARD VIEW */}
          {activeSection === 'none' && (
            <div className="p-6 sm:p-8 flex flex-col justify-between h-full relative group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3.5 rounded-2xl bg-[#00adb5]/10 border border-[#00adb5]/30 text-[#55d8e1] group-hover:scale-110 transition-transform">
                    <Network size={32} />
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-[#2a2a2d] text-[#55d8e1] rounded-full border border-[#55d8e1]/20">
                    7 IEEE Benchmark Cases
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-[#e4e1e5] group-hover:text-[#55d8e1] transition-colors">
                    Existing Benchmark Networks
                  </h2>
                  <p className="text-xs text-[#bbc9ca] mt-2 leading-relaxed">
                    Load pre-configured IEEE test cases (IEEE 9, 14, 30, 39, 57, 118, 300-bus). Executes AC Newton-Raphson power flow analysis to yield bus voltage profiles and thermal loading.
                  </p>
                </div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Cpu size={16} className="text-[#55d8e1]" />
                    <span>PyPOWER AC Solver</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Activity size={16} className="text-[#55d8e1]" />
                    <span>Live Telemetry</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Zap size={16} className="text-[#FFD369]" />
                    <span>Line Overload Badges</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Layers size={16} className="text-[#55d8e1]" />
                    <span>D3 Auto-Layout</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSection('existing');
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#00adb5] text-[#002022] font-bold text-sm hover:bg-[#55d8e1] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,173,181,0.2)]"
                >
                  <span>Select Benchmark Network</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STATE B: FULLY EXPANDED CARD VIEW */}
          {activeSection === 'existing' && (
            <div className="p-6 flex flex-col h-full">
              {/* Header inside Expanded Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2D333B]">
                <div>
                  <h2 className="text-xl font-bold text-[#e4e1e5] flex items-center gap-2">
                    <Network size={22} className="text-[#55d8e1]" />
                    Standard IEEE Power System Models
                  </h2>
                  <p className="text-xs text-[#bbc9ca] mt-1">
                    Select a PyPOWER benchmark case below, then click Initialize Twin.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbc9ca]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search cases..."
                      className="bg-[#1b1b1e] border border-[#2D333B] text-xs text-[#e4e1e5] pl-9 pr-3 py-2 rounded-full focus:outline-none focus:border-[#55d8e1] focus:ring-1 focus:ring-[#55d8e1] transition-all w-40 sm:w-48"
                    />
                  </div>

                  {/* Initialize Twin Launch Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCase(selectedCaseId);
                    }}
                    className="bg-[#55d8e1] text-[#003739] text-xs sm:text-sm px-6 py-2.5 rounded-lg hover:bg-[#55d8e1]/90 transition-all font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(85,216,225,0.3)] shrink-0 cursor-pointer"
                  >
                    <Play size={16} fill="currentColor" />
                    <span>Initialize Twin ⚡</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Network Cards List */}
              <div className="flex-1 overflow-y-auto pr-1 my-4 space-y-4 max-h-[560px]">
                {filteredCases.map((caseItem) => {
                  const isSelected = selectedCaseId === caseItem.id;
                  const stats = CASE_STATS[caseItem.id] || { buses: 14, branches: 20, gens: 5, loads: 11, status: 'Offline', delay: '--' };

                  return (
                    <div
                      key={caseItem.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseId(caseItem.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onSelectCase(caseItem.id);
                      }}
                      className={`rounded-xl flex flex-col md:flex-row relative group transition-all duration-300 cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'bg-[#1f1f22] ring-2 ring-[#55d8e1] shadow-[0_0_20px_rgba(85,216,225,0.15)]'
                          : 'bg-[#1f1f22] border border-[#2D333B] hover:bg-[#2a2a2d] hover:border-[#00adb5]/40'
                      }`}
                    >
                      {/* Active highlight side strip */}
                      {isSelected && (
                        <>
                          <div className="absolute top-0 right-0 w-2 h-full bg-[#55d8e1]" />
                          <div className="absolute top-0 left-0 w-full h-full bg-[#55d8e1]/5 pointer-events-none" />
                        </>
                      )}

                      {/* Left Info Column */}
                      <div className="p-5 w-full md:w-60 flex flex-col justify-between relative z-10">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className={`text-lg font-semibold ${isSelected ? 'text-[#55d8e1]' : 'text-[#e4e1e5]'}`}>
                              {caseItem.name}
                            </h3>
                            {isSelected && (
                              <CheckCircle2 size={20} className="text-[#55d8e1]" />
                            )}
                          </div>

                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md mt-2 inline-block ${
                            isSelected
                              ? 'bg-[#55d8e1]/15 text-[#55d8e1] border border-[#55d8e1]/30 font-bold'
                              : 'bg-[#353438] text-[#bbc9ca]'
                          }`}>
                            {isSelected ? 'Selected Model' : 'Standard Model'}
                          </span>
                        </div>

                        <div className="mt-4 flex justify-between items-center text-xs font-mono text-[#bbc9ca] relative">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#55d8e1] animate-pulse' : 'bg-[#869394]'}`} />
                            <span>{isSelected ? 'Standby' : 'Offline'}</span>
                          </div>
                          <div>{isSelected ? '12 ms' : '-- ms'}</div>
                        </div>
                      </div>

                      {/* Middle SVG Circuit Graphic & Stats Grid */}
                      <div className="p-5 flex-1 flex flex-col md:flex-row gap-6 items-center relative z-10">
                        <CircuitThumbnail caseId={caseItem.id} isSelected={isSelected} />

                        {/* Telemetry Stats Grid */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full h-full border-t md:border-t-0 md:border-l border-[#2D333B] pt-4 md:pt-0 md:pl-4">
                          <div className="flex flex-col justify-center">
                            <span className="text-xs text-[#bbc9ca] mb-1">Buses</span>
                            <span className={`text-xl font-bold font-mono ${isSelected ? 'text-[#55d8e1]' : 'text-[#e4e1e5]'}`}>
                              {stats.buses}
                            </span>
                          </div>

                          <div className="flex flex-col justify-center">
                            <span className="text-xs text-[#bbc9ca] mb-1">Branches</span>
                            <span className={`text-xl font-bold font-mono ${isSelected ? 'text-[#55d8e1]' : 'text-[#e4e1e5]'}`}>
                              {stats.branches}
                            </span>
                          </div>

                          <div className="flex flex-col justify-center">
                            <span className="text-xs text-[#bbc9ca] mb-1">Gen Units</span>
                            <span className={`text-xl font-bold font-mono ${isSelected ? 'text-[#55d8e1]' : 'text-[#e4e1e5]'}`}>
                              {stats.gens}
                            </span>
                          </div>

                          <div className="flex flex-col justify-center">
                            <span className="text-xs text-[#bbc9ca] mb-1">Loads</span>
                            <span className={`text-xl font-bold font-mono ${stats.loads >= 50 ? 'text-[#FFD369]' : isSelected ? 'text-[#55d8e1]' : 'text-[#e4e1e5]'}`}>
                              {stats.loads}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STATE C: COLLAPSED CARD VIEW (when Right card is expanded) */}
          {activeSection === 'custom' && (
            <div 
              onClick={() => setActiveSection('existing')}
              className="p-6 flex flex-col items-center justify-between h-full text-center cursor-pointer group"
            >
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#00adb5]/10 border border-[#00adb5]/30 flex items-center justify-center text-[#55d8e1] group-hover:scale-110 transition-transform">
                  <Network size={28} />
                </div>
                <h3 className="text-base font-bold text-[#e4e1e5]">IEEE Benchmarks</h3>
                <p className="text-[11px] text-[#bbc9ca] max-w-[160px]">
                  7 PyPOWER standard test cases
                </p>
                <span className="text-[10px] font-mono text-[#55d8e1] bg-[#55d8e1]/10 px-2.5 py-0.5 rounded-full border border-[#55d8e1]/20 mt-1">
                  Active: {cases.find(c => c.id === selectedCaseId)?.name || 'IEEE 14-Bus'}
                </span>
              </div>

              <button className="w-full mt-8 py-2.5 px-3 rounded-xl bg-[#2a2a2d] border border-[#2D333B] text-xs font-semibold text-[#55d8e1] hover:bg-[#00adb5] hover:text-[#002022] transition-all flex items-center justify-center gap-1.5">
                <span>Expand</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>


        {/* ========================================================================= */}
        {/* CARD 2: CREATE CUSTOM NETWORK                                             */}
        {/* ========================================================================= */}
        <div
          onClick={() => {
            if (activeSection === 'none') setActiveSection('custom');
          }}
          className={`rounded-2xl border transition-all duration-500 flex flex-col overflow-hidden ${
            activeSection === 'none'
              ? 'lg:flex-1 border-[#2D333B] bg-[#1f1f22] hover:border-[#55d8e1]/50 shadow-lg cursor-pointer group'
              : activeSection === 'custom'
              ? 'lg:flex-[3.5] border-[#55d8e1] bg-[#1f1f22] shadow-[0_0_30px_rgba(85,216,225,0.1)]'
              : 'lg:flex-[0.8] border-[#2D333B] bg-[#1b1b1e] hover:border-[#55d8e1]/40 hover:bg-[#1f1f22] cursor-pointer'
          }`}
        >
          {/* STATE A: DEFAULT 50/50 SPLIT CARD VIEW */}
          {activeSection === 'none' && (
            <div className="p-6 sm:p-8 flex flex-col justify-between h-full relative group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3.5 rounded-2xl bg-[#55d8e1]/10 border border-[#55d8e1]/30 text-[#55d8e1] group-hover:scale-110 transition-transform">
                    <PlusCircle size={32} />
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-[#2a2a2d] text-[#55d8e1] rounded-full border border-[#55d8e1]/20">
                    Custom Grid Builder
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-[#e4e1e5] group-hover:text-[#55d8e1] transition-colors">
                    Create Custom Network
                  </h2>
                  <p className="text-xs text-[#bbc9ca] mt-2 leading-relaxed">
                    Design custom transmission networks from scratch or import MATPOWER / JSON dataset files. Interactively define bus types, transmission line impedances ($R, X, B$), and load demands.
                  </p>
                </div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Sliders size={16} className="text-[#55d8e1]" />
                    <span>Custom Buses</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Upload size={16} className="text-[#55d8e1]" />
                    <span>MATPOWER Import</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Cpu size={16} className="text-[#FFD369]" />
                    <span>Newton-Raphson</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1b1b1e] border border-[#2D333B] flex items-center gap-2 text-xs">
                    <Layers size={16} className="text-[#55d8e1]" />
                    <span>Drag & Drop UI</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSection('custom');
                  }}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#55d8e1] text-[#003739] font-bold text-sm hover:bg-[#55d8e1]/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(85,216,225,0.25)]"
                >
                  <span>Open Custom Builder</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STATE B: FULLY EXPANDED CARD VIEW */}
          {activeSection === 'custom' && (
            <div className="p-6 flex flex-col h-full justify-between">
              <div>
                {/* Header inside Expanded Custom Card */}
                <div className="pb-6 border-b border-[#2D333B]">
                  <h2 className="text-xl font-bold text-[#e4e1e5] flex items-center gap-2">
                    <PlusCircle size={22} className="text-[#55d8e1]" />
                    Interactive Custom Network Builder
                  </h2>
                  <p className="text-xs text-[#bbc9ca] mt-1">
                    Design a custom transmission grid from scratch or import MATPOWER / JSON network specifications.
                  </p>
                </div>

                {/* Dropzone Upload Section */}
                <div 
                  onClick={onOpenCustomModal}
                  className="mt-6 rounded-xl border border-dashed border-[#3c494a] bg-[#0e0e11] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-[#00adb5] hover:bg-[#1b1b1e] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-[#1f1f22] border border-[#2D333B] flex items-center justify-center group-hover:border-[#00adb5] group-hover:bg-[#00adb5]/10 transition-colors shrink-0 text-[#bbc9ca] group-hover:text-[#55d8e1]">
                      <Upload size={28} />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-[#e4e1e5]">
                        Custom Network Upload & Config
                      </h4>
                      <p className="text-xs text-[#bbc9ca] mt-1">
                        Drag & drop MATPOWER .m file or JSON grid topology specification
                      </p>
                    </div>
                  </div>

                  <button className="bg-[#1f1f22] border border-[#2D333B] text-[#e4e1e5] text-xs px-5 py-2.5 rounded-lg hover:border-[#00adb5] hover:text-[#55d8e1] transition-colors font-medium flex items-center gap-2 shrink-0">
                    <FolderOpen size={18} />
                    <span>Browse Files</span>
                  </button>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-[#1b1b1e] border border-[#2D333B]">
                    <div className="text-[#55d8e1] mb-2">
                      <Network size={20} />
                    </div>
                    <h5 className="text-xs font-bold text-[#e4e1e5]">Bus Topology</h5>
                    <p className="text-[11px] text-[#bbc9ca] mt-1">Configure Slack, PV Generator, and PQ Load bus parameters.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#1b1b1e] border border-[#2D333B]">
                    <div className="text-[#55d8e1] mb-2">
                      <Sliders size={20} />
                    </div>
                    <h5 className="text-xs font-bold text-[#e4e1e5]">Line Impedances</h5>
                    <p className="text-[11px] text-[#bbc9ca] mt-1">Set R, X, B line parameters and MVA thermal limits.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#1b1b1e] border border-[#2D333B]">
                    <div className="text-[#55d8e1] mb-2">
                      <Cpu size={20} />
                    </div>
                    <h5 className="text-xs font-bold text-[#e4e1e5]">PyPOWER Solver</h5>
                    <p className="text-[11px] text-[#bbc9ca] mt-1">AC Newton-Raphson power flow engine integration.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-[#2D333B] flex justify-end">
                <button
                  onClick={onOpenCustomModal}
                  className="bg-[#55d8e1] text-[#003739] text-xs sm:text-sm px-6 py-3 rounded-lg hover:bg-[#55d8e1]/90 transition-all font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(85,216,225,0.3)]"
                >
                  <PlusCircle size={18} />
                  <span>Launch Custom Builder</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE C: COLLAPSED CARD VIEW (when Left card is expanded) */}
          {activeSection === 'existing' && (
            <div 
              onClick={() => setActiveSection('custom')}
              className="p-6 flex flex-col items-center justify-between h-full text-center cursor-pointer group"
            >
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#55d8e1]/10 border border-[#55d8e1]/30 flex items-center justify-center text-[#55d8e1] group-hover:scale-110 transition-transform">
                  <PlusCircle size={28} />
                </div>
                <h3 className="text-base font-bold text-[#e4e1e5]">Create Custom Network</h3>
                <p className="text-[11px] text-[#bbc9ca] max-w-[160px]">
                  Custom power grid layout & parameters
                </p>
                <span className="text-[10px] font-mono text-[#55d8e1] bg-[#55d8e1]/10 px-2.5 py-0.5 rounded-full border border-[#55d8e1]/20 mt-1">
                  Interactive Drag & Drop
                </span>
              </div>

              <button className="w-full mt-8 py-2.5 px-3 rounded-xl bg-[#2a2a2d] border border-[#2D333B] text-xs font-semibold text-[#55d8e1] hover:bg-[#55d8e1] hover:text-[#002022] transition-all flex items-center justify-center gap-1.5">
                <span>Expand</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto w-full mt-6 pt-4 border-t border-[#2D333B] flex flex-col sm:flex-row items-center justify-between text-xs text-[#bbc9ca] gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-[#55d8e1] animate-pulse" />
          <span>EEQ401 Digital Twin Engine • PyPOWER 5.1.21</span>
        </div>
        <div className="text-[11px]">
          Newton-Raphson AC Load Flow Visualizer
        </div>
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import CircuitThumbnail from './CircuitThumbnail';
import { 
  Search, 
  ArrowRight, 
  Upload, 
  Layers, 
  ChevronDown,
  ChevronUp,
  Cpu,
  PlusCircle,
  FileCode2,
  FolderOpen
} from 'lucide-react';

const BENCHMARK_CASES = [
  {
    id: 'case9',
    name: 'IEEE 9-Bus WSCC System',
    buses: 9,
    branches: 9,
    gens: 3,
    description: 'Western System Coordinating Council classic stability benchmark'
  },
  {
    id: 'case14',
    name: 'IEEE 14-Bus Test System',
    buses: 14,
    branches: 20,
    gens: 5,
    description: 'Standard transmission benchmark with synchronous condensers'
  },
  {
    id: 'case30',
    name: 'IEEE 30-Bus System',
    buses: 30,
    branches: 41,
    gens: 6,
    description: 'Midwest US sub-transmission grid model'
  },
  {
    id: 'case39',
    name: 'IEEE 39-Bus New England',
    buses: 39,
    branches: 46,
    gens: 10,
    description: 'New England bulk power grid standard 10-generator model'
  },
  {
    id: 'case57',
    name: 'IEEE 57-Bus System',
    buses: 57,
    branches: 80,
    gens: 7,
    description: 'US AEP transmission network with dual voltage corridors'
  },
  {
    id: 'case118',
    name: 'IEEE 118-Bus System',
    buses: 118,
    branches: 186,
    gens: 54,
    description: 'Midwest US bulk power grid multi-area interconnection'
  },
  {
    id: 'case300',
    name: 'IEEE 300-Bus System',
    buses: 300,
    branches: 411,
    gens: 69,
    description: 'Large-scale continental transmission network benchmark'
  }
];

const CUSTOM_TEMPLATES = [
  {
    id: '3bus',
    name: '3-Bus Loop Template',
    buses: 3,
    branches: 3,
    gens: 2,
    description: 'Radial transmission loop with slack unit and single load bus'
  },
  {
    id: '5bus',
    name: '5-Bus Meshed Grid Template',
    buses: 5,
    branches: 7,
    gens: 2,
    description: 'Meshed sub-transmission system with dual generation centers'
  },
  {
    id: 'blank',
    name: 'Blank Canvas Designer',
    buses: 2,
    branches: 1,
    gens: 1,
    description: 'Interactive scratchpad to configure custom buses and impedances'
  }
];

export default function ModeSelection({ 
  onSelectCase, 
  onOpenCustomModal,
  selectedCaseId = 'case14' 
}) {
  // 'existing' | 'custom'
  const [activeAccordion, setActiveAccordion] = useState('existing');
  const [selectedCase, setSelectedCase] = useState(selectedCaseId);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBenchmarkCases = BENCHMARK_CASES.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F3EC] text-[#1C1B18] font-sans antialiased p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
      
      <div className="max-w-7xl mx-auto w-full">
        
        {/* ========================================================================= */}
        {/* PAGE HEADER (MATCHING REFERENCE IMAGE)                                    */}
        {/* ========================================================================= */}
        <header className="pb-8 border-b border-[#E3DFD5]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-[#827E74] tracking-[0.2em] uppercase block mb-1.5 font-mono">
                IEEE POWER NETWORK
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#1C1B18] tracking-tight leading-none">
                Digital Twin
              </h1>
              <p className="text-xs sm:text-[13px] text-[#5C5950] mt-3 max-w-xl leading-relaxed">
                AC Newton-Raphson power flow analysis for IEEE benchmark transmission systems. Select a test system to open the network workspace.
              </p>
            </div>

            {/* Solver Info Tag */}
            <div className="flex items-center gap-2 text-xs text-[#7A766D] font-mono self-start md:self-end">
              <Cpu size={14} className="text-[#558178]" />
              <span>PyPOWER · AC solver</span>
            </div>
          </div>
        </header>


        {/* ========================================================================= */}
        {/* ACCORDION CONTAINER                                                       */}
        {/* ========================================================================= */}
        <div className="mt-8 space-y-6">

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 1: EXISTING BENCHMARK NETWORKS                                  */}
          {/* ----------------------------------------------------------------------- */}
          <div className="border border-[#E3DFD5] rounded-xl bg-[#FAF8F4] overflow-hidden transition-all duration-300 shadow-sm">
            {/* Accordion Header Button */}
            <button
              onClick={() => setActiveAccordion(prev => prev === 'existing' ? '' : 'existing')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#F2EFE8] transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border transition-colors ${
                  activeAccordion === 'existing' 
                    ? 'bg-[#E3ECE6] text-[#2D5049] border-[#A2BEB5]' 
                    : 'bg-[#ECE8DF] text-[#706C62] border-[#DDD8CD]'
                }`}>
                  <Layers size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1C1B18]">
                    Existing Networks
                  </h2>
                  <p className="text-[11px] text-[#7A766D]">
                    Standard IEEE transmission benchmark models (9 to 300 buses)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#EAE6DC] text-[#5C5950] border border-[#DDD8CE]">
                  7 Benchmarks
                </span>
                <div className="text-[#7A766D]">
                  {activeAccordion === 'existing' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </button>

            {/* Accordion Content: 3-per-row PC Grid */}
            {activeAccordion === 'existing' && (
              <div className="p-6 pt-2 border-t border-[#E8E4DA] animate-in fade-in duration-200">
                
                {/* Search Bar */}
                <div className="mb-6 max-w-sm">
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C887E]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter test systems..."
                      className="w-full bg-[#FAF8F4] border border-[#DCD6C9] text-xs text-[#1C1B18] placeholder-[#9A968C] pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#4B736B] focus:ring-1 focus:ring-[#4B736B] transition-all"
                    />
                  </div>
                </div>

                {/* 3 Columns PC Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBenchmarkCases.map((c) => {
                    const isSelected = selectedCase === c.id;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCase(c.id)}
                        onDoubleClick={() => onSelectCase(c.id)}
                        className={`rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between border ${
                          isSelected
                            ? 'bg-[#EAF0EC] border-[#558178] shadow-[0_2px_12px_rgba(45,80,73,0.08)] ring-1 ring-[#558178]'
                            : 'bg-[#FAF8F4] border-[#E2DDD2] hover:border-[#B5AEA0] hover:bg-[#F4F1EA]'
                        }`}
                      >
                        <div>
                          {/* Top Title & Directional Arrow */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className={`text-[14px] font-bold tracking-tight ${
                              isSelected ? 'text-[#193B35]' : 'text-[#1C1B18]'
                            }`}>
                              {c.name}
                            </h3>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCase(c.id);
                              }}
                              className={`p-1 rounded-md transition-colors ${
                                isSelected 
                                  ? 'text-[#2D5049] hover:bg-[#D5E3DC]' 
                                  : 'text-[#8C887E] hover:text-[#1C1B18]'
                              }`}
                              title="Open in Workspace"
                            >
                              <ArrowRight size={16} />
                            </button>
                          </div>

                          {/* Sub-spec Row: No Redundant Info */}
                          <div className="text-[11px] text-[#7A766D] font-mono mb-3">
                            {c.buses} buses &nbsp;·&nbsp; {c.branches} branches &nbsp;·&nbsp; {c.gens} generators
                          </div>

                          {/* Inner Schematic Thumbnail Box */}
                          <CircuitThumbnail caseId={c.id} isSelected={isSelected} />
                        </div>

                        {/* Bottom Narrative Description (NO numbers repeated!) */}
                        <div className="mt-3.5 pt-2.5 border-t border-[#E8E3D8] flex items-center justify-between text-[11px] text-[#5C5950]">
                          <span className="line-clamp-1">{c.description}</span>
                          {isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCase(c.id);
                              }}
                              className="ml-2 text-[10px] font-bold text-[#1E433C] underline hover:text-[#0C2420] shrink-0"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Quick Launch Bar */}
                <div className="mt-6 pt-4 border-t border-[#E8E4DA] flex items-center justify-between">
                  <span className="text-xs text-[#7A766D] font-mono">
                    Selected: <strong className="text-[#1C1B18]">{BENCHMARK_CASES.find(c => c.id === selectedCase)?.name || selectedCase}</strong>
                  </span>

                  <button
                    onClick={() => onSelectCase(selectedCase)}
                    className="px-6 py-2.5 rounded-lg bg-[#2D5049] hover:bg-[#1E3B35] text-[#F5F3EC] text-xs font-bold transition-all shadow flex items-center gap-2 cursor-pointer"
                  >
                    <span>Launch Workspace</span>
                    <ArrowRight size={15} />
                  </button>
                </div>

              </div>
            )}
          </div>


          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 2: CUSTOM NETWORK (TEMPLATES & DATA IMPORT)                      */}
          {/* ----------------------------------------------------------------------- */}
          <div className="border border-[#E3DFD5] rounded-xl bg-[#FAF8F4] overflow-hidden transition-all duration-300 shadow-sm">
            {/* Accordion Header Button */}
            <button
              onClick={() => setActiveAccordion(prev => prev === 'custom' ? '' : 'custom')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#F2EFE8] transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border transition-colors ${
                  activeAccordion === 'custom' 
                    ? 'bg-[#E3ECE6] text-[#2D5049] border-[#A2BEB5]' 
                    : 'bg-[#ECE8DF] text-[#706C62] border-[#DDD8CD]'
                }`}>
                  <PlusCircle size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1C1B18]">
                    Custom Network
                  </h2>
                  <p className="text-[11px] text-[#7A766D]">
                    Start with pre-built starter templates or import external MATPOWER / JSON dataset
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#EAE6DC] text-[#5C5950] border border-[#DDD8CE]">
                  Templates & Import
                </span>
                <div className="text-[#7A766D]">
                  {activeAccordion === 'custom' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </button>

            {/* Accordion Content */}
            {activeAccordion === 'custom' && (
              <div className="p-6 pt-2 border-t border-[#E8E4DA] space-y-6 animate-in fade-in duration-200">
                
                {/* OPTION 1: STARTER TEMPLATES */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A766D]">
                        Option 1 · Quick Starter Templates
                      </h3>
                      <p className="text-xs text-[#5C5950] mt-0.5">
                        Select a pre-configured template to open the interactive custom editor
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {CUSTOM_TEMPLATES.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={onOpenCustomModal}
                        className="rounded-xl p-4 bg-[#FAF8F4] border border-[#E2DDD2] hover:border-[#558178] hover:bg-[#EAF0EC] transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-[14px] font-bold text-[#1C1B18] group-hover:text-[#1E433C]">
                              {tmpl.name}
                            </h4>
                            <span className="p-1 text-[#8C887E] group-hover:text-[#2D5049]">
                              <ArrowRight size={16} />
                            </span>
                          </div>

                          <div className="text-[11px] text-[#7A766D] font-mono mb-3">
                            {tmpl.buses} buses &nbsp;·&nbsp; {tmpl.branches} branches &nbsp;·&nbsp; {tmpl.gens} gens
                          </div>

                          <CircuitThumbnail caseId={tmpl.id} isSelected={false} />
                        </div>

                        <div className="mt-3.5 pt-2.5 border-t border-[#E8E3D8] text-[11px] text-[#5C5950] line-clamp-1">
                          {tmpl.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OPTION 2: IMPORT NETWORK DATA */}
                <div className="pt-4 border-t border-[#E8E4DA]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A766D] mb-1">
                    Option 2 · Import Grid Data
                  </h3>
                  <p className="text-xs text-[#5C5950] mb-3">
                    Upload MATPOWER raw case format (.m) or JSON power grid topology file
                  </p>

                  <div 
                    onClick={onOpenCustomModal}
                    className="border-2 border-dashed border-[#D5CFBF] hover:border-[#558178] bg-[#F4F1EA] hover:bg-[#EAF0EC] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <div className="p-3.5 rounded-xl bg-[#EAE6DC] group-hover:bg-[#D8E6E0] text-[#5C5950] group-hover:text-[#2D5049] transition-colors shrink-0">
                        <Upload size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1C1B18] group-hover:text-[#193B35]">
                          Upload MATPOWER or JSON Data
                        </h4>
                        <p className="text-xs text-[#7A766D] mt-0.5">
                          Drag and drop network specification file or click browse to import
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCustomModal();
                      }}
                      className="px-4 py-2 rounded-lg bg-[#FAF8F4] border border-[#DDD8CD] group-hover:border-[#558178] text-xs font-semibold text-[#1C1B18] group-hover:text-[#193B35] flex items-center gap-2 shrink-0 transition-colors"
                    >
                      <FolderOpen size={15} />
                      <span>Browse Files</span>
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* FOOTER (CLEAN & MINIMALIST)                                              */}
      {/* ========================================================================= */}
      <footer className="max-w-7xl mx-auto w-full mt-12 pt-4 border-t border-[#E3DFD5] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7A766D] gap-2 font-mono">
        <div>
          EEQ401 Digital Twin Platform · PyPOWER AC Power Flow
        </div>
        <div className="text-[11px] text-[#9E9A90]">
          Newton-Raphson Formulation
        </div>
      </footer>

    </div>
  );
}

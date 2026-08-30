import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Search, 
  Zap, 
  Sliders, 
  Info,
  GitCompare,
  Table,
  Loader2,
  Bot,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Trash2
} from 'lucide-react';

export default function CircuitVisualizer({ 
  networkData, 
  selectedElement, 
  onSelectElement, 
  showFlowAnimation = true, 
  setShowFlowAnimation,
  onOpenComparison,
  onOpenDataTable,
  onTriggerAIHeal,
  isAISolving = false,
  isStressed = false,
  isLoading = false,
  cases = [],
  selectedCaseId = 'case14',
  onSelectCase,
  onApplyStress,
  onResetStress
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedBusId, setHighlightedBusId] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'slack', 'pv', 'pq', 'critical'
  const [hoveredBusId, setHoveredBusId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);

  // Stress test states (string input allowing free backspace and decimal typing)
  const [localMultiplier, setLocalMultiplier] = useState('1');
  const [selectedTargetBuses, setSelectedTargetBuses] = useState([]);
  const [busSearchQuery, setBusSearchQuery] = useState('');
  const [isBusGridOpen, setIsBusGridOpen] = useState(false);
  const [stressRules, setStressRules] = useState([]);

  const { summary, nodes, edges } = networkData;
  const canvasWidth = summary.canvas_width || 2800;
  const canvasHeight = summary.canvas_height || 1800;

  // D3 Zoom setup
  const zoomBehaviorRef = useRef(null);
  const gRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g.main-group');
    gRef.current = g;

    const zoom = d3.zoom()
      .scaleExtent([0.01, 50])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 60);

    const handleResize = () => handleFitToScreen();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [networkData]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.4);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      handleFitToScreen();
    }
  };

  const handleFitToScreen = () => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current || !nodes || nodes.length === 0) return;

    const containerWidth = containerRef.current.clientWidth || 1000;
    const containerHeight = containerRef.current.clientHeight || 700;

    const xCoords = nodes.map(n => n.x);
    const yCoords = nodes.map(n => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const networkWidth = Math.max(maxX - minX, 100);
    const networkHeight = Math.max(maxY - minY, 100);

    // Padding so peripheral nodes are well within the canvas
    const pad = Math.min(80, Math.min(containerWidth, containerHeight) * 0.08);

    const scale = Math.min(
      (containerWidth - pad * 2) / networkWidth,
      (containerHeight - pad * 2) / networkHeight
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const tx = containerWidth / 2 - centerX * scale;
    const ty = containerHeight / 2 - centerY * scale;

    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, transform);
  };

  // Search & Focus on specific bus
  const handleSearch = (query) => {
    setSearchQuery(query);
    const targetId = parseInt(query, 10);
    if (isNaN(targetId)) {
      setHighlightedBusId(null);
      return;
    }

    const node = nodes.find(n => n.id === targetId);
    if (node && svgRef.current && containerRef.current && zoomBehaviorRef.current) {
      setHighlightedBusId(node.id);
      onSelectElement({ type: 'bus', data: node });

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const targetScale = 1.2;

      const tx = containerWidth / 2 - node.x * targetScale;
      const ty = containerHeight / 2 - node.y * targetScale;

      const transform = d3.zoomIdentity.translate(tx, ty).scale(targetScale);
      d3.select(svgRef.current).transition().duration(600).call(zoomBehaviorRef.current.transform, transform);
    } else {
      setHighlightedBusId(null);
    }
  };

  // Bus selection in stress test
  const toggleTargetBus = (bId) => {
    if (selectedTargetBuses.includes(bId)) {
      setSelectedTargetBuses(selectedTargetBuses.filter(id => id !== bId));
    } else {
      setSelectedTargetBuses([...selectedTargetBuses, bId]);
    }
  };

  const toggleSelectAllBuses = () => {
    if (selectedTargetBuses.length === nodes.length) {
      setSelectedTargetBuses([]);
    } else {
      setSelectedTargetBuses(nodes.map(n => n.id));
    }
  };

  // Save rule
  const handleSaveRule = () => {
    const mult = parseFloat(localMultiplier) || 1.0;
    const targetCount = selectedTargetBuses.length > 0 ? selectedTargetBuses.length : nodes.length;
    const newRule = {
      id: Date.now(),
      multiplier: mult,
      targetBuses: selectedTargetBuses.length > 0 ? [...selectedTargetBuses] : nodes.map(n => n.id),
      label: `Rule ${stressRules.length + 1}: ${mult}x on ${targetCount} buses`
    };
    setStressRules([...stressRules, newRule]);
  };

  const handleDeleteRule = (ruleId) => {
    setStressRules(stressRules.filter(r => r.id !== ruleId));
  };

  // Run Stress Test
  const handleRunStress = () => {
    if (!onApplyStress) return;
    const busScales = {};
    const mult = parseFloat(localMultiplier) || 1.0;

    if (stressRules.length > 0) {
      stressRules.forEach(rule => {
        rule.targetBuses.forEach(bId => {
          busScales[bId] = rule.multiplier;
        });
      });
    } else if (selectedTargetBuses.length > 0) {
      selectedTargetBuses.forEach(bId => {
        busScales[bId] = mult;
      });
    } else {
      // Global scale across all load buses
      nodes.forEach(n => {
        if (n.pd > 0) {
          busScales[n.id] = mult;
        }
      });
    }
    onApplyStress(busScales);
  };

  const handleResetLocalStress = () => {
    setLocalMultiplier('1');
    setSelectedTargetBuses([]);
    setStressRules([]);
    if (onResetStress) onResetStress();
  };

  // Map bus lookup for edges
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Palette styling with high contrast
  const getLineStroke = (edge) => {
    if (edge.is_tripped || edge.status === 0 || edge.thermal_status === 'tripped') return '#DC2626';
    if (edge.thermal_status === 'overload' || (edge.loading_pct || 0) > 125) return '#DC2626';
    if (edge.thermal_status === 'warning' || (edge.loading_pct || 0) > 110) return '#D97706';
    return '#374151'; // High-contrast crisp charcoal-slate for normal in-service lines (≤110%)
  };

  // High-distinction bus styles for instant visual differentiation
  const getBusNodeStyles = (node) => {
    if (node.v_status === 'critical') {
      return { fill: '#FEE2E2', stroke: '#DC2626', text: '#991B1B' };
    }
    if (node.v_status === 'alert') {
      return { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E' };
    }
    if (node.type === 'slack') {
      return { fill: '#EDE9FE', stroke: '#7C3AED', text: '#5B21B6' }; // Vivid Royal Purple
    }
    if (node.type === 'pv') {
      return { fill: '#D1FAE5', stroke: '#059669', text: '#065F46' }; // Vivid Emerald Jade
    }
    return { fill: '#F1F5F9', stroke: '#475569', text: '#1E293B' };   // Steel Slate Grey
  };

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return nodes;
    if (filterType === 'slack') return nodes.filter(n => n.type === 'slack');
    if (filterType === 'pv') return nodes.filter(n => n.type === 'pv');
    if (filterType === 'pq') return nodes.filter(n => n.type === 'pq');
    if (filterType === 'critical') return nodes.filter(n => n.v_status === 'critical' || n.v_status === 'alert');
    return nodes;
  }, [nodes, filterType]);

  const filteredBusButtons = useMemo(() => {
    if (!busSearchQuery) return nodes;
    return nodes.filter(n => String(n.id).includes(busSearchQuery));
  }, [nodes, busSearchQuery]);

  const isGridSafe = summary?.grid_health === 'SAFE';

  return (
    <div className="flex-1 w-full h-full flex overflow-hidden bg-[#F5F3EC] text-[#1C1B18] font-sans">
      
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR CONTROLS (NETWORK SELECTION, STRESS TEST, BOTTOM ACTIONS)     */}
      {/* ========================================================================= */}
      <aside className="w-64 sm:w-72 bg-[#FAF8F4] border-r border-[#E3DFD5] h-full flex flex-col justify-between p-4 overflow-y-auto z-20 shrink-0">
        <div className="space-y-4">
          
          {/* 1. NETWORK SELECTION */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] mb-1.5 font-semibold">
              NETWORK
            </div>
            <div className="relative">
              <select
                value={selectedCaseId}
                onChange={(e) => onSelectCase && onSelectCase(e.target.value)}
                className="w-full appearance-none bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] text-xs font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-[#244B43] cursor-pointer hover:bg-[#F2EFE8] transition-colors truncate"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#FAF8F4] text-[#1C1B18]">
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-[#7A766D] pointer-events-none" />
            </div>
          </div>

          {/* 2. STRESS TEST */}
          <div className="space-y-2.5 pt-3 border-t border-[#E3DFD5]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A766D] font-semibold">
                STRESS TEST
              </span>
              {isStressed && (
                <span className="text-[10px] font-mono font-bold text-[#A67C33] lowercase">
                  active
                </span>
              )}
            </div>

            {/* Load multiplier */}
            <div>
              <div className="text-xs text-[#5C5950] mb-1">
                Load multiplier
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={localMultiplier}
                  onChange={(e) => setLocalMultiplier(e.target.value)}
                  className="w-full bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#244B43]"
                  placeholder="1.0"
                />
                <span className="absolute right-7 text-xs text-[#7A766D] font-bold pointer-events-none">x</span>
                {localMultiplier !== '1' && localMultiplier !== '' && (
                  <button
                    onClick={() => setLocalMultiplier('1')}
                    className="absolute right-2 text-[#7A766D] hover:text-[#1C1B18]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Multiplier Preset Buttons */}
              <div className="grid grid-cols-4 gap-1 mt-1.5">
                {['0.5', '1', '2', '5'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setLocalMultiplier(m)}
                    className={`py-1 rounded-md text-[11px] font-semibold border transition-all ${
                      localMultiplier === m
                        ? 'bg-[#244B43] text-[#FAF8F4] border-[#244B43]'
                        : 'bg-[#ECE8DF] text-[#5C5950] border-[#DDD8CD] hover:text-[#1C1B18]'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>

            {/* Target buses (Collapsible Section) */}
            <div className="space-y-1.5">
              <button
                onClick={() => setIsBusGridOpen(!isBusGridOpen)}
                className="w-full text-xs font-semibold text-[#1C1B18] flex items-center justify-between py-1"
              >
                <span>
                  Target buses ({selectedTargetBuses.length} selected)
                </span>
                {isBusGridOpen ? <ChevronUp size={14} className="text-[#7A766D]" /> : <ChevronDown size={14} className="text-[#7A766D]" />}
              </button>

              {isBusGridOpen && (
                <div className="space-y-2 p-2.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] animate-in fade-in duration-150">
                  {/* Search and All toggle */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search bus..."
                        value={busSearchQuery}
                        onChange={(e) => setBusSearchQuery(e.target.value)}
                        className="w-full bg-[#FAF8F4] border border-[#DDD8CD] rounded-md pl-6 pr-2 py-0.5 text-xs text-[#1C1B18] placeholder:text-[#7A766D] focus:outline-none focus:border-[#244B43]"
                      />
                      <Search size={11} className="absolute left-1.5 top-1.5 text-[#7A766D] pointer-events-none" />
                    </div>
                    <button
                      onClick={toggleSelectAllBuses}
                      className="px-2 py-0.5 rounded bg-[#FAF8F4] border border-[#DDD8CD] text-[11px] font-semibold text-[#5C5950] hover:text-[#1C1B18]"
                    >
                      {selectedTargetBuses.length === nodes.length ? 'None' : 'All'}
                    </button>
                  </div>

                  {/* Numbered Bus Button Grid (3-column) */}
                  <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto p-0.5">
                    {filteredBusButtons.map((node) => {
                      const isSelected = selectedTargetBuses.includes(node.id);
                      return (
                        <button
                          key={node.id}
                          onClick={() => toggleTargetBus(node.id)}
                          className={`py-1 rounded text-xs font-mono font-bold transition-all border ${
                            isSelected
                              ? 'bg-[#244B43] text-[#FAF8F4] border-[#244B43]'
                              : 'bg-[#FAF8F4] text-[#5C5950] border-[#DDD8CD] hover:border-[#244B43]'
                          }`}
                        >
                          {node.id}
                        </button>
                      );
                    })}
                  </div>

                  {/* Save Rule Action */}
                  <button
                    onClick={handleSaveRule}
                    className="w-full py-1 rounded-md bg-[#FAF8F4] hover:bg-[#E2DDD2] border border-[#DDD8CD] text-[#244B43] text-xs font-semibold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Save rule ({selectedTargetBuses.length} buses @ {localMultiplier}x)</span>
                  </button>
                </div>
              )}

              {/* Saved Rules List */}
              {stressRules.length > 0 && (
                <div className="space-y-1">
                  {stressRules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="p-1.5 px-2 rounded-lg bg-[#ECE8DF] border border-[#DDD8CD] text-[11px] font-mono text-[#1C1B18] flex items-center justify-between"
                    >
                      <span>{rule.label}</span>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-[#7A766D] hover:text-red-600 ml-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Run Analysis Action Button */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={handleRunStress}
                disabled={isLoading}
                className="flex-1 py-2 rounded-lg bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                <span>Run analysis</span>
              </button>

              {isStressed && (
                <button
                  onClick={handleResetLocalStress}
                  title="Reset to 1.0x baseline"
                  className="p-2 rounded-lg bg-[#ECE8DF] hover:bg-[#E2DDD2] border border-[#DDD8CD] text-[#5C5950] hover:text-[#1C1B18] transition-colors"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="pt-3 border-t border-[#E3DFD5] grid grid-cols-3 gap-1.5 text-xs">
          <button
            onClick={onOpenComparison}
            className={`py-2 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
              isStressed
                ? 'bg-[#E3ECE6] text-[#244B43] border-[#A2BEB5]'
                : 'bg-[#ECE8DF] text-[#5C5950] border-[#DDD8CD] hover:text-[#1C1B18]'
            }`}
            title="Compare with baseline"
          >
            <GitCompare size={14} />
            <span>Compare</span>
          </button>

          <button
            onClick={onTriggerAIHeal}
            disabled={isAISolving}
            className={`py-2 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
              !isGridSafe
                ? 'bg-[#244B43] text-[#FAF8F4] border-[#244B43] animate-pulse'
                : 'bg-[#ECE8DF] text-[#5C5950] border-[#DDD8CD] hover:text-[#1C1B18]'
            }`}
            title="AI Operator Grid Remediation"
          >
            {isAISolving ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            <span>Auto-heal</span>
          </button>

          <button
            onClick={onOpenDataTable}
            className="py-2 px-1 rounded-lg bg-[#ECE8DF] text-[#5C5950] border border-[#DDD8CD] hover:text-[#1C1B18] text-[11px] font-bold flex flex-col items-center gap-1 transition-all"
            title="View Full Data Matrix"
          >
            <Table size={14} />
            <span>Matrix</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* CENTER INTERACTIVE SVG CANVAS                                             */}
      {/* ========================================================================= */}
      <div ref={containerRef} className="relative flex-1 h-full overflow-hidden select-none bg-[#FAF9F6]">
        
        {/* TOP CANVAS CONTROLS TOOLBAR */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#FAF8F4] border border-[#DDD8CD] p-1.5 rounded-xl shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-1">
            <button 
              onClick={handleZoomIn} 
              title="Zoom In"
              className="p-1.5 text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] rounded-lg transition-colors"
            >
              <ZoomIn size={15} />
            </button>
            <button 
              onClick={handleZoomOut} 
              title="Zoom Out"
              className="p-1.5 text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] rounded-lg transition-colors"
            >
              <ZoomOut size={15} />
            </button>
            <button 
              onClick={handleResetZoom} 
              title="Reset Zoom"
              className="p-1.5 text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] rounded-lg transition-colors"
            >
              <RotateCcw size={15} />
            </button>
            <button 
              onClick={handleFitToScreen} 
              title="Fit to Viewport"
              className="p-1.5 text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] rounded-lg transition-colors"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#DDD8CD] mx-0.5" />

          {/* Bus Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Find bus..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] rounded-lg pl-7 pr-2.5 py-1 text-xs focus:outline-none focus:border-[#244B43] w-28 sm:w-36 placeholder:text-[#7A766D]"
            />
            <Search size={12} className="absolute left-2.5 top-2 text-[#7A766D] pointer-events-none" />
          </div>

          {/* Bus Filter Dropdown */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="appearance-none bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] rounded-lg pl-2.5 pr-6 py-1 text-xs focus:outline-none focus:border-[#244B43] cursor-pointer"
            >
              <option value="all">All buses</option>
              <option value="slack">Slack only</option>
              <option value="pv">PV Generators</option>
              <option value="pq">PQ Loads</option>
              <option value="critical">Alert / Critical</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2 text-[#7A766D] pointer-events-none" />
          </div>
        </div>

        {/* SVG CANVAS */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
        >
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#DDD8CD" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#dot-grid)" />

          <g className="main-group">
            {/* 1. TRANSMISSION BRANCHES */}
            <g className="edges-group">
              {edges.map((edge) => {
                const sourceNode = nodeMap.get(edge.from_bus);
                const targetNode = nodeMap.get(edge.to_bus);
                if (!sourceNode || !targetNode) return null;

                const isTripped = edge.is_tripped || edge.status === 0 || edge.thermal_status === 'tripped';
                const strokeColor = getLineStroke(edge);
                const isHovered = hoveredEdgeId === edge.id;
                const isSelected = selectedElement?.type === 'line' && (
                  selectedElement.data.id === edge.id ||
                  (selectedElement.data.from_bus === edge.from_bus && selectedElement.data.to_bus === edge.to_bus)
                );

                const midX = (sourceNode.x + targetNode.x) / 2;
                const midY = (sourceNode.y + targetNode.y) / 2;

                return (
                  <g 
                    key={edge.id || `${edge.from_bus}-${edge.to_bus}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement({ type: 'line', data: edge });
                    }}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    className="cursor-pointer group"
                  >
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke="transparent"
                      strokeWidth={16}
                    />

                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isTripped ? '#DC2626' : strokeColor}
                      strokeWidth={isTripped ? (isSelected ? 4.5 : 3.5) : isSelected ? 4 : isHovered ? 2.8 : 2.2}
                      strokeDasharray={isTripped ? "6,6" : undefined}
                      strokeOpacity={isTripped ? 0.95 : 1}
                      className="transition-all duration-150"
                    />

                    {isTripped ? (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-24}
                          y={-8}
                          width={48}
                          height={16}
                          rx={4}
                          fill="#FEE2E2"
                          stroke="#DC2626"
                          strokeWidth={1.5}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-mono text-[8px] font-bold select-none"
                          fill="#DC2626"
                        >
                          TRIPPED
                        </text>
                      </g>
                    ) : (
                      edge.loading_pct !== undefined && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x={-18}
                            y={-8}
                            width={36}
                            height={16}
                            rx={4}
                            fill="#FAF8F4"
                            stroke={isSelected ? '#244B43' : '#DDD8CD'}
                            strokeWidth={isSelected ? 1.5 : 1}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="font-mono text-[9px] font-bold select-none"
                            fill={strokeColor}
                          >
                            {Math.round(edge.loading_pct)}%
                          </text>
                        </g>
                      )
                    )}
                  </g>
                );
              })}
            </g>

            {/* 2. SUBSTATION BUSES */}
            <g className="nodes-group">
              {filteredNodes.map((node) => {
                const isSelected = selectedElement?.type === 'bus' && selectedElement.data.id === node.id;
                const isHighlighted = highlightedBusId === node.id;
                const isHovered = hoveredBusId === node.id;
                const style = getBusNodeStyles(node);
                const isSlack = node.type === 'slack';
                const isPV = node.type === 'pv';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement({ type: 'bus', data: node });
                    }}
                    onMouseEnter={() => setHoveredBusId(node.id)}
                    onMouseLeave={() => setHoveredBusId(null)}
                    className="cursor-pointer"
                  >
                    {/* Slack outer orbital ring for immediate recognition */}
                    {isSlack && (
                      <circle
                        r={isSelected ? 18 : 15}
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth={1.5}
                        strokeDasharray="3,3"
                      />
                    )}

                    {/* Node circle with rich distinct background fill and thick colored border */}
                    <circle
                      r={isSelected ? 14 : isHovered ? 13 : 11}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={isSelected ? 3.5 : isHovered ? 3 : 2.5}
                      className="transition-all duration-150 shadow-sm"
                    />

                    {/* Bus ID inside circle with matching high-contrast font color */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="font-mono text-[10px] font-bold select-none"
                      fill={style.text}
                    >
                      {node.id}
                    </text>

                    {/* Small generator badge indicator on top for PV and Slack */}
                    {(isPV || isSlack) && (
                      <circle
                        cx={0}
                        cy={-(isSelected ? 14 : 11)}
                        r={3}
                        fill={isSlack ? '#7C3AED' : '#059669'}
                        stroke="#FAF8F4"
                        strokeWidth={1}
                      />
                    )}

                    {/* Voltage badge below node */}
                    <g transform="translate(0, 19)">
                      <rect
                        x={-22}
                        y={-6}
                        width={44}
                        height={12}
                        rx={3}
                        fill="#FAF8F4"
                        stroke="#DDD8CD"
                        strokeWidth={0.8}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="font-mono text-[8px] font-semibold"
                        fill="#5C5950"
                      >
                        {node.vm ? node.vm.toFixed(3) : '1.000'} pu
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

          </g>
        </svg>

        {/* Real-time AC Solver Activity Toast */}
        {isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF8F4] border border-[#DDD8CD] shadow-lg text-xs font-mono text-[#244B43] animate-pulse">
            <Loader2 size={13} className="animate-spin text-[#244B43]" />
            <span className="font-bold">Solving AC Power Flow...</span>
          </div>
        )}

        {/* BOTTOM LEFT: COMPACT 2-COLUMN LEGEND CARD */}
        <div className="absolute bottom-4 left-4 z-20 bg-[#FAF8F4]/95 border border-[#DDD8CD] p-2.5 rounded-xl shadow-md text-xs hidden sm:block backdrop-blur-sm">
          <div className="font-bold text-[#1C1B18] mb-1.5 flex items-center gap-1.5 text-[11px] pb-1 border-b border-[#E3DFD5]">
            <Info size={12} className="text-[#244B43]" />
            <span>Legend</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[#5C5950]">
            {/* Column 1: Substation Buses & Voltage Security */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#7C3AED] bg-[#EDE9FE] flex items-center justify-center text-[6px] font-bold text-[#5B21B6]">S</span>
                <span>Slack bus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#059669] bg-[#D1FAE5] flex items-center justify-center text-[6px] font-bold text-[#065F46]">G</span>
                <span>PV generator</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#475569] bg-[#F1F5F9] flex items-center justify-center text-[6px] font-bold text-[#1E293B]">L</span>
                <span>PQ load bus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#D97706] bg-[#FEF3C7] flex items-center justify-center text-[6px] font-bold text-[#92400E]">!</span>
                <span>V alert (&lt;0.90 / &gt;1.10)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-red-600 bg-[#FEE2E2] flex items-center justify-center text-[6px] font-bold text-red-700">!</span>
                <span>V critical (&lt;0.85 / &gt;1.15)</span>
              </div>
            </div>

            {/* Column 2: Transmission Lines & Contingency */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-[#374151]" />
                <span>Line ≤110%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-[#D97706]" />
                <span>Line &gt;110% alert</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-red-600" />
                <span>Line &gt;125% overload</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 border-t border-dashed border-red-600" />
                <span>Tripped line outage</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

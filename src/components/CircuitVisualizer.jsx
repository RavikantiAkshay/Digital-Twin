import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Search, 
  Activity, 
  Sliders, 
  Info,
  GitCompare,
  Table,
  Zap,
  RefreshCw,
  Loader2,
  Bot
} from 'lucide-react';

export default function CircuitVisualizer({ 
  networkData, 
  selectedElement, 
  onSelectElement, 
  showFlowAnimation, 
  setShowFlowAnimation,
  onOpenStressPanel,
  onOpenComparison,
  onOpenDataTable,
  onTriggerAIHeal,
  isAISolving,
  isStressed = false,
  isStressPanelOpen = false,
  isLoading = false
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedBusId, setHighlightedBusId] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'slack', 'pv', 'pq', 'critical'
  const [hoveredBusId, setHoveredBusId] = useState(null);

  const { summary, nodes, edges } = networkData;
  const canvasWidth = summary.canvas_width || 2800;
  const canvasHeight = summary.canvas_height || 1800;
  const isLargeGrid = nodes.length > 40;

  // D3 Zoom setup
  const zoomBehaviorRef = useRef(null);
  const gRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g.main-group');
    gRef.current = g;

    const zoom = d3.zoom()
      .scaleExtent([0.08, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial fit to screen
    handleFitToScreen();

  }, [networkData]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleFitToScreen = () => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scale = Math.min(
      (containerWidth - 100) / canvasWidth,
      (containerHeight - 100) / canvasHeight
    );

    const tx = (containerWidth - canvasWidth * scale) / 2;
    const ty = (containerHeight - canvasHeight * scale) / 2;

    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    d3.select(svgRef.current).transition().duration(500).call(zoomBehaviorRef.current.transform, transform);
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

  // Map bus lookup for edges
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Line & Node colors
  const getLineColor = (edge) => {
    if (edge.is_tripped || edge.status === 0 || edge.thermal_status === 'tripped') return '#ef4444';
    if (edge.thermal_status === 'overload') return '#ef4444'; // Red (Overload violation)
    if (edge.thermal_status === 'warning') return '#FFD369';  // Amber (Thermal emergency warning)
    return '#00adb5';                                         // Teal (Normal in-service corridor)
  };

  const getBusBorderColor = (node) => {
    if (node.v_status === 'critical') return '#ef4444';
    if (node.v_status === 'alert') return '#FFD369';
    if (node.type === 'slack') return '#a855f7';
    if (node.type === 'pv') return '#55d8e1';
    return '#10b981';
  };

  // Filtering nodes
  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return nodes;
    if (filterType === 'slack') return nodes.filter(n => n.type === 'slack');
    if (filterType === 'pv') return nodes.filter(n => n.type === 'pv');
    if (filterType === 'pq') return nodes.filter(n => n.type === 'pq');
    if (filterType === 'critical') return nodes.filter(n => n.v_status === 'critical' || n.v_status === 'alert');
    return nodes;
  }, [nodes, filterType]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#131316] overflow-hidden select-none grid-bg">

      {/* Floating Canvas View Controls Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#1f1f22]/90 border border-[#2D333B] p-2 rounded-xl backdrop-blur-md shadow-xl">
        <button 
          onClick={handleZoomIn} 
          title="Zoom In (+)"
          className="p-2 text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] rounded-lg transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={handleZoomOut} 
          title="Zoom Out (-)"
          className="p-2 text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] rounded-lg transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={handleResetZoom} 
          title="Reset Zoom"
          className="p-2 text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] rounded-lg transition-colors"
        >
          <RotateCcw size={18} />
        </button>
        <button 
          onClick={handleFitToScreen} 
          title="Fit to Viewport"
          className="p-2 text-[#bbc9ca] hover:text-[#55d8e1] hover:bg-[#2a2a2d] rounded-lg transition-colors"
        >
          <Maximize2 size={18} />
        </button>

        <div className="h-5 w-[1px] bg-[#2D333B] mx-1" />

        {/* Animation Flow Toggle */}
        <button
          onClick={() => setShowFlowAnimation(!showFlowAnimation)}
          title="Toggle Animated Power Flow Particles"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showFlowAnimation 
              ? 'bg-[#00adb5]/20 text-[#55d8e1] border border-[#00adb5]/40' 
              : 'bg-[#131316] text-[#bbc9ca] hover:text-white border border-[#2D333B]'
          }`}
        >
          <Activity size={14} className={showFlowAnimation ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">Flow Motion</span>
        </button>

        <div className="h-5 w-[1px] bg-[#2D333B] mx-1" />

        {/* Bus Search Box */}
        <div className="relative w-28 sm:w-36">
          <Search size={14} className="absolute left-2.5 top-2 text-[#869394]" />
          <input
            type="text"
            placeholder="Find Bus ID..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-[#131316] border border-[#2D333B] text-xs text-[#e4e1e5] rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-[#55d8e1] font-mono"
          />
        </div>

        {/* Filter Node Types */}
        <div className="relative hidden md:block">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none bg-[#131316] border border-[#2D333B] text-[#bbc9ca] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#55d8e1] cursor-pointer"
          >
            <option value="all" className="bg-[#131316] text-[#e4e1e5]">All Buses</option>
            <option value="slack" className="bg-[#131316] text-[#e4e1e5]">Slack Reference</option>
            <option value="pv" className="bg-[#131316] text-[#e4e1e5]">PV Generators</option>
            <option value="pq" className="bg-[#131316] text-[#e4e1e5]">PQ Loads</option>
            <option value="critical" className="bg-[#131316] text-[#e4e1e5]">Voltage Alerts</option>
          </select>
        </div>
      </div>

      {/* SVG Canvas Render Engine */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <defs>
          {/* Node Glow Filters */}
          <filter id="glow-slack" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-danger" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Main Zoom Container */}
        <g className="main-group">
          {/* 1. TRANSMISSION LINES (EDGES) */}
          <g className="edges-group">
            {edges.map((edge) => {
              const sourceNode = nodeMap.get(edge.from_bus);
              const targetNode = nodeMap.get(edge.to_bus);
              if (!sourceNode || !targetNode) return null;

              const isSelected = selectedElement?.type === 'line' && selectedElement?.data?.id === edge.id;
              const isTripped = edge.is_tripped || edge.status === 0 || edge.thermal_status === 'tripped';
              const color = getLineColor(edge);
              const baseWidth = Math.max(1.5, Math.min(5, (edge.rate_a / summary.base_mva) * 2.5));

              return (
                <g key={edge.id} className="group cursor-pointer">
                  {/* Line hit target area */}
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="transparent"
                    strokeWidth={16}
                    onClick={() => onSelectElement({ type: 'line', data: edge })}
                  />

                  {/* Main Line Stroke */}
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isTripped ? '#ef4444' : (isSelected ? '#55d8e1' : color)}
                    strokeWidth={isSelected ? baseWidth + 3 : (isTripped ? 3.5 : baseWidth)}
                    strokeDasharray={isTripped ? '8 6' : 'none'}
                    strokeOpacity={1.0}
                    className="transition-all duration-200"
                  />

                  {/* Flow animation dash overlay (only if line is in service) */}
                  {showFlowAnimation && !isTripped && edge.pf !== 0 && (
                    <line
                      x1={edge.pf > 0 ? sourceNode.x : targetNode.x}
                      y1={edge.pf > 0 ? sourceNode.y : targetNode.y}
                      x2={edge.pf > 0 ? targetNode.x : sourceNode.x}
                      y2={edge.pf > 0 ? targetNode.y : sourceNode.y}
                      stroke="#ffffff"
                      strokeWidth={1.8}
                      strokeOpacity={0.8}
                      className="line-flow-animated"
                    />
                  )}

                  {/* Midpoint Label (Line Loading % or Breaker Open Status) */}
                  {!isLargeGrid && (
                    <g 
                      transform={`translate(${(sourceNode.x + targetNode.x) / 2}, ${(sourceNode.y + targetNode.y) / 2})`}
                      className="pointer-events-none"
                    >
                      {isTripped ? (
                        <>
                          <rect
                            x="-28"
                            y="-10"
                            width="56"
                            height="20"
                            rx="5"
                            fill="#1c1113"
                            fillOpacity="0.98"
                            stroke="#ef4444"
                            strokeWidth="1.5"
                          />
                          <text
                            textAnchor="middle"
                            dy="4"
                            fontSize="8.5"
                            fontWeight="800"
                            fill="#ef4444"
                            className="font-mono tracking-wider"
                          >
                            TRIPPED ⚡
                          </text>
                        </>
                      ) : (
                        <>
                          <rect
                            x="-18"
                            y="-8"
                            width="36"
                            height="16"
                            rx="4"
                            fill="#131316"
                            fillOpacity="0.9"
                            stroke={color}
                            strokeWidth="1"
                          />
                          <text
                            textAnchor="middle"
                            dy="3.5"
                            fontSize="8.5"
                            fontWeight="700"
                            fill={color}
                            className="font-mono"
                          >
                            {edge.loading_pct}%
                          </text>
                        </>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 2. BUS NODES */}
          <g className="nodes-group">
            {filteredNodes.map((node) => {
              const isSelected = selectedElement?.type === 'bus' && selectedElement?.data?.id === node.id;
              const isHighlighted = highlightedBusId === node.id;
              const isHovered = hoveredBusId === node.id;
              const borderColor = getBusBorderColor(node);

              const isSlack = node.type === 'slack';
              const isGen = node.type === 'pv' || isSlack;
              const nodeRadius = isSlack ? 22 : (isGen ? 18 : 15);

              // Smart voltage label visibility: show for small grids, or when zoomed in, or on hover/select
              const showVoltageLabel = !isLargeGrid || zoomLevel >= 1.0 || isHovered || isSelected || isHighlighted || node.v_status === 'critical';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => onSelectElement({ type: 'bus', data: node })}
                  onMouseEnter={() => setHoveredBusId(node.id)}
                  onMouseLeave={() => setHoveredBusId(null)}
                >
                  {/* Selection / Warning Pulsing Ring */}
                  {(isSelected || isHighlighted || node.v_status === 'critical') && (
                    <circle
                      r={nodeRadius + 7}
                      fill="none"
                      stroke={node.v_status === 'critical' ? '#ef4444' : '#55d8e1'}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      className="animate-spin"
                      style={{ animationDuration: '6s' }}
                    />
                  )}

                  {/* Base Circle Node */}
                  <circle
                    r={nodeRadius}
                    fill={node.v_status === 'critical' ? '#450a0a' : '#1f1f22'}
                    stroke={isSelected ? '#55d8e1' : borderColor}
                    strokeWidth={isSelected ? "3" : (isSlack ? "3" : "2")}
                    filter={isSlack ? "url(#glow-slack)" : (node.v_status === 'critical' ? "url(#glow-danger)" : undefined)}
                    className="transition-all duration-200"
                  />

                  {/* Slack Outer Ring Indicator */}
                  {isSlack && (
                    <circle
                      r={nodeRadius + 4}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Generator Accent Ring */}
                  {isGen && !isSlack && (
                    <circle
                      r={nodeRadius - 3.5}
                      fill="none"
                      stroke="#00adb5"
                      strokeWidth="1.5"
                      strokeOpacity="0.6"
                    />
                  )}

                  {/* Bus ID Text */}
                  <text
                    textAnchor="middle"
                    dy="4"
                    fontSize={isSlack ? "13" : "11"}
                    fontWeight="700"
                    fill="#e4e1e5"
                    className="font-mono select-none"
                  >
                    {node.id}
                  </text>

                  {/* Floating Voltage Badge below Bus */}
                  {showVoltageLabel && (
                    <g transform={`translate(0, ${nodeRadius + 15})`} className="pointer-events-none">
                      <rect
                        x="-26"
                        y="-7"
                        width="52"
                        height="15"
                        rx="4"
                        fill="#131316"
                        fillOpacity="0.95"
                        stroke={borderColor}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dy="3.5"
                        fontSize="9"
                        fontWeight="600"
                        fill={node.v_status === 'critical' ? '#ef4444' : '#e4e1e5'}
                        className="font-mono"
                      >
                        {node.vm.toFixed(3)} p.u.
                      </text>
                    </g>
                  )}

                  {/* Generator Icon Tag if Generator */}
                  {isGen && (
                    <g transform={`translate(${nodeRadius + 4}, -${nodeRadius + 4})`}>
                      <circle r="7.5" fill="#00adb5" stroke="#55d8e1" strokeWidth="1.2" />
                      <text textAnchor="middle" dy="2.8" fontSize="7.5" fontWeight="800" fill="#002022">
                        G
                      </text>
                    </g>
                  )}

                  {/* Slack Crown Badge */}
                  {isSlack && (
                    <g transform={`translate(0, -${nodeRadius + 10})`}>
                      <polygon points="-5,3 0,-3 5,3 3,1 0,5 -3,1" fill="#a855f7" />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Real-time AC Solver Activity Toast */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#19191c]/95 border border-[#55d8e1]/50 backdrop-blur-md shadow-[0_0_25px_rgba(85,216,225,0.3)] text-xs font-mono text-[#55d8e1] animate-pulse">
          <Loader2 size={14} className="animate-spin text-[#55d8e1]" />
          <span className="font-bold tracking-wide">Solving AC Newton-Raphson Power Flow...</span>
        </div>
      )}

      {/* Floating Canvas Action Dock (Bottom-Center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#19191c]/95 border border-[#2D333B] p-2 rounded-2xl backdrop-blur-xl shadow-2xl">
        {/* Stress Test */}
        {onOpenStressPanel && (
          <button
            onClick={onOpenStressPanel}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap shrink-0 ${
              isStressPanelOpen
                ? 'bg-[#FFD369] text-[#1f1f22] border-[#FFD369] shadow-[0_0_15px_rgba(255,211,105,0.35)]'
                : 'bg-[#1f1f22] border-[#2D333B] text-[#FFD369] hover:border-[#FFD369]/60 hover:bg-[#2a2a2d]'
            }`}
            title="Open Load Scaling & Stress Testing Panel"
          >
            <Sliders size={15} className="shrink-0" />
            <span>Stress Test</span>
            {isStressed && (
              <span className="w-2 h-2 rounded-full bg-[#FFD369] animate-pulse shrink-0" />
            )}
          </button>
        )}

        {/* Compare vs Baseline */}
        {onOpenComparison && (
          <button
            onClick={onOpenComparison}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap shrink-0 ${
              isStressed
                ? 'bg-[#55d8e1]/15 text-[#55d8e1] border-[#55d8e1]/50 shadow-[0_0_15px_rgba(85,216,225,0.25)] hover:bg-[#55d8e1]/25'
                : 'bg-[#1f1f22] border-[#2D333B] text-[#bbc9ca] hover:text-white hover:border-[#00adb5]/50'
            }`}
            title="Compare active power flow against 1.0x baseline"
          >
            <GitCompare size={15} className="shrink-0" />
            <span>Compare</span>
            {isStressed && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#55d8e1]/25 text-[#55d8e1] whitespace-nowrap leading-none shrink-0">
                Δ Stressed
              </span>
            )}
          </button>
        )}

        {/* AI Auto-Heal Remediation */}
        {onTriggerAIHeal && (
          <button
            onClick={onTriggerAIHeal}
            disabled={isAISolving}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap shrink-0 ${
              summary?.grid_health !== 'SAFE' || (edges && edges.some(e => e.is_tripped))
                ? 'bg-[#00adb5] text-[#131316] border-[#55d8e1] shadow-[0_0_20px_rgba(0,173,181,0.5)] hover:bg-[#55d8e1] animate-pulse'
                : 'bg-[#1f1f22] border-[#2D333B] text-[#55d8e1] hover:border-[#00adb5]/50 hover:bg-[#2a2a2d]'
            }`}
            title="Execute Physics-Guided RL Operator to Resolve Violations"
          >
            {isAISolving ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Bot size={15} className="shrink-0" />}
            <span>AI Auto-Heal</span>
          </button>
        )}

        {/* Data Matrix Table */}
        {onOpenDataTable && (
          <button
            onClick={onOpenDataTable}
            className="px-4 py-2 rounded-xl bg-[#1f1f22] border border-[#2D333B] text-[#bbc9ca] hover:text-[#55d8e1] hover:border-[#00adb5]/50 hover:bg-[#2a2a2d] text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
            title="Open Full Matrix Data Table"
          >
            <Table size={15} className="shrink-0" />
            <span>Matrix Data</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-[#2D333B] mx-1 hidden sm:block" />

        {/* Live Telemetry Summary Chip */}
        {summary && (
          <div className="hidden md:flex items-center gap-3 px-3 py-1 text-xs font-mono text-[#bbc9ca]">
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Gen:</span>
              <span className="font-bold text-[#55d8e1]">{summary.total_gen_mw} MW</span>
            </div>
            <div className="h-3 w-[1px] bg-[#2D333B]" />
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Load:</span>
              <span className="font-bold text-emerald-400">{summary.total_load_mw} MW</span>
            </div>
            <div className="h-3 w-[1px] bg-[#2D333B]" />
            <div>
              <span className="text-[10px] text-[#869394] uppercase mr-1">Loss:</span>
              <span className="font-bold text-[#FFD369]">{summary.total_losses_mw} MW</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend Card */}
      <div className="absolute bottom-4 left-4 z-20 bg-[#1f1f22]/90 border border-[#2D333B] p-3.5 rounded-xl backdrop-blur-md text-xs shadow-xl hidden sm:block">
        <div className="font-semibold text-[#e4e1e5] mb-2 flex items-center gap-1.5">
          <Info size={14} className="text-[#55d8e1]" />
          <span>Grid Topology Legend</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#bbc9ca]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
            <span>Slack / Ref Bus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#55d8e1] shadow-sm" />
            <span>PV Generator</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span>PQ Load Bus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
            <span>Voltage Alert</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#00adb5] rounded" />
            <span>Line &le;85% (Normal)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#FFD369] rounded" />
            <span>Line &gt;85% (Heavy)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#ef4444] rounded" />
            <span>Line &gt;100% (Overload)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-b-2 border-dashed border-[#ef4444]" />
            <span>Tripped Line</span>
          </div>
        </div>
      </div>
    </div>
  );
}

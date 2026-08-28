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
  RefreshCw
} from 'lucide-react';

export default function CircuitVisualizer({ 
  networkData, 
  selectedElement, 
  onSelectElement, 
  showFlowAnimation, 
  setShowFlowAnimation,
  onOpenStressPanel,
  isStressPanelOpen,
  onOpenComparison,
  isStressed,
  onOpenDataTable,
  onRefreshClick,
  isLoading
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
    if (edge.thermal_status === 'overload') return '#ef4444'; // Red
    if (edge.thermal_status === 'warning') return '#FFD369';  // Gold
    if (edge.loading_pct > 60) return '#eab308';             // Yellow
    return '#00adb5';                                         // Teal
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
              : 'bg-[#1b1b1e] text-[#bbc9ca] border border-[#2D333B]'
          }`}
        >
          <Activity size={14} className={showFlowAnimation ? 'animate-pulse' : ''} />
          <span>Flow Particles</span>
        </button>

        <div className="h-5 w-[1px] bg-[#2D333B] mx-1" />

        <div className="text-xs text-[#bbc9ca] px-2 font-mono">
          Zoom: {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      {/* Floating Bus Search & Filter Bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        {/* Bus Search */}
        <div className="bg-[#1f1f22]/90 border border-[#2D333B] px-3 py-1.5 flex items-center gap-2 rounded-xl backdrop-blur-md w-56 shadow-xl">
          <Search size={16} className="text-[#bbc9ca]" />
          <input
            type="text"
            placeholder="Search Bus ID (e.g. 14)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-transparent text-xs text-[#e4e1e5] placeholder-[#bbc9ca]/50 focus:outline-none w-full font-mono"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="bg-[#1f1f22]/90 border border-[#2D333B] px-3 py-1.5 flex items-center gap-2 rounded-xl backdrop-blur-md shadow-xl">
          <Sliders size={15} className="text-[#55d8e1]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent text-xs text-[#e4e1e5] focus:outline-none cursor-pointer font-sans"
          >
            <option value="all" className="bg-[#131316] text-[#e4e1e5]">All Buses ({nodes.length})</option>
            <option value="slack" className="bg-[#131316] text-[#e4e1e5]">Slack Buses</option>
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
                    strokeWidth={14}
                    onClick={() => onSelectElement({ type: 'line', data: edge })}
                  />

                  {/* Main Line Stroke */}
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isSelected ? '#55d8e1' : color}
                    strokeWidth={isSelected ? baseWidth + 3 : baseWidth}
                    strokeOpacity={isSelected ? 1.0 : (isLargeGrid ? 0.55 : 0.75)}
                    className="transition-all duration-200"
                  />

                  {/* Flow animation dash overlay */}
                  {showFlowAnimation && edge.pf !== 0 && (
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

                  {/* Midpoint Label (Line Loading %) - only for smaller grids */}
                  {!isLargeGrid && (
                    <g 
                      transform={`translate(${(sourceNode.x + targetNode.x) / 2}, ${(sourceNode.y + targetNode.y) / 2})`}
                      className="pointer-events-none"
                    >
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
                  {/* Search Highlight Pulsing Ring */}
                  {(isHighlighted || isSelected || isHovered) && (
                    <circle
                      r={nodeRadius + 10}
                      fill="none"
                      stroke="#55d8e1"
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      className="animate-spin-slow opacity-90"
                    />
                  )}

                  {/* Outer Status Ring */}
                  <circle
                    r={nodeRadius + 3}
                    fill="none"
                    stroke={borderColor}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeOpacity={0.9}
                    filter={isSlack ? "url(#glow-slack)" : (node.v_status === 'critical' ? "url(#glow-danger)" : undefined)}
                  />

                  {/* Inner Node Body */}
                  <circle
                    r={nodeRadius}
                    fill={isSlack ? '#3f2e00' : (isGen ? '#003739' : '#1b1b1e')}
                    stroke="#2D333B"
                    strokeWidth="2"
                  />

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

      {/* Floating Canvas Action Dock (Bottom-Center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#19191c]/95 border border-[#2D333B] p-2 rounded-2xl backdrop-blur-xl shadow-2xl">
        {/* Stress Test */}
        {onOpenStressPanel && (
          <button
            onClick={onOpenStressPanel}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              isStressPanelOpen
                ? 'bg-[#FFD369] text-[#1f1f22] border-[#FFD369] shadow-[0_0_15px_rgba(255,211,105,0.35)]'
                : 'bg-[#1f1f22] border-[#2D333B] text-[#FFD369] hover:border-[#FFD369]/60 hover:bg-[#2a2a2d]'
            }`}
            title="Open Load Scaling & Stress Testing Panel"
          >
            <Sliders size={15} />
            <span>Stress Test</span>
            {isStressed && (
              <span className="w-2 h-2 rounded-full bg-[#FFD369] animate-pulse" />
            )}
          </button>
        )}

        {/* Compare vs Baseline */}
        {onOpenComparison && (
          <button
            onClick={onOpenComparison}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              isStressed
                ? 'bg-[#55d8e1]/15 text-[#55d8e1] border-[#55d8e1]/50 shadow-[0_0_15px_rgba(85,216,225,0.25)] hover:bg-[#55d8e1]/25'
                : 'bg-[#1f1f22] border-[#2D333B] text-[#bbc9ca] hover:text-white hover:border-[#00adb5]/50'
            }`}
            title="Compare active power flow against 1.0x baseline"
          >
            <GitCompare size={15} />
            <span>Compare</span>
            {isStressed && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#55d8e1]/20 text-[#55d8e1]">
                Δ Stressed
              </span>
            )}
          </button>
        )}

        {/* Data Matrix Table */}
        {onOpenDataTable && (
          <button
            onClick={onOpenDataTable}
            className="px-3.5 py-2 rounded-xl bg-[#1f1f22] border border-[#2D333B] text-[#bbc9ca] hover:text-[#55d8e1] hover:border-[#00adb5]/50 hover:bg-[#2a2a2d] text-xs font-semibold transition-all flex items-center gap-2"
            title="Open Full Matrix Data Table"
          >
            <Table size={15} />
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
            <span>Line &lt;60% Load</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#FFD369] rounded" />
            <span>Line Overload</span>
          </div>
        </div>
      </div>
    </div>
  );
}

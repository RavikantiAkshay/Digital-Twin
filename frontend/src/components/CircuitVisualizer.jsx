import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Search, 
  Eye, 
  EyeOff, 
  Zap, 
  Activity, 
  ShieldAlert, 
  Sliders, 
  Sun,
  Moon,
  Info
} from 'lucide-react';

export default function CircuitVisualizer({ 
  networkData, 
  selectedElement, 
  onSelectElement, 
  showFlowAnimation, 
  setShowFlowAnimation 
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedBusId, setHighlightedBusId] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'slack', 'pv', 'pq', 'overload'

  const { summary, nodes, edges } = networkData;
  const canvasWidth = summary.canvas_width || 1600;
  const canvasHeight = summary.canvas_height || 1000;

  // D3 Zoom setup
  const zoomBehaviorRef = useRef(null);
  const gRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g.main-group');
    gRef.current = g;

    const zoom = d3.zoom()
      .scaleExtent([0.15, 6])
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
      (containerWidth - 80) / canvasWidth,
      (containerHeight - 80) / canvasHeight
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
      const targetScale = 1.5;

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

  // Color mappings
  const getLineColor = (edge) => {
    if (edge.thermal_status === 'overload') return '#ef4444'; // Red
    if (edge.thermal_status === 'warning') return '#f59e0b';  // Amber
    if (edge.loading_pct > 60) return '#eab308';             // Yellow
    return '#10b981';                                         // Emerald green
  };

  const getBusBorderColor = (node) => {
    if (node.v_status === 'critical') return '#ef4444';
    if (node.v_status === 'alert') return '#f59e0b';
    if (node.type === 'slack') return '#a855f7';
    if (node.type === 'pv') return '#06b6d4';
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
    <div ref={containerRef} className="relative w-full h-full bg-[#080d1a] overflow-hidden select-none grid-bg">

      {/* Floating Canvas View Controls Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 glass-panel p-2">
        <button 
          onClick={handleZoomIn} 
          title="Zoom In (+)"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={handleZoomOut} 
          title="Zoom Out (-)"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={handleResetZoom} 
          title="Reset Zoom"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <RotateCcw size={18} />
        </button>
        <button 
          onClick={handleFitToScreen} 
          title="Fit to Viewport"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <Maximize2 size={18} />
        </button>

        <div className="h-5 w-[1px] bg-slate-800 mx-1" />

        {/* Animation Flow Toggle */}
        <button
          onClick={() => setShowFlowAnimation(!showFlowAnimation)}
          title="Toggle Animated Power Flow Particles"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showFlowAnimation 
              ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' 
              : 'bg-slate-800/60 text-slate-400 border border-slate-700'
          }`}
        >
          <Activity size={14} className={showFlowAnimation ? 'animate-pulse' : ''} />
          <span>Flow Animation</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-800 mx-1" />

        <div className="text-xs text-slate-400 px-2 font-mono">
          Zoom: {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      {/* Floating Bus Search & Filter Bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        {/* Bus Search */}
        <div className="glass-panel px-3 py-1.5 flex items-center gap-2 border-slate-800 w-52">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search Bus ID (e.g. 14)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-mono"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="glass-panel px-3 py-1.5 flex items-center gap-2 border-slate-800">
          <Sliders size={15} className="text-blue-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900 text-white">All Buses ({nodes.length})</option>
            <option value="slack" className="bg-slate-900 text-white">Slack Buses</option>
            <option value="pv" className="bg-slate-900 text-white">PV Generators</option>
            <option value="pq" className="bg-slate-900 text-white">PQ Loads</option>
            <option value="critical" className="bg-slate-900 text-white">Voltage Alerts</option>
          </select>
        </div>
      </div>

      {/* SVG Canvas Render Engine */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <defs>
          {/* Arrow markers for transmission line power flow */}
          <marker
            id="arrow-normal"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
          </marker>
          <marker
            id="arrow-warning"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
          <marker
            id="arrow-overload"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>

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

              // Calculate stroke width based on thermal capacity
              const baseWidth = Math.max(2, Math.min(6, (edge.rate_a / summary.base_mva) * 3));

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
                    stroke={isSelected ? '#60a5fa' : color}
                    strokeWidth={isSelected ? baseWidth + 3 : baseWidth}
                    strokeOpacity={isSelected ? 1.0 : 0.75}
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
                      strokeWidth={2}
                      strokeOpacity={0.8}
                      className="line-flow-animated"
                    />
                  )}

                  {/* Midpoint Label (Line Loading %) */}
                  {nodes.length <= 39 && (
                    <g 
                      transform={`translate(${(sourceNode.x + targetNode.x) / 2}, ${(sourceNode.y + targetNode.y) / 2})`}
                      className="pointer-events-none"
                    >
                      <rect
                        x="-20"
                        y="-9"
                        width="40"
                        height="18"
                        rx="4"
                        fill="#090d16"
                        fillOpacity="0.85"
                        stroke={color}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dy="3"
                        fontSize="9"
                        fontWeight="600"
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
              const borderColor = getBusBorderColor(node);

              const isSlack = node.type === 'slack';
              const isGen = node.type === 'pv' || isSlack;
              const nodeRadius = isSlack ? 22 : (isGen ? 18 : 15);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => onSelectElement({ type: 'bus', data: node })}
                >
                  {/* Search Highlight Pulsing Ring */}
                  {(isHighlighted || isSelected) && (
                    <circle
                      r={nodeRadius + 12}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      className="animate-spin-slow"
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
                    fill={isSlack ? '#3b0764' : (isGen ? '#083344' : '#064e3b')}
                    stroke="#1e293b"
                    strokeWidth="2"
                  />

                  {/* Bus ID Text */}
                  <text
                    textAnchor="middle"
                    dy="4"
                    fontSize={isSlack ? "13" : "11"}
                    fontWeight="700"
                    fill="#ffffff"
                    className="font-mono select-none"
                  >
                    {node.id}
                  </text>

                  {/* Floating Voltage Badge below Bus */}
                  <g transform={`translate(0, ${nodeRadius + 16})`} className="pointer-events-none">
                    <rect
                      x="-28"
                      y="-8"
                      width="56"
                      height="16"
                      rx="4"
                      fill="#0f172a"
                      fillOpacity="0.9"
                      stroke={borderColor}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="9.5"
                      fontWeight="600"
                      fill={node.v_status === 'critical' ? '#ef4444' : '#e2e8f0'}
                      className="font-mono"
                    >
                      {node.vm.toFixed(3)} p.u.
                    </text>
                  </g>

                  {/* Generator Icon / Tag if Generator */}
                  {isGen && (
                    <g transform={`translate(${nodeRadius + 6}, -${nodeRadius + 6})`}>
                      <circle r="9" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                      <text textAnchor="middle" dy="3" fontSize="9" fontWeight="800" fill="#ffffff">
                        G
                      </text>
                    </g>
                  )}

                  {/* Slack Crown Badge */}
                  {isSlack && (
                    <g transform={`translate(0, -${nodeRadius + 12})`}>
                      <polygon points="-6,4 0,-4 6,4 4,2 0,6 -4,2" fill="#a855f7" />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Legend Card */}
      <div className="absolute bottom-4 left-4 z-20 glass-panel p-3 border-slate-800 text-xs">
        <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Info size={14} className="text-blue-400" />
          <span>Grid Topology Legend</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
            <span>Slack / Ref Bus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" />
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
            <span className="w-4 h-1 bg-emerald-500 rounded" />
            <span>Line &lt;60% Load</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-amber-500 rounded" />
            <span>Line Overload</span>
          </div>
        </div>
      </div>
    </div>
  );
}

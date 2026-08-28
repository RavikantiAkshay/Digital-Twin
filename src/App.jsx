import React, { useState, useEffect, useMemo } from 'react';
import ModeSelection from './components/ModeSelection';
import CircuitVisualizer from './components/CircuitVisualizer';
import TopBar from './components/TopBar';
import InspectorPanel from './components/InspectorPanel';
import StressTestPanel from './components/StressTestPanel';
import DataTableModal from './components/DataTableModal';
import CustomNetworkModal from './components/CustomNetworkModal';
import ComparisonModal from './components/ComparisonModal';
import { Loader2 } from 'lucide-react';

const FALLBACK_CASES = [
  { id: 'case9', name: 'IEEE 9-Bus System', description: '3 Generators, 9 Buses, 9 Transmission Lines' },
  { id: 'case14', name: 'IEEE 14-Bus System', description: '5 Generators, 14 Buses, 20 Transmission Lines' },
  { id: 'case30', name: 'IEEE 30-Bus System', description: '6 Generators, 30 Buses, 41 Transmission Lines' },
  { id: 'case39', name: 'IEEE 39-Bus System', description: '10 Generators, 39 Buses, 46 Lines (New England)' },
  { id: 'case57', name: 'IEEE 57-Bus System', description: '7 Generators, 57 Buses, 80 Transmission Lines' },
  { id: 'case118', name: 'IEEE 118-Bus System', description: '54 Generators, 118 Buses, 186 Lines (Large Grid)' },
  { id: 'case300', name: 'IEEE 300-Bus System', description: '69 Generators, 300 Buses, 411 Transmission Lines' },
];

export default function App() {
  const [mode, setMode] = useState('selection'); // 'selection' | 'visualizer'
  const [cases, setCases] = useState(FALLBACK_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState('case14');
  const [networkData, setNetworkData] = useState(null);
  const [baselineData, setBaselineData] = useState(null); // Preserves 1.0x baseline for comparison
  const [activeBusScales, setActiveBusScales] = useState({});
  const [trippedBranches, setTrippedBranches] = useState([]); // Array of tripped lines: ["1-2", "2-3"]
  const [selectedElement, setSelectedElement] = useState(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDataTableOpen, setIsDataTableOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isStressPanelOpen, setIsStressPanelOpen] = useState(false);
  const [showFlowAnimation, setShowFlowAnimation] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch supported cases from Python FastAPI Backend
  useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(data => {
        if (data.cases) {
          setCases(data.cases);
        }
      })
      .catch(err => {
        console.warn('Backend API /api/cases unreachable, using built-in IEEE cases fallback:', err);
      });
  }, []);

  // Fetch network data and solve AC power flow
  const loadNetworkData = async (caseId) => {
    setSelectedCaseId(caseId);
    setTrippedBranches([]);
    setActiveBusScales({});
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/network/${caseId}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setNetworkData(data);
      setBaselineData(data); // Record unscaled normal case as baseline
      setSelectedElement(null);
      setMode('visualizer');
    } catch (err) {
      console.error(`Failed to load case ${caseId}:`, err);
      setErrorMsg(`Could not connect to PyPOWER solver API. Make sure python server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Run load scaling & stress analysis AC power flow
  const handleApplyStress = async (busScales) => {
    const updatedScales = busScales !== undefined ? busScales : activeBusScales;
    setActiveBusScales(updatedScales || {});
    setIsLoading(true);
    try {
      const endpoint = selectedCaseId.startsWith('custom') 
        ? '/api/network/custom/stress' 
        : `/api/network/${selectedCaseId}/solve`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_scale: 1.0,
          bus_scales: updatedScales || {},
          tripped_branches: trippedBranches
        })
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setNetworkData(data);
    } catch (err) {
      console.error(`Failed to solve stress power flow for ${selectedCaseId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Interactive Line Outage / Circuit Breaker Switching
  const handleToggleLineTrip = async (lineId, fromBus, toBus) => {
    const f = parseInt(fromBus, 10);
    const t = parseInt(toBus, 10);
    const key = `${f}-${t}`;
    const reverseKey = `${t}-${f}`;

    const isCurrentlyTripped = trippedBranches.some(k => k === key || k === reverseKey || k === lineId);
    const newTripped = isCurrentlyTripped
      ? trippedBranches.filter(k => k !== key && k !== reverseKey && k !== lineId)
      : [...trippedBranches, key];

    setTrippedBranches(newTripped);
    setIsLoading(true);

    try {
      const endpoint = selectedCaseId.startsWith('custom') 
        ? '/api/network/custom/stress' 
        : `/api/network/${selectedCaseId}/solve`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_scale: 1.0,
          bus_scales: activeBusScales || {},
          tripped_branches: newTripped
        })
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setNetworkData(data);
    } catch (err) {
      console.error(`Failed to solve contingency power flow for ${selectedCaseId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset grid back to 1.0x baseline state
  const handleResetStress = () => {
    setActiveBusScales({});
    setTrippedBranches([]);
    handleApplyStress({});
  };

  const handleCaseSelection = (caseId) => {
    if (caseId === 'custom_grid' && networkData?.summary?.case_id === 'custom_grid') {
      setSelectedCaseId('custom_grid');
      setMode('visualizer');
    } else {
      loadNetworkData(caseId);
    }
  };

  const handleLaunchCustomGrid = (solvedData, customTitle) => {
    const customCaseObj = {
      id: 'custom_grid',
      name: `✨ ${customTitle || 'Custom Grid Model'}`,
      description: `Custom AC Power Flow Model (${solvedData.nodes.length} Buses, ${solvedData.edges.length} Branches)`
    };

    setCases(prev => {
      const filtered = prev.filter(c => c.id !== 'custom_grid');
      return [customCaseObj, ...filtered];
    });

    setSelectedCaseId('custom_grid');
    setTrippedBranches([]);
    setActiveBusScales({});
    setNetworkData(solvedData);
    setBaselineData(solvedData); // Record base custom grid
    setSelectedElement(null);
    setMode('visualizer');
  };

  // Keep selected element live and in sync with solver telemetry
  const activeElement = useMemo(() => {
    if (!selectedElement || !networkData) return null;
    if (selectedElement.type === 'line') {
      const f = parseInt(selectedElement.data.from_bus, 10);
      const t = parseInt(selectedElement.data.to_bus, 10);
      const updatedEdge = networkData.edges?.find(e => 
        e.id === selectedElement.data.id ||
        (e.from_bus === f && e.to_bus === t) ||
        (e.from_bus === t && e.to_bus === f)
      );
      return updatedEdge ? { type: 'line', data: updatedEdge } : selectedElement;
    }
    if (selectedElement.type === 'bus') {
      const bId = parseInt(selectedElement.data.id, 10);
      const updatedNode = networkData.nodes?.find(n => n.id === bId);
      return updatedNode ? { type: 'bus', data: updatedNode } : selectedElement;
    }
    return selectedElement;
  }, [selectedElement, networkData]);

  // Compute whether the grid is currently operating away from baseline
  const isStressed = Boolean(
    baselineData && 
    networkData && 
    (
      Math.abs((networkData.summary?.total_load_mw || 0) - (baselineData.summary?.total_load_mw || 0)) > 0.01 ||
      networkData.summary?.global_load_scale !== 1.0 ||
      networkData.nodes?.some(n => n.is_targeted) ||
      trippedBranches.length > 0
    )
  );

  return (
    <div className="min-h-screen bg-[#131316] text-[#e4e1e5] font-sans relative overflow-hidden">
      
      {/* MODE 1: WELCOME & CASE SELECTION SCREEN */}
      {mode === 'selection' && (
        <ModeSelection
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={handleCaseSelection}
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
        />
      )}

      {/* MODE 2: MAIN DIGITAL TWIN CIRCUIT VISUALIZER */}
      {mode === 'visualizer' && (
        <div className="h-screen w-screen flex flex-col overflow-hidden">
          {/* Top Navbar */}
          <TopBar
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={handleCaseSelection}
            summary={networkData?.summary}
            onHomeClick={() => setMode('selection')}
            onRefreshClick={() => {
              if (selectedCaseId.startsWith('custom')) {
                handleApplyStress(activeBusScales);
              } else {
                loadNetworkData(selectedCaseId);
              }
            }}
            onOpenCustomModal={() => setIsCustomModalOpen(true)}
            isLoading={isLoading}
          />

          {/* Main Visualizer Workspace */}
          <div className="flex-1 relative overflow-hidden">
            {!networkData && isLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-[#131316] text-[#55d8e1] gap-4">
                <Loader2 size={40} className="animate-spin" />
                <div className="text-sm font-bold tracking-wide font-mono">
                  Solving AC Newton-Raphson Power Flow for {selectedCaseId.toUpperCase()}...
                </div>
              </div>
            ) : networkData ? (
              <CircuitVisualizer
                networkData={networkData}
                selectedElement={activeElement}
                onSelectElement={setSelectedElement}
                showFlowAnimation={showFlowAnimation}
                setShowFlowAnimation={setShowFlowAnimation}
                onOpenStressPanel={() => setIsStressPanelOpen(prev => !prev)}
                isStressPanelOpen={isStressPanelOpen}
                onOpenComparison={() => setIsComparisonOpen(true)}
                isStressed={isStressed}
                onOpenDataTable={() => setIsDataTableOpen(true)}
                onRefreshClick={() => {
                  if (selectedCaseId.startsWith('custom')) {
                    handleApplyStress(activeBusScales);
                  } else {
                    loadNetworkData(selectedCaseId);
                  }
                }}
                isLoading={isLoading}
              />
            ) : null}

            {/* Slide-over Inspector Panel */}
            <InspectorPanel
              element={activeElement}
              onClose={() => setSelectedElement(null)}
              summary={networkData?.summary}
              onToggleLineTrip={handleToggleLineTrip}
              isLoading={isLoading}
            />

            {/* Slide-over Stress Test Panel */}
            <StressTestPanel
              isOpen={isStressPanelOpen}
              onClose={() => setIsStressPanelOpen(false)}
              summary={networkData?.summary}
              nodes={networkData?.nodes || []}
              violations={networkData?.violations || []}
              onApplyStress={handleApplyStress}
              onOpenComparison={() => setIsComparisonOpen(true)}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* DATA TABLE MODAL */}
      {isDataTableOpen && (
        <DataTableModal
          networkData={networkData}
          onClose={() => setIsDataTableOpen(false)}
        />
      )}

      {/* COMPARISON MODAL (BASE CASE VS STRESSED DELTA ANALYSIS) */}
      <ComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        baselineData={baselineData}
        networkData={networkData}
        onResetStress={handleResetStress}
      />

      {/* CUSTOM NETWORK BUILDER MODAL */}
      <CustomNetworkModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onLaunchCustomGrid={handleLaunchCustomGrid}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ModeSelection from './components/ModeSelection';
import CircuitVisualizer from './components/CircuitVisualizer';
import TopBar from './components/TopBar';
import InspectorPanel from './components/InspectorPanel';
import StressTestPanel from './components/StressTestPanel';
import DataTableModal from './components/DataTableModal';
import CustomNetworkModal from './components/CustomNetworkModal';
import ComparisonModal from './components/ComparisonModal';
import AIAutoHealModal from './components/AIAutoHealModal';
import { Loader2 } from 'lucide-react';
import { getBuiltinBaseCase, BUILTIN_CASES_LIST } from './data/cached_cases';

export default function App() {
  const [mode, setMode] = useState('selection'); // 'selection' | 'visualizer'
  const [cases, setCases] = useState(BUILTIN_CASES_LIST);
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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiHealResult, setAiHealResult] = useState(null);
  const [isAISolving, setIsAISolving] = useState(false);
  const [showFlowAnimation, setShowFlowAnimation] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // In-memory instant client-side cache for baseline cases (0ms network delay)
  const baseCasesCacheRef = useRef(new Map());

  // Fetch supported cases from Python FastAPI Backend (for any dynamic/custom cases)
  useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(data => {
        if (data.cases) {
          setCases(data.cases);
        }
      })
      .catch(() => {
        // Safe to ignore, built-in IEEE cases are already loaded in state
      });
  }, []);

  // Fetch network data or serve instantaneously from local client-side files
  const loadNetworkData = async (caseId) => {
    setSelectedCaseId(caseId);
    setTrippedBranches([]);
    setActiveBusScales({});
    setErrorMsg(null);
    setSelectedElement(null);
    setMode('visualizer');

    // 1. Instant In-Memory Cache Hit Check (0ms latency)
    if (baseCasesCacheRef.current.has(caseId)) {
      const cached = baseCasesCacheRef.current.get(caseId);
      setNetworkData(cached);
      setBaselineData(cached);
      setIsLoading(false);
      return;
    }

    // 2. Instant Client-Side Static Asset Load (0 backend network calls)
    try {
      const builtin = await getBuiltinBaseCase(caseId);
      if (builtin) {
        baseCasesCacheRef.current.set(caseId, builtin);
        setNetworkData(builtin);
        setBaselineData(builtin);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Built-in base case load fallback to backend:', e);
    }

    // 3. Fallback to backend API only for dynamic/custom grids
    setIsLoading(true);
    try {
      const res = await fetch(`/api/network/${caseId}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      baseCasesCacheRef.current.set(caseId, data);
      setNetworkData(data);
      setBaselineData(data);
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
  const handleToggleLineTrip = async (arg1, arg2, arg3) => {
    let lineId = arg1;
    let fromBus = arg2;
    let toBus = arg3;

    if (typeof arg1 === 'object' && arg1 !== null) {
      lineId = arg1.id;
      fromBus = arg1.from_bus;
      toBus = arg1.to_bus;
    }

    const f = parseInt(fromBus, 10);
    const t = parseInt(toBus, 10);
    const key = !isNaN(f) && !isNaN(t) ? `${f}-${t}` : String(lineId);
    const reverseKey = !isNaN(f) && !isNaN(t) ? `${t}-${f}` : String(lineId);

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

      // Immediately refresh selectedElement to match the new solver response
      if (selectedElement && selectedElement.type === 'line') {
        const updatedEdge = data.edges?.find(e => 
          (e.id && e.id === lineId) ||
          (e.from_bus === f && e.to_bus === t) ||
          (e.from_bus === t && e.to_bus === f)
        );
        if (updatedEdge) {
          setSelectedElement({ type: 'line', data: updatedEdge });
        }
      }
    } catch (err) {
      console.error(`Failed to solve contingency power flow for ${selectedCaseId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Physics-Guided AI Grid Healing
  const handleTriggerAIHeal = async () => {
    setIsAISolving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/network/${selectedCaseId}/ai-heal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_scale: 1.0,
          bus_scales: activeBusScales || {},
          tripped_branches: trippedBranches
        })
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setAiHealResult(data);
      setIsAIModalOpen(true);
    } catch (err) {
      console.error(`AI Remediation failed:`, err);
      setErrorMsg('AI Remediation call failed. Make sure python backend is running.');
    } finally {
      setIsAISolving(false);
    }
  };

  const handleApplyAIDispatch = (solvedNetwork) => {
    if (solvedNetwork) {
      setNetworkData(solvedNetwork);
    }
    setIsAIModalOpen(false);
  };

  // Reset grid back to 1.0x baseline state
  const handleResetStress = async () => {
    setActiveBusScales({});
    setTrippedBranches([]);
    setSelectedElement(null);

    // If baselineData exists and is not custom grid, immediately restore cached baseline (0ms instant response)
    if (baselineData && !selectedCaseId.startsWith('custom')) {
      setNetworkData(baselineData);
      setIsLoading(false);
      return;
    }

    // Otherwise explicitly solve with empty scales and empty tripped_branches
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
          bus_scales: {},
          tripped_branches: []
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNetworkData(data);
      }
    } catch (err) {
      console.error(`Failed to reset stress for ${selectedCaseId}:`, err);
    } finally {
      setIsLoading(false);
    }
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
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F5F3EC] text-[#1C1B18]">
          {/* Top Navbar */}
          <TopBar
            onHomeClick={() => setMode('selection')}
            onRefreshClick={() => {
              if (selectedCaseId.startsWith('custom')) {
                handleApplyStress(activeBusScales);
              } else {
                loadNetworkData(selectedCaseId);
              }
            }}
            isLoading={isLoading}
          />

          {/* Main Visualizer Workspace: Left Controls + Canvas + Right Overview/Inspector */}
          <div className="flex-1 flex overflow-hidden relative">
            {!networkData && isLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-[#F5F3EC] text-[#244B43] gap-4">
                <Loader2 size={36} className="animate-spin" />
                <div className="text-xs font-bold font-mono text-[#5C5950]">
                  Solving AC Power Flow for {selectedCaseId.toUpperCase()}...
                </div>
              </div>
            ) : networkData ? (
              <>
                <CircuitVisualizer
                  networkData={networkData}
                  selectedElement={activeElement}
                  onSelectElement={setSelectedElement}
                  showFlowAnimation={showFlowAnimation}
                  setShowFlowAnimation={setShowFlowAnimation}
                  onOpenComparison={() => setIsComparisonOpen(true)}
                  isStressed={isStressed}
                  onOpenDataTable={() => setIsDataTableOpen(true)}
                  onTriggerAIHeal={handleTriggerAIHeal}
                  isAISolving={isAISolving}
                  isLoading={isLoading}
                  cases={cases}
                  selectedCaseId={selectedCaseId}
                  onSelectCase={handleCaseSelection}
                  onOpenCustomModal={() => setIsCustomModalOpen(true)}
                  onApplyStress={handleApplyStress}
                  onResetStress={handleResetStress}
                />

                {/* Persistent Right Sidebar: Network Overview / Element Inspector */}
                <InspectorPanel
                  element={activeElement}
                  onClose={() => setSelectedElement(null)}
                  summary={networkData?.summary}
                  onToggleLineTrip={handleToggleLineTrip}
                  trippedBranches={trippedBranches}
                  isLoading={isLoading}
                />
              </>
            ) : null}
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

      {/* AI AUTONOMOUS REMEDIATION MODAL */}
      <AIAutoHealModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        aiResult={aiHealResult}
        onApplyHeal={handleApplyAIDispatch}
        isLoading={isAISolving}
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

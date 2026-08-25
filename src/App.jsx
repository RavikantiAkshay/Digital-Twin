import React, { useState, useEffect } from 'react';
import ModeSelection from './components/ModeSelection';
import CircuitVisualizer from './components/CircuitVisualizer';
import TopBar from './components/TopBar';
import InspectorPanel from './components/InspectorPanel';
import StressTestPanel from './components/StressTestPanel';
import DataTableModal from './components/DataTableModal';
import CustomNetworkModal from './components/CustomNetworkModal';
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
  const [selectedElement, setSelectedElement] = useState(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDataTableOpen, setIsDataTableOpen] = useState(false);
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
    setSelectedCaseId(caseId); // Set immediately so loader text matches target caseId
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/network/${caseId}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      setNetworkData(data);
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
    setIsLoading(true);
    try {
      const res = await fetch(`/api/network/${selectedCaseId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_scale: 1.0,
          bus_scales: busScales || {}
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

  const handleCaseSelection = (caseId) => {
    loadNetworkData(caseId);
  };

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
            onRefreshClick={() => loadNetworkData(selectedCaseId)}
            onOpenDataTable={() => setIsDataTableOpen(true)}
            onToggleStressPanel={() => setIsStressPanelOpen(!isStressPanelOpen)}
            isStressPanelOpen={isStressPanelOpen}
            isLoading={isLoading}
          />

          {/* Main Visualizer Workspace */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-[#131316] text-[#55d8e1] gap-4">
                <Loader2 size={40} className="animate-spin" />
                <div className="text-sm font-bold tracking-wide font-mono">
                  Solving AC Newton-Raphson Power Flow for {selectedCaseId.toUpperCase()}...
                </div>
              </div>
            ) : networkData ? (
              <CircuitVisualizer
                networkData={networkData}
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
                showFlowAnimation={showFlowAnimation}
                setShowFlowAnimation={setShowFlowAnimation}
              />
            ) : null}

            {/* Slide-over Inspector Panel */}
            <InspectorPanel
              element={selectedElement}
              onClose={() => setSelectedElement(null)}
              summary={networkData?.summary}
            />

            {/* Slide-over Stress Test Panel */}
            <StressTestPanel
              isOpen={isStressPanelOpen}
              onClose={() => setIsStressPanelOpen(false)}
              summary={networkData?.summary}
              nodes={networkData?.nodes || []}
              violations={networkData?.violations || []}
              onApplyStress={handleApplyStress}
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

      {/* CUSTOM NETWORK BUILDER MODAL */}
      <CustomNetworkModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onLaunchDefaultCase={handleCaseSelection}
      />
    </div>
  );
}

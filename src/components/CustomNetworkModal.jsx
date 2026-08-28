import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  PlusCircle, 
  Upload, 
  Table, 
  Zap, 
  Network, 
  Sliders, 
  Play, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Columns, 
  ArrowRight,
  HelpCircle,
  FolderOpen,
  Sparkles,
  RefreshCw,
  Plus
} from 'lucide-react';

// Preset sample networks
const PRESET_TEMPLATES = {
  '5bus': {
    name: '5-Bus Sample Transmission Grid',
    base_mva: 100.0,
    buses: [
      { id: 1, type: 'slack', pd: 0, qd: 0, base_kv: 230, vm: 1.05, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 2, type: 'pv', pd: 20, qd: 10, base_kv: 230, vm: 1.03, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 3, type: 'pq', pd: 45, qd: 15, base_kv: 230, vm: 1.00, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 4, type: 'pq', pd: 40, qd: 5, base_kv: 230, vm: 1.00, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 5, type: 'pq', pd: 60, qd: 10, base_kv: 230, vm: 1.00, va: 0, vmin: 0.90, vmax: 1.10 },
    ],
    generators: [
      { gen_id: 'G1', bus_id: 1, pg: 0, qg: 0, vg: 1.05, pmax: 200, pmin: 0, qmax: 100, qmin: -100, status: 1 },
      { gen_id: 'G2', bus_id: 2, pg: 40, qg: 0, vg: 1.03, pmax: 100, pmin: 0, qmax: 80, qmin: -50, status: 1 },
    ],
    branches: [
      { from_bus: 1, to_bus: 2, r: 0.02, x: 0.06, b: 0.03, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 1, to_bus: 3, r: 0.08, x: 0.24, b: 0.025, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 2, to_bus: 3, r: 0.06, x: 0.18, b: 0.02, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 2, to_bus: 4, r: 0.06, x: 0.18, b: 0.02, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 2, to_bus: 5, r: 0.04, x: 0.12, b: 0.015, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 3, to_bus: 4, r: 0.01, x: 0.03, b: 0.01, rate_a: 100, tap: 1.0, status: 1 },
      { from_bus: 4, to_bus: 5, r: 0.08, x: 0.24, b: 0.025, rate_a: 100, tap: 1.0, status: 1 },
    ]
  },
  '3bus': {
    name: '3-Bus Simple Loop Grid',
    base_mva: 100.0,
    buses: [
      { id: 1, type: 'slack', pd: 0, qd: 0, base_kv: 138, vm: 1.05, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 2, type: 'pv', pd: 25, qd: 10, base_kv: 138, vm: 1.02, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 3, type: 'pq', pd: 50, qd: 20, base_kv: 138, vm: 1.00, va: 0, vmin: 0.90, vmax: 1.10 },
    ],
    generators: [
      { gen_id: 'G1', bus_id: 1, pg: 0, qg: 0, vg: 1.05, pmax: 150, pmin: 0, qmax: 80, qmin: -80, status: 1 },
      { gen_id: 'G2', bus_id: 2, pg: 30, qg: 0, vg: 1.02, pmax: 100, pmin: 0, qmax: 60, qmin: -40, status: 1 },
    ],
    branches: [
      { from_bus: 1, to_bus: 2, r: 0.02, x: 0.08, b: 0.02, rate_a: 80, tap: 1.0, status: 1 },
      { from_bus: 2, to_bus: 3, r: 0.03, x: 0.12, b: 0.02, rate_a: 80, tap: 1.0, status: 1 },
      { from_bus: 1, to_bus: 3, r: 0.04, x: 0.15, b: 0.02, rate_a: 80, tap: 1.0, status: 1 },
    ]
  },
  'blank': {
    name: 'New Custom Grid',
    base_mva: 100.0,
    buses: [
      { id: 1, type: 'slack', pd: 0, qd: 0, base_kv: 230, vm: 1.05, va: 0, vmin: 0.90, vmax: 1.10 },
      { id: 2, type: 'pq', pd: 30, qd: 10, base_kv: 230, vm: 1.00, va: 0, vmin: 0.90, vmax: 1.10 },
    ],
    generators: [
      { gen_id: 'G1', bus_id: 1, pg: 0, qg: 0, vg: 1.05, pmax: 200, pmin: 0, qmax: 100, qmin: -100, status: 1 }
    ],
    branches: [
      { from_bus: 1, to_bus: 2, r: 0.02, x: 0.08, b: 0.02, rate_a: 100, tap: 1.0, status: 1 }
    ]
  }
};

export default function CustomNetworkModal({ isOpen, onClose, onLaunchCustomGrid }) {
  // 1. All hooks declared unconditionally at the very top of component
  const [modalTab, setModalTab] = useState('tables');
  const [activeTable, setActiveTable] = useState('buses');
  const [gridName, setGridName] = useState('5-Bus Sample Transmission Grid');
  const [baseMva, setBaseMva] = useState(100.0);
  const [buses, setBuses] = useState(PRESET_TEMPLATES['5bus'].buses);
  const [generators, setGenerators] = useState(PRESET_TEMPLATES['5bus'].generators);
  const [branches, setBranches] = useState(PRESET_TEMPLATES['5bus'].branches);
  const [guideTab, setGuideTab] = useState('buses');
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [solveError, setSolveError] = useState(null);

  const fileInputRef = useRef(null);

  // 2. Topology validation useMemo Hook declared unconditionally
  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];

    // Bus validation
    const busIdSet = new Set();
    let slackCount = 0;

    buses.forEach((b, idx) => {
      const bId = Number(b.id);
      if (isNaN(bId) || bId <= 0) {
        errors.push(`Bus row #${idx + 1} has an invalid ID (${b.id}). Must be positive integer.`);
      }
      if (busIdSet.has(bId)) {
        errors.push(`Duplicate Bus ID '${bId}' detected at row #${idx + 1}.`);
      }
      busIdSet.add(bId);

      const bType = String(b.type).toLowerCase();
      if (bType === 'slack' || bType === '3' || bType === 'ref') {
        slackCount++;
      }
    });

    if (buses.length === 0) {
      errors.push('The grid must have at least 1 Bus.');
    }
    if (slackCount === 0) {
      errors.push('No Slack (Reference) Bus defined. At least 1 bus must have Type="Slack".');
    } else if (slackCount > 1) {
      warnings.push(`Multiple Slack buses detected (${slackCount}). Standard power flow uses 1 reference angle.`);
    }

    // Generator validation
    generators.forEach((g, idx) => {
      const gBus = Number(g.bus_id);
      if (!busIdSet.has(gBus)) {
        errors.push(`Generator #${idx + 1} (${g.gen_id}) references non-existent Bus ID '${g.bus_id}'.`);
      }
    });

    if (generators.length === 0) {
      warnings.push('No generators configured. Grid has no real power generation sources.');
    }

    // Branch validation
    branches.forEach((br, idx) => {
      const fBus = Number(br.from_bus);
      const tBus = Number(br.to_bus);
      if (!busIdSet.has(fBus)) {
        errors.push(`Branch #${idx + 1} From-Bus '${br.from_bus}' does not exist in Buses matrix.`);
      }
      if (!busIdSet.has(tBus)) {
        errors.push(`Branch #${idx + 1} To-Bus '${br.to_bus}' does not exist in Buses matrix.`);
      }
      if (fBus === tBus && fBus !== 0) {
        errors.push(`Branch #${idx + 1} has identical From and To Bus (${fBus}). Self-loops not permitted.`);
      }
      if (Number(br.x) <= 0) {
        warnings.push(`Branch #${idx + 1} Reactance X (${br.x}) is non-positive. Inductive reactance required.`);
      }
    });

    if (branches.length === 0) {
      errors.push('The grid must have at least 1 Transmission Branch / Line.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [buses, generators, branches]);

  // If modal is closed, return null AFTER all hooks are called
  if (!isOpen) return null;

  // Load Preset
  const handleLoadPreset = (presetKey) => {
    const p = PRESET_TEMPLATES[presetKey];
    if (!p) return;
    setGridName(p.name);
    setBaseMva(p.base_mva);
    setBuses(JSON.parse(JSON.stringify(p.buses)));
    setGenerators(JSON.parse(JSON.stringify(p.generators)));
    setBranches(JSON.parse(JSON.stringify(p.branches)));
    setUploadFeedback(`Loaded ${p.name} template successfully!`);
    setSolveError(null);
  };

  // ----------------------------------------------------
  // TABLE ROW OPERATIONS
  // ----------------------------------------------------
  const handleAddBus = () => {
    const nextId = buses.length > 0 ? Math.max(...buses.map(b => Number(b.id) || 0)) + 1 : 1;
    setBuses([...buses, {
      id: nextId,
      type: 'pq',
      pd: 25.0,
      qd: 10.0,
      base_kv: 230.0,
      vm: 1.0,
      va: 0.0,
      vmin: 0.90,
      vmax: 1.10
    }]);
  };

  const handleUpdateBus = (index, field, value) => {
    const updated = [...buses];
    updated[index] = { ...updated[index], [field]: value };
    setBuses(updated);
  };

  const handleDeleteBus = (index) => {
    if (buses.length <= 1) return;
    const busToDelete = buses[index].id;
    setBuses(buses.filter((_, i) => i !== index));
    setGenerators(generators.filter(g => Number(g.bus_id) !== Number(busToDelete)));
    setBranches(branches.filter(br => Number(br.from_bus) !== Number(busToDelete) && Number(br.to_bus) !== Number(busToDelete)));
  };

  const handleAddGenerator = () => {
    const nextNum = generators.length + 1;
    const targetBus = buses.length > 0 ? buses[0].id : 1;
    setGenerators([...generators, {
      gen_id: `G${nextNum}`,
      bus_id: targetBus,
      pg: 0.0,
      qg: 0.0,
      vg: 1.05,
      pmax: 200.0,
      pmin: 0.0,
      qmax: 100.0,
      qmin: -100.0,
      status: 1
    }]);
  };

  const handleUpdateGenerator = (index, field, value) => {
    const updated = [...generators];
    updated[index] = { ...updated[index], [field]: value };
    setGenerators(updated);
  };

  const handleDeleteGenerator = (index) => {
    setGenerators(generators.filter((_, i) => i !== index));
  };

  const handleAddBranch = () => {
    const fromId = buses.length > 0 ? buses[0].id : 1;
    const toId = buses.length > 1 ? buses[1].id : (buses.length > 0 ? buses[0].id : 2);
    setBranches([...branches, {
      from_bus: fromId,
      to_bus: toId,
      r: 0.03,
      x: 0.12,
      b: 0.02,
      rate_a: 100.0,
      tap: 1.0,
      status: 1
    }]);
  };

  const handleUpdateBranch = (index, field, value) => {
    const updated = [...branches];
    updated[index] = { ...updated[index], [field]: value };
    setBranches(updated);
  };

  const handleDeleteBranch = (index) => {
    if (branches.length <= 1) return;
    setBranches(branches.filter((_, i) => i !== index));
  };

  // ----------------------------------------------------
  // CSV & JSON PARSING ENGINE
  // ----------------------------------------------------
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const processUploadedFile = (file) => {
    setSolveError(null);
    setUploadFeedback(null);
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (evt) => {
        try {
          const json = JSON.parse(evt.target.result);
          if (json.buses && Array.isArray(json.buses)) {
            setBuses(json.buses.map(b => ({
              id: Number(b.id || b.bus_id || 1),
              type: b.type || (b.bus_type === 3 ? 'slack' : b.bus_type === 2 ? 'pv' : 'pq'),
              pd: Number(b.pd || b.pd_mw || 0),
              qd: Number(b.qd || b.qd_mvar || 0),
              base_kv: Number(b.base_kv || b.kv || 230),
              vm: Number(b.vm || 1.0),
              va: Number(b.va || 0.0),
              vmin: Number(b.vmin || 0.90),
              vmax: Number(b.vmax || 1.10)
            })));
          }
          if (json.generators && Array.isArray(json.generators)) {
            setGenerators(json.generators.map((g, i) => ({
              gen_id: g.gen_id || `G${i+1}`,
              bus_id: Number(g.bus_id || g.bus || 1),
              pg: Number(g.pg || g.pg_mw || 0),
              qg: Number(g.qg || g.qg_mvar || 0),
              vg: Number(g.vg || 1.0),
              pmax: Number(g.pmax || 200),
              pmin: Number(g.pmin || 0),
              qmax: Number(g.qmax || 100),
              qmin: Number(g.qmin || -100),
              status: Number(g.status ?? 1)
            })));
          }
          if (json.branches && Array.isArray(json.branches)) {
            setBranches(json.branches.map(br => ({
              from_bus: Number(br.from_bus || br.from || br.fbus || 1),
              to_bus: Number(br.to_bus || br.to || br.tbus || 2),
              r: Number(br.r || 0.01),
              x: Number(br.x || 0.05),
              b: Number(br.b || 0.0),
              rate_a: Number(br.rate_a || br.rating || 100),
              tap: Number(br.tap || 1.0),
              status: Number(br.status ?? 1)
            })));
          }
          if (json.name) setGridName(json.name);
          if (json.base_mva) setBaseMva(Number(json.base_mva));
          setUploadFeedback(`JSON file "${file.name}" parsed successfully!`);
          setModalTab('tables');
        } catch (err) {
          setSolveError(`JSON Parse Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          parseCsvText(text, file.name);
        } catch (err) {
          setSolveError(`CSV Parse Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      setSolveError('Unsupported file type. Please upload a .json or .csv grid dataset.');
    }
  };

  const parseCsvText = (text, filename) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) {
      throw new Error('CSV file contains no data rows.');
    }

    const headers = lines[0].toLowerCase().split(/[,;\t]/).map(h => h.trim().replace(/['"]/g, ''));
    const rows = lines.slice(1).map(line => line.split(/[,;\t]/).map(val => val.trim().replace(/['"]/g, '')));

    const hasHeader = (...keys) => keys.some(k => headers.includes(k));
    const getVal = (row, ...keys) => {
      for (const k of keys) {
        const idx = headers.indexOf(k);
        if (idx !== -1 && row[idx] !== undefined && row[idx] !== '') {
          return row[idx];
        }
      }
      return undefined;
    };

    if (hasHeader('from_bus', 'from', 'fbus', 'tbus', 'to_bus')) {
      const newBranches = rows.map(r => ({
        from_bus: Number(getVal(r, 'from_bus', 'from', 'fbus') || 1),
        to_bus: Number(getVal(r, 'to_bus', 'to', 'tbus') || 2),
        r: Number(getVal(r, 'r', 'resistance') || 0.01),
        x: Number(getVal(r, 'x', 'reactance') || 0.05),
        b: Number(getVal(r, 'b', 'susceptance', 'charging') || 0.0),
        rate_a: Number(getVal(r, 'rate_a', 'rating', 'limit_mva', 'rate') || 100),
        tap: Number(getVal(r, 'tap', 'ratio') || 1.0),
        status: Number(getVal(r, 'status') ?? 1)
      }));
      setBranches(newBranches);
      setUploadFeedback(`Imported ${newBranches.length} branches from "${filename}".`);
      setModalTab('tables');
      setActiveTable('branches');
    } else if (hasHeader('pg', 'pg_mw', 'pmax', 'pmin', 'qg', 'vg')) {
      const newGens = rows.map((r, i) => ({
        gen_id: getVal(r, 'gen_id', 'id', 'name') || `G${i+1}`,
        bus_id: Number(getVal(r, 'bus_id', 'bus') || 1),
        pg: Number(getVal(r, 'pg', 'pg_mw', 'p') || 0),
        qg: Number(getVal(r, 'qg', 'qg_mvar', 'q') || 0),
        vg: Number(getVal(r, 'vg', 'v_set', 'voltage') || 1.0),
        pmax: Number(getVal(r, 'pmax') || 200),
        pmin: Number(getVal(r, 'pmin') || 0),
        qmax: Number(getVal(r, 'qmax') || 100),
        qmin: Number(getVal(r, 'qmin') || -100),
        status: Number(getVal(r, 'status') ?? 1)
      }));
      setGenerators(newGens);
      setUploadFeedback(`Imported ${newGens.length} generators from "${filename}".`);
      setModalTab('tables');
      setActiveTable('gens');
    } else {
      const newBuses = rows.map(r => ({
        id: Number(getVal(r, 'id', 'bus_id', 'bus', 'bus_i') || 1),
        type: getVal(r, 'type', 'bus_type') || 'pq',
        pd: Number(getVal(r, 'pd', 'pd_mw', 'load_mw', 'p') || 0),
        qd: Number(getVal(r, 'qd', 'qd_mvar', 'load_mvar', 'q') || 0),
        base_kv: Number(getVal(r, 'base_kv', 'kv', 'voltage_kv') || 230),
        vm: Number(getVal(r, 'vm', 'v_mag', 'v') || 1.0),
        va: Number(getVal(r, 'va', 'v_angle', 'angle') || 0.0),
        vmin: Number(getVal(r, 'vmin') || 0.90),
        vmax: Number(getVal(r, 'vmax') || 1.10)
      }));
      setBuses(newBuses);
      setUploadFeedback(`Imported ${newBuses.length} buses from "${filename}".`);
      setModalTab('tables');
      setActiveTable('buses');
    }
  };

  const handleDownloadSampleCsv = (type) => {
    let csvContent = '';
    let filename = '';

    if (type === 'buses') {
      csvContent = "id,type,pd_mw,qd_mvar,base_kv,vm,va,vmin,vmax\n" +
        buses.map(b => `${b.id},${b.type},${b.pd},${b.qd},${b.base_kv},${b.vm},${b.va},${b.vmin},${b.vmax}`).join('\n');
      filename = 'custom_buses_template.csv';
    } else if (type === 'gens') {
      csvContent = "gen_id,bus_id,pg_mw,qg_mvar,vg,pmax,pmin,qmax,qmin,status\n" +
        generators.map(g => `${g.gen_id},${g.bus_id},${g.pg},${g.qg},${g.vg},${g.pmax},${g.pmin},${g.qmax},${g.qmin},${g.status}`).join('\n');
      filename = 'custom_generators_template.csv';
    } else if (type === 'branches') {
      csvContent = "from_bus,to_bus,r,x,b,rate_a,tap,status\n" +
        branches.map(br => `${br.from_bus},${br.to_bus},${br.r},${br.x},${br.b},${br.rate_a},${br.tap},${br.status}`).join('\n');
      filename = 'custom_branches_template.csv';
    } else if (type === 'json') {
      const fullGrid = {
        name: gridName,
        base_mva: baseMva,
        buses,
        generators,
        branches
      };
      csvContent = JSON.stringify(fullGrid, null, 2);
      filename = 'custom_grid_topology.json';
    }

    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSolveAndLaunch = async () => {
    if (!validation.isValid) {
      setSolveError('Cannot solve: Please resolve the topology errors listed above.');
      return;
    }

    setIsSolving(true);
    setSolveError(null);

    const payload = {
      name: gridName,
      case_id: 'custom_grid',
      base_mva: Number(baseMva),
      buses: buses.map(b => ({
        id: Number(b.id),
        type: String(b.type).toLowerCase(),
        pd: Number(b.pd || 0),
        qd: Number(b.qd || 0),
        base_kv: Number(b.base_kv || 230),
        vm: Number(b.vm || 1.0),
        va: Number(b.va || 0.0),
        vmin: Number(b.vmin || 0.90),
        vmax: Number(b.vmax || 1.10)
      })),
      generators: generators.map(g => ({
        gen_id: String(g.gen_id),
        bus_id: Number(g.bus_id),
        pg: Number(g.pg || 0),
        qg: Number(g.qg || 0),
        vg: Number(g.vg || 1.0),
        pmax: Number(g.pmax || 200),
        pmin: Number(g.pmin || 0),
        qmax: Number(g.qmax || 100),
        qmin: Number(g.qmin || -100),
        status: Number(g.status ?? 1)
      })),
      branches: branches.map(br => ({
        from_bus: Number(br.from_bus),
        to_bus: Number(br.to_bus),
        r: Number(br.r || 0.01),
        x: Number(br.x || 0.05),
        b: Number(br.b || 0.0),
        rate_a: Number(br.rate_a || 100),
        tap: Number(br.tap || 1.0),
        status: Number(br.status ?? 1)
      }))
    };

    try {
      const res = await fetch('/api/network/custom/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `Server returned error ${res.status}`);
      }

      const solvedData = await res.json();
      if (solvedData.summary && solvedData.summary.success === false) {
        throw new Error(solvedData.summary.status_message || 'AC Power Flow Diverged. Check generator capacities and load magnitudes.');
      }

      onLaunchCustomGrid(solvedData, gridName);
      onClose();
    } catch (err) {
      console.error('Custom solve error:', err);
      setSolveError(err.message || 'Failed to solve custom power grid.');
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-[#19191c] border border-[#2D333B] rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-[#2D333B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1f1f22]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30">
              <PlusCircle size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#e4e1e5]">
                  Custom Network Builder
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#55d8e1]/10 border border-[#55d8e1]/30 text-[#55d8e1] font-semibold">
                  AC Newton-Raphson
                </span>
              </div>
              <p className="text-xs text-[#bbc9ca]">
                Interactive 3-Card Table Sheet Editor • CSV & JSON Grid Specification
              </p>
            </div>
          </div>

          {/* Top Switcher Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center bg-[#131316] border border-[#2D333B] p-1 rounded-xl gap-1">
              <button
                onClick={() => setModalTab('tables')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  modalTab === 'tables'
                    ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                    : 'text-[#bbc9ca] hover:text-white'
                }`}
              >
                <Table size={14} />
                <span>Table Sheet Editor</span>
              </button>
              <button
                onClick={() => setModalTab('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  modalTab === 'upload'
                    ? 'bg-[#55d8e1] text-[#003739] shadow-[0_0_12px_rgba(85,216,225,0.25)]'
                    : 'text-[#bbc9ca] hover:text-white'
                }`}
              >
                <Upload size={14} />
                <span>File Import & Guide</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#bbc9ca] hover:text-white hover:bg-[#2a2a2d] transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRESET QUICK-LOADER & GRID CONFIG BAR                                     */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 border-b border-[#2D333B] bg-[#131316] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="text-[#869394] font-medium">Grid Title:</span>
              <input
                type="text"
                value={gridName}
                onChange={(e) => setGridName(e.target.value)}
                className="bg-[#1b1b1e] border border-[#2D333B] text-[#e4e1e5] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#55d8e1] font-semibold w-48 sm:w-60"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[#bbc9ca]">
              <span className="text-[#869394]">Base:</span>
              <input
                type="number"
                value={baseMva}
                onChange={(e) => setBaseMva(Number(e.target.value) || 100)}
                className="bg-[#1b1b1e] border border-[#2D333B] text-[#55d8e1] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#55d8e1] font-mono font-bold w-16"
              />
              <span>MVA</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#869394] font-medium hidden md:inline">Presets:</span>
            <button
              onClick={() => handleLoadPreset('5bus')}
              className="px-2.5 py-1 rounded-lg bg-[#1f1f22] border border-[#2D333B] text-[#55d8e1] hover:border-[#55d8e1]/50 hover:bg-[#2a2a2d] transition-all flex items-center gap-1 font-medium"
              title="Load 5-Bus Sample Grid"
            >
              <Sparkles size={13} className="text-[#55d8e1]" />
              <span>5-Bus Sample</span>
            </button>
            <button
              onClick={() => handleLoadPreset('3bus')}
              className="px-2.5 py-1 rounded-lg bg-[#1f1f22] border border-[#2D333B] text-[#bbc9ca] hover:text-[#55d8e1] hover:border-[#55d8e1]/50 hover:bg-[#2a2a2d] transition-all flex items-center gap-1"
              title="Load 3-Bus Loop Grid"
            >
              <span>3-Bus Loop</span>
            </button>
            <button
              onClick={() => handleLoadPreset('blank')}
              className="px-2 py-1 rounded-lg bg-[#1f1f22] border border-[#2D333B] text-[#869394] hover:text-red-400 hover:border-red-500/30 transition-all"
              title="Reset to minimal blank grid"
            >
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY WORKSPACE                                                       */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {uploadFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
              <button onClick={() => setUploadFeedback(null)} className="text-emerald-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {solveError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-red-400 shrink-0" />
                <span>{solveError}</span>
              </div>
              <button onClick={() => setSolveError(null)} className="text-red-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: 3-CARD EXPAND / SHRINK TABLE SHEET EDITOR                          */}
          {/* ========================================================================= */}
          {modalTab === 'tables' && (
            <div className="space-y-4">
              
              {/* Sheet Switcher Quick Bar */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-[#869394] uppercase tracking-wider text-[10px]">Active Sheet:</span>
                  <button
                    onClick={() => setActiveTable('buses')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'buses'
                        ? 'bg-[#55d8e1]/15 text-[#55d8e1] border border-[#55d8e1]/40 font-bold'
                        : 'text-[#bbc9ca] hover:text-white bg-[#1b1b1e] border border-[#2D333B]'
                    }`}
                  >
                    <Network size={14} />
                    <span>Buses Matrix ({buses.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTable('gens')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'gens'
                        ? 'bg-[#FFD369]/15 text-[#FFD369] border border-[#FFD369]/40 font-bold'
                        : 'text-[#bbc9ca] hover:text-white bg-[#1b1b1e] border border-[#2D333B]'
                    }`}
                  >
                    <Zap size={14} className="text-[#FFD369]" />
                    <span>Generators ({generators.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTable('branches')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'branches'
                        ? 'bg-[#00adb5]/15 text-[#00adb5] border border-[#00adb5]/40 font-bold'
                        : 'text-[#bbc9ca] hover:text-white bg-[#1b1b1e] border border-[#2D333B]'
                    }`}
                  >
                    <Sliders size={14} />
                    <span>Branches ({branches.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setActiveTable(activeTable === 'none' ? 'buses' : 'none')}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                    activeTable === 'none'
                      ? 'bg-[#2a2a2d] border-[#55d8e1]/30 text-[#55d8e1]'
                      : 'bg-[#1b1b1e] border-[#2D333B] text-[#bbc9ca] hover:text-white'
                  }`}
                  title="Toggle 3-Way Equal Overview"
                >
                  <Columns size={13} />
                  <span>{activeTable === 'none' ? 'Expanded View' : '3-Card Overview'}</span>
                </button>
              </div>

              {/* Dynamic 3-Card Container */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[440px]">
                
                {/* ------------------------------------------------------------- */}
                {/* CARD 1: BUSES MATRIX                                          */}
                {/* ------------------------------------------------------------- */}
                <div
                  onClick={() => {
                    if (activeTable !== 'buses') setActiveTable('buses');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'buses'
                      ? 'lg:flex-[3.5] border-[#55d8e1] bg-[#1f1f22] shadow-[0_0_20px_rgba(85,216,225,0.08)]'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#2D333B] bg-[#1f1f22] hover:border-[#55d8e1]/40 cursor-pointer'
                      : 'lg:flex-[0.7] border-[#2D333B] bg-[#1b1b1e] hover:border-[#55d8e1]/40 hover:bg-[#1f1f22] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'buses' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#2D333B] gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30">
                            <Network size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#e4e1e5]">Buses Matrix</h3>
                            <p className="text-[11px] text-[#bbc9ca]">Bus Types: Slack (3), PV Gen (2), PQ Load (1)</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBus();
                          }}
                          className="bg-[#55d8e1] text-[#003739] text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-[#55d8e1]/90 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Bus</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#131316] text-[#869394] font-mono border-b border-[#2D333B] text-[11px] sticky top-0 z-10">
                              <th className="p-2 w-16">Bus ID</th>
                              <th className="p-2 w-28">Type</th>
                              <th className="p-2">Pd (MW)</th>
                              <th className="p-2">Qd (MVAr)</th>
                              <th className="p-2">Base kV</th>
                              <th className="p-2">Vm (p.u.)</th>
                              <th className="p-2">Va (deg)</th>
                              <th className="p-2 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2D333B]/60 font-mono">
                            {buses.map((b, idx) => (
                              <tr key={idx} className="hover:bg-[#2a2a2d]/40 transition-colors">
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    value={b.id}
                                    onChange={(e) => handleUpdateBus(idx, 'id', Number(e.target.value))}
                                    className="w-14 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#55d8e1] font-bold text-center focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 font-sans">
                                  <select
                                    value={String(b.type).toLowerCase()}
                                    onChange={(e) => handleUpdateBus(idx, 'type', e.target.value)}
                                    className={`w-24 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-xs font-semibold focus:border-[#55d8e1] focus:outline-none cursor-pointer ${
                                      b.type === 'slack' ? 'text-[#55d8e1]' : b.type === 'pv' ? 'text-[#FFD369]' : 'text-[#e4e1e5]'
                                    }`}
                                  >
                                    <option value="slack">Slack (Ref)</option>
                                    <option value="pv">PV (Gen)</option>
                                    <option value="pq">PQ (Load)</option>
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.pd}
                                    onChange={(e) => handleUpdateBus(idx, 'pd', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-emerald-400 focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.qd}
                                    onChange={(e) => handleUpdateBus(idx, 'qd', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-emerald-400/80 focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.base_kv}
                                    onChange={(e) => handleUpdateBus(idx, 'base_kv', Number(e.target.value))}
                                    className="w-18 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#e4e1e5] focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={b.vm}
                                    onChange={(e) => handleUpdateBus(idx, 'vm', Number(e.target.value))}
                                    className="w-18 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#55d8e1] focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.va}
                                    onChange={(e) => handleUpdateBus(idx, 'va', Number(e.target.value))}
                                    className="w-16 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#bbc9ca] focus:border-[#55d8e1] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBus(idx);
                                    }}
                                    disabled={buses.length <= 1}
                                    className="p-1 rounded text-[#869394] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                    title="Delete Bus"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-between h-full text-center">
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-[#55d8e1]/10 text-[#55d8e1] border border-[#55d8e1]/30 flex items-center justify-center">
                          <Network size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-[#e4e1e5]">Buses</h4>
                        <span className="font-mono text-xs text-[#55d8e1] bg-[#55d8e1]/10 px-2 py-0.5 rounded border border-[#55d8e1]/20">
                          {buses.length} Buses
                        </span>
                      </div>
                      <button className="w-full py-1.5 rounded-lg bg-[#2a2a2d] border border-[#2D333B] text-[11px] font-semibold text-[#55d8e1] hover:bg-[#55d8e1] hover:text-[#003739] transition-all flex items-center justify-center gap-1">
                        <span>Expand</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* CARD 2: GENERATORS MATRIX                                     */}
                {/* ------------------------------------------------------------- */}
                <div
                  onClick={() => {
                    if (activeTable !== 'gens') setActiveTable('gens');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'gens'
                      ? 'lg:flex-[3.5] border-[#FFD369] bg-[#1f1f22] shadow-[0_0_20px_rgba(255,211,105,0.08)]'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#2D333B] bg-[#1f1f22] hover:border-[#FFD369]/40 cursor-pointer'
                      : 'lg:flex-[0.7] border-[#2D333B] bg-[#1b1b1e] hover:border-[#FFD369]/40 hover:bg-[#1f1f22] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'gens' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#2D333B] gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#FFD369]/10 text-[#FFD369] border border-[#FFD369]/30">
                            <Zap size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#e4e1e5]">Generators Matrix</h3>
                            <p className="text-[11px] text-[#bbc9ca]">Real (Pg) & Reactive (Qg) Generation Limits</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddGenerator();
                          }}
                          className="bg-[#FFD369] text-[#1f1f22] text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-[#FFD369]/90 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Gen</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#131316] text-[#869394] font-mono border-b border-[#2D333B] text-[11px] sticky top-0 z-10">
                              <th className="p-2 w-16">Gen ID</th>
                              <th className="p-2 w-20">Bus ID</th>
                              <th className="p-2">Pg (MW)</th>
                              <th className="p-2">Qg (MVAr)</th>
                              <th className="p-2">Vg (p.u.)</th>
                              <th className="p-2">Pmax</th>
                              <th className="p-2">Qmax</th>
                              <th className="p-2 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2D333B]/60 font-mono">
                            {generators.map((g, idx) => (
                              <tr key={idx} className="hover:bg-[#2a2a2d]/40 transition-colors">
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={g.gen_id}
                                    onChange={(e) => handleUpdateGenerator(idx, 'gen_id', e.target.value)}
                                    className="w-16 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#FFD369] font-bold text-center focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <select
                                    value={g.bus_id}
                                    onChange={(e) => handleUpdateGenerator(idx, 'bus_id', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-xs font-bold text-[#55d8e1] focus:border-[#FFD369] focus:outline-none cursor-pointer"
                                  >
                                    {buses.map(b => (
                                      <option key={b.id} value={b.id}>Bus {b.id} ({b.type})</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.pg}
                                    onChange={(e) => handleUpdateGenerator(idx, 'pg', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#55d8e1] focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.qg}
                                    onChange={(e) => handleUpdateGenerator(idx, 'qg', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#55d8e1]/80 focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={g.vg}
                                    onChange={(e) => handleUpdateGenerator(idx, 'vg', Number(e.target.value))}
                                    className="w-18 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#FFD369] focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.pmax}
                                    onChange={(e) => handleUpdateGenerator(idx, 'pmax', Number(e.target.value))}
                                    className="w-18 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#bbc9ca] focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.qmax}
                                    onChange={(e) => handleUpdateGenerator(idx, 'qmax', Number(e.target.value))}
                                    className="w-18 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#bbc9ca] focus:border-[#FFD369] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteGenerator(idx);
                                    }}
                                    className="p-1 rounded text-[#869394] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete Generator"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-between h-full text-center">
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-[#FFD369]/10 text-[#FFD369] border border-[#FFD369]/30 flex items-center justify-center">
                          <Zap size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-[#e4e1e5]">Generators</h4>
                        <span className="font-mono text-xs text-[#FFD369] bg-[#FFD369]/10 px-2 py-0.5 rounded border border-[#FFD369]/20">
                          {generators.length} Gens
                        </span>
                      </div>
                      <button className="w-full py-1.5 rounded-lg bg-[#2a2a2d] border border-[#2D333B] text-[11px] font-semibold text-[#FFD369] hover:bg-[#FFD369] hover:text-[#1f1f22] transition-all flex items-center justify-center gap-1">
                        <span>Expand</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* CARD 3: BRANCHES MATRIX                                       */}
                {/* ------------------------------------------------------------- */}
                <div
                  onClick={() => {
                    if (activeTable !== 'branches') setActiveTable('branches');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'branches'
                      ? 'lg:flex-[3.5] border-[#00adb5] bg-[#1f1f22] shadow-[0_0_20px_rgba(0,173,181,0.08)]'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#2D333B] bg-[#1f1f22] hover:border-[#00adb5]/40 cursor-pointer'
                      : 'lg:flex-[0.7] border-[#2D333B] bg-[#1b1b1e] hover:border-[#00adb5]/40 hover:bg-[#1f1f22] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'branches' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#2D333B] gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#00adb5]/10 text-[#00adb5] border border-[#00adb5]/30">
                            <Sliders size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#e4e1e5]">Branches Matrix</h3>
                            <p className="text-[11px] text-[#bbc9ca]">Line Impedances (R, X, B) & MVA Thermal Limits</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBranch();
                          }}
                          className="bg-[#00adb5] text-[#002022] text-xs px-2.5 py-1 rounded-lg font-bold hover:bg-[#00adb5]/90 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Line</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#131316] text-[#869394] font-mono border-b border-[#2D333B] text-[11px] sticky top-0 z-10">
                              <th className="p-2 w-20">From Bus</th>
                              <th className="p-2 w-20">To Bus</th>
                              <th className="p-2">R (p.u.)</th>
                              <th className="p-2">X (p.u.)</th>
                              <th className="p-2">B (p.u.)</th>
                              <th className="p-2">Rate A (MVA)</th>
                              <th className="p-2">Tap</th>
                              <th className="p-2 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2D333B]/60 font-mono">
                            {branches.map((br, idx) => (
                              <tr key={idx} className="hover:bg-[#2a2a2d]/40 transition-colors">
                                <td className="p-1.5">
                                  <select
                                    value={br.from_bus}
                                    onChange={(e) => handleUpdateBranch(idx, 'from_bus', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-xs font-bold text-[#55d8e1] focus:border-[#00adb5] focus:outline-none cursor-pointer"
                                  >
                                    {buses.map(b => (
                                      <option key={b.id} value={b.id}>Bus {b.id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <select
                                    value={br.to_bus}
                                    onChange={(e) => handleUpdateBranch(idx, 'to_bus', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-xs font-bold text-[#55d8e1] focus:border-[#00adb5] focus:outline-none cursor-pointer"
                                  >
                                    {buses.map(b => (
                                      <option key={b.id} value={b.id}>Bus {b.id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={br.r}
                                    onChange={(e) => handleUpdateBranch(idx, 'r', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#e4e1e5] focus:border-[#00adb5] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={br.x}
                                    onChange={(e) => handleUpdateBranch(idx, 'x', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#00adb5] font-bold focus:border-[#00adb5] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={br.b}
                                    onChange={(e) => handleUpdateBranch(idx, 'b', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#bbc9ca] focus:border-[#00adb5] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={br.rate_a}
                                    onChange={(e) => handleUpdateBranch(idx, 'rate_a', Number(e.target.value))}
                                    className="w-20 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#FFD369] font-bold focus:border-[#00adb5] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={br.tap}
                                    onChange={(e) => handleUpdateBranch(idx, 'tap', Number(e.target.value))}
                                    className="w-16 bg-[#131316] border border-[#2D333B] rounded px-1.5 py-1 text-[#bbc9ca] focus:border-[#00adb5] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBranch(idx);
                                    }}
                                    disabled={branches.length <= 1}
                                    className="p-1 rounded text-[#869394] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                    title="Delete Branch"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-between h-full text-center">
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-[#00adb5]/10 text-[#00adb5] border border-[#00adb5]/30 flex items-center justify-center">
                          <Sliders size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-[#e4e1e5]">Branches</h4>
                        <span className="font-mono text-xs text-[#00adb5] bg-[#00adb5]/10 px-2 py-0.5 rounded border border-[#00adb5]/20">
                          {branches.length} Lines
                        </span>
                      </div>
                      <button className="w-full py-1.5 rounded-lg bg-[#2a2a2d] border border-[#2D333B] text-[11px] font-semibold text-[#00adb5] hover:bg-[#00adb5] hover:text-[#002022] transition-all flex items-center justify-center gap-1">
                        <span>Expand</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FILE UPLOAD & COLUMN GUIDANCE SPECIFICATION                         */}
          {/* ========================================================================= */}
          {modalTab === 'upload' && (
            <div className="space-y-5">
              
              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-[#3c494a] bg-[#1b1b1e] hover:border-[#55d8e1] hover:bg-[#1f1f22] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-inner"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-[#131316] border border-[#2D333B] flex items-center justify-center text-[#55d8e1] group-hover:scale-110 transition-transform mb-3 shadow-md">
                  <Upload size={30} />
                </div>
                <h3 className="text-base font-bold text-[#e4e1e5]">
                  Drag & Drop JSON or CSV Grid Data File
                </h3>
                <p className="text-xs text-[#bbc9ca] mt-1 max-w-md">
                  Upload complete network JSON or individual table CSV files (<code className="text-[#55d8e1]">buses.csv</code>, <code className="text-[#FFD369]">generators.csv</code>, <code className="text-[#00adb5]">branches.csv</code>).
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <button className="bg-[#2a2a2d] border border-[#2D333B] text-[#55d8e1] text-xs px-4 py-2 rounded-xl font-semibold hover:bg-[#55d8e1] hover:text-[#003739] transition-all flex items-center gap-2">
                    <FolderOpen size={15} />
                    <span>Browse Files from Disk</span>
                  </button>
                </div>
              </div>

              {/* Comprehensive Column Guidance Hints Panel */}
              <div className="p-5 rounded-2xl bg-[#1b1b1e] border border-[#2D333B] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2D333B]">
                  <div>
                    <h3 className="text-sm font-bold text-[#e4e1e5] flex items-center gap-2">
                      <HelpCircle size={16} className="text-[#55d8e1]" />
                      File Column Naming & Ordering Guidance
                    </h3>
                    <p className="text-xs text-[#bbc9ca]">
                      Exact column headers and allowable name aliases supported by the auto-parser
                    </p>
                  </div>

                  <div className="flex items-center bg-[#131316] border border-[#2D333B] p-1 rounded-xl gap-1 text-xs">
                    <button
                      onClick={() => setGuideTab('buses')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        guideTab === 'buses' ? 'bg-[#55d8e1]/20 text-[#55d8e1] border border-[#55d8e1]/30 font-bold' : 'text-[#bbc9ca] hover:text-white'
                      }`}
                    >
                      Buses CSV
                    </button>
                    <button
                      onClick={() => setGuideTab('gens')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        guideTab === 'gens' ? 'bg-[#FFD369]/20 text-[#FFD369] border border-[#FFD369]/30 font-bold' : 'text-[#bbc9ca] hover:text-white'
                      }`}
                    >
                      Gens CSV
                    </button>
                    <button
                      onClick={() => setGuideTab('branches')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        guideTab === 'branches' ? 'bg-[#00adb5]/20 text-[#00adb5] border border-[#00adb5]/30 font-bold' : 'text-[#bbc9ca] hover:text-white'
                      }`}
                    >
                      Branches CSV
                    </button>
                    <button
                      onClick={() => setGuideTab('json')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        guideTab === 'json' ? 'bg-[#2a2a2d] text-white border border-[#2D333B] font-bold' : 'text-[#bbc9ca] hover:text-white'
                      }`}
                    >
                      Unified JSON
                    </button>
                  </div>
                </div>

                {guideTab === 'buses' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#55d8e1]">Expected CSV Columns for Buses:</div>
                      <button
                        onClick={() => handleDownloadSampleCsv('buses')}
                        className="text-xs text-[#55d8e1] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Download size={13} />
                        <span>Download sample buses.csv</span>
                      </button>
                    </div>
                    <div className="bg-[#131316] p-3 rounded-xl border border-[#2D333B] font-mono text-[11px] text-[#e4e1e5] overflow-x-auto">
                      <div className="text-[#869394] mb-1"># Recommended CSV Header Order:</div>
                      <div className="text-[#55d8e1] font-bold">id, type, pd_mw, qd_mvar, base_kv, vm, va, vmin, vmax</div>
                      <div className="text-[#bbc9ca] mt-2">1, slack, 0.0, 0.0, 230.0, 1.05, 0.0, 0.90, 1.10</div>
                      <div className="text-[#bbc9ca]">2, pv, 20.0, 10.0, 230.0, 1.03, 0.0, 0.90, 1.10</div>
                      <div className="text-[#bbc9ca]">3, pq, 45.0, 15.0, 230.0, 1.00, 0.0, 0.90, 1.10</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-[#bbc9ca]">
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">id:</strong> Bus number (1, 2, 3...). Aliases: <code className="text-[#55d8e1]">bus_id</code>, <code className="text-[#55d8e1]">bus</code>.
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">type:</strong> <code className="text-[#55d8e1]">slack</code> (3), <code className="text-[#FFD369]">pv</code> (2), or <code className="text-[#e4e1e5]">pq</code> (1).
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">pd_mw & qd_mvar:</strong> Real (MW) & Reactive (MVAr) load demand.
                      </div>
                    </div>
                  </div>
                )}

                {guideTab === 'gens' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#FFD369]">Expected CSV Columns for Generators:</div>
                      <button
                        onClick={() => handleDownloadSampleCsv('gens')}
                        className="text-xs text-[#FFD369] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Download size={13} />
                        <span>Download sample generators.csv</span>
                      </button>
                    </div>
                    <div className="bg-[#131316] p-3 rounded-xl border border-[#2D333B] font-mono text-[11px] text-[#e4e1e5] overflow-x-auto">
                      <div className="text-[#869394] mb-1"># Recommended CSV Header Order:</div>
                      <div className="text-[#FFD369] font-bold">gen_id, bus_id, pg_mw, qg_mvar, vg, pmax, pmin, qmax, qmin, status</div>
                      <div className="text-[#bbc9ca]">G1, 1, 0.0, 0.0, 1.05, 200.0, 0.0, 100.0, -100.0, 1</div>
                      <div className="text-[#bbc9ca]">G2, 2, 40.0, 0.0, 1.03, 100.0, 0.0, 80.0, -50.0, 1</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-[#bbc9ca]">
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">bus_id:</strong> Must match a Bus ID in Buses matrix.
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">vg:</strong> Generator voltage setpoint in p.u. (typically 1.00 - 1.05).
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">pmax & qmax:</strong> Generation active and reactive capacity bounds.
                      </div>
                    </div>
                  </div>
                )}

                {guideTab === 'branches' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#00adb5]">Expected CSV Columns for Branches:</div>
                      <button
                        onClick={() => handleDownloadSampleCsv('branches')}
                        className="text-xs text-[#00adb5] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Download size={13} />
                        <span>Download sample branches.csv</span>
                      </button>
                    </div>
                    <div className="bg-[#131316] p-3 rounded-xl border border-[#2D333B] font-mono text-[11px] text-[#e4e1e5] overflow-x-auto">
                      <div className="text-[#869394] mb-1"># Recommended CSV Header Order:</div>
                      <div className="text-[#00adb5] font-bold">from_bus, to_bus, r, x, b, rate_a, tap, status</div>
                      <div className="text-[#bbc9ca]">1, 2, 0.02, 0.06, 0.03, 100.0, 1.0, 1</div>
                      <div className="text-[#bbc9ca]">1, 3, 0.08, 0.24, 0.025, 100.0, 1.0, 1</div>
                      <div className="text-[#bbc9ca]">2, 3, 0.06, 0.18, 0.02, 100.0, 1.0, 1</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-[#bbc9ca]">
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">from_bus & to_bus:</strong> Endpoints of the line (must exist).
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">r & x:</strong> Resistance and Reactance in p.u. (<code className="text-[#00adb5]">x &gt; 0</code>).
                      </div>
                      <div className="p-2 rounded-lg bg-[#131316] border border-[#2D333B]">
                        <strong className="text-[#e4e1e5] block">rate_a:</strong> Continuous thermal transmission rating in MVA.
                      </div>
                    </div>
                  </div>
                )}

                {guideTab === 'json' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#55d8e1]">Unified JSON Specification Schema:</div>
                      <button
                        onClick={() => handleDownloadSampleCsv('json')}
                        className="text-xs text-[#55d8e1] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Download size={13} />
                        <span>Download custom_grid.json</span>
                      </button>
                    </div>
                    <pre className="bg-[#131316] p-3 rounded-xl border border-[#2D333B] font-mono text-[11px] text-[#bbc9ca] max-h-48 overflow-y-auto">
{`{
  "name": "${gridName}",
  "base_mva": ${baseMva},
  "buses": [
    { "id": 1, "type": "slack", "pd": 0, "qd": 0, "base_kv": 230, "vm": 1.05 },
    { "id": 2, "type": "pv", "pd": 20, "qd": 10, "base_kv": 230, "vm": 1.03 },
    { "id": 3, "type": "pq", "pd": 45, "qd": 15, "base_kv": 230, "vm": 1.00 }
  ],
  "generators": [
    { "gen_id": "G1", "bus_id": 1, "pg": 0, "qg": 0, "vg": 1.05, "pmax": 200, "qmax": 100 },
    { "gen_id": "G2", "bus_id": 2, "pg": 40, "qg": 0, "vg": 1.03, "pmax": 100, "qmax": 80 }
  ],
  "branches": [
    { "from_bus": 1, "to_bus": 2, "r": 0.02, "x": 0.06, "b": 0.03, "rate_a": 100 },
    { "from_bus": 1, "to_bus": 3, "r": 0.08, "x": 0.24, "b": 0.025, "rate_a": 100 },
    { "from_bus": 2, "to_bus": 3, "r": 0.06, "x": 0.18, "b": 0.02, "rate_a": 100 }
  ]
}`}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* LIVE TOPOLOGY VALIDATION SUMMARY BANNER                                   */}
          {/* ========================================================================= */}
          <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            validation.isValid
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/30 border-red-500/40 text-red-300'
          }`}>
            <div className="flex items-start sm:items-center gap-2.5">
              {validation.isValid ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div>
                <span className="font-bold">
                  {validation.isValid
                    ? `✓ Topology Verified: ${buses.length} Buses, ${generators.length} Generators, ${branches.length} Branches`
                    : `⚠ Topology Errors (${validation.errors.length}):`}
                </span>
                {!validation.isValid && (
                  <ul className="list-disc list-inside text-[11px] text-red-200 mt-1 space-y-0.5 font-mono">
                    {validation.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {validation.errors.length > 3 && (
                      <li>...and {validation.errors.length - 3} more errors</li>
                    )}
                  </ul>
                )}
                {validation.isValid && validation.warnings.length > 0 && (
                  <div className="text-[11px] text-[#FFD369] mt-0.5">
                    Note: {validation.warnings[0]}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-[#bbc9ca] self-end sm:self-auto shrink-0">
              <span>Total Load:</span>
              <strong className="text-emerald-400">
                {buses.reduce((acc, b) => acc + (Number(b.pd) || 0), 0).toFixed(1)} MW
              </strong>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER ACTIONS                                                      */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-[#2D333B] bg-[#1f1f22] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#869394]">
            <span className="w-2 h-2 rounded-full bg-[#55d8e1] animate-pulse" />
            <span>PyPOWER AC Newton-Raphson Engine</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#1b1b1e] border border-[#2D333B] text-xs font-semibold text-[#bbc9ca] hover:text-white hover:bg-[#2a2a2d] transition-all"
            >
              Cancel
            </button>

            <button
              onClick={handleSolveAndLaunch}
              disabled={!validation.isValid || isSolving}
              className="px-6 py-2.5 rounded-xl bg-[#55d8e1] text-[#003739] text-xs sm:text-sm font-bold hover:bg-[#55d8e1]/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(85,216,225,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSolving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Solving AC Power Flow...</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-current" />
                  <span>Solve & Launch Digital Twin</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

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
  Plus,
  FileSpreadsheet,
  FileCode2
} from 'lucide-react';

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
  const [modalTab, setModalTab] = useState('tables'); // 'tables' | 'upload'
  const [activeTable, setActiveTable] = useState('buses'); // 'buses' | 'gens' | 'branches' | 'none'
  const [gridName, setGridName] = useState('5-Bus Sample Transmission Grid');
  const [baseMva, setBaseMva] = useState(100.0);
  const [buses, setBuses] = useState(PRESET_TEMPLATES['5bus'].buses);
  const [generators, setGenerators] = useState(PRESET_TEMPLATES['5bus'].generators);
  const [branches, setBranches] = useState(PRESET_TEMPLATES['5bus'].branches);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [solveError, setSolveError] = useState(null);

  const fileInputRef = useRef(null);

  // Topology validation
  const validation = useMemo(() => {
    const errors = [];
    const busIdSet = new Set();
    let slackCount = 0;

    buses.forEach((b, idx) => {
      const bId = Number(b.id);
      if (isNaN(bId) || bId <= 0) {
        errors.push(`Bus #${idx + 1}: Invalid ID.`);
      }
      if (busIdSet.has(bId)) {
        errors.push(`Bus #${idx + 1}: Duplicate ID '${bId}'.`);
      }
      busIdSet.add(bId);

      const bType = String(b.type).toLowerCase();
      if (bType === 'slack' || bType === '3' || bType === 'ref') {
        slackCount++;
      }
    });

    if (buses.length === 0) errors.push('At least 1 bus required.');
    if (slackCount === 0) errors.push('1 Slack bus required.');

    generators.forEach((g) => {
      if (!busIdSet.has(Number(g.bus_id))) {
        errors.push(`Gen ${g.gen_id}: Invalid Bus ID '${g.bus_id}'.`);
      }
    });

    branches.forEach((br, idx) => {
      const f = Number(br.from_bus);
      const t = Number(br.to_bus);
      if (!busIdSet.has(f) || !busIdSet.has(t)) {
        errors.push(`Branch #${idx + 1}: Non-existent bus connection.`);
      }
      if (f === t && f !== 0) {
        errors.push(`Branch #${idx + 1}: Self-loop not permitted.`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [buses, generators, branches]);

  const totalLoadMw = useMemo(() => {
    return buses.reduce((acc, b) => acc + (Number(b.pd) || 0), 0);
  }, [buses]);

  if (!isOpen) return null;

  // Bus Actions
  const handleAddBus = () => {
    const maxId = buses.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0);
    setBuses([...buses, {
      id: maxId + 1,
      type: 'pq',
      pd: 20,
      qd: 5,
      base_kv: 230,
      vm: 1.0,
      va: 0.0,
      vmin: 0.90,
      vmax: 1.10
    }]);
  };

  const handleUpdateBus = (idx, field, val) => {
    const copy = [...buses];
    copy[idx] = { ...copy[idx], [field]: val };
    setBuses(copy);
  };

  const handleDeleteBus = (idx) => {
    setBuses(buses.filter((_, i) => i !== idx));
  };

  // Gen Actions
  const handleAddGen = () => {
    const nextIdx = generators.length + 1;
    const firstBusId = buses[0]?.id || 1;
    setGenerators([...generators, {
      gen_id: `G${nextIdx}`,
      bus_id: firstBusId,
      pg: 50,
      qg: 0,
      vg: 1.02,
      pmax: 150,
      pmin: 0,
      qmax: 80,
      qmin: -50,
      status: 1
    }]);
  };

  const handleUpdateGen = (idx, field, val) => {
    const copy = [...generators];
    copy[idx] = { ...copy[idx], [field]: val };
    setGenerators(copy);
  };

  const handleDeleteGen = (idx) => {
    setGenerators(generators.filter((_, i) => i !== idx));
  };

  // Branch Actions
  const handleAddBranch = () => {
    const fBus = buses[0]?.id || 1;
    const tBus = buses[1]?.id || buses[0]?.id || 2;
    setBranches([...branches, {
      from_bus: fBus,
      to_bus: tBus,
      r: 0.02,
      x: 0.08,
      b: 0.02,
      rate_a: 100,
      tap: 1.0,
      status: 1
    }]);
  };

  const handleUpdateBranch = (idx, field, val) => {
    const copy = [...branches];
    copy[idx] = { ...copy[idx], [field]: val };
    setBranches(copy);
  };

  const handleDeleteBranch = (idx) => {
    setBranches(branches.filter((_, i) => i !== idx));
  };

  // File Upload Handling
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          setUploadFeedback(`Imported "${file.name}".`);
          setModalTab('tables');
        } catch (err) {
          setSolveError(`JSON Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          parseCsvText(text, file.name);
        } catch (err) {
          setSolveError(`CSV Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      setSolveError('Please upload a .json or .csv network file.');
    }
  };

  const parseCsvText = (text, filename) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) throw new Error('CSV file contains no data rows.');

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
      csvContent = "id,type,pd,qd,base_kv,vm,va,vmin,vmax\n" +
        buses.map(b => `${b.id},${b.type},${b.pd},${b.qd},${b.base_kv},${b.vm},${b.va},${b.vmin},${b.vmax}`).join('\n');
      filename = 'buses_template.csv';
    } else if (type === 'gens') {
      csvContent = "gen_id,bus_id,pg,qg,vg,pmax,pmin,qmax,qmin,status\n" +
        generators.map(g => `${g.gen_id},${g.bus_id},${g.pg},${g.qg},${g.vg},${g.pmax},${g.pmin},${g.qmax},${g.qmin},${g.status}`).join('\n');
      filename = 'generators_template.csv';
    } else if (type === 'branches') {
      csvContent = "from_bus,to_bus,r,x,b,rate_a,tap,status\n" +
        branches.map(br => `${br.from_bus},${br.to_bus},${br.r},${br.x},${br.b},${br.rate_a},${br.tap},${br.status}`).join('\n');
      filename = 'branches_template.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Solve and Launch
  const handleSolveAndLaunch = async () => {
    if (!validation.isValid) {
      setSolveError(validation.errors[0] || 'Invalid grid topology.');
      return;
    }

    setIsSolving(true);
    setSolveError(null);

    const payload = {
      name: gridName || 'Custom Grid',
      base_mva: Number(baseMva) || 100.0,
      buses: buses.map(b => ({
        id: Number(b.id),
        type: b.type,
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
        throw new Error(errorData.detail || `Server error ${res.status}`);
      }

      const solvedData = await res.json();
      if (solvedData.summary && solvedData.summary.success === false) {
        throw new Error(solvedData.summary.status_message || 'Power flow diverged.');
      }

      onLaunchCustomGrid(solvedData, gridName);
      onClose();
    } catch (err) {
      console.error('Custom solve error:', err);
      setSolveError(err.message || 'Failed to solve power grid.');
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150 font-sans">
      <div className="bg-[#FAF8F4] border border-[#E3DFD5] rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#1C1B18]">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER (CLEAN & MINIMAL)                                            */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-[#E3DFD5] flex items-center justify-between bg-[#FAF8F4]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
              <PlusCircle size={20} />
            </div>
            <h2 className="text-base font-bold text-[#1C1B18]">
              Custom Network Builder
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#ECE8DF] border border-[#DDD8CD] p-1 rounded-xl gap-1 text-xs">
              <button
                onClick={() => setModalTab('tables')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  modalTab === 'tables'
                    ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                    : 'text-[#5C5950] hover:text-[#1C1B18]'
                }`}
              >
                <Table size={14} />
                <span>Table Editor</span>
              </button>
              <button
                onClick={() => setModalTab('upload')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  modalTab === 'upload'
                    ? 'bg-[#244B43] text-[#FAF8F4] shadow-sm'
                    : 'text-[#5C5950] hover:text-[#1C1B18]'
                }`}
              >
                <Upload size={14} />
                <span>File Import</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#7A766D] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP CONFIG BAR (NO REDUNDANT PRESETS)                                     */}
        {/* ========================================================================= */}
        <div className="px-6 py-2.5 border-b border-[#E3DFD5] bg-[#F4F1EA] flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#7A766D] font-medium">Grid Title:</span>
            <input
              type="text"
              value={gridName}
              onChange={(e) => setGridName(e.target.value)}
              className="bg-[#FAF8F4] border border-[#DDD8CD] text-[#1C1B18] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#244B43] font-semibold w-64"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[#5C5950]">
            <span className="text-[#7A766D]">Base:</span>
            <input
              type="number"
              value={baseMva}
              onChange={(e) => setBaseMva(Number(e.target.value) || 100)}
              className="bg-[#FAF8F4] border border-[#DDD8CD] text-[#244B43] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#244B43] font-mono font-bold w-16 text-center"
            />
            <span>MVA</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY WORKSPACE                                                       */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {uploadFeedback && (
            <div className="p-3 rounded-xl bg-[#E3ECE6] border border-[#A2BEB5] text-[#1E433C] text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#244B43] shrink-0" />
                <span>{uploadFeedback}</span>
              </div>
              <button onClick={() => setUploadFeedback(null)} className="text-[#244B43]">
                <X size={14} />
              </button>
            </div>
          )}

          {solveError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-red-600 shrink-0" />
                <span>{solveError}</span>
              </div>
              <button onClick={() => setSolveError(null)} className="text-red-600">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: 3-CARD TABLE SHEET EDITOR                                          */}
          {/* ========================================================================= */}
          {modalTab === 'tables' && (
            <div className="space-y-4">
              
              {/* Sheet Switcher */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-[#7A766D] uppercase tracking-wider text-[10px]">ACTIVE SHEET:</span>
                  <button
                    onClick={() => setActiveTable('buses')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'buses'
                        ? 'bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5] font-bold'
                        : 'text-[#5C5950] hover:text-[#1C1B18] bg-[#ECE8DF] border border-[#DDD8CD]'
                    }`}
                  >
                    <Network size={14} />
                    <span>Buses Matrix ({buses.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTable('gens')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'gens'
                        ? 'bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5] font-bold'
                        : 'text-[#5C5950] hover:text-[#1C1B18] bg-[#ECE8DF] border border-[#DDD8CD]'
                    }`}
                  >
                    <Zap size={14} className="text-[#A67C33]" />
                    <span>Generators ({generators.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTable('branches')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTable === 'branches'
                        ? 'bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5] font-bold'
                        : 'text-[#5C5950] hover:text-[#1C1B18] bg-[#ECE8DF] border border-[#DDD8CD]'
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
                      ? 'bg-[#E3ECE6] border-[#A2BEB5] text-[#244B43]'
                      : 'bg-[#ECE8DF] border-[#DDD8CD] text-[#5C5950] hover:text-[#1C1B18]'
                  }`}
                >
                  <Columns size={13} />
                  <span>{activeTable === 'none' ? 'Expanded View' : '3-Card Overview'}</span>
                </button>
              </div>

              {/* Dynamic 3-Card Container */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[440px]">
                
                {/* CARD 1: BUSES MATRIX */}
                <div
                  onClick={() => {
                    if (activeTable !== 'buses') setActiveTable('buses');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'buses'
                      ? 'lg:flex-[3.5] border-[#558178] bg-[#FAF8F4] shadow-sm'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#E2DDD2] bg-[#FAF8F4] hover:border-[#558178] cursor-pointer'
                      : 'lg:flex-[0.7] border-[#E2DDD2] bg-[#ECE7DE] hover:border-[#558178] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'buses' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5]">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
                            <Network size={16} />
                          </div>
                          <h3 className="text-sm font-bold text-[#1C1B18]">Buses Matrix</h3>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBus();
                          }}
                          className="bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Bus</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#ECE8DF] text-[#5C5950] font-mono border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
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
                          <tbody className="divide-y divide-[#E3DFD5] font-mono">
                            {buses.map((b, idx) => (
                              <tr key={idx} className="hover:bg-[#F2EFE8] transition-colors">
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    value={b.id}
                                    onChange={(e) => handleUpdateBus(idx, 'id', Number(e.target.value))}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#244B43] font-bold text-center focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 font-sans">
                                  <select
                                    value={String(b.type).toLowerCase()}
                                    onChange={(e) => handleUpdateBus(idx, 'type', e.target.value)}
                                    className={`w-24 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-xs font-semibold focus:border-[#244B43] focus:outline-none cursor-pointer ${
                                      b.type === 'slack' ? 'text-[#244B43] font-bold' : b.type === 'pv' ? 'text-[#A67C33] font-bold' : 'text-[#1C1B18]'
                                    }`}
                                  >
                                    <option value="slack">Slack</option>
                                    <option value="pv">PV</option>
                                    <option value="pq">PQ</option>
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.pd}
                                    onChange={(e) => handleUpdateBus(idx, 'pd', Number(e.target.value))}
                                    className="w-20 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#1C1B18] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.qd}
                                    onChange={(e) => handleUpdateBus(idx, 'qd', Number(e.target.value))}
                                    className="w-20 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.base_kv}
                                    onChange={(e) => handleUpdateBus(idx, 'base_kv', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={b.vm}
                                    onChange={(e) => handleUpdateBus(idx, 'vm', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#244B43] font-semibold focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={b.va}
                                    onChange={(e) => handleUpdateBus(idx, 'va', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={() => handleDeleteBus(idx)}
                                    className="p-1 text-[#9E9A90] hover:text-red-600 rounded transition-colors"
                                  >
                                    <Trash2 size={13} />
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
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43]">
                          <Network size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-[#1C1B18]">Buses</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#DDD8CE] text-[#5C5950]">
                          {buses.length}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#244B43] mb-4 flex items-center gap-1 hover:underline">
                        Expand <ArrowRight size={13} />
                      </span>
                    </div>
                  )}
                </div>

                {/* CARD 2: GENERATORS MATRIX */}
                <div
                  onClick={() => {
                    if (activeTable !== 'gens') setActiveTable('gens');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'gens'
                      ? 'lg:flex-[3.5] border-[#558178] bg-[#FAF8F4] shadow-sm'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#E2DDD2] bg-[#FAF8F4] hover:border-[#558178] cursor-pointer'
                      : 'lg:flex-[0.7] border-[#E2DDD2] bg-[#ECE7DE] hover:border-[#558178] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'gens' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5]">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
                            <Zap size={16} className="text-[#A67C33]" />
                          </div>
                          <h3 className="text-sm font-bold text-[#1C1B18]">Generators</h3>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddGen();
                          }}
                          className="bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Gen</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#ECE8DF] text-[#5C5950] font-mono border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                              <th className="p-2 w-14">Gen ID</th>
                              <th className="p-2 w-16">Bus ID</th>
                              <th className="p-2">Pg (MW)</th>
                              <th className="p-2">Qg (MVAr)</th>
                              <th className="p-2">Vg (p.u.)</th>
                              <th className="p-2">Pmax</th>
                              <th className="p-2">Pmin</th>
                              <th className="p-2">Qmax</th>
                              <th className="p-2">Qmin</th>
                              <th className="p-2 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E3DFD5] font-mono">
                            {generators.map((g, idx) => (
                              <tr key={idx} className="hover:bg-[#F2EFE8] transition-colors">
                                <td className="p-1.5">
                                  <input
                                    type="text"
                                    value={g.gen_id}
                                    onChange={(e) => handleUpdateGen(idx, 'gen_id', e.target.value)}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#244B43] font-bold text-center focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <select
                                    value={g.bus_id}
                                    onChange={(e) => handleUpdateGen(idx, 'bus_id', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-xs font-semibold focus:border-[#244B43] focus:outline-none cursor-pointer"
                                  >
                                    {buses.map(b => (
                                      <option key={b.id} value={b.id}>Bus {b.id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.pg}
                                    onChange={(e) => handleUpdateGen(idx, 'pg', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#A67C33] font-bold focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.qg}
                                    onChange={(e) => handleUpdateGen(idx, 'qg', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={g.vg}
                                    onChange={(e) => handleUpdateGen(idx, 'vg', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#244B43] font-semibold focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.pmax}
                                    onChange={(e) => handleUpdateGen(idx, 'pmax', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#1C1B18] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.pmin}
                                    onChange={(e) => handleUpdateGen(idx, 'pmin', Number(e.target.value))}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.qmax}
                                    onChange={(e) => handleUpdateGen(idx, 'qmax', Number(e.target.value))}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={g.qmin}
                                    onChange={(e) => handleUpdateGen(idx, 'qmin', Number(e.target.value))}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={() => handleDeleteGen(idx)}
                                    className="p-1 text-[#9E9A90] hover:text-red-600 rounded transition-colors"
                                  >
                                    <Trash2 size={13} />
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
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43]">
                          <Zap size={20} className="text-[#A67C33]" />
                        </div>
                        <h4 className="text-xs font-bold text-[#1C1B18]">Generators</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#DDD8CE] text-[#5C5950]">
                          {generators.length}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#244B43] mb-4 flex items-center gap-1 hover:underline">
                        Expand <ArrowRight size={13} />
                      </span>
                    </div>
                  )}
                </div>

                {/* CARD 3: BRANCHES MATRIX */}
                <div
                  onClick={() => {
                    if (activeTable !== 'branches') setActiveTable('branches');
                  }}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                    activeTable === 'branches'
                      ? 'lg:flex-[3.5] border-[#558178] bg-[#FAF8F4] shadow-sm'
                      : activeTable === 'none'
                      ? 'lg:flex-1 border-[#E2DDD2] bg-[#FAF8F4] hover:border-[#558178] cursor-pointer'
                      : 'lg:flex-[0.7] border-[#E2DDD2] bg-[#ECE7DE] hover:border-[#558178] cursor-pointer'
                  }`}
                >
                  {(activeTable === 'branches' || activeTable === 'none') ? (
                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5]">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#E3ECE6] text-[#244B43] border border-[#A2BEB5]">
                            <Sliders size={16} />
                          </div>
                          <h3 className="text-sm font-bold text-[#1C1B18]">Branches</h3>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBranch();
                          }}
                          className="bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} />
                          <span>Add Branch</span>
                        </button>
                      </div>

                      <div className="flex-1 overflow-x-auto overflow-y-auto mt-3 max-h-[360px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#ECE8DF] text-[#5C5950] font-mono border-b border-[#DDD8CD] text-[11px] sticky top-0 z-10">
                              <th className="p-2 w-16">From Bus</th>
                              <th className="p-2 w-16">To Bus</th>
                              <th className="p-2">R (p.u.)</th>
                              <th className="p-2">X (p.u.)</th>
                              <th className="p-2">B (p.u.)</th>
                              <th className="p-2">Rate (MVA)</th>
                              <th className="p-2">Tap</th>
                              <th className="p-2 w-12 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E3DFD5] font-mono">
                            {branches.map((br, idx) => (
                              <tr key={idx} className="hover:bg-[#F2EFE8] transition-colors">
                                <td className="p-1.5">
                                  <select
                                    value={br.from_bus}
                                    onChange={(e) => handleUpdateBranch(idx, 'from_bus', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-xs font-semibold focus:border-[#244B43] focus:outline-none cursor-pointer"
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
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-xs font-semibold focus:border-[#244B43] focus:outline-none cursor-pointer"
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
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={br.x}
                                    onChange={(e) => handleUpdateBranch(idx, 'x', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#244B43] font-bold focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={br.b}
                                    onChange={(e) => handleUpdateBranch(idx, 'b', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={br.rate_a}
                                    onChange={(e) => handleUpdateBranch(idx, 'rate_a', Number(e.target.value))}
                                    className="w-16 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#1C1B18] font-semibold focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={br.tap}
                                    onChange={(e) => handleUpdateBranch(idx, 'tap', Number(e.target.value))}
                                    className="w-14 bg-[#FAF8F4] border border-[#DDD8CD] rounded px-1.5 py-1 text-[#5C5950] focus:border-[#244B43] focus:outline-none"
                                  />
                                </td>
                                <td className="p-1.5 text-center">
                                  <button
                                    onClick={() => handleDeleteBranch(idx)}
                                    className="p-1 text-[#9E9A90] hover:text-red-600 rounded transition-colors"
                                  >
                                    <Trash2 size={13} />
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
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <div className="p-2 rounded-xl bg-[#E3ECE6] text-[#244B43]">
                          <Sliders size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-[#1C1B18]">Branches</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#DDD8CE] text-[#5C5950]">
                          {branches.length}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#244B43] mb-4 flex items-center gap-1 hover:underline">
                        Expand <ArrowRight size={13} />
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FILE IMPORT & COLUMN SPECIFICATION GUIDE                           */}
          {/* ========================================================================= */}
          {modalTab === 'upload' && (
            <div className="space-y-5">
              
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D5CFBF] hover:border-[#558178] bg-[#F4F1EA] hover:bg-[#EAF0EC] rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#E3ECE6] text-[#244B43] flex items-center justify-center mb-2">
                  <Upload size={22} />
                </div>
                <h3 className="text-sm font-bold text-[#1C1B18]">
                  Upload Network Dataset
                </h3>
                <p className="text-xs text-[#7A766D] mt-0.5">
                  Click or drag and drop your .json or .csv files to import.
                </p>
              </div>

              {/* COLUMN SPECIFICATIONS REFERENCE CARDS */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A766D]">
                  Expected Column Specifications & Templates
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  
                  {/* BUSES SPEC */}
                  <div className="p-3.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#1C1B18] flex items-center gap-1.5">
                          <Network size={14} className="text-[#244B43]" />
                          <span>buses.csv</span>
                        </span>
                        <button 
                          onClick={() => handleDownloadSampleCsv('buses')}
                          className="p-1 text-[#244B43] hover:bg-[#E3ECE6] rounded transition-colors"
                          title="Download Template"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className="text-[11px] font-mono bg-[#FAF8F4] border border-[#DDD8CD] p-2 rounded text-[#244B43] leading-relaxed select-all">
                        id, type, pd, qd, base_kv, vm, va, vmin, vmax
                      </div>
                      <p className="text-[10px] text-[#7A766D] mt-1.5">
                        Types: <code className="font-mono">slack</code> (ref), <code className="font-mono">pv</code> (gen), <code className="font-mono">pq</code> (load).
                      </p>
                    </div>
                  </div>

                  {/* GENERATORS SPEC */}
                  <div className="p-3.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#1C1B18] flex items-center gap-1.5">
                          <Zap size={14} className="text-[#A67C33]" />
                          <span>generators.csv</span>
                        </span>
                        <button 
                          onClick={() => handleDownloadSampleCsv('gens')}
                          className="p-1 text-[#244B43] hover:bg-[#E3ECE6] rounded transition-colors"
                          title="Download Template"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className="text-[11px] font-mono bg-[#FAF8F4] border border-[#DDD8CD] p-2 rounded text-[#244B43] leading-relaxed select-all">
                        gen_id, bus_id, pg, qg, vg, pmax, pmin, qmax, qmin, status
                      </div>
                      <p className="text-[10px] text-[#7A766D] mt-1.5">
                        Voltages in p.u., powers in MW / MVAr.
                      </p>
                    </div>
                  </div>

                  {/* BRANCHES SPEC */}
                  <div className="p-3.5 rounded-xl bg-[#ECE8DF] border border-[#DDD8CD] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#1C1B18] flex items-center gap-1.5">
                          <Sliders size={14} className="text-[#244B43]" />
                          <span>branches.csv</span>
                        </span>
                        <button 
                          onClick={() => handleDownloadSampleCsv('branches')}
                          className="p-1 text-[#244B43] hover:bg-[#E3ECE6] rounded transition-colors"
                          title="Download Template"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className="text-[11px] font-mono bg-[#FAF8F4] border border-[#DDD8CD] p-2 rounded text-[#244B43] leading-relaxed select-all">
                        from_bus, to_bus, r, x, b, rate_a, tap, status
                      </div>
                      <p className="text-[10px] text-[#7A766D] mt-1.5">
                        Line impedances in p.u., ratings in MVA.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER                                                              */}
        {/* ========================================================================= */}
        <div className="px-6 py-3 border-t border-[#E3DFD5] bg-[#FAF8F4] flex items-center justify-between gap-3 text-xs">
          <div>
            {validation.isValid ? (
              <div className="flex items-center gap-1.5 text-[#244B43] font-mono text-[11px] font-medium">
                <CheckCircle2 size={14} />
                <span>{buses.length} Buses · {generators.length} Generators · {branches.length} Branches · Load: {totalLoadMw.toFixed(1)} MW</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs">
                <AlertTriangle size={14} />
                <span>{validation.errors[0]}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#5C5950] hover:text-[#1C1B18] hover:bg-[#ECE8DF] transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSolveAndLaunch}
              disabled={isSolving || !validation.isValid}
              className="px-5 py-2 rounded-lg bg-[#244B43] hover:bg-[#1B3B34] text-[#FAF8F4] text-xs font-bold transition-all shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play size={13} fill="currentColor" />
              <span>{isSolving ? 'Solving...' : 'Solve & Launch Digital Twin'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

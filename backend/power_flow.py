import math
import numpy as np
from pypower.api import runpf, ppoption
from typing import Dict, Any, List, Optional

try:
    from backend.load_network import load_case
    from backend.layout_engine import generate_layout
except ImportError:
    from load_network import load_case
    from layout_engine import generate_layout

def clean_num(val: Any, default: float = 0.0, digits: Optional[int] = None) -> float:
    """Safely converts any value to a finite JSON-compliant float, replacing NaN/Inf with default."""
    try:
        if val is None or np.isnan(val) or np.isinf(val):
            return default
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        if digits is not None:
            return round(f, digits)
        return f
    except Exception:
        return default

def solve_and_extract(
    case_id: str, 
    global_scale: float = 1.0, 
    bus_scales: Optional[Dict[Any, float]] = None,
    tripped_branches: Optional[List[Any]] = None
) -> Dict[str, Any]:
    """
    Executes AC Newton-Raphson power flow on the given PyPOWER case_id with optional
    global load scaling, targeted bus-specific load scaling, and transmission line outage contingencies.
    Formats complete telemetry, graph topology, and violation lists for frontend rendering.
    """
    mpc = load_case(case_id)
    
    # 1. Apply Global Load Scale
    if global_scale != 1.0:
        mpc['bus'][:, 2] *= float(global_scale)  # Pd (Active Load MW)
        mpc['bus'][:, 3] *= float(global_scale)  # Qd (Reactive Load MVAr)
        
    # 2. Apply Targeted Bus Load Scales
    if bus_scales:
        for bus_id_key, mult in bus_scales.items():
            try:
                b_id = int(bus_id_key)
                mask = (mpc['bus'][:, 0] == b_id)
                if np.any(mask):
                    mpc['bus'][mask, 2] *= float(mult)
                    mpc['bus'][mask, 3] *= float(mult)
            except (ValueError, TypeError):
                pass

    # 3. Apply Line Outages / Contingency Tripping
    tripped_set = set()
    if tripped_branches:
        for item in tripped_branches:
            if isinstance(item, (int, np.integer)):
                tripped_set.add(f"idx_{item}")
            elif isinstance(item, str):
                tripped_set.add(item.strip())
                parts = item.split('-')
                if len(parts) >= 2:
                    try:
                        f, t = int(parts[0]), int(parts[1])
                        tripped_set.add(f"{f}-{t}")
                        tripped_set.add(f"{t}-{f}")
                    except ValueError:
                        pass
            elif isinstance(item, dict):
                if 'index' in item:
                    tripped_set.add(f"idx_{item['index']}")
                if 'from_bus' in item and 'to_bus' in item:
                    f = int(item['from_bus'])
                    t = int(item['to_bus'])
                    tripped_set.add(f"{f}-{t}")
                    tripped_set.add(f"{t}-{f}")

        for i in range(len(mpc['branch'])):
            f_b = int(mpc['branch'][i, 0])
            t_b = int(mpc['branch'][i, 1])
            edge_id = f"{f_b}-{t_b}-{i}"
            if (
                f"idx_{i}" in tripped_set or 
                f"{f_b}-{t_b}" in tripped_set or 
                f"{t_b}-{f_b}" in tripped_set or 
                edge_id in tripped_set
            ):
                mpc['branch'][i, 10] = 0  # Trip branch out of service (BR_STATUS = 0)

    opts = ppoption(VERBOSE=0, OUT_ALL=0)
    
    # Run AC Power Flow safely wrapped against matrix singularity and electrical islanding
    try:
        solved_mpc, success = runpf(mpc, opts)
    except Exception:
        success = False
        solved_mpc = mpc.copy()
    
    bus_arr = solved_mpc['bus']
    branch_arr = solved_mpc['branch']
    gen_arr = solved_mpc['gen']
    base_mva = clean_num(solved_mpc.get('baseMVA', 100.0), 100.0)
    
    # Generate 2D visual layout coordinates (uses cached topology layout for consistency)
    n_bus = len(bus_arr)
    layout_coords = generate_layout(load_case(case_id)['bus'], load_case(case_id)['branch'], case_id)
    
    # 1. Map Generators to Buses
    gen_map = {}
    for i, g in enumerate(gen_arr):
        gen_bus = int(g[0])
        gen_info = {
            'gen_id': f"G{i+1}",
            'bus_id': gen_bus,
            'pg': clean_num(g[1], 0.0, 2),         # MW
            'qg': clean_num(g[2], 0.0, 2),         # MVAr
            'qmax': clean_num(g[3], 0.0, 2),
            'qmin': clean_num(g[4], 0.0, 2),
            'vg': clean_num(g[5], 1.0, 3),         # p.u.
            'status': int(g[7]) if not np.isnan(g[7]) else 0,
            'pmax': clean_num(g[8], 0.0, 2),
            'pmin': clean_num(g[9], 0.0, 2)
        }
        if gen_bus not in gen_map:
            gen_map[gen_bus] = []
        gen_map[gen_bus].append(gen_info)

    # 2. Extract Buses (Nodes) & Violation List
    nodes = []
    tot_pg = 0.0
    tot_qg = 0.0
    tot_pd = 0.0
    tot_qd = 0.0
    v_violations = 0
    violations_list = []

    # If power flow diverged or islanded, record critical solver alert
    if not bool(success):
        violations_list.append({
            'category': 'Grid AC Divergence (Voltage Collapse / Islanding)',
            'type': 'divergence',
            'element': 'AC Newton-Raphson Solver',
            'value': 'Non-Convergent',
            'limit': 'Line outage or severe overload caused grid islanding or voltage collapse',
            'severity': 'critical'
        })
    
    # Quick lookup map for targeted bus scales
    scaled_buses_set = set()
    if bus_scales:
        for k in bus_scales.keys():
            try:
                scaled_buses_set.add(int(k))
            except (ValueError, TypeError):
                pass

    for idx, row in enumerate(bus_arr):
        bus_id = int(row[0])
        bus_type_raw = int(row[1])
        pd = clean_num(row[2], 0.0, 2)
        qd = clean_num(row[3], 0.0, 2)
        vm = clean_num(row[7], 1.0, 4)   # Voltage magnitude p.u.
        va = clean_num(row[8], 0.0, 2)   # Voltage angle degrees
        base_kv = clean_num(row[9], 138.0)
        vmax = clean_num(row[11], 1.10) if row[11] > 0 else 1.10
        vmin = clean_num(row[12], 0.90) if row[12] > 0 else 0.90
        
        tot_pd += pd
        tot_qd += qd
        
        # Bus classification
        if bus_type_raw == 3:
            bus_type = "slack"
        elif bus_type_raw == 2:
            bus_type = "pv"
        else:
            bus_type = "pq"
            
        gens_at_bus = gen_map.get(bus_id, [])
        bus_pg = sum(g['pg'] for g in gens_at_bus if g['status'] == 1)
        bus_qg = sum(g['qg'] for g in gens_at_bus if g['status'] == 1)
        tot_pg += bus_pg
        tot_qg += bus_qg
        
        # Voltage status — ANSI C84.1 standard operating range
        if vm < 0.85 or vm > 1.15:
            v_status = "critical"
            v_violations += 1
            violations_list.append({
                'category': 'Voltage Violation',
                'type': 'voltage_underflow' if vm < 0.85 else 'voltage_overflow',
                'element': f"Bus {bus_id}",
                'value': f"{vm:.4f} p.u.",
                'limit': "<0.85 / >1.15 p.u.",
                'severity': 'critical'
            })
        elif vm < 0.90 or vm > 1.10:
            v_status = "alert"
            violations_list.append({
                'category': 'Voltage Warning',
                'type': 'voltage_marginal',
                'element': f"Bus {bus_id}",
                'value': f"{vm:.4f} p.u.",
                'limit': "0.90 - 1.10 p.u.",
                'severity': 'alert'
            })
        else:
            v_status = "safe"
            
        pos = layout_coords.get(bus_id, (500.0, 500.0))
        
        # Track multiplier for UI display if targeted
        is_targeted = bus_id in scaled_buses_set
        bus_multiplier = 1.0
        if bus_scales:
            bus_multiplier = clean_num(bus_scales.get(bus_id, bus_scales.get(str(bus_id), 1.0)), 1.0)
        
        nodes.append({
            'id': bus_id,
            'index': idx + 1,
            'label': f"Bus {bus_id}",
            'type': bus_type,
            'vm': vm,
            'va': va,
            'base_kv': base_kv,
            'pd': pd,
            'qd': qd,
            'pg': clean_num(bus_pg, 0.0, 2),
            'qg': clean_num(bus_qg, 0.0, 2),
            'v_status': v_status,
            'vmax': vmax,
            'vmin': vmin,
            'generators': gens_at_bus,
            'is_targeted': is_targeted,
            'load_multiplier': bus_multiplier,
            'x': clean_num(pos[0], 500.0),
            'y': clean_num(pos[1], 500.0)
        })

    # 3. Extract Transmission Lines (Edges)
    edges = []
    line_overloads = 0
    tot_losses_mw = 0.0
    
    for i, row in enumerate(branch_arr):
        f_bus = int(row[0])
        t_bus = int(row[1])
        r = clean_num(row[2], 0.001, 5)
        x = clean_num(row[3], 0.01, 5)
        b = clean_num(row[4], 0.0, 5)
        rate_a = clean_num(row[5], 0.0, 1)
        tap = clean_num(row[8], 1.0) if row[8] != 0 else 1.0
        status = int(row[10]) if not np.isnan(row[10]) else 1
        
        pf = clean_num(row[13], 0.0, 2) if len(row) > 13 else 0.0
        qf = clean_num(row[14], 0.0, 2) if len(row) > 14 else 0.0
        pt = clean_num(row[15], 0.0, 2) if len(row) > 15 else 0.0
        qt = clean_num(row[16], 0.0, 2) if len(row) > 16 else 0.0
        
        s_flow = clean_num(np.sqrt(pf**2 + qf**2), 0.0, 2)
        p_loss = clean_num(abs(pf + pt), 0.0, 2)
        tot_losses_mw += p_loss
        
        is_tripped = (status == 0)
        if is_tripped:
            pf = 0.0
            qf = 0.0
            pt = 0.0
            qt = 0.0
            s_flow = 0.0
            p_loss = 0.0
            loading_pct = 0.0
            line_status = "tripped"
            violations_list.append({
                'category': 'Line Outage (N-1)',
                'type': 'line_tripped',
                'element': f"Line {f_bus} → {t_bus}",
                'value': 'DISCONNECTED (Open Breaker)',
                'limit': 'In-Service',
                'severity': 'alert'
            })
        else:
            if rate_a > 0:
                loading_pct = clean_num((s_flow / rate_a) * 100.0, 0.0, 1)
            else:
                loading_pct = 0.0
                
            if loading_pct > 125.0:
                line_status = "overload"
                line_overloads += 1
                violations_list.append({
                    'category': 'Thermal Overload',
                    'type': 'line_overload',
                    'element': f"Line {f_bus} → {t_bus}",
                    'value': f"{loading_pct:.1f}% ({s_flow:.1f} MVA)",
                    'limit': f"Rate {rate_a} MVA (125%)",
                    'severity': 'critical'
                })
            elif loading_pct > 110.0:
                line_status = "warning"
                violations_list.append({
                    'category': 'Thermal Emergency',
                    'type': 'line_emergency',
                    'element': f"Line {f_bus} → {t_bus}",
                    'value': f"{loading_pct:.1f}% ({s_flow:.1f} MVA)",
                    'limit': f"Rate {rate_a} MVA (110%)",
                    'severity': 'alert'
                })
            else:
                line_status = "normal"
            
        edges.append({
            'id': f"{f_bus}-{t_bus}-{i}",
            'index': i,
            'from_bus': f_bus,
            'to_bus': t_bus,
            'r': r,
            'x': x,
            'b': b,
            'rate_a': rate_a,
            'tap': tap,
            'status': status,
            'is_tripped': is_tripped,
            'pf': pf,
            'qf': qf,
            'pt': pt,
            'qt': qt,
            's_flow': s_flow,
            'p_loss': p_loss,
            'loading_pct': loading_pct,
            'thermal_status': line_status
        })

    # Grid overall health determination (EEQ401 standard security classification)
    if not bool(success) or v_violations > 0 or line_overloads > 0:
        grid_health = "CRITICAL"
    elif any(n['v_status'] == 'alert' for n in nodes) or any(e['thermal_status'] == 'warning' for e in edges):
        grid_health = "ALERT"
    else:
        grid_health = "SAFE"

    # Canvas dimensions must match layout_engine._canvas_params exactly
    if n_bus <= 15:
        canvas_w, canvas_h = 1800.0, 1200.0
    elif n_bus <= 30:
        canvas_w, canvas_h = 2000.0, 1400.0
    elif n_bus <= 45:
        canvas_w, canvas_h = 2800.0, 2000.0
    elif n_bus <= 65:
        canvas_w, canvas_h = 4000.0, 3000.0
    elif n_bus <= 130:
        canvas_w, canvas_h = 6400.0, 4800.0
    else:
        canvas_w, canvas_h = 10000.0, 7500.0

    system_summary = {
        'case_id': case_id,
        'success': bool(success),
        'status_message': "AC Newton-Raphson Converged" if bool(success) else "AC Power Flow Diverged (Voltage Collapse / Islanding)",
        'grid_health': grid_health,
        'global_load_scale': clean_num(global_scale, 1.0, 2),
        'n_bus': n_bus,
        'n_branch': len(edges),
        'n_gen': len(gen_arr),
        'base_mva': base_mva,
        'total_gen_mw': clean_num(tot_pg, 0.0, 2),
        'total_gen_mvar': clean_num(tot_qg, 0.0, 2),
        'total_load_mw': clean_num(tot_pd, 0.0, 2),
        'total_load_mvar': clean_num(tot_qd, 0.0, 2),
        'total_losses_mw': clean_num(tot_losses_mw, 0.0, 2),
        'voltage_violations': v_violations,
        'line_overloads': line_overloads,
        'total_violations_count': len(violations_list),
        'canvas_width': canvas_w,
        'canvas_height': canvas_h
    }

    return {
        'summary': system_summary,
        'nodes': nodes,
        'edges': edges,
        'violations': violations_list
    }

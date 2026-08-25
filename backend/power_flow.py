import numpy as np
from pypower.api import runpf, ppoption
from typing import Dict, Any, List, Optional

try:
    from backend.load_network import load_case
    from backend.layout_engine import generate_layout
except ImportError:
    from load_network import load_case
    from layout_engine import generate_layout

def solve_and_extract(
    case_id: str, 
    global_scale: float = 1.0, 
    bus_scales: Optional[Dict[Any, float]] = None
) -> Dict[str, Any]:
    """
    Executes AC Newton-Raphson power flow on the given PyPOWER case_id with optional
    global load scaling and targeted bus-specific load scaling.
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
            b_id = int(bus_id_key)
            mask = (mpc['bus'][:, 0] == b_id)
            if np.any(mask):
                mpc['bus'][mask, 2] *= float(mult)
                mpc['bus'][mask, 3] *= float(mult)

    opts = ppoption(VERBOSE=0, OUT_ALL=0)
    
    # Run AC Power Flow
    solved_mpc, success = runpf(mpc, opts)
    
    bus_arr = solved_mpc['bus']
    branch_arr = solved_mpc['branch']
    gen_arr = solved_mpc['gen']
    base_mva = float(solved_mpc['baseMVA'])
    
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
            'pg': float(round(g[1], 2)),         # MW
            'qg': float(round(g[2], 2)),         # MVAr
            'qmax': float(round(g[3], 2)),
            'qmin': float(round(g[4], 2)),
            'vg': float(round(g[5], 3)),         # p.u.
            'status': int(g[7]),
            'pmax': float(round(g[8], 2)),
            'pmin': float(round(g[9], 2))
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
    
    # Quick lookup map for targeted bus scales
    scaled_buses_set = set()
    if bus_scales:
        for k in bus_scales.keys():
            try:
                scaled_buses_set.add(int(k))
            except (ValueError, TypeError):
                pass

    for row in bus_arr:
        bus_id = int(row[0])
        bus_type_raw = int(row[1])
        pd = float(round(row[2], 2))
        qd = float(round(row[3], 2))
        vm = float(round(row[7], 4))   # Voltage magnitude p.u.
        va = float(round(row[8], 2))   # Voltage angle degrees
        base_kv = float(row[9])
        vmax = float(row[11]) if row[11] > 0 else 1.10
        vmin = float(row[12]) if row[12] > 0 else 0.90
        
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
        # Normal:   0.90 – 1.10 p.u.
        # Alert:    0.85 – 0.90 or 1.10 – 1.15
        # Critical: < 0.85 or > 1.15
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
            bus_multiplier = float(bus_scales.get(bus_id, bus_scales.get(str(bus_id), 1.0)))
        
        nodes.append({
            'id': bus_id,
            'label': f"Bus {bus_id}",
            'type': bus_type,
            'vm': vm,
            'va': va,
            'base_kv': base_kv,
            'pd': pd,
            'qd': qd,
            'pg': float(round(bus_pg, 2)),
            'qg': float(round(bus_qg, 2)),
            'v_status': v_status,
            'vmax': vmax,
            'vmin': vmin,
            'generators': gens_at_bus,
            'is_targeted': is_targeted,
            'load_multiplier': bus_multiplier,
            'x': pos[0],
            'y': pos[1]
        })

    # 3. Extract Transmission Lines (Edges)
    edges = []
    line_overloads = 0
    tot_losses_mw = 0.0
    
    for i, row in enumerate(branch_arr):
        f_bus = int(row[0])
        t_bus = int(row[1])
        r = float(round(row[2], 5))
        x = float(round(row[3], 5))
        b = float(round(row[4], 5))
        rate_a = float(row[5])
        tap = float(row[8]) if row[8] != 0 else 1.0
        status = int(row[10])
        
        pf = float(round(row[13], 2)) if len(row) > 13 else 0.0
        qf = float(round(row[14], 2)) if len(row) > 14 else 0.0
        pt = float(round(row[15], 2)) if len(row) > 15 else 0.0
        qt = float(round(row[16], 2)) if len(row) > 16 else 0.0
        
        s_flow = float(round(np.sqrt(pf**2 + qf**2), 2))
        p_loss = float(round(abs(pf + pt), 2))
        tot_losses_mw += p_loss
        
        if rate_a > 0:
            loading_pct = float(round((s_flow / rate_a) * 100.0, 1))
        else:
            loading_pct = 0.0
            
        if loading_pct > 120.0:
            line_status = "overload"
            line_overloads += 1
            violations_list.append({
                'category': 'Thermal Overload',
                'type': 'line_overload',
                'element': f"Line {f_bus} → {t_bus}",
                'value': f"{loading_pct:.1f}% ({s_flow:.1f} MVA)",
                'limit': f"Rate {rate_a} MVA (120%)",
                'severity': 'critical'
            })
        elif loading_pct > 100.0:
            line_status = "warning"
            violations_list.append({
                'category': 'Thermal Emergency',
                'type': 'line_emergency',
                'element': f"Line {f_bus} → {t_bus}",
                'value': f"{loading_pct:.1f}% ({s_flow:.1f} MVA)",
                'limit': f"Rate {rate_a} MVA (100%)",
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
        'status_message': "AC Newton-Raphson Converged" if bool(success) else "AC Power Flow Diverged (Voltage Collapse)",
        'grid_health': grid_health,
        'global_load_scale': global_scale,
        'n_bus': n_bus,
        'n_branch': len(edges),
        'n_gen': len(gen_arr),
        'base_mva': base_mva,
        'total_gen_mw': round(tot_pg, 2),
        'total_gen_mvar': round(tot_qg, 2),
        'total_load_mw': round(tot_pd, 2),
        'total_load_mvar': round(tot_qd, 2),
        'total_losses_mw': round(tot_losses_mw, 2),
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

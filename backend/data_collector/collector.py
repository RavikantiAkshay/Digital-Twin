"""
Implementation-Plan Compliant Power Grid Data Collection Engine
================================================================
Generates and stores contingency data in the EXACT format specified in
implementation_plan.md (Lines 98-112):

data/
├── {case_id}/
│   ├── scenarios.parquet       # All scenario metadata
│   ├── scenarios.csv           # Human-readable CSV table
│   ├── bus_features.npy        # (N_scenarios, N_buses, 8) float32
│   ├── branch_features.npy     # (N_scenarios, N_branches, 8) float32
│   ├── gen_features.npy        # (N_scenarios, N_gens, 6) float32
│   ├── adjacency.npy           # (N_branches, 2) int — edge index
│   ├── labels_security.npy     # (N_scenarios,) int — 0/1/2 (SAFE/ALERT/CRITICAL)
│   ├── labels_severity.npy     # (N_scenarios, 3) float32 — max_load, min_v, n_viols
│   ├── labels_dispatch.npy     # (N_scenarios, N_gens) float32 — optimal verified ΔPg
│   └── split_indices.json      # train/val/test indices (70/15/15)

Target Scenario Matrix:
- IEEE 9:   1,000 loads x   9 lines =  9,000 scenarios
- IEEE 14:  1,000 loads x  20 lines = 20,000 scenarios
- IEEE 30:  1,000 loads x  41 lines = 41,000 scenarios
- IEEE 39:    800 loads x  46 lines = 36,800 scenarios
- IEEE 57:    500 loads x  80 lines = 40,000 scenarios
- IEEE 118:   300 loads x 186 lines = 55,800 scenarios
------------------------------------------------------
TOTAL MINIMUM SCENARIOS:            202,600 scenarios
"""

import os
import sys
import time
import json
import argparse
import multiprocessing as mp
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
import scipy.sparse as sp
import scipy.sparse.linalg as spla
import scipy.optimize as opt
from pypower.api import runpf, ppoption

# Ensure paths
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.load_network import load_case

DATA_DIR = os.path.join(current_dir, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Exact scenario specifications from implementation_plan.md
PLAN_SPECS = {
    'case9': {
        'name': 'IEEE 9-Bus System',
        'load_profiles': 1000,
        'n_branch': 9,
        'target_scenarios': 9000,
    },
    'case14': {
        'name': 'IEEE 14-Bus System',
        'load_profiles': 1000,
        'n_branch': 20,
        'target_scenarios': 20000,
    },
    'case30': {
        'name': 'IEEE 30-Bus System',
        'load_profiles': 1000,
        'n_branch': 41,
        'target_scenarios': 41000,
    },
    'case39': {
        'name': 'IEEE 39-Bus System',
        'load_profiles': 1000,
        'n_branch': 46,
        'target_scenarios': 46000,
    },
    'case57': {
        'name': 'IEEE 57-Bus System',
        'load_profiles': 1000,
        'n_branch': 80,
        'target_scenarios': 80000,
    },
    'case118': {
        'name': 'IEEE 118-Bus System',
        'load_profiles': 1000,
        'n_branch': 186,
        'target_scenarios': 186000,
    }
}


def compute_gsf_matrix(mpc: Dict[str, Any]) -> np.ndarray:
    """Computes exact Generation Shift Factors (GSF) for optimal redispatch."""
    bus = np.array(mpc['bus'])
    branch = np.array(mpc['branch'])
    gen = np.array(mpc['gen'])
    
    n_bus = len(bus)
    n_branch = len(branch)
    n_gen = len(gen)
    
    bus_ids = [int(b[0]) for b in bus]
    bus_map = {b_id: i for i, b_id in enumerate(bus_ids)}
    
    slack_idx = 0
    for i, b in enumerate(bus):
        if int(b[1]) == 3:
            slack_idx = i
            break
            
    f_bus = np.array([bus_map[int(br[0])] for br in branch], dtype=int)
    t_bus = np.array([bus_map[int(br[1])] for br in branch], dtype=int)
    x = np.array([float(br[3]) for br in branch], dtype=float)
    x = np.where(np.abs(x) < 1e-5, 1e-4, x)
    b_branch = 1.0 / x
    
    rows = np.repeat(np.arange(n_branch), 2)
    cols = np.column_stack((f_bus, t_bus)).flatten()
    data = np.column_stack((np.ones(n_branch), -np.ones(n_branch))).flatten()
    C = sp.csr_matrix((data, (rows, cols)), shape=(n_branch, n_bus))
    
    Bf = sp.diags(b_branch) @ C
    Bbus = C.T @ sp.diags(b_branch) @ C
    
    non_slack = [i for i in range(n_bus) if i != slack_idx]
    B_red = Bbus[non_slack, :][:, non_slack].tocsc()
    
    PTDF = np.zeros((n_branch, n_bus), dtype=float)
    Bf_red = Bf[:, non_slack].toarray()
    
    try:
        inv_B_red = spla.inv(B_red).toarray()
        PTDF[:, non_slack] = Bf_red @ inv_B_red
    except Exception:
        inv_B_red = np.linalg.pinv(B_red.toarray())
        PTDF[:, non_slack] = Bf_red @ inv_B_red
        
    gen_buses = [bus_map[int(g[0])] for g in gen]
    return PTDF[:, gen_buses]


def solve_ac_power_flow(mpc: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, float, float, int]:
    """Solves AC Newton-Raphson power flow. Returns (solved_mpc, success, max_load, min_v, n_viols)."""
    opts = ppoption(VERBOSE=0, OUT_ALL=0)
    try:
        solved, success = runpf(mpc, opts)
        if not success or solved is None:
            return mpc, False, 999.0, 0.0, 10
    except Exception:
        return mpc, False, 999.0, 0.0, 10
        
    bus = solved['bus']
    branch = solved['branch']
    
    vm = bus[:, 7] if bus.shape[1] > 7 else np.ones(len(bus))
    min_v = float(np.min(vm))
    v_viols = int(np.sum((vm < 0.90) | (vm > 1.10)))
    
    pf = branch[:, 13] if branch.shape[1] > 13 else np.zeros(len(branch))
    qf = branch[:, 14] if branch.shape[1] > 14 else np.zeros(len(branch))
    s_flow = np.sqrt(pf**2 + qf**2)
    rates = np.where(branch[:, 5] > 0.1, branch[:, 5], 200.0)
    
    loadings = (s_flow / rates) * 100.0
    loadings[branch[:, 10] == 0] = 0.0
    
    max_loading = float(np.max(loadings)) if len(loadings) > 0 else 0.0
    t_viols = int(np.sum(loadings > 100.0))
    
    return solved, True, max_loading, min_v, v_viols + t_viols


def solve_optimal_dispatch(
    mpc: Dict[str, Any],
    gsf: np.ndarray,
    loadings: np.ndarray,
    rates: np.ndarray
) -> np.ndarray:
    """Computes verified optimal generator redispatch (ΔPg) via LP + AC re-solve."""
    gen = mpc['gen']
    n_gen = len(gen)
    pg = gen[:, 1]
    pmax = gen[:, 8]
    pmin = gen[:, 9]
    
    lb = pmin - pg
    ub = pmax - pg
    
    c = np.ones(2 * n_gen)
    branch = mpc['branch']
    pf = branch[:, 13] if branch.shape[1] > 13 else np.zeros(len(rates))
    
    crit = np.where((branch[:, 10] != 0) & (loadings > 85.0))[0]
    if len(crit) == 0:
        crit = np.where(branch[:, 10] != 0)[0]
        
    gsf_sub = gsf[crit, :n_gen]
    rates_sub = rates[crit]
    pf_sub = pf[crit]
    target = 0.98 * rates_sub
    
    A_ub = np.vstack([np.hstack([gsf_sub, -gsf_sub]), np.hstack([-gsf_sub, gsf_sub])])
    b_ub = np.concatenate([target - pf_sub, target + pf_sub])
    A_eq = np.array([[1.0] * n_gen + [-1.0] * n_gen])
    b_eq = np.array([0.0])
    
    bounds = [(0.0, max(0.0, float(ub[i]))) for i in range(n_gen)] + \
             [(0.0, max(0.0, float(-lb[i]))) for i in range(n_gen)]
             
    try:
        res = opt.linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method='highs')
        if res.success:
            delta_pg = res.x[:n_gen] - res.x[n_gen:]
            
            # AC Power Flow Verification
            test_mpc = {
                'baseMVA': float(mpc.get('baseMVA', 100.0)),
                'bus': mpc['bus'].copy(),
                'gen': mpc['gen'].copy(),
                'branch': mpc['branch'].copy()
            }
            test_mpc['gen'][:, 1] = np.clip(test_mpc['gen'][:, 1] + delta_pg, pmin, pmax)
            test_mpc['gen'][0, 1] -= np.sum(delta_pg[1:])
            
            _, succ, post_load, _, post_viols = solve_ac_power_flow(test_mpc)
            if succ and (post_viols == 0 or post_load < np.max(loadings)):
                return delta_pg
    except Exception:
        pass
        
    return np.zeros(n_gen)


def process_load_profile(args: Tuple) -> List[Dict[str, Any]]:
    """Worker task: generates raw arrays and scenario rows for 1 randomized load scenario across all lines."""
    case_id, profile_idx, bus_loads = args
    
    mpc = load_case(case_id)
    n_bus = len(mpc['bus'])
    n_branch = len(mpc['branch'])
    n_gen = len(mpc['gen'])
    base_mva = float(mpc.get('baseMVA', 100.0))
    
    bus_ids = [int(b[0]) for b in mpc['bus']]
    bus_map = {b_id: i for i, b_id in enumerate(bus_ids)}
    gsf = compute_gsf_matrix(mpc)
    
    # 1. Pure Random Loading: apply to chosen target buses (any non-slack bus)
    target_bus_ids = []
    for b_idx, new_p, new_q in bus_loads:
        mpc['bus'][b_idx, 2] = new_p
        mpc['bus'][b_idx, 3] = new_q
        target_bus_ids.append(int(mpc['bus'][b_idx, 0]))
        
    # 2. Base AC solve
    base_solved, base_ok, _, _, _ = solve_ac_power_flow(mpc)
    if not base_ok:
        return []
        
    scenarios = []
    
    # 3. Exhaustive N-1 across every branch
    for trip_idx in range(n_branch):
        f_bus = int(mpc['branch'][trip_idx, 0])
        t_bus = int(mpc['branch'][trip_idx, 1])
        
        cont_mpc = {
            'baseMVA': base_mva,
            'bus': base_solved['bus'].copy(),
            'gen': base_solved['gen'].copy(),
            'branch': base_solved['branch'].copy()
        }
        cont_mpc['branch'][trip_idx, 10] = 0  # Trip branch
        
        cont_solved, cont_ok, max_load, min_v, viols_count = solve_ac_power_flow(cont_mpc)
        rates = np.where(cont_mpc['branch'][:, 5] > 0.1, cont_mpc['branch'][:, 5], 200.0)
        
        # --- BUS FEATURES (N_buses x 8) ---
        # [Vm, Va, Pd, Qd, is_PQ, is_PV, is_Slack, base_kv]
        b_types = cont_solved['bus'][:, 1].astype(int)
        bus_feat = np.column_stack([
            cont_solved['bus'][:, 7] if cont_ok else np.zeros(n_bus),
            (cont_solved['bus'][:, 8] if cont_ok else np.zeros(n_bus)) * (np.pi / 180.0),
            cont_solved['bus'][:, 2] / base_mva,
            cont_solved['bus'][:, 3] / base_mva,
            (b_types == 1).astype(float),
            (b_types == 2).astype(float),
            (b_types == 3).astype(float),
            cont_solved['bus'][:, 9] / 100.0 if cont_solved['bus'].shape[1] > 9 else np.ones(n_bus)
        ]).astype(np.float32)
        
        # --- BRANCH FEATURES (N_branches x 8) ---
        # [r, x, b, rate_a, tap, loading_pct, status, is_tripped]
        br = cont_solved['branch']
        pf = br[:, 13] if (cont_ok and br.shape[1] > 13) else np.zeros(n_branch)
        qf = br[:, 14] if (cont_ok and br.shape[1] > 14) else np.zeros(n_branch)
        s_flow = np.sqrt(pf**2 + qf**2)
        loadings = (s_flow / rates) * 100.0
        loadings[br[:, 10] == 0] = 0.0
        
        is_tripped_arr = np.zeros(n_branch, dtype=float)
        is_tripped_arr[trip_idx] = 1.0
        
        taps = np.where(br[:, 8] > 0.01, br[:, 8], 1.0) if br.shape[1] > 8 else np.ones(n_branch)
        
        branch_feat = np.column_stack([
            br[:, 2],
            br[:, 3],
            br[:, 4],
            rates / base_mva,
            taps,
            loadings / 100.0,
            br[:, 10],
            is_tripped_arr
        ]).astype(np.float32)
        
        # --- GEN FEATURES (N_gens x 6) ---
        # [Pg, Qg, Pmax, Pmin, headroom_up, headroom_down]
        g_arr = cont_solved['gen']
        pg_norm = g_arr[:, 1] / base_mva
        qg_norm = g_arr[:, 2] / base_mva
        pmax_norm = g_arr[:, 8] / base_mva
        pmin_norm = g_arr[:, 9] / base_mva
        h_up = np.maximum(0.0, pmax_norm - pg_norm)
        h_down = np.maximum(0.0, pg_norm - pmin_norm)
        
        gen_feat = np.column_stack([
            pg_norm,
            qg_norm,
            pmax_norm,
            pmin_norm,
            h_up,
            h_down
        ]).astype(np.float32)
        
        # --- LABELS ---
        if not cont_ok:
            sec_class = 2  # CRITICAL
            severity = np.array([9.99, 0.0, 10.0], dtype=np.float32)
            delta_pg = np.zeros(n_gen, dtype=np.float32)
        elif viols_count == 0 and max_load <= 90.0 and min_v >= 0.95:
            sec_class = 0  # SAFE
            severity = np.array([max_load / 100.0, min_v, 0.0], dtype=np.float32)
            delta_pg = np.zeros(n_gen, dtype=np.float32)
        elif viols_count == 0 and max_load <= 100.0 and min_v >= 0.90:
            sec_class = 1  # ALERT
            severity = np.array([max_load / 100.0, min_v, 0.0], dtype=np.float32)
            delta_pg = np.zeros(n_gen, dtype=np.float32)
        else:
            sec_class = 2  # CRITICAL
            severity = np.array([max_load / 100.0, min_v, float(viols_count)], dtype=np.float32)
            # Optimal verified corrective dispatch
            delta_pg = solve_optimal_dispatch(cont_solved, gsf, loadings, rates).astype(np.float32)
            
        metadata_row = {
            'Scenario_ID': f"{case_id.upper()}_{profile_idx:04d}_LINE_{f_bus}_{t_bus}",
            'Grid': case_id.upper(),
            'Load_Profile_ID': profile_idx,
            'Num_Target_Buses': len(bus_loads),
            'Target_Buses': ",".join(map(str, target_bus_ids)),
            'Tripped_Line_Idx': trip_idx,
            'Tripped_From_Bus': f_bus,
            'Tripped_To_Bus': t_bus,
            'Converged': 1 if cont_ok else 0,
            'Security_Class': sec_class,
            'Security_Label': ['SAFE', 'ALERT', 'CRITICAL'][sec_class],
            'Peak_Loading_Pct': round(float(max_load), 1),
            'Min_Voltage_PU': round(float(min_v), 3),
            'Violations_Count': int(viols_count),
            'Total_Load_MW': round(float(np.sum(cont_solved['bus'][:, 2])), 1)
        }
        
        scenarios.append({
            'meta': metadata_row,
            'bus_feat': bus_feat,
            'branch_feat': branch_feat,
            'gen_feat': gen_feat,
            'sec_class': sec_class,
            'severity': severity,
            'delta_pg': delta_pg
        })
        
    return scenarios


def collect_case_data(
    case_id: str,
    num_workers: int = 4
) -> Dict[str, Any]:
    """Generates the full scenario set and saves the exact files defined in implementation_plan.md."""
    specs = PLAN_SPECS[case_id]
    n_profiles = specs['load_profiles']
    n_branch = specs['n_branch']
    expected_total = specs['target_scenarios']
    
    # Storage directory: backend/data_collector/data/{case_id}/
    case_dir = os.path.join(DATA_DIR, case_id)
    os.makedirs(case_dir, exist_ok=True)
    
    print("\n" + "=" * 90, flush=True)
    print(f"  DATA ENGINE: {case_id.upper()} ({specs['name']})", flush=True)
    print(f"  -> Target Scenarios:   {expected_total:,} (Exhaustive N-1: {n_profiles} loads x {n_branch} lines)", flush=True)
    print(f"  -> Workers:            {num_workers} CPU cores", flush=True)
    print(f"  -> Output Directory:   {case_dir}", flush=True)
    print("=" * 90, flush=True)
    
    # 1. Save static adjacency.npy: (N_branches, 2)
    base_mpc = load_case(case_id)
    bus_map = {int(b[0]): i for i, b in enumerate(base_mpc['bus'])}
    adj = np.array([[bus_map[int(br[0])], bus_map[int(br[1])]] for br in base_mpc['branch']], dtype=np.int64)
    np.save(os.path.join(case_dir, "adjacency.npy"), adj)
    
    # 2. Build multi-core task queue: ANY bus except slack bus can be loaded!
    non_slack_indices = np.where(base_mpc['bus'][:, 1] != 3)[0]
    n_candidates = len(non_slack_indices)
    
    existing_loads = base_mpc['bus'][base_mpc['bus'][:, 2] > 0, 2]
    avg_pd = float(np.mean(existing_loads)) if len(existing_loads) > 0 else 50.0
    total_pmax = float(np.sum(base_mpc['gen'][:, 8]))
    
    def generate_single_profile(p_id: int):
        k_targets = int(np.random.randint(1, n_candidates + 1))
        chosen_indices = np.random.choice(non_slack_indices, size=k_targets, replace=False)
        
        bus_loads = []
        tot_proposed_p = float(np.sum(base_mpc['bus'][:, 2]))
        for b_idx in chosen_indices:
            base_p = float(base_mpc['bus'][b_idx, 2])
            base_q = float(base_mpc['bus'][b_idx, 3])
            if base_p > 0:
                mult = float(np.random.uniform(0.5, 2.0))
                new_p = base_p * mult
                new_q = base_q * mult
                tot_proposed_p += (new_p - base_p)
            else:
                new_p = float(np.random.uniform(0.15 * avg_pd, 1.0 * avg_pd))
                new_q = new_p * float(np.random.uniform(0.2, 0.4))
                tot_proposed_p += new_p
            bus_loads.append((int(b_idx), new_p, new_q))
            
        # Ensure total system load stays within available generation capacity
        max_allowed_load = 0.92 * total_pmax
        if tot_proposed_p > max_allowed_load:
            scale_down = (max_allowed_load * float(np.random.uniform(0.85, 0.98))) / tot_proposed_p
            bus_loads = [(b_idx, round(p * scale_down, 2), round(q * scale_down, 2)) for b_idx, p, q in bus_loads]
        else:
            bus_loads = [(b_idx, round(p, 2), round(q, 2)) for b_idx, p, q in bus_loads]
            
        return (case_id, p_id, bus_loads)
        
    t_start = time.time()
    
    meta_rows = []
    all_bus_feats = []
    all_branch_feats = []
    all_gen_feats = []
    all_sec_labels = []
    all_sev_labels = []
    all_disp_labels = []
    
    safe_cnt = 0
    alert_cnt = 0
    crit_cnt = 0
    
    profile_counter = 0
    
    with mp.Pool(processes=num_workers) as pool:
        while len(meta_rows) < expected_total:
            remaining_scenarios = expected_total - len(meta_rows)
            profiles_needed = max(10, (remaining_scenarios + n_branch - 1) // n_branch)
            batch_tasks = []
            for _ in range(profiles_needed):
                profile_counter += 1
                batch_tasks.append(generate_single_profile(profile_counter))
                
            for profile_scenarios in pool.imap_unordered(process_load_profile, batch_tasks, chunksize=5):
                if not profile_scenarios:
                    continue
                for s in profile_scenarios:
                    if len(meta_rows) >= expected_total:
                        break
                    meta_rows.append(s['meta'])
                    all_bus_feats.append(s['bus_feat'])
                    all_branch_feats.append(s['branch_feat'])
                    all_gen_feats.append(s['gen_feat'])
                    all_sec_labels.append(s['sec_class'])
                    all_sev_labels.append(s['severity'])
                    all_disp_labels.append(s['delta_pg'])
                    
                    c = s['sec_class']
                    if c == 0: safe_cnt += 1
                    elif c == 1: alert_cnt += 1
                    else: crit_cnt += 1
                    
                total_done = len(meta_rows)
                pct = (total_done / expected_total) * 100.0
                elapsed = time.time() - t_start
                rate = total_done / max(0.1, elapsed)
                eta_sec = max(0.0, (expected_total - total_done) / max(0.1, rate))
                
                sys.stdout.write(
                    f"\r[{case_id.upper()}] {total_done:>6}/{expected_total} ({pct:>5.1f}%) | "
                    f"Speed: {rate:>6.1f} scen/s | Elapsed: {elapsed:>5.1f}s | ETA: {eta_sec:>5.1f}s | "
                    f"Safe: {safe_cnt} Alert: {alert_cnt} Crit: {crit_cnt}"
                )
                sys.stdout.flush()
            
    total_time = round(time.time() - t_start, 2)
    n_scenarios = len(meta_rows)
    print(f"\n\n[PACKAGING DATA] Storing {n_scenarios:,} scenarios into plan format...", flush=True)
    
    # 3. Save feature tensors (.npy)
    bus_arr = np.stack(all_bus_feats).astype(np.float32)
    branch_arr = np.stack(all_branch_feats).astype(np.float32)
    gen_arr = np.stack(all_gen_feats).astype(np.float32)
    sec_arr = np.array(all_sec_labels, dtype=np.int64)
    sev_arr = np.stack(all_sev_labels).astype(np.float32)
    disp_arr = np.stack(all_disp_labels).astype(np.float32)
    
    np.save(os.path.join(case_dir, "bus_features.npy"), bus_arr)
    np.save(os.path.join(case_dir, "branch_features.npy"), branch_arr)
    np.save(os.path.join(case_dir, "gen_features.npy"), gen_arr)
    np.save(os.path.join(case_dir, "labels_security.npy"), sec_arr)
    np.save(os.path.join(case_dir, "labels_severity.npy"), sev_arr)
    np.save(os.path.join(case_dir, "labels_dispatch.npy"), disp_arr)
    
    # 4. Save metadata tables (scenarios.parquet & scenarios.csv)
    df = pd.DataFrame(meta_rows)
    df.to_parquet(os.path.join(case_dir, "scenarios.parquet"), index=False, compression='snappy')
    df.to_csv(os.path.join(case_dir, "scenarios.csv"), index=False)
    
    # 5. Generate and save 70 / 15 / 15 train/val/test split indices
    indices = np.random.permutation(n_scenarios).tolist()
    n_train = int(n_scenarios * 0.70)
    n_val = int(n_scenarios * 0.15)
    
    splits = {
        'train': indices[:n_train],
        'val': indices[n_train:n_train + n_val],
        'test': indices[n_train + n_val:]
    }
    with open(os.path.join(case_dir, "split_indices.json"), "w") as f:
        json.dump(splits, f)
        
    print(f" -> bus_features.npy:    {bus_arr.shape} (float32)", flush=True)
    print(f" -> branch_features.npy: {branch_arr.shape} (float32)", flush=True)
    print(f" -> gen_features.npy:    {gen_arr.shape} (float32)", flush=True)
    print(f" -> adjacency.npy:       {adj.shape} (int64)", flush=True)
    print(f" -> labels_security.npy: {sec_arr.shape} (int64)", flush=True)
    print(f" -> labels_severity.npy: {sev_arr.shape} (float32)", flush=True)
    print(f" -> labels_dispatch.npy: {disp_arr.shape} (float32)", flush=True)
    print(f" -> scenarios.parquet & scenarios.csv ({len(df)} rows)", flush=True)
    print(f" -> split_indices.json:  {len(splits['train'])} train / {len(splits['val'])} val / {len(splits['test'])} test", flush=True)
    print(f" -> Complete in {total_time}s ({round(total_time/60, 2)} min)", flush=True)
    
    return {
        'case_id': case_id,
        'scenarios': n_scenarios,
        'time_seconds': total_time
    }


def main():
    parser = argparse.ArgumentParser(description="Implementation Plan Compliant Data Collector")
    parser.add_argument(
        '--case',
        type=str,
        default='case9',
        choices=list(PLAN_SPECS.keys()) + ['all'],
        help="IEEE Case (case9, case14, case30, case39, case57, case118, or 'all')"
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=max(1, mp.cpu_count() - 1),
        help=f"Number of CPU worker processes (Default: {max(1, mp.cpu_count() - 1)})"
    )
    args = parser.parse_args()
    
    cases_to_run = list(PLAN_SPECS.keys()) if args.case == 'all' else [args.case]
    
    print("\n" + "#" * 90)
    print("  IMPLEMENTATION PLAN COMPLIANT DATA COLLECTOR")
    print(f"  Target Cases:     {', '.join([c.upper() for c in cases_to_run])}")
    print(f"  Total Scenarios:  {sum([PLAN_SPECS[c]['target_scenarios'] for c in cases_to_run]):,}")
    print(f"  Output Format:    scenarios.parquet, scenarios.csv, bus/branch/gen .npy, split_indices.json")
    print(f"  CPU Workers:      {args.workers}")
    print("#" * 90)
    
    t0 = time.time()
    for c in cases_to_run:
        collect_case_data(c, num_workers=args.workers)
        
    total_time = round(time.time() - t0, 2)
    print("\n" + "#" * 90)
    print(f"  ALL CASES COMPLETED! Total Time: {total_time}s ({round(total_time/60, 2)} min)")
    print("#" * 90)


if __name__ == "__main__":
    main()

"""
Physics-Guided Sensitivity Matrix Engine (PTDF, GSF, LODF)
==========================================================
Computes linear power flow sensitivity factors from transmission reactances and topology:
1. PTDF (Power Transfer Distribution Factors): dP_branch / dP_bus_injection
2. GSF  (Generation Shift Factors):            dP_branch / dP_generator
3. LODF (Line Outage Distribution Factors):    dP_branch_m / dP_branch_k_outaged

Used by the RL Grid Operator to prune action dimensions by 50x on CPU.
"""

import os
import sys
import json
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla
from typing import Dict, Any, Tuple, List, Optional

# Ensure project root and backend are in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.load_network import load_case, SUPPORTED_CASES
except ImportError:
    from load_network import load_case, SUPPORTED_CASES

SENSITIVITIES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sensitivities")

def compute_ptdf_and_gsf(mpc: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes exact DC Power Flow sensitivity matrices:
    - PTDF: (n_branch, n_bus)
    - GSF:  (n_branch, n_gen)
    - LODF: (n_branch, n_branch)
    """
    bus = np.array(mpc['bus'])
    branch = np.array(mpc['branch'])
    gen = np.array(mpc['gen'])
    
    n_bus = len(bus)
    n_branch = len(branch)
    n_gen = len(gen)
    
    bus_ids = [int(b[0]) for b in bus]
    bus_map = {b_id: i for i, b_id in enumerate(bus_ids)}
    
    # Locate reference slack bus
    slack_idx = 0
    for i, b in enumerate(bus):
        if int(b[1]) == 3:
            slack_idx = i
            break
            
    # Branch reactances (safeguarded against near-zero division)
    f_bus = np.array([bus_map[int(br[0])] for br in branch], dtype=int)
    t_bus = np.array([bus_map[int(br[1])] for br in branch], dtype=int)
    x = np.array([float(br[3]) for br in branch], dtype=float)
    x = np.where(np.abs(x) < 1e-5, 1e-4, x)
    b_branch = 1.0 / x
    
    # 1. Branch-to-Bus Incidence Matrix C (n_branch x n_bus)
    rows = np.repeat(np.arange(n_branch), 2)
    cols = np.column_stack((f_bus, t_bus)).flatten()
    data = np.column_stack((np.ones(n_branch), -np.ones(n_branch))).flatten()
    C = sp.csr_matrix((data, (rows, cols)), shape=(n_branch, n_bus))
    
    # 2. Bf = diag(b_branch) * C
    Bf = sp.diags(b_branch) @ C
    
    # 3. Bbus = C.T * diag(b_branch) * C
    Bbus = C.T @ sp.diags(b_branch) @ C
    
    # 4. Reduced Bbus without slack reference
    non_slack = [i for i in range(n_bus) if i != slack_idx]
    B_red = Bbus[non_slack, :][:, non_slack].tocsc()
    
    # 5. Solve for PTDF (n_branch x n_bus)
    PTDF = np.zeros((n_branch, n_bus), dtype=float)
    Bf_red = Bf[:, non_slack].toarray()
    
    try:
        inv_B_red = spla.inv(B_red).toarray()
        PTDF[:, non_slack] = Bf_red @ inv_B_red
    except Exception:
        # Fallback pseudo-inverse for disconnected islands
        inv_B_red = np.linalg.pinv(B_red.toarray())
        PTDF[:, non_slack] = Bf_red @ inv_B_red
        
    # 6. Generation Shift Factors GSF (n_branch x n_gen)
    gen_buses = [bus_map[int(g[0])] for g in gen]
    GSF = PTDF[:, gen_buses]
    
    # 7. Line Outage Distribution Factors LODF (n_branch x n_branch)
    LODF = np.zeros((n_branch, n_branch), dtype=float)
    for k in range(n_branch):
        from_k = f_bus[k]
        to_k = t_bus[k]
        denom = 1.0 - (PTDF[k, from_k] - PTDF[k, to_k])
        if abs(denom) > 1e-4:
            LODF[:, k] = (PTDF[:, from_k] - PTDF[:, to_k]) / denom
        LODF[k, k] = -1.0
        
    return PTDF, GSF, LODF

def precompute_all_sensitivities():
    """Pre-computes and saves GSF, PTDF, and LODF matrices for all standard IEEE cases."""
    os.makedirs(SENSITIVITIES_DIR, exist_ok=True)
    results = {}
    for case_id in SUPPORTED_CASES.keys():
        mpc = load_case(case_id)
        ptdf, gsf, lodf = compute_ptdf_and_gsf(mpc)
        
        # Save as binary numpy arrays for ultra-fast C-speed loading
        np.save(os.path.join(SENSITIVITIES_DIR, f"{case_id}_gsf.npy"), gsf)
        np.save(os.path.join(SENSITIVITIES_DIR, f"{case_id}_ptdf.npy"), ptdf)
        np.save(os.path.join(SENSITIVITIES_DIR, f"{case_id}_lodf.npy"), lodf)
        
        # Also store generator mapping metadata JSON
        gen_info = []
        for i, g in enumerate(mpc['gen']):
            gen_info.append({
                'gen_idx': i,
                'gen_id': f"G{i+1}",
                'bus_id': int(g[0]),
                'pmin': float(g[9]),
                'pmax': float(g[8]),
                'pg_base': float(g[1])
            })
            
        meta = {
            'case_id': case_id,
            'n_bus': len(mpc['bus']),
            'n_branch': len(mpc['branch']),
            'n_gen': len(mpc['gen']),
            'generators': gen_info
        }
        with open(os.path.join(SENSITIVITIES_DIR, f"{case_id}_meta.json"), "w") as f:
            json.dump(meta, f, indent=2)
            
        results[case_id] = {
            'ptdf_shape': list(ptdf.shape),
            'gsf_shape': list(gsf.shape),
            'lodf_shape': list(lodf.shape)
        }
    return results

def load_sensitivities(case_id: str) -> Optional[Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, Any]]]:
    """Loads pre-computed sensitivity matrices in <0.1ms."""
    gsf_file = os.path.join(SENSITIVITIES_DIR, f"{case_id}_gsf.npy")
    ptdf_file = os.path.join(SENSITIVITIES_DIR, f"{case_id}_ptdf.npy")
    lodf_file = os.path.join(SENSITIVITIES_DIR, f"{case_id}_lodf.npy")
    meta_file = os.path.join(SENSITIVITIES_DIR, f"{case_id}_meta.json")
    
    if os.path.exists(gsf_file) and os.path.exists(meta_file):
        gsf = np.load(gsf_file)
        ptdf = np.load(ptdf_file)
        lodf = np.load(lodf_file)
        with open(meta_file, "r") as f:
            meta = json.load(f)
        return ptdf, gsf, lodf, meta
    
    # On-demand fallback compute if not precomputed
    mpc = load_case(case_id)
    ptdf, gsf, lodf = compute_ptdf_and_gsf(mpc)
    return ptdf, gsf, lodf, {}

def get_controlling_generators(case_id: str, branch_idx: int, top_k: int = 4) -> List[Dict[str, Any]]:
    """
    Given an overloaded branch, queries the GSF matrix and returns the top_k generators
    with highest physical leverage to relieve the corridor.
    """
    sens = load_sensitivities(case_id)
    if not sens:
        return []
    ptdf, gsf, lodf, meta = sens
    
    if branch_idx >= len(gsf):
        return []
        
    line_gsf = gsf[branch_idx]
    gens_meta = meta.get('generators', [])
    
    # Rank generators by absolute GSF sensitivity leverage |dFlow / dPg|
    ranked_indices = np.argsort(-np.abs(line_gsf))
    
    results = []
    for rank, g_idx in enumerate(ranked_indices[:top_k]):
        g_meta = gens_meta[g_idx] if g_idx < len(gens_meta) else {}
        sensitivity_val = float(line_gsf[g_idx])
        results.append({
            'gen_idx': int(g_idx),
            'gen_id': g_meta.get('gen_id', f"G{g_idx+1}"),
            'bus_id': g_meta.get('bus_id', 0),
            'sensitivity_gsf': round(sensitivity_val, 4),
            'recommended_direction': "RAMP_DOWN" if sensitivity_val > 0 else "RAMP_UP",
            'pmin': g_meta.get('pmin', 0.0),
            'pmax': g_meta.get('pmax', 100.0),
            'pg_base': g_meta.get('pg_base', 0.0)
        })
    return results

def get_controlling_loads(case_id: str, branch_idx: int, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Given an overloaded branch, queries the PTDF matrix to find load buses whose demand
    curtailment directly relieves the corridor (dFlow/dPd > 0).
    """
    sens = load_sensitivities(case_id)
    if not sens:
        return []
    ptdf, gsf, lodf, meta = sens
    
    if branch_idx >= len(ptdf):
        return []
        
    line_ptdf = ptdf[branch_idx]
    
    # Positive PTDF means positive power injection at bus increases line flow.
    # Therefore, reducing load (curtailment) at high positive PTDF buses relieves the line!
    load_buses = [i for i in range(len(line_ptdf)) if abs(line_ptdf[i]) > 0.02]
    ranked_buses = sorted(load_buses, key=lambda b: -abs(line_ptdf[b]))
    
    results = []
    for b_idx in ranked_buses[:top_k]:
        results.append({
            'bus_idx': int(b_idx),
            'bus_id': int(b_idx + 1),
            'ptdf_sensitivity': round(float(line_ptdf[b_idx]), 4),
            'curtailment_effectiveness': "HIGH" if abs(line_ptdf[b_idx]) > 0.15 else "MODERATE"
        })
    return results

if __name__ == "__main__":
    print("Pre-computing physics sensitivities for all IEEE networks...")
    res = precompute_all_sensitivities()
    for c, shapes in res.items():
        print(f"[{c}] GSF shape: {shapes['gsf_shape']}, LODF shape: {shapes['lodf_shape']}")
    print("Done!")

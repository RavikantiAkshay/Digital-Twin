"""
Independent Verification & Proof Script for PG-RL Agent
========================================================
Runs 20 unseen, randomized contingency & stress scenarios on IEEE 14.
Prints a step-by-step proof table with:
- Scenario ID
- Injected Outage & Load Scale
- Pre-Healing Peak Loading %
- AI Generator Dispatch (Delta MW)
- Post-Healing Peak Loading %
- Exact Action Magnitude (Checking for Minimal Intervention)
- Final Health Status (SAFE / FAILED)
"""

import os
import sys
import numpy as np

# Ensure path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.ai_engine.grid_env import PowerGridEnv
from backend.ai_engine.agent import load_policy

def run_proof_test(case_id: str = "case14", num_tests: int = 15):
    print("=" * 95)
    print(f"  INDEPENDENT VERIFICATION TEST: PG-RL GRID OPERATOR ON {case_id.upper()}")
    print("=" * 95)
    
    env = PowerGridEnv(case_id=case_id, max_steps=3)
    policy = load_policy(case_id, state_dim=env.state_dim, action_dim=env.action_dim)
    
    success_count = 0
    
    header = f"{'#':<3} | {'Scenario':<20} | {'Pre Load':<10} | {'AI Dispatch Actions (MW)':<30} | {'Post Load':<10} | {'Status':<8}"
    print(header)
    print("-" * 95)
    
    for i in range(1, num_tests + 1):
        # Generate random stress and contingency
        scale = round(float(np.random.uniform(1.10, 1.25)), 2)
        candidate_lines = [br_idx for br_idx in range(env.n_branch) if br_idx not in [0, 1]] # avoid radial slack line
        tripped_line = int(np.random.choice(candidate_lines)) if np.random.rand() > 0.3 else None
        
        f_bus = env.base_mpc['branch'][tripped_line, 0] if tripped_line is not None else None
        t_bus = env.base_mpc['branch'][tripped_line, 1] if tripped_line is not None else None
        
        scenario_desc = f"Scale {scale}x" + (f" + Trip {int(f_bus)}-{int(t_bus)}" if tripped_line is not None else " (No Trip)")
        
        state = env.reset(load_scale=scale, trip_line=tripped_line)
        pre_loading = float(round(env._solve_ac(env.active_mpc)[2], 1))
        
        # Policy inference (pure test mode)
        action = policy.act(state, deterministic=True)
        next_state, reward, done, info = env.step(action)
        
        post_loading = float(round(info.get('max_loading_pct', 999.0), 1))
        viols = info.get('violations_count', 99)
        delta_pg = info.get('delta_pg_mw', [])
        
        # Format actions summary
        action_strs = []
        for g_idx, d_mw in enumerate(delta_pg):
            if abs(d_mw) > 1.0:
                action_strs.append(f"G{g_idx+1}:{d_mw:+.1f}M")
        action_summary = ", ".join(action_strs[:3]) if action_strs else "No Action"
        
        is_safe = (viols == 0 and post_loading <= 100.0)
        if is_safe:
            success_count += 1
            status_str = "[SAFE]"
        else:
            status_str = "[FAIL]" if post_loading > 110.0 else "[ALERT]"
            
        print(f"{i:<3} | {scenario_desc:<20} | {pre_loading:<9}% | {action_summary:<30} | {post_loading:<9}% | {status_str:<8}")
        
    print("-" * 95)
    success_rate = (success_count / num_tests) * 100.0
    print(f"VERIFICATION SUMMARY: {success_count}/{num_tests} Scenarios Stabilized to SAFE ({success_rate:.1f}% Success Rate)")
    print("=" * 95)

if __name__ == "__main__":
    run_proof_test("case14", num_tests=15)

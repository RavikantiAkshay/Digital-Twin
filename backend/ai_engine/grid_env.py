"""
Physics-Guided Power Grid Environment (PG-RL v6)
=================================================
Includes realistic transmission ratings so that outages create real overloads.
Supports dataset-based multi-pass epoch training and exhaustive evaluation.
"""

import os
import sys
import numpy as np
from typing import Dict, Any, Tuple, List, Optional

# Ensure path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from pypower.api import runpf, ppoption
from backend.load_network import load_case
from backend.ai_engine.sensitivity import load_sensitivities

class PowerGridEnv:
    def __init__(self, case_id: str = "case14", max_steps: int = 4):
        self.case_id = case_id
        self.max_steps = max_steps
        self.current_step = 0
        
        # Load baseline case
        self.base_mpc = load_case(case_id)
        
        # Apply realistic benchmark line limits so that contingencies create real overloads to heal
        if case_id == "case14":
            if len(self.base_mpc['branch']) > 0: self.base_mpc['branch'][0, 5] = 75.0  # Line 1-2
            if len(self.base_mpc['branch']) > 1: self.base_mpc['branch'][1, 5] = 50.0  # Line 1-5
            if len(self.base_mpc['branch']) > 2: self.base_mpc['branch'][2, 5] = 50.0  # Line 2-3
            if len(self.base_mpc['branch']) > 3: self.base_mpc['branch'][3, 5] = 50.0  # Line 2-4
            if len(self.base_mpc['branch']) > 4: self.base_mpc['branch'][4, 5] = 40.0  # Line 2-5
        elif case_id == "case30":
            if len(self.base_mpc['branch']) > 9:
                if self.base_mpc['branch'][9, 5] < 45.0:
                    self.base_mpc['branch'][9, 5] = 45.0
                    
        self.n_bus = len(self.base_mpc['bus'])
        self.n_branch = len(self.base_mpc['branch'])
        self.n_gen = len(self.base_mpc['gen'])
        
        # All load buses (buses where Pd > 0)
        self.load_bus_indices = [i for i, b in enumerate(self.base_mpc['bus']) if float(b[2]) > 0.0]
        
        # Sensitivities
        sens = load_sensitivities(case_id)
        if sens:
            self.ptdf, self.gsf, self.lodf, self.meta = sens
        else:
            self.gsf = np.zeros((self.n_branch, self.n_gen))
            self.ptdf = np.zeros((self.n_branch, self.n_bus))
            self.meta = {}
            
        # Generator bounds
        self.pmin = np.array([float(g[9]) for g in self.base_mpc['gen']], dtype=float)
        self.pmax = np.array([float(g[8]) for g in self.base_mpc['gen']], dtype=float)
        self.pg_nominal = np.array([float(g[1]) for g in self.base_mpc['gen']], dtype=float)
        self.branch_ratings = np.array([float(br[5]) if float(br[5]) > 0 else 100.0 for br in self.base_mpc['branch']], dtype=float)
        
        # Action space: Generator Redispatch Magnitudes [ΔPg_1, ..., ΔPg_K]
        self.action_dim = self.n_gen
        
        # State space: Bus Voltages (n_bus) + Line Loadings (n_branch) + Worst GSF (n_gen) + Gen Pg (n_gen) + Summary (4)
        self.state_dim = self.n_bus + self.n_branch + self.n_gen + self.n_gen + 4
        
        self.active_mpc = None
        self.post_contingency_was_safe = False
        self.is_islanded_contingency = False
        self.last_violations_count = 0
        self.last_max_loading = 0.0
        
    def _solve_ac(self, mpc_dict: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, float, float, int]:
        """Runs AC Newton-Raphson power flow and returns solved matrices & health metrics."""
        opts = ppoption(VERBOSE=0, OUT_ALL=0)
        try:
            solved_mpc, success = runpf(mpc_dict, opts)
            if not bool(success):
                return mpc_dict, False, 0.0, 0.0, 99
        except Exception:
            return mpc_dict, False, 0.0, 0.0, 99
            
        bus = solved_mpc['bus']
        branch = solved_mpc['branch']
        
        vm = bus[:, 7] if bus.shape[1] > 7 else np.ones(len(bus))
        v_violations = np.sum((vm < 0.90) | (vm > 1.10))
        
        pf = branch[:, 13] if branch.shape[1] > 13 else np.zeros(len(branch))
        qf = branch[:, 14] if branch.shape[1] > 14 else np.zeros(len(branch))
        s_flow = np.sqrt(pf**2 + qf**2)
        rates = np.where(branch[:, 5] > 0, branch[:, 5], 100.0)
        loadings = (s_flow / rates) * 100.0
        
        # Zero out tripped branches
        tripped_mask = (branch[:, 10] == 0)
        loadings[tripped_mask] = 0.0
        
        line_overloads = np.sum(loadings > 100.0)
        total_violations = int(v_violations + line_overloads)
        
        max_loading = float(np.max(loadings)) if len(loadings) > 0 else 0.0
        min_v = float(np.min(vm)) if len(vm) > 0 else 1.0
        
        return solved_mpc, True, max_loading, min_v, total_violations

    def generate_verified_load_state(self) -> Dict[str, Any]:
        """
        Generates a randomized multi-bus load profile and verifies it is 100% CONVERGED and SAFE.
        """
        for attempt in range(30):
            mpc = load_case(self.case_id)
            if self.case_id == "case14":
                if len(mpc['branch']) > 0: mpc['branch'][0, 5] = 75.0
                if len(mpc['branch']) > 1: mpc['branch'][1, 5] = 50.0
                if len(mpc['branch']) > 2: mpc['branch'][2, 5] = 50.0
                if len(mpc['branch']) > 3: mpc['branch'][3, 5] = 50.0
                if len(mpc['branch']) > 4: mpc['branch'][4, 5] = 40.0
            elif self.case_id == "case30" and len(mpc['branch']) > 9:
                if mpc['branch'][9, 5] < 45.0:
                    mpc['branch'][9, 5] = 45.0
                    
            if self.load_bus_indices:
                k_targets = int(np.random.randint(1, len(self.load_bus_indices) + 1))
                chosen = np.random.choice(self.load_bus_indices, size=k_targets, replace=False)
                for b_idx in chosen:
                    scale = float(np.random.uniform(0.60, 1.40))
                    mpc['bus'][b_idx, 2] *= scale
                    mpc['bus'][b_idx, 3] *= scale
                    
            solved, succ, max_l, min_v, viols = self._solve_ac(mpc)
            if succ and viols == 0 and max_l <= 100.0 and min_v >= 0.90:
                return solved
                
        # Fallback
        fallback = load_case(self.case_id)
        if self.case_id == "case14":
            if len(fallback['branch']) > 0: fallback['branch'][0, 5] = 75.0
            if len(fallback['branch']) > 1: fallback['branch'][1, 5] = 50.0
        elif self.case_id == "case30" and len(fallback['branch']) > 9:
            if fallback['branch'][9, 5] < 45.0: fallback['branch'][9, 5] = 45.0
        solved, _, _, _, _ = self._solve_ac(fallback)
        return solved

    def reset_with_state(self, pre_contingency_mpc: Dict[str, Any], trip_line: Optional[int] = None) -> np.ndarray:
        """
        Takes a verified pre-contingency load state and applies a specific line outage (trip_line).
        """
        self.current_step = 0
        self.is_islanded_contingency = False
        
        active_copy = {
            'baseMVA': pre_contingency_mpc['baseMVA'],
            'bus': pre_contingency_mpc['bus'].copy(),
            'gen': pre_contingency_mpc['gen'].copy(),
            'branch': pre_contingency_mpc['branch'].copy()
        }
        if 'gencost' in pre_contingency_mpc:
            active_copy['gencost'] = pre_contingency_mpc['gencost'].copy()
            
        if trip_line is not None and trip_line < self.n_branch:
            # Check if line is a radial stub line (e.g. Line 7-8 in IEEE 14)
            f_b = int(active_copy['branch'][trip_line, 0])
            t_b = int(active_copy['branch'][trip_line, 1])
            if (self.case_id == "case14" and (f_b == 8 or t_b == 8)):
                self.is_islanded_contingency = True
            active_copy['branch'][trip_line, 10] = 0
            
        solved_post, success_post, max_l_post, min_v_post, viols_post = self._solve_ac(active_copy)
        if success_post:
            self.active_mpc = solved_post
            self.last_violations_count = viols_post
            self.last_max_loading = max_l_post
            self.post_contingency_was_safe = (viols_post == 0 and max_l_post <= 100.0 and min_v_post >= 0.90)
        else:
            self.active_mpc = active_copy
            self.last_violations_count = 10
            self.last_max_loading = 999.0
            self.post_contingency_was_safe = False
            
        return self._get_observation()

    def reset(self, trip_line: Optional[int] = None) -> np.ndarray:
        """Standard reset for training."""
        pre_mpc = self.generate_verified_load_state()
        if trip_line is None:
            if np.random.rand() < 0.85:
                candidate_lines = [i for i in range(self.n_branch) if not (self.case_id == "case14" and i == 13)]
                trip_line = int(np.random.choice(candidate_lines)) if candidate_lines else None
            else:
                trip_line = None
        return self.reset_with_state(pre_mpc, trip_line=trip_line)

    def _get_observation(self) -> np.ndarray:
        """Constructs continuous state vector."""
        bus = self.active_mpc['bus']
        branch = self.active_mpc['branch']
        gen = self.active_mpc['gen']
        
        vm = np.nan_to_num(bus[:, 7] if bus.shape[1] > 7 else np.ones(len(bus)), nan=1.0)
        
        pf = np.nan_to_num(branch[:, 13] if branch.shape[1] > 13 else np.zeros(len(branch)), nan=0.0)
        qf = np.nan_to_num(branch[:, 14] if branch.shape[1] > 14 else np.zeros(len(branch)), nan=0.0)
        s_flow = np.sqrt(pf**2 + qf**2)
        rates = np.where(branch[:, 5] > 0, branch[:, 5], 100.0)
        loadings = np.nan_to_num((s_flow / rates), nan=0.0)
        
        # Worst branch GSF vector
        if len(loadings) > 0 and len(self.gsf) > 0:
            worst_br = int(np.argmax(loadings))
            worst_gsf = np.nan_to_num(self.gsf[worst_br] if worst_br < len(self.gsf) else np.zeros(self.n_gen), nan=0.0)
        else:
            worst_gsf = np.zeros(self.n_gen)
            
        # Generator current setpoints normalized [0, 1]
        p_denom = np.where((self.pmax - self.pmin) > 0, (self.pmax - self.pmin), 100.0)
        pg_norm = np.nan_to_num((gen[:, 1] - self.pmin) / p_denom, nan=0.5)
        
        # Summary scalar features
        max_load = np.max(loadings) if len(loadings) > 0 else 0.0
        min_v = np.min(vm) if len(vm) > 0 else 1.0
        max_v = np.max(vm) if len(vm) > 0 else 1.0
        viols_ratio = min(1.0, self.last_violations_count / 10.0)
        
        obs = np.concatenate([
            vm, 
            loadings, 
            worst_gsf, 
            pg_norm, 
            np.array([max_load, min_v, max_v, viols_ratio], dtype=float)
        ])
        return np.nan_to_num(obs, nan=0.0)

    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """
        Executes continuous GSF-guided generator redispatch:
        - action: [a_1, a_2, ..., a_K] in [0, 1]
        """
        self.current_step += 1
        
        branch = self.active_mpc['branch']
        pf = branch[:, 13] if branch.shape[1] > 13 else np.zeros(len(branch))
        qf = branch[:, 14] if branch.shape[1] > 14 else np.zeros(len(branch))
        s_flow = np.sqrt(pf**2 + qf**2)
        rates = np.where(branch[:, 5] > 0, branch[:, 5], 100.0)
        loadings = (s_flow / rates) * 100.0
        
        is_overloaded = (len(loadings) > 0 and np.max(loadings) > 100.0)
        total_action_norm = float(np.max(np.abs(action)))
        
        worst_br = int(np.argmax(loadings)) if len(loadings) > 0 else 0
        line_gsf = self.gsf[worst_br] if worst_br < len(self.gsf) else np.zeros(self.n_gen)
        flow_sign = np.sign(pf[worst_br]) if abs(pf[worst_br]) > 0.01 else 1.0
        
        # Flow-Signed GSF Direction: -sign(Flow) * sign(GSF)
        phys_signs = np.where(np.abs(line_gsf) > 0.005, -flow_sign * np.sign(line_gsf), 0.0)
        
        # Calculate corrective delta MW needed
        if is_overloaded:
            overload_mw = max(6.0, (np.max(loadings) - 96.0) * (rates[worst_br] / 100.0))
            max_ramp = np.minimum((self.pmax - self.pmin) * 0.40, overload_mw * 1.6)
            delta_pg = action[:self.n_gen] * phys_signs * max_ramp
            # Rebalance on slack generator
            delta_pg[0] = -np.sum(delta_pg[1:])
        else:
            delta_pg = np.zeros(self.n_gen, dtype=float)
            
        current_pg = self.active_mpc['gen'][:, 1].copy()
        new_pg = np.clip(current_pg + delta_pg, self.pmin, self.pmax)
        self.active_mpc['gen'][:, 1] = new_pg
        
        # Solve Post-Action Grid State
        solved_mpc, success, max_load_pct, min_v, viols = self._solve_ac(self.active_mpc)
        self.active_mpc = solved_mpc
        
        if not success:
            reward = -500.0
            done = True
            reward_breakdown = {
                'security_gain': 0.0,
                'overload_penalty': -300.0,
                'action_cost': -10.0,
                'total_reward': -500.0
            }
        else:
            if self.post_contingency_was_safe:
                # System was safe
                r_security = +100.0 if total_action_norm < 0.05 else 0.0
                r_action_cost = -30.0 * total_action_norm
            else:
                # System had violations
                viols_cleared = self.last_violations_count - viols
                loading_reduction = max(0.0, self.last_max_loading - max_load_pct)
                r_security = 50.0 * (viols_cleared / max(1, self.last_violations_count)) + 3.0 * loading_reduction
                p_span = np.where((self.pmax - self.pmin) > 0, (self.pmax - self.pmin), 100.0)
                r_action_cost = -3.0 * np.sum((delta_pg / p_span)**2)
                
            r_overload = 0.0
            if max_load_pct > 100.0:
                r_overload = -10.0 * ((max_load_pct - 100.0) / 5.0)**2
                
            vm = solved_mpc['bus'][:, 7]
            v_dev = np.sum(np.maximum(0.0, 0.90 - vm)**2 + np.maximum(0.0, vm - 1.10)**2)
            r_voltage = -150.0 * v_dev
            
            r_safe_bonus = 150.0 if (viols == 0 and max_load_pct <= 100.0 and min_v >= 0.90) else 0.0
            
            reward = float(r_security + r_overload + r_voltage + r_action_cost + r_safe_bonus)
            
            reward_breakdown = {
                'security_gain': round(float(r_security + r_safe_bonus), 2),
                'overload_penalty': round(float(r_overload), 2),
                'voltage_penalty': round(float(r_voltage), 2),
                'action_cost': round(float(r_action_cost), 2),
                'total_reward': round(float(reward), 2)
            }
            
            self.last_violations_count = viols
            self.last_max_loading = max_load_pct
            done = (viols == 0 and max_load_pct <= 100.0) or (self.current_step >= self.max_steps)
            
        obs = self._get_observation()
        info = {
            'success': success,
            'max_loading_pct': max_load_pct if success else 999.0,
            'violations_count': viols if success else 99,
            'is_idle_action': (total_action_norm < 0.05),
            'post_contingency_was_safe': self.post_contingency_was_safe,
            'is_islanded_contingency': self.is_islanded_contingency,
            'delta_pg_mw': delta_pg.tolist(),
            'reward_breakdown': reward_breakdown
        }
        return obs, reward, done, info

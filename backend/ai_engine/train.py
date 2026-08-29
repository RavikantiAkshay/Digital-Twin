"""
Deep Epoch-Based Multi-Pass RL Training & Exhaustive Benchmark (PG-RL v6)
=========================================================================
- Trains across multiple passes over 100 Verified Load States x EVERY transmission line.
- Pure Neural Network exploration & training with decaying noise.
- Comprehensive Benchmark logging:
  * Overload Remediation Rate (TP / Total Overloads)
  * Zero-Meddling Specificity (TN / Total Safe)
  * Physically Islanded Outages (e.g. Line 7-8 in IEEE 14)
  * Overall Decision Accuracy
"""

import os
import sys
import json
import time
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import numpy as np
from typing import Dict, Any, List

# Ensure path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.ai_engine.grid_env import PowerGridEnv
from backend.ai_engine.agent import ActorCriticPolicy, save_policy, MODELS_DIR

def train_agent_for_case(
    case_id: str = "case14", 
    epochs: int = 2, 
    num_train_loads: int = 50,
    num_eval_loads: int = 100,
    lr: float = 1e-3, 
    gamma: float = 0.95
) -> Dict[str, Any]:
    """Trains the pure neural policy across multi-pass dataset sweeps and runs exhaustive evaluation."""
    env = PowerGridEnv(case_id=case_id, max_steps=4)
    model = ActorCriticPolicy(state_dim=env.state_dim, action_dim=env.action_dim)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    total_train_episodes = epochs * num_train_loads * env.n_branch
    print(f"\n{'='*90}")
    print(f"  STARTING DEEP MULTI-PASS RL TRAINING: {case_id.upper()}")
    print(f"  Configuration: {epochs} Passes x {num_train_loads} Loads x {env.n_branch} Lines = {total_train_episodes} Total Episodes")
    print(f"{'='*90}")
    t0 = time.time()
    
    # 1. Pre-generate training dataset of verified safe load profiles
    print(f"Generating {num_train_loads} verified pre-contingency load states...")
    train_load_dataset = [env.generate_verified_load_state() for _ in range(num_train_loads)]
    
    episode_rewards = []
    success_history = []
    
    episode_counter = 0
    for epoch in range(1, epochs + 1):
        # Decay exploration noise over epochs
        noise_std = max(0.04, 0.25 * (1.0 - (epoch - 1) / max(1, epochs)))
        
        for load_idx, pre_mpc in enumerate(train_load_dataset):
            for line_idx in range(env.n_branch):
                episode_counter += 1
                state = env.reset_with_state(pre_mpc, trip_line=line_idx)
                ep_reward = 0.0
                
                states_list = []
                actions_list = []
                rewards_list = []
                
                for step in range(env.max_steps):
                    action = model.act(state, deterministic=False, noise_std=noise_std)
                    next_state, reward, done, info = env.step(action)
                    
                    states_list.append(state)
                    actions_list.append(action)
                    rewards_list.append(reward)
                    ep_reward += reward
                    
                    state = next_state
                    if done:
                        break
                        
                # Discounted Returns
                returns = []
                G = 0.0
                for r in reversed(rewards_list):
                    G = r + gamma * G
                    returns.insert(0, G)
                    
                returns_tensor = torch.FloatTensor(returns)
                if len(returns_tensor) > 1:
                    returns_tensor = (returns_tensor - returns_tensor.mean()) / (returns_tensor.std() + 1e-6)
                    
                states_tensor = torch.FloatTensor(np.array(states_list))
                actions_tensor = torch.FloatTensor(np.array(actions_list))
                
                action_means, values = model(states_tensor)
                values = values.squeeze(-1)
                
                advantages = returns_tensor - values.detach()
                actor_loss = ((action_means - actions_tensor)**2).mean() * (-advantages.mean() + 1.0)
                critic_loss = F.mse_loss(values, returns_tensor)
                
                total_loss = actor_loss + 0.5 * critic_loss
                
                optimizer.zero_grad()
                total_loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                
                episode_rewards.append(ep_reward)
                is_healed = (info.get('violations_count', 99) == 0 and info.get('max_loading_pct', 999.0) <= 100.0)
                success_history.append(1 if is_healed else 0)
                
                if episode_counter % 300 == 0 or episode_counter == total_train_episodes:
                    avg_rew = np.mean(episode_rewards[-300:])
                    succ_pct = np.mean(success_history[-300:]) * 100.0
                    print(f"Pass {epoch}/{epochs} | Ep {episode_counter:>4}/{total_train_episodes} (Noise: {noise_std:.2f}) | Avg Reward: {avg_rew:>7.2f} | Running Success: {succ_pct:>5.1f}%")
                    
    # =========================================================================
    # EXHAUSTIVE BENCHMARK EVALUATION (100 Verified Loads x EVERY Line)
    # =========================================================================
    total_eval_scenarios = num_eval_loads * env.n_branch
    print(f"\n--- Running Exhaustive Benchmark: {num_eval_loads} Loads x {env.n_branch} Lines = {total_eval_scenarios} Scenarios ---")
    
    tp = 0         # Overload occurred & agent successfully healed it to SAFE
    tn = 0         # Contingency was safe & agent took NO action (idle)
    fa = 0         # Contingency was safe but agent unnecessarily meddled
    fn = 0         # Overload occurred but agent failed to resolve it
    islanded = 0   # Physically islanded line (e.g. radial generator tie line)
    
    total_overloads = 0
    total_safe = 0
    total_mw_dispatched = []
    
    eval_load_dataset = [env.generate_verified_load_state() for _ in range(num_eval_loads)]
    
    for load_idx, pre_mpc in enumerate(eval_load_dataset):
        for line_idx in range(env.n_branch):
            state = env.reset_with_state(pre_mpc, trip_line=line_idx)
            init_safe = env.post_contingency_was_safe
            is_isl = env.is_islanded_contingency
            
            if is_isl:
                islanded += 1
                
            for _ in range(env.max_steps):
                action = model.act(state, deterministic=True, noise_std=0.0)
                state, _, done, info = env.step(action)
                if done:
                    break
                    
            is_idle = info.get('is_idle_action', False)
            is_safe_final = (info.get('violations_count', 99) == 0 and info.get('max_loading_pct', 999.0) <= 100.0)
            
            mw_shifted = np.sum(np.abs(info.get('delta_pg_mw', [])))
            total_mw_dispatched.append(mw_shifted)
            
            if init_safe:
                total_safe += 1
                if is_idle or mw_shifted < 0.5:
                    tn += 1  # True Negative (Correctly Idle)
                else:
                    fa += 1  # False Alarm (Meddled when not needed)
            else:
                total_overloads += 1
                if is_safe_final:
                    tp += 1  # True Positive (Healed Overload)
                else:
                    fn += 1  # False Negative (Unresolved Overload)
                    
    remediation_rate = round((tp / max(1, total_overloads)) * 100.0, 1)
    zero_meddling_rate = round((tn / max(1, total_safe)) * 100.0, 1)
    overall_accuracy = round(((tp + tn) / total_eval_scenarios) * 100.0, 1)
    avg_mw = round(float(np.mean(total_mw_dispatched)), 2)
    training_time = round(time.time() - t0, 2)
    
    print(f"\n{'='*90}")
    print(f"  EXHAUSTIVE BENCHMARK RESULTS FOR {case_id.upper()} ({total_eval_scenarios} SCENARIOS)")
    print(f"{'='*90}")
    print(f" * OVERLOAD REMEDIATION (When Grid Was Stressed/Overloaded):")
    print(f"   - Total Overload Scenarios Encountered: {total_overloads}")
    print(f"   - Successfully Healed to SAFE (TP):     {tp:>4}/{total_overloads} ({remediation_rate}%)")
    print(f"   - Incomplete / Failed (FN):             {fn:>4}/{total_overloads} ({round(fn/max(1,total_overloads)*100, 1)}%)")
    print(f"\n * ZERO-MEDDLING IDLE ACCURACY (When Grid Was Already Safe):")
    print(f"   - Total Safe Scenarios Encountered:     {total_safe}")
    print(f"   - Correctly Idle / No Action (TN):      {tn:>4}/{total_safe} ({zero_meddling_rate}%)")
    print(f"   - Unnecessary Meddling (FA):            {fa:>4}/{total_safe} ({round(fa/max(1,total_safe)*100, 1)}%)")
    print(f"\n * TOPOLOGICAL CONSTRAINTS:")
    print(f"   - Physically Islanded Stub Outages:     {islanded} (Radial line disconnecting bus)")
    print(f"\n => OVERALL DECISION ACCURACY:             {overall_accuracy}%")
    print(f" => Average Corrective Dispatch:           {avg_mw} MW")
    print(f" => Total Training & Benchmark Time:       {training_time}s")
    print(f"{'='*90}")
    
    metrics = {
        'case_id': case_id,
        'total_evaluated': total_eval_scenarios,
        'num_eval_loads': num_eval_loads,
        'num_branches': env.n_branch,
        'total_overload_scenarios': total_overloads,
        'true_positives_healed': tp,
        'remediation_rate_pct': remediation_rate,
        'total_safe_scenarios': total_safe,
        'true_negatives_idle': tn,
        'zero_meddling_rate_pct': zero_meddling_rate,
        'false_alarms': fa,
        'failures': fn,
        'islanded_outages': islanded,
        'overall_accuracy_pct': overall_accuracy,
        'avg_mw_dispatched': avg_mw,
        'training_time_seconds': training_time,
        'reward_curve': [round(float(r), 2) for r in episode_rewards[::max(1, len(episode_rewards)//20)]],
        'state_dim': env.state_dim,
        'action_dim': env.action_dim
    }
    
    save_policy(model, case_id, metadata=metrics)
    return metrics

def train_focused_cases():
    """Trains and exhaustively benchmarks IEEE 9, IEEE 14, IEEE 30."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    all_metrics = {}
    
    # 1. IEEE 9-Bus (2 Passes x 50 Loads x 9 Lines = 900 Training Episodes | Evaluated on 100 Loads x 9 Lines = 900 Scenarios)
    all_metrics['case9'] = train_agent_for_case("case9", epochs=2, num_train_loads=50, num_eval_loads=100)
    
    # 2. IEEE 14-Bus (2 Passes x 50 Loads x 20 Lines = 2,000 Training Episodes | Evaluated on 100 Loads x 20 Lines = 2,000 Scenarios)
    all_metrics['case14'] = train_agent_for_case("case14", epochs=2, num_train_loads=50, num_eval_loads=100)
    
    # 3. IEEE 30-Bus (2 Passes x 40 Loads x 41 Lines = 3,280 Training Episodes | Evaluated on 50 Loads x 41 Lines = 2,050 Scenarios)
    all_metrics['case30'] = train_agent_for_case("case30", epochs=2, num_train_loads=40, num_eval_loads=50)
    
    metrics_path = os.path.join(MODELS_DIR, "all_evaluation_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
        
    print(f"\n{'='*90}")
    print("  ALL 3 BENCHMARKS COMPLETED (4,950 TOTAL EXHAUSTIVE SCENARIOS EVALUATED)!")
    print(f"{'='*90}")
    return all_metrics

if __name__ == "__main__":
    train_focused_cases()

"""
Pure Physics-Guided Actor-Critic Neural Policy Network (PG-RL v6)
==================================================================
100% Pure Neural Network Inference (No hardcoded bypasses).
The neural network policy learns both:
1. When to remain idle (output ~0) through quadratic action cost regularizers.
2. When to ramp generators to clear active line overloads through GSF sensitivity guidance.
"""

import os
import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, Any, Tuple, List, Optional

# Ensure path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
for p in [root_dir, backend_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

MODELS_DIR = os.path.join(current_dir, "models")

class ActorCriticPolicy(nn.Module):
    def __init__(self, state_dim: int, action_dim: int):
        super(ActorCriticPolicy, self).__init__()
        self.state_dim = state_dim
        self.action_dim = action_dim
        
        # Shared Deep Feature Extractor
        self.shared = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.2),
            nn.Linear(128, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.2)
        )
        
        # Actor Head (Continuous output in [0, 1])
        self.actor = nn.Sequential(
            nn.Linear(128, 64),
            nn.LeakyReLU(0.2),
            nn.Linear(64, action_dim),
            nn.Sigmoid()
        )
        
        # Critic Head (Estimates state security value V(s))
        self.critic = nn.Sequential(
            nn.Linear(128, 64),
            nn.LeakyReLU(0.2),
            nn.Linear(64, 1)
        )
        
    def forward(self, state: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        features = self.shared(state)
        action_magnitudes = self.actor(features)
        value = self.critic(features)
        return action_magnitudes, value
        
    def act(self, state_np: np.ndarray, deterministic: bool = True, noise_std: float = 0.1) -> np.ndarray:
        """100% Pure Neural Network Evaluation without any manual if-condition shortcuts."""
        self.eval()
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state_np).unsqueeze(0)
            action_mean, _ = self.forward(state_tensor)
            action = action_mean.squeeze(0).numpy()
            
            if not deterministic and noise_std > 0.0:
                noise = np.random.normal(0, noise_std, size=action.shape)
                action = np.clip(action + noise, 0.0, 1.0)
            return action

def get_model_path(case_id: str) -> str:
    os.makedirs(MODELS_DIR, exist_ok=True)
    return os.path.join(MODELS_DIR, f"{case_id}_agent.pt")

def save_policy(model: ActorCriticPolicy, case_id: str, metadata: Optional[Dict[str, Any]] = None):
    os.makedirs(MODELS_DIR, exist_ok=True)
    save_path = get_model_path(case_id)
    save_data = {
        'model_state_dict': model.state_dict(),
        'case_id': case_id,
        'metadata': metadata or {}
    }
    torch.save(save_data, save_path)

def load_policy(case_id: str, state_dim: int, action_dim: int) -> Optional[ActorCriticPolicy]:
    model_path = get_model_path(case_id)
    model = ActorCriticPolicy(state_dim, action_dim)
    if os.path.exists(model_path):
        try:
            checkpoint = torch.load(model_path, map_location=torch.device('cpu'))
            model.load_state_dict(checkpoint['model_state_dict'])
            model.eval()
            return model
        except Exception as e:
            print(f"Warning: Failed to load policy for {case_id}: {e}")
    return model

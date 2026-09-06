"""
Heterogeneous Graph Attention Network (HeteroGATNet) for Power System
Security Assessment, Severity Estimation, and Corrective Redispatch.

Key Architecture Features:
  - Heterogeneous nodes: 'bus' and 'gen'
  - Heterogeneous edges: ('bus', 'branch', 'bus'), ('gen', 'connected_to', 'bus'), ('bus', 'has_gen', 'gen')
  - GATv2Conv with edge-feature conditioning on transmission branches
  - Residual connections and LayerNorm for stable deep message passing
  - Multi-task output heads:
      1. Security classification (SAFE / ALERT / CRITICAL)
      2. Corrective dispatch prediction (continuous Delta Pg per generator)
      3. System severity regression ([max_loading, min_voltage, violations_count])
      4. Bus voltage magnitude prediction (per-bus Vm)
  - Completely scale-invariant across any grid size (IEEE 9, 14, 30, 39, 57, 118, 300, etc.)
"""

from typing import Any, Dict, Optional, Tuple, Union
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import HeteroData
from torch_geometric.nn import (
    GATv2Conv,
    HeteroConv,
    global_mean_pool,
    global_max_pool,
)


class BusEncoder(nn.Module):
    """Encodes 8-dimensional bus features into hidden representation."""

    def __init__(self, in_dim: int = 8, hidden_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class GenEncoder(nn.Module):
    """Encodes 6-dimensional generator features into hidden representation."""

    def __init__(self, in_dim: int = 6, hidden_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class BranchEncoder(nn.Module):
    """Encodes 8-dimensional branch edge features into edge representation."""

    def __init__(self, in_dim: int = 8, edge_dim: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, edge_dim),
            nn.LayerNorm(edge_dim),
            nn.LeakyReLU(0.2),
            nn.Linear(edge_dim, edge_dim),
        )

    def forward(self, edge_attr: torch.Tensor) -> torch.Tensor:
        return self.net(edge_attr)


class HeteroGATLayer(nn.Module):
    """
    A single Heterogeneous GATv2 layer with:
      - Message passing on ('bus', 'branch', 'bus') conditioned on edge attributes
      - Bipartite message passing between 'bus' and 'gen'
      - Residual connection, LayerNorm, and Dropout
    """

    def __init__(
        self,
        hidden_dim: int = 64,
        edge_dim: int = 32,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        assert hidden_dim % num_heads == 0, f"hidden_dim ({hidden_dim}) must be divisible by num_heads ({num_heads})"
        head_dim = hidden_dim // num_heads

        self.conv = HeteroConv({
            ('bus', 'branch', 'bus'): GATv2Conv(
                in_channels=hidden_dim,
                out_channels=head_dim,
                heads=num_heads,
                edge_dim=edge_dim,
                concat=True,
                add_self_loops=False,
            ),
            ('gen', 'connected_to', 'bus'): GATv2Conv(
                in_channels=(hidden_dim, hidden_dim),
                out_channels=head_dim,
                heads=num_heads,
                concat=True,
                add_self_loops=False,
            ),
            ('bus', 'has_gen', 'gen'): GATv2Conv(
                in_channels=(hidden_dim, hidden_dim),
                out_channels=head_dim,
                heads=num_heads,
                concat=True,
                add_self_loops=False,
            ),
        }, aggr='sum')

        self.norm_bus = nn.LayerNorm(hidden_dim)
        self.norm_gen = nn.LayerNorm(hidden_dim)
        self.act = nn.LeakyReLU(0.2)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x_dict: Dict[str, torch.Tensor],
        edge_index_dict: Dict[Tuple[str, str, str], torch.Tensor],
        edge_attr_dict: Optional[Dict[Tuple[str, str, str], torch.Tensor]] = None,
    ) -> Dict[str, torch.Tensor]:
        # Perform heterogeneous message passing
        out_dict = self.conv(x_dict, edge_index_dict, edge_attr_dict=edge_attr_dict)

        # Residual + Normalization for bus
        if 'bus' in out_dict:
            h_bus = x_dict['bus'] + self.dropout(self.act(out_dict['bus']))
            out_dict['bus'] = self.norm_bus(h_bus)
        else:
            out_dict['bus'] = x_dict['bus']

        # Residual + Normalization for gen
        if 'gen' in out_dict:
            h_gen = x_dict['gen'] + self.dropout(self.act(out_dict['gen']))
            out_dict['gen'] = self.norm_gen(h_gen)
        else:
            out_dict['gen'] = x_dict['gen']

        return out_dict


class HeteroGATNet(nn.Module):
    """
    Heterogeneous Graph Attention Network for Multi-Task Power System Analysis.

    Inputs:
      HeteroData instance or batch containing:
        - data['bus'].x: (N_bus, 8)
        - data['gen'].x: (N_gen, 6)
        - data['bus', 'branch', 'bus'].edge_index: (2, 2 * N_branch)
        - data['bus', 'branch', 'bus'].edge_attr: (2 * N_branch, 8)
        - data['gen', 'connected_to', 'bus'].edge_index: (2, N_gen)
        - data['bus', 'has_gen', 'gen'].edge_index: (2, N_gen)

    Outputs dict:
      - 'security_logits': (B, 3) raw logits for [SAFE, ALERT, CRITICAL]
      - 'severity': (B, 3) continuous estimates for [max_loading, min_voltage, violations_count]
      - 'dispatch': (N_gen,) continuous scalar Delta Pg per generator
      - 'bus_voltage': (N_bus,) estimated bus voltage magnitude Vm
      - 'graph_embedding': (B, 2 * hidden_dim) pooled global system embedding
    """

    def __init__(
        self,
        bus_in_dim: int = 8,
        gen_in_dim: int = 6,
        branch_in_dim: int = 8,
        hidden_dim: int = 64,
        edge_dim: int = 32,
        num_layers: int = 3,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers

        # 1. Feature Encoders
        self.bus_encoder = BusEncoder(in_dim=bus_in_dim, hidden_dim=hidden_dim, dropout=dropout)
        self.gen_encoder = GenEncoder(in_dim=gen_in_dim, hidden_dim=hidden_dim, dropout=dropout)
        self.branch_encoder = BranchEncoder(in_dim=branch_in_dim, edge_dim=edge_dim)

        # 2. Heterogeneous Message Passing Stack
        self.layers = nn.ModuleList([
            HeteroGATLayer(
                hidden_dim=hidden_dim,
                edge_dim=edge_dim,
                num_heads=num_heads,
                dropout=dropout,
            )
            for _ in range(num_layers)
        ])

        # Global Readout dimension: mean pool + max pool of bus embeddings
        self.readout_dim = 2 * hidden_dim

        # 3. Output Head 1: Security Classifier (SAFE, ALERT, CRITICAL)
        self.classifier_head = nn.Sequential(
            nn.Linear(self.readout_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 3),
        )

        # 4. Output Head 2: Corrective Dispatch Predictor (Delta Pg per gen)
        # Conditioned on local generator embedding + global graph context
        self.dispatch_head = nn.Sequential(
            nn.Linear(hidden_dim + self.readout_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 32),
            nn.LeakyReLU(0.2),
            nn.Linear(32, 1),
        )

        # 5. Output Head 3: System Severity Regressor ([max_loading, min_voltage, violations_count])
        self.severity_head = nn.Sequential(
            nn.Linear(self.readout_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 3),
        )

        # 6. Output Head 4: Per-Bus Voltage Magnitude Prediction (Vm)
        self.voltage_head = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.LeakyReLU(0.2),
            nn.Linear(32, 1),
        )

    def forward(self, data: HeteroData) -> Dict[str, torch.Tensor]:
        # 1. Project input features
        x_dict = {
            'bus': self.bus_encoder(data['bus'].x),
            'gen': self.gen_encoder(data['gen'].x),
        }

        # Project edge features
        edge_attr_branch = self.branch_encoder(data['bus', 'branch', 'bus'].edge_attr)
        edge_attr_dict = {
            ('bus', 'branch', 'bus'): edge_attr_branch,
        }

        edge_index_dict = {
            ('bus', 'branch', 'bus'): data['bus', 'branch', 'bus'].edge_index,
            ('gen', 'connected_to', 'bus'): data['gen', 'connected_to', 'bus'].edge_index,
            ('bus', 'has_gen', 'gen'): data['bus', 'has_gen', 'gen'].edge_index,
        }

        # 2. Multi-layer GATv2 Message Passing
        for layer in self.layers:
            x_dict = layer(x_dict, edge_index_dict, edge_attr_dict=edge_attr_dict)

        h_bus = x_dict['bus']
        h_gen = x_dict['gen']

        # Determine batch assignments for pooling (handles single graphs or PyG batched graphs)
        if hasattr(data['bus'], 'batch') and data['bus'].batch is not None:
            bus_batch = data['bus'].batch
            gen_batch = data['gen'].batch
            batch_size = int(bus_batch.max().item()) + 1
        else:
            bus_batch = torch.zeros(h_bus.size(0), dtype=torch.long, device=h_bus.device)
            gen_batch = torch.zeros(h_gen.size(0), dtype=torch.long, device=h_gen.device)
            batch_size = 1

        # 3. Global System Graph Readout (Bus mean + max pooling)
        bus_mean = global_mean_pool(h_bus, bus_batch, size=batch_size)
        bus_max = global_max_pool(h_bus, bus_batch, size=batch_size)
        h_graph = torch.cat([bus_mean, bus_max], dim=-1)  # (B, 2 * hidden_dim)

        # 4. Head 1: Security Classification
        security_logits = self.classifier_head(h_graph)

        # 5. Head 2: Corrective Dispatch Prediction (per generator)
        # Broadcast global graph context to each generator node
        h_graph_per_gen = h_graph[gen_batch]
        gen_dispatch_features = torch.cat([h_gen, h_graph_per_gen], dim=-1)
        dispatch_pred = self.dispatch_head(gen_dispatch_features).squeeze(-1)  # (N_gen,)

        # 6. Head 3: System Severity Regression
        severity_pred = self.severity_head(h_graph)

        # 7. Head 4: Per-Bus Voltage Magnitude (Vm)
        voltage_pred = self.voltage_head(h_bus).squeeze(-1)  # (N_bus,)

        return {
            'security_logits': security_logits,
            'severity': severity_pred,
            'dispatch': dispatch_pred,
            'bus_voltage': voltage_pred,
            'graph_embedding': h_graph,
            'bus_embeddings': h_bus,
            'gen_embeddings': h_gen,
        }

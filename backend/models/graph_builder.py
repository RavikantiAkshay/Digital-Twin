"""
Power Grid Heterogeneous Graph Builder for PyG (PyTorch Geometric).

Converts either pre-collected numpy scenario arrays or live PyPOWER case
dictionaries into standardized PyG HeteroData graphs for HeteroGATNet.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import torch
from torch_geometric.data import HeteroData


class HeteroGraphBuilder:
    """
    Constructs PyTorch Geometric HeteroData objects from:
      1. Stored numpy arrays (dataset scenarios)
      2. In-memory PyPOWER case dictionaries (online/inference)

    Graph Schema:
      Node Types:
        - 'bus': features shape (N_bus, 8)
            [Vm, Va, Pd, Qd, is_PQ, is_PV, is_Slack, base_kv_norm]
        - 'gen': features shape (N_gen, 6)
            [Pg_norm, Qg_norm, Pmax, Pmin, headroom_up, headroom_down]

      Edge Types:
        - ('bus', 'branch', 'bus'): transmission lines & transformers
            edge_index: (2, 2 * N_branch) (bidirectional)
            edge_attr: (2 * N_branch, 8)
            [r, x, b, rate_a, tap, loading_pct, status, is_tripped]
        - ('gen', 'connected_to', 'bus'): generator injection point
            edge_index: (2, N_gen)
        - ('bus', 'has_gen', 'gen'): reverse generator connection
            edge_index: (2, N_gen)
    """

    @staticmethod
    def from_numpy(
        bus_feat: np.ndarray,
        branch_feat: np.ndarray,
        gen_feat: np.ndarray,
        adjacency: np.ndarray,
        gen_buses: Union[List[int], np.ndarray],
        sec_label: Optional[int] = None,
        sev_label: Optional[np.ndarray] = None,
        disp_label: Optional[np.ndarray] = None,
        base_mva: float = 100.0,
    ) -> HeteroData:
        """
        Builds a HeteroData graph from pre-extracted numpy arrays.

        Args:
            bus_feat: (N_bus, 8) float array
            branch_feat: (N_branch, 8) float array
            gen_feat: (N_gen, 6) float array
            adjacency: (N_branch, 2) int array of [from_bus_idx, to_bus_idx]
            gen_buses: (N_gen,) int array of bus indices where generators reside
            sec_label: optional security class scalar (0=SAFE, 1=ALERT, 2=CRITICAL)
            sev_label: optional severity vector (3,) [max_loading, min_v, n_viols]
            disp_label: optional corrective dispatch vector (N_gen,) [delta_Pg]

        Returns:
            HeteroData object ready for PyTorch / PyG batching and inference.
        """
        data = HeteroData()

        # 1. Bus nodes
        data["bus"].x = torch.from_numpy(np.array(bus_feat, dtype=np.float32, copy=True))

        # 2. Generator nodes
        data["gen"].x = torch.from_numpy(np.array(gen_feat, dtype=np.float32, copy=True))

        # 3. Transmission branch edges (bidirectional for electrical power flow)
        adj_arr = np.array(adjacency, dtype=np.int64, copy=True)
        n_branch = len(adj_arr)

        f_bus = adj_arr[:, 0]
        t_bus = adj_arr[:, 1]

        # Bidirectional edge index: [f -> t, t -> f]
        edge_index_forward = np.column_stack((f_bus, t_bus)).T
        edge_index_reverse = np.column_stack((t_bus, f_bus)).T
        edge_index_branch = np.concatenate([edge_index_forward, edge_index_reverse], axis=1)

        # Duplicate edge attributes for both directions
        br_feat = np.array(branch_feat, dtype=np.float32, copy=True)
        edge_attr_branch = np.concatenate([br_feat, br_feat], axis=0)

        data["bus", "branch", "bus"].edge_index = torch.from_numpy(edge_index_branch).long()
        data["bus", "branch", "bus"].edge_attr = torch.from_numpy(edge_attr_branch).float()

        # 4. Generator to Bus connections (bipartite)
        gen_indices = np.arange(len(gen_buses), dtype=np.int64)
        bus_indices = np.array(gen_buses, dtype=np.int64, copy=True)

        edge_gen_to_bus = np.stack([gen_indices, bus_indices], axis=0)
        edge_bus_to_gen = np.stack([bus_indices, gen_indices], axis=0)

        data["gen", "connected_to", "bus"].edge_index = torch.from_numpy(edge_gen_to_bus).long()
        data["bus", "has_gen", "gen"].edge_index = torch.from_numpy(edge_bus_to_gen).long()

        # 5. Optional target labels
        if sec_label is not None:
            data.y_security = torch.tensor(int(sec_label), dtype=torch.long)

        if sev_label is not None:
            sev_tensor = torch.from_numpy(np.array(sev_label, dtype=np.float32, copy=True)).float()
            if sev_tensor.dim() == 1:
                sev_tensor = sev_tensor.unsqueeze(0)
            data.y_severity = sev_tensor

        if disp_label is not None:
            d_arr = np.array(disp_label, dtype=np.float32, copy=True)
            # If dispatch is provided in MW (> 10.0), normalize to p.u. (consistent with gen_features)
            if np.max(np.abs(d_arr)) > 10.0:
                d_arr = d_arr / float(base_mva)
            data.y_dispatch = torch.from_numpy(d_arr).float()

        return data

    @staticmethod
    def from_mpc(
        mpc: Dict[str, Any],
        tripped_branch_idx: Optional[int] = None,
        is_converged: bool = True,
        sec_label: Optional[int] = None,
        sev_label: Optional[np.ndarray] = None,
        disp_label: Optional[np.ndarray] = None,
    ) -> HeteroData:
        """
        Builds a HeteroData graph directly from a PyPOWER case dictionary (mpc).
        Used during online inference, user-interactive testing, or auto-heal workflows.

        Args:
            mpc: PyPOWER dictionary containing 'bus', 'branch', 'gen', 'baseMVA'
            tripped_branch_idx: Index of branch tripped (N-1), if any
            is_converged: Whether power flow converged
            sec_label, sev_label, disp_label: Optional ground truth labels

        Returns:
            HeteroData object
        """
        bus = np.array(mpc["bus"])
        branch = np.array(mpc["branch"])
        gen = np.array(mpc["gen"])
        base_mva = float(mpc.get("baseMVA", 100.0))

        n_bus = len(bus)
        n_branch = len(branch)
        n_gen = len(gen)

        bus_ids = [int(b[0]) for b in bus]
        bus_map = {b_id: i for i, b_id in enumerate(bus_ids)}

        # 1. Bus Features (N_bus, 8)
        # [Vm, Va, Pd, Qd, is_PQ, is_PV, is_Slack, base_kv_norm]
        b_types = bus[:, 1].astype(int)
        vm = bus[:, 7] if is_converged else np.zeros(n_bus)
        va = (bus[:, 8] if is_converged else np.zeros(n_bus)) * (np.pi / 180.0)
        pd_norm = bus[:, 2] / base_mva
        qd_norm = bus[:, 3] / base_mva
        is_pq = (b_types == 1).astype(float)
        is_pv = (b_types == 2).astype(float)
        is_slack = (b_types == 3).astype(float)
        base_kv = bus[:, 9] / 100.0 if bus.shape[1] > 9 else np.ones(n_bus)

        bus_feat = np.column_stack([
            vm, va, pd_norm, qd_norm, is_pq, is_pv, is_slack, base_kv
        ]).astype(np.float32)

        # 2. Branch Features (N_branch, 8)
        # [r, x, b, rate_a, tap, loading_pct, status, is_tripped]
        rates = np.where(branch[:, 5] > 0.1, branch[:, 5], 200.0)
        pf = branch[:, 13] if (is_converged and branch.shape[1] > 13) else np.zeros(n_branch)
        qf = branch[:, 14] if (is_converged and branch.shape[1] > 14) else np.zeros(n_branch)
        s_flow = np.sqrt(pf**2 + qf**2)
        loadings = (s_flow / rates) * 100.0
        loadings[branch[:, 10] == 0] = 0.0

        is_tripped_arr = np.zeros(n_branch, dtype=float)
        if tripped_branch_idx is not None and 0 <= tripped_branch_idx < n_branch:
            is_tripped_arr[tripped_branch_idx] = 1.0

        taps = np.where(branch[:, 8] > 0.01, branch[:, 8], 1.0) if branch.shape[1] > 8 else np.ones(n_branch)

        branch_feat = np.column_stack([
            branch[:, 2],
            branch[:, 3],
            branch[:, 4],
            rates / base_mva,
            taps,
            loadings / 100.0,
            branch[:, 10],
            is_tripped_arr
        ]).astype(np.float32)

        # 3. Gen Features (N_gen, 6)
        # [Pg, Qg, Pmax, Pmin, headroom_up, headroom_down]
        pg_norm = gen[:, 1] / base_mva
        qg_norm = gen[:, 2] / base_mva
        pmax_norm = gen[:, 8] / base_mva
        pmin_norm = gen[:, 9] / base_mva
        h_up = np.maximum(0.0, pmax_norm - pg_norm)
        h_down = np.maximum(0.0, pg_norm - pmin_norm)

        gen_feat = np.column_stack([
            pg_norm, qg_norm, pmax_norm, pmin_norm, h_up, h_down
        ]).astype(np.float32)

        # 4. Topologies
        adjacency = np.array([[bus_map[int(br[0])], bus_map[int(br[1])]] for br in branch], dtype=np.int64)
        gen_buses = np.array([bus_map[int(g[0])] for g in gen], dtype=np.int64)

        return HeteroGraphBuilder.from_numpy(
            bus_feat=bus_feat,
            branch_feat=branch_feat,
            gen_feat=gen_feat,
            adjacency=adjacency,
            gen_buses=gen_buses,
            sec_label=sec_label,
            sev_label=sev_label,
            disp_label=disp_label,
        )

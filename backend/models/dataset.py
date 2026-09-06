"""
PyTorch / PyG Dataset Loader for Power Grid Contingency Scenarios.

Loads pre-collected multi-grid contingency datasets, handles memory-mapped
storage for ultra-fast I/O, manages train/val/test splits, and computes
exact class-balancing weights for PhysicsInformedLoss.
"""

import os
import json
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import torch
from torch.utils.data import Dataset
from torch_geometric.data import HeteroData

from backend.data_collector.collector import load_case
from backend.models.graph_builder import HeteroGraphBuilder


class PowerGridDataset(Dataset):
    """
    Dataset for loading power grid contingency scenarios into PyG HeteroData objects.

    Args:
        case_id: Name of grid case (e.g., 'case9', 'case14', 'case30', 'case39', 'case57', 'case118')
        split: One of 'train', 'val', 'test', or 'all'
        data_dir: Base directory containing collected grid folders
        cache_in_ram: If True and dataset fits comfortably, loads arrays into memory for max speed
    """

    def __init__(
        self,
        case_id: str,
        split: str = 'train',
        data_dir: str = 'backend/data_collector/data',
        cache_in_ram: bool = False,
    ):
        super().__init__()
        self.case_id = case_id.lower()
        self.split = split.lower()
        self.case_dir = os.path.join(data_dir, self.case_id)

        if not os.path.exists(self.case_dir):
            raise FileNotFoundError(f"Case directory not found: {self.case_dir}")

        # 1. Load topology & generator bus mappings
        self.adjacency = np.load(os.path.join(self.case_dir, "adjacency.npy"))
        mpc = load_case(self.case_id)
        self.base_mva = float(mpc.get('baseMVA', 100.0))
        bus_ids = [int(b[0]) for b in mpc['bus']]
        bus_map = {b_id: i for i, b_id in enumerate(bus_ids)}
        self.gen_buses = np.array([bus_map[int(g[0])] for g in mpc['gen']], dtype=np.int64)

        # 2. Memory-mapped array handles (instant zero-copy disk access)
        mmap = None if cache_in_ram else 'r'
        self.bus_features = np.load(os.path.join(self.case_dir, "bus_features.npy"), mmap_mode=mmap)
        self.branch_features = np.load(os.path.join(self.case_dir, "branch_features.npy"), mmap_mode=mmap)
        self.gen_features = np.load(os.path.join(self.case_dir, "gen_features.npy"), mmap_mode=mmap)
        self.labels_security = np.load(os.path.join(self.case_dir, "labels_security.npy"), mmap_mode=mmap)
        self.labels_severity = np.load(os.path.join(self.case_dir, "labels_severity.npy"), mmap_mode=mmap)
        self.labels_dispatch = np.load(os.path.join(self.case_dir, "labels_dispatch.npy"), mmap_mode=mmap)

        self.total_scenarios = len(self.labels_security)

        # 3. Split Indices
        split_path = os.path.join(self.case_dir, "split_indices.json")
        if os.path.exists(split_path):
            with open(split_path, 'r') as f:
                split_dict = json.load(f)
            if self.split in split_dict:
                self.indices = np.array(split_dict[self.split], dtype=np.int64)
            elif self.split == 'all':
                self.indices = np.arange(self.total_scenarios, dtype=np.int64)
            else:
                raise ValueError(f"Unknown split '{self.split}'. Options: {list(split_dict.keys())} or 'all'")
        else:
            # Fallback 70/15/15 deterministic split if json not found
            perm = np.random.RandomState(42).permutation(self.total_scenarios)
            n_tr = int(self.total_scenarios * 0.70)
            n_va = int(self.total_scenarios * 0.15)
            if self.split == 'train':
                self.indices = perm[:n_tr]
            elif self.split == 'val':
                self.indices = perm[n_tr:n_tr + n_va]
            elif self.split == 'test':
                self.indices = perm[n_tr + n_va:]
            else:
                self.indices = perm

        # 4. Compute Class Weights for Security Cross-Entropy
        # w_c = Total / (3 * count_c)
        train_sec_labels = self.labels_security[self.indices] if self.split == 'train' else self.labels_security
        counts = np.bincount(train_sec_labels, minlength=3)
        total_samples = len(train_sec_labels)
        weights = total_samples / (3.0 * np.maximum(counts, 1.0))
        self.class_weights = torch.tensor(weights, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> HeteroData:
        real_idx = int(self.indices[idx])

        return HeteroGraphBuilder.from_numpy(
            bus_feat=self.bus_features[real_idx],
            branch_feat=self.branch_features[real_idx],
            gen_feat=self.gen_features[real_idx],
            adjacency=self.adjacency,
            gen_buses=self.gen_buses,
            sec_label=int(self.labels_security[real_idx]),
            sev_label=self.labels_severity[real_idx],
            disp_label=self.labels_dispatch[real_idx],
            base_mva=self.base_mva,
        )

    def get_class_weights(self) -> torch.Tensor:
        """Returns pre-calculated class weights tensor for CrossEntropyLoss."""
        return self.class_weights


class MultiGridDataset(Dataset):
    """
    Unified cross-grid dataset that pools and balances contingency scenarios
    across multiple power networks (e.g. IEEE 9, 14, 30, 39, 57, 118).

    Enforces scale invariance during training so the GNN learns generalizable AC physics
    rather than memorizing specific bus numbers or static topologies.
    """

    DEFAULT_CASES = ['case9', 'case14', 'case30', 'case39', 'case57', 'case118']

    def __init__(
        self,
        cases: Optional[List[str]] = None,
        split: str = 'train',
        data_dir: str = 'backend/data_collector/data',
        max_per_case: Optional[int] = None,
    ):
        super().__init__()
        self.cases = [c.lower() for c in (cases or self.DEFAULT_CASES)]
        self.split = split.lower()
        self.data_dir = data_dir

        self.datasets: List[PowerGridDataset] = []
        self.case_offsets: List[Tuple[int, int, PowerGridDataset]] = []
        total_len = 0

        # Collect datasets
        for case_id in self.cases:
            try:
                ds = PowerGridDataset(case_id, split=self.split, data_dir=self.data_dir)
                # If max_per_case is set, limit the number of scenarios to balance grids
                if max_per_case is not None and len(ds) > max_per_case:
                    ds.indices = ds.indices[:max_per_case]

                start_idx = total_len
                end_idx = total_len + len(ds)
                self.case_offsets.append((start_idx, end_idx, ds))
                total_len = end_idx
                self.datasets.append(ds)
            except Exception as e:
                print(f"[MultiGridDataset] Warning: could not load {case_id} ({e})", flush=True)

        self.total_len = total_len

        # Compute aggregate class weights across all sub-datasets
        all_train_labels = []
        for ds in self.datasets:
            all_train_labels.append(ds.labels_security[ds.indices])
        if len(all_train_labels) > 0:
            concat_labels = np.concatenate(all_train_labels)
            counts = np.bincount(concat_labels, minlength=3)
            total = len(concat_labels)
            weights = total / (3.0 * np.maximum(counts, 1.0))
            self.class_weights = torch.tensor(weights, dtype=torch.float32)
        else:
            self.class_weights = torch.tensor([1.0, 1.0, 1.0], dtype=torch.float32)

    def __len__(self) -> int:
        return self.total_len

    def __getitem__(self, idx: int) -> HeteroData:
        for start_idx, end_idx, ds in self.case_offsets:
            if start_idx <= idx < end_idx:
                return ds[idx - start_idx]
        raise IndexError(f"Index {idx} out of range for MultiGridDataset (len={self.total_len})")

    def get_class_weights(self) -> torch.Tensor:
        return self.class_weights

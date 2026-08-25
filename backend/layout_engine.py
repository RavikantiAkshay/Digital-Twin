"""
Topology-Aware Layout Engine for IEEE Power System Visualisation.

This engine analyses the electrical graph structure of each bus:
  - Node degree (how many branches connect to it)
  - Adjacency (which buses it connects to)
  - Electrical distance (branch impedance as edge weight)

It uses a multi-phase approach:
  1. Spectral initialisation — uses graph Laplacian eigenvectors to find a
     natural 2D embedding that respects the graph's global structure.
  2. Weighted spring refinement — Fruchterman-Reingold with impedance-based
     edge weights so electrically close buses are placed near each other.
  3. Degree-proportional spacing — high-degree (hub) nodes get more breathing
     room by increasing their personal repulsion radius.
  4. Overlap elimination — fast vectorised force repulsion ensures no two
     nodes are closer than min_dist.
  5. In-memory caching — repeated requests return instantly.
"""

import numpy as np
import networkx as nx
from typing import Dict, Tuple
import math

# ─────────────────────── Hand-tuned presets for small IEEE cases ───────────────────────

IEEE9_PRESET = {
    1: (150, 150), 2: (850, 150), 3: (500, 750), 4: (350, 300),
    5: (350, 600), 6: (650, 600), 7: (650, 300), 8: (500, 150), 9: (500, 450)
}

IEEE14_PRESET = {
    1: (100, 300), 2: (250, 150), 3: (450, 100), 4: (300, 350), 5: (200, 450),
    6: (600, 150), 7: (500, 400), 8: (650, 450), 9: (750, 350), 10: (850, 250),
    11: (750, 150), 12: (900, 150), 13: (950, 300), 14: (900, 450)
}

IEEE30_PRESET = {
    1: (100, 200), 2: (200, 150), 3: (200, 300), 4: (300, 250), 5: (200, 450),
    6: (350, 350), 7: (300, 450), 8: (450, 450), 9: (500, 300), 10: (600, 350),
    11: (650, 200), 12: (550, 150), 13: (650, 100), 14: (750, 150), 15: (750, 250),
    16: (700, 350), 17: (750, 400), 18: (850, 400), 19: (850, 450), 20: (800, 500),
    21: (700, 500), 22: (650, 550), 23: (600, 500), 24: (650, 450), 25: (500, 600),
    26: (450, 650), 27: (400, 550), 28: (350, 500), 29: (300, 650), 30: (250, 600)
}

PRESETS = {'case9': IEEE9_PRESET, 'case14': IEEE14_PRESET, 'case30': IEEE30_PRESET}

# ─────────────────────── In-memory layout cache ───────────────────────

LAYOUT_CACHE: Dict[str, Dict[int, Tuple[float, float]]] = {}

# ─────────────────────── Canvas sizing per network scale ───────────────────────

def _canvas_params(n_buses: int):
    """Returns (width, height, padding, min_node_distance) tuned per grid size."""
    if n_buses <= 15:
        return 1800.0, 1200.0, 120.0, 160.0
    elif n_buses <= 30:
        return 2000.0, 1400.0, 130.0, 150.0
    elif n_buses <= 45:
        return 2800.0, 2000.0, 160.0, 160.0
    elif n_buses <= 65:
        return 4000.0, 3000.0, 200.0, 180.0
    elif n_buses <= 130:
        return 6400.0, 4800.0, 280.0, 190.0
    else:
        return 10000.0, 7500.0, 350.0, 190.0

# ─────────────────────── Core layout algorithm ───────────────────────

def generate_layout(bus_matrix: np.ndarray, branch_matrix: np.ndarray, case_id: str) -> Dict[int, Tuple[float, float]]:
    """
    Generate visually clean (x, y) coordinates for every bus in a power system.

    Algorithm:
      Phase 1 — Build a weighted NetworkX graph.  Edge weight = 1 / |Z| (inverse
                impedance), so electrically close buses attract each other.
      Phase 2 — Compute a spectral layout (Laplacian eigenvectors) to get an
                initial 2D embedding that respects the graph's global structure.
      Phase 3 — Refine with weighted Fruchterman-Reingold spring layout, using
                the spectral positions as starting points and a high k-factor
                for generous spacing.
      Phase 4 — Degree-proportional force repulsion: each node's personal space
                is proportional to its degree, so hub nodes push neighbours
                further away.
      Phase 5 — Boundary clamping and caching.
    """
    if case_id in LAYOUT_CACHE:
        return LAYOUT_CACHE[case_id]

    bus_ids = [int(b[0]) for b in bus_matrix]
    n_buses = len(bus_ids)
    width, height, padding, min_dist = _canvas_params(n_buses)

    # ── Use preset if available ──
    preset = PRESETS.get(case_id)
    if preset is not None and all(bid in preset for bid in bus_ids):
        result = _rescale_preset(preset, bus_ids, width, height, padding)
        LAYOUT_CACHE[case_id] = result
        return result

    # ═══════════════════════════════════════════════════════════════════
    # Phase 1: Build weighted graph
    # ═══════════════════════════════════════════════════════════════════
    G = nx.Graph()
    for bid in bus_ids:
        G.add_node(bid)

    for br in branch_matrix:
        f_bus, t_bus = int(br[0]), int(br[1])
        status = int(br[10])
        if status == 0:
            continue
        # Edge weight = inverse impedance magnitude.
        # Electrically close buses (low impedance) get high weight → placed closer.
        r, x = float(br[2]), float(br[3])
        z_mag = math.sqrt(r * r + x * x)
        weight = 1.0 / max(z_mag, 1e-6)
        # If edge already exists (parallel lines), keep the higher weight
        if G.has_edge(f_bus, t_bus):
            G[f_bus][t_bus]['weight'] = max(G[f_bus][t_bus]['weight'], weight)
        else:
            G.add_edge(f_bus, t_bus, weight=weight)

    degrees = dict(G.degree())
    max_degree = max(degrees.values()) if degrees else 1

    # ═══════════════════════════════════════════════════════════════════
    # Phase 2: Spectral layout for initial positions
    # ═══════════════════════════════════════════════════════════════════
    try:
        spectral_pos = nx.spectral_layout(G, weight='weight')
    except Exception:
        spectral_pos = {bid: (np.random.rand(), np.random.rand()) for bid in bus_ids}

    # ═══════════════════════════════════════════════════════════════════
    # Phase 3: Weighted spring refinement (Fruchterman-Reingold)
    # ═══════════════════════════════════════════════════════════════════
    # High k = more spacing between connected nodes
    k_factor = 10.0 / math.sqrt(n_buses)
    raw_pos = nx.spring_layout(
        G,
        pos=spectral_pos,  # start from spectral (preserves global structure)
        k=k_factor,
        iterations=150,
        weight='weight',
        seed=42
    )

    # ═══════════════════════════════════════════════════════════════════
    # Phase 4: Scale to canvas + degree-proportional force repulsion
    # ═══════════════════════════════════════════════════════════════════
    # Scale raw_pos from [-1,1] range to [padding, width-padding]
    xs = np.array([raw_pos[bid][0] for bid in bus_ids])
    ys = np.array([raw_pos[bid][1] for bid in bus_ids])

    x_min, x_max = xs.min(), xs.max()
    y_min, y_max = ys.min(), ys.max()
    x_span = max(x_max - x_min, 1e-6)
    y_span = max(y_max - y_min, 1e-6)

    coords = np.zeros((n_buses, 2))
    for i, bid in enumerate(bus_ids):
        coords[i, 0] = padding + ((xs[i] - x_min) / x_span) * (width - 2 * padding)
        coords[i, 1] = padding + ((ys[i] - y_min) / y_span) * (height - 2 * padding)

    # Compute per-node minimum distance based on degree
    # Hub nodes (high degree) need more space around them
    node_min_dists = np.array([
        min_dist * (1.0 + 0.4 * (degrees.get(bid, 1) / max_degree))
        for bid in bus_ids
    ])

    # Force repulsion iterations
    n_iters = 50 if n_buses <= 120 else 35
    for iteration in range(n_iters):
        moved = False
        for i in range(n_buses):
            diffs = coords[i] - coords[i + 1:]
            dists = np.linalg.norm(diffs, axis=1)

            for ci in range(len(dists)):
                j = i + 1 + ci
                # Required distance is the max of both nodes' personal spaces
                required = max(node_min_dists[i], node_min_dists[j])
                if dists[ci] < required:
                    moved = True
                    d = dists[ci]
                    diff = diffs[ci]
                    if d < 0.01:
                        # Nearly coincident — deterministic jitter
                        diff = np.array([float((i * 7 + j * 13) % 17) - 8.0,
                                         float((i * 11 + j * 3) % 13) - 6.0])
                        d = np.linalg.norm(diff)
                    overlap = required - d
                    direction = diff / d
                    push = direction * (overlap * 0.55)
                    coords[i] += push
                    coords[j] -= push
        if not moved:
            break

    # ═══════════════════════════════════════════════════════════════════
    # Phase 5: Boundary clamping + cache
    # ═══════════════════════════════════════════════════════════════════
    # After repulsion, nodes may have been pushed outside canvas.
    # Re-scale to fit within bounds while preserving relative positions.
    x_vals = coords[:, 0]
    y_vals = coords[:, 1]

    actual_x_min, actual_x_max = x_vals.min(), x_vals.max()
    actual_y_min, actual_y_max = y_vals.min(), y_vals.max()
    actual_x_span = max(actual_x_max - actual_x_min, 1e-6)
    actual_y_span = max(actual_y_max - actual_y_min, 1e-6)

    # Only re-scale if nodes went outside bounds
    if actual_x_min < padding or actual_x_max > width - padding or \
       actual_y_min < padding or actual_y_max > height - padding:
        for i in range(n_buses):
            coords[i, 0] = padding + ((coords[i, 0] - actual_x_min) / actual_x_span) * (width - 2 * padding)
            coords[i, 1] = padding + ((coords[i, 1] - actual_y_min) / actual_y_span) * (height - 2 * padding)

    final = {}
    for i, bid in enumerate(bus_ids):
        final[bid] = (round(float(coords[i, 0]), 2), round(float(coords[i, 1]), 2))

    LAYOUT_CACHE[case_id] = final
    return final


# ─────────────────────── Helpers ───────────────────────

def _rescale_preset(preset, bus_ids, width, height, padding):
    """Rescale hand-tuned coordinates to fit the current canvas."""
    raw_xs = [preset[bid][0] for bid in bus_ids]
    raw_ys = [preset[bid][1] for bid in bus_ids]
    min_x, max_x = min(raw_xs), max(raw_xs)
    min_y, max_y = min(raw_ys), max(raw_ys)
    dx = max((max_x - min_x), 1.0)
    dy = max((max_y - min_y), 1.0)

    result = {}
    for bid in bus_ids:
        rx, ry = preset[bid]
        nx_val = padding + ((rx - min_x) / dx) * (width - 2 * padding)
        ny_val = padding + ((ry - min_y) / dy) * (height - 2 * padding)
        result[bid] = (round(nx_val, 2), round(ny_val, 2))
    return result

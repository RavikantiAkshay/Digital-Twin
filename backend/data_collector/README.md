# Power Grid Data Collector — Implementation Plan Compliant

Generates contingency datasets stored in the **exact directory structure and format** defined in [`implementation_plan.md`](file:///C:/Users/Akshay/.gemini/antigravity-ide/brain/1c95e501-eb6c-4bdf-9764-0ebf1d8592d4/implementation_plan.md) (Lines 98–112):

```
backend/data_collector/data/
└── {case_id}/
    ├── scenarios.parquet       # All scenario metadata (compressed, high-speed loading)
    ├── scenarios.csv           # Human-readable CSV table (view in Excel / VS Code)
    ├── bus_features.npy        # (N_scenarios, N_buses, 8) float32
    ├── branch_features.npy     # (N_scenarios, N_branches, 8) float32
    ├── gen_features.npy        # (N_scenarios, N_gens, 6) float32
    ├── adjacency.npy           # (N_branches, 2) int64 — topology edge index
    ├── labels_security.npy     # (N_scenarios,) int64 — 0=SAFE, 1=ALERT, 2=CRITICAL
    ├── labels_severity.npy     # (N_scenarios, 3) float32 — [max_load, min_v, n_viols]
    ├── labels_dispatch.npy     # (N_scenarios, N_gens) float32 — optimal verified ΔPg
    └── split_indices.json      # train/val/test indices (70% / 15% / 15% split)
```

---

## 🎯 Target Scenario Counts (Exhaustive N-1)

| Network | Load Variations | Lines Outaged per Load | Total Scenarios |
|---|---|---|---|
| **IEEE 9** | 1,000 | 9 (All lines) | **9,000** |
| **IEEE 14** | 1,000 | 20 (All lines) | **20,000** |
| **IEEE 30** | 1,000 | 41 (All lines) | **41,000** |
| **IEEE 39** | 800 | 46 (All lines) | **36,800** |
| **IEEE 57** | 500 | 80 (All lines) | **40,000** |
| **IEEE 118** | 300 | 186 (All lines) | **55,800** |
| **TOTAL** | | | **202,600+** |

## 🔬 How Loading Scenarios Are Generated (Random Targets Across Grid)

* **Slack Bus Protected**: The reference slack bus is never loaded directly.
* **Any Other Bus Can Be Loaded**: Every non-slack bus (PQ buses, transmission junction buses like 4, 6, 8, or generator buses) is eligible.
* **Random Target Count**: Anywhere from 1 bus up to all non-slack buses are randomly selected per scenario.
* **Random Injection Amount**:
  - Buses with existing base load: scaled randomly between $0.5\times$ and $2.5\times$.
  - Buses with 0 base load (switching junctions): injected with realistic random power demand.
* **Exhaustive N-1**: Under each random load combination, every single transmission line is tripped one by one to solve the resulting AC power flow.

### 1. `bus_features.npy` — Shape: `(N, N_buses, 8)` float32
For each scenario and each bus:
* `Vm`: Voltage magnitude (p.u.)
* `Va`: Voltage angle (radians)
* `Pd`: Active load ($P_d / \text{baseMVA}$)
* `Qd`: Reactive load ($Q_d / \text{baseMVA}$)
* `is_PQ`: One-hot flag ($1.0$ if PQ load bus)
* `is_PV`: One-hot flag ($1.0$ if PV generator bus)
* `is_Slack`: One-hot flag ($1.0$ if Slack reference bus)
* `base_kv`: Base kV normalized ($\text{kV} / 100$)

### 2. `branch_features.npy` — Shape: `(N, N_branches, 8)` float32
For each scenario and each transmission branch:
* `r`: Resistance (p.u.)
* `x`: Reactance (p.u.)
* `b`: Susceptance (p.u.)
* `rate_a`: Thermal MVA rating normalized ($\text{Rate} / \text{baseMVA}$)
* `tap`: Transformer tap ratio (1.0 for lines)
* `loading_pct`: Solved loading fraction ($S_{\text{flow}} / \text{Rate}$)
* `status`: In-service status ($1.0$ = closed, $0.0$ = open/tripped)
* `is_tripped`: Outage indicator flag ($1.0$ if this line was outaged)

### 3. `gen_features.npy` — Shape: `(N, N_gens, 6)` float32
For each scenario and each generator:
* `Pg`: Active power generation ($P_g / \text{baseMVA}$)
* `Qg`: Reactive power generation ($Q_g / \text{baseMVA}$)
* `Pmax`: Maximum active capacity ($P_{\max} / \text{baseMVA}$)
* `Pmin`: Minimum active capacity ($P_{\min} / \text{baseMVA}$)
* `headroom_up`: Available upward ramp capacity ($(P_{\max} - P_g) / \text{baseMVA}$)
* `headroom_down`: Available downward ramp capacity ($(P_g - P_{\min}) / \text{baseMVA}$)

### 4. `adjacency.npy` — Shape: `(N_branches, 2)` int64
Static grid topology edge list: `[from_bus_idx, to_bus_idx]` (0-indexed).

### 5. `labels_security.npy` — Shape: `(N,)` int64
Classification target:
* `0`: **SAFE** (no overloads, voltages in $0.95 - 1.05$ p.u., loadings $\le 90\%$)
* `1`: **ALERT** (no overloads, voltages in $0.90 - 0.95$ p.u. or loadings in $90\% - 100\%$)
* `2`: **CRITICAL** (thermal overloads $>100\%$ or voltage $<0.90$ / $>1.10$ p.u., or islanded)

### 6. `labels_severity.npy` — Shape: `(N, 3)` float32
Regression continuous targets:
* Column 0: `max_loading_ratio` ($S_{\max} / \text{Rate}$)
* Column 1: `min_voltage_pu` (lowest bus voltage in p.u.)
* Column 2: `violations_count` (number of active thermal + voltage violations)

### 7. `labels_dispatch.npy` — Shape: `(N, N_gens)` float32
Optimal corrective generator redispatch $\Delta P_g$ (MW) verified by full AC Newton-Raphson power flow. ($[0, \dots, 0]$ for safe scenarios).

### 8. `split_indices.json`
Fixed reproducible index splits:
```json
{
  "train": [0, 4, 7, ...],  // 70% of scenarios
  "val":   [2, 9, 15, ...], // 15% of scenarios
  "test":  [1, 5, 12, ...]  // 15% of scenarios
}
```

---

## 🚀 How to Run in Your Terminal

```powershell
# 1. Run IEEE 9 (9,000 scenarios in ~20-25 seconds)
python backend/data_collector/collector.py --case case9

# 2. Run IEEE 14 (20,000 scenarios in ~40 seconds)
python backend/data_collector/collector.py --case case14

# 3. Run IEEE 30 (41,000 scenarios in ~1.5 minutes)
python backend/data_collector/collector.py --case case30

# 4. Run IEEE 39 (36,800 scenarios in ~1.5 minutes)
python backend/data_collector/collector.py --case case39

# 5. Run IEEE 57 (40,000 scenarios in ~2 minutes)
python backend/data_collector/collector.py --case case57

# 6. Run IEEE 118 (55,800 scenarios in ~3-4 minutes)
python backend/data_collector/collector.py --case case118

# 7. Run All Cases Sequentially (202,600+ scenarios)
python backend/data_collector/collector.py --case all
```

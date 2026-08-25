# IEEE Power Network Digital Twin ⚡

An interactive, full-stack AC Newton-Raphson Power Flow Digital Twin and Multi-Bus Stress Analysis platform for IEEE Benchmark Test Systems (`IEEE 9`, `14`, `30`, `39`, `57`, `118`, `300-bus`).

## 🌟 Key Features

- **AC Newton-Raphson Power Flow Engine**: Powered by `PyPOWER` in FastAPI for rigorous non-linear voltage magnitude, phase angle, and branch flow solutions.
- **Spectral Laplacian Layout System**: Automatic 2D node embedding using Laplacian eigenvectors and impedance-weighted physics to eliminate overlaps even on 300-bus grids.
- **Interactive Multi-Bus Load Stress Manager**: Apply custom load multipliers (e.g. `0.3x` to `5.0x`) to targeted groups of buses to simulate load shedding, contingencies, and voltage collapse scenarios.
- **Real-Time Security & Telemetry Classification**: Built according to ANSI C84.1 / EEQ401 power engineering standards (`SAFE`, `ALERT`, `CRITICAL` voltage and thermal limits).
- **Comprehensive Matrix Inspector**: View admittance ($Y_{bus}$), bus voltage vector ($V$), branch loading, and line loss matrices live.

---

## 🛠️ Stack & Architecture

- **Backend**: Python 3.10+, FastAPI, PyPOWER, NetworkX, NumPy, SciPy.
- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons, SVG Graph Visualizer.

---

## 🚀 Running Locally

### 1. Start Python Backend API
```bash
python -m venv .venv
# Activate environment
pip install fastapi uvicorn pypower networkx numpy scipy
python backend/server.py
```
The FastAPI server will start on `http://127.0.0.1:8000`.

### 2. Start Frontend App
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

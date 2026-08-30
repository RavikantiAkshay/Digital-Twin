import uvicorn
import os
import json
import sys
from typing import Dict, Optional, Any, List
from pydantic import BaseModel

# Ensure backend directory is in python module search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import math
import numpy as np

try:
    from backend.load_network import SUPPORTED_CASES
    from backend.power_flow import solve_and_extract
    from backend.custom_grid_solver import solve_custom_network, ACTIVE_CUSTOM_CASE
except ImportError:
    from load_network import SUPPORTED_CASES
    from power_flow import solve_and_extract
    from custom_grid_solver import solve_custom_network, ACTIVE_CUSTOM_CASE

def sanitize_json_obj(obj: Any) -> Any:
    """Recursively replaces any NaN, Inf, or -Inf float values with valid finite defaults."""
    if isinstance(obj, dict):
        return {k: sanitize_json_obj(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_json_obj(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj) or np.isnan(obj) or np.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, (np.floating, np.integer)):
        val = float(obj) if isinstance(obj, np.floating) else int(obj)
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return 0.0
        return val
    return obj

class SolveRequest(BaseModel):
    global_scale: Optional[float] = 1.0
    bus_scales: Optional[Dict[str, float]] = None
    tripped_branches: Optional[list] = None

class CustomNetworkRequest(BaseModel):
    name: Optional[str] = "Custom Grid"
    case_id: Optional[str] = "custom_grid"
    base_mva: Optional[float] = 100.0
    buses: list
    generators: Optional[list] = []
    branches: list
    global_scale: Optional[float] = 1.0
    bus_scales: Optional[Dict[str, float]] = None
    tripped_branches: Optional[list] = None

app = FastAPI(
    title="Power Grid Digital Twin API",
    description="AC Power Flow & Topology Visualizer Backend powered by PyPOWER & EEQ401 Contingency Analysis",
    version="1.0.0"
)

# Enable CORS for Vite dev server & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "online", "engine": "PyPOWER AC Newton-Raphson Solver"}

@app.get("/api/cases")
def get_supported_cases():
    cases_list = []
    for case_id, info in SUPPORTED_CASES.items():
        cases_list.append({
            "id": case_id,
            "name": info["name"],
            "description": info["description"]
        })
    return {"cases": cases_list}

@app.post("/api/network/custom/solve")
def solve_custom_grid(req: CustomNetworkRequest):
    """Solves AC Newton-Raphson power flow for a custom grid topology."""
    try:
        b_scales = {}
        if req.bus_scales:
            for k, v in req.bus_scales.items():
                try:
                    b_scales[int(k)] = float(v)
                except ValueError:
                    pass
        
        payload = req.dict()
        data = solve_custom_network(
            payload,
            global_scale=req.global_scale if req.global_scale is not None else 1.0,
            bus_scales=b_scales,
            tripped_branches=req.tripped_branches
        )
        return sanitize_json_obj(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Custom grid AC solve failed: {str(e)}")

@app.post("/api/network/custom/stress")
def stress_custom_grid(req: SolveRequest):
    """Applies load scaling & contingency stress testing to the active custom grid."""
    if not ACTIVE_CUSTOM_CASE or 'raw_data' not in ACTIVE_CUSTOM_CASE:
        raise HTTPException(status_code=404, detail="No active custom grid found in session.")
    
    try:
        b_scales = {}
        if req.bus_scales:
            for k, v in req.bus_scales.items():
                try:
                    b_scales[int(k)] = float(v)
                except ValueError:
                    pass
        
        data = solve_custom_network(
            ACTIVE_CUSTOM_CASE['raw_data'],
            global_scale=req.global_scale if req.global_scale is not None else 1.0,
            bus_scales=b_scales,
            tripped_branches=req.tripped_branches
        )
        return sanitize_json_obj(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stress custom grid: {str(e)}")

@app.get("/api/network/{case_id}")
def get_network_data(case_id: str):
    if case_id not in SUPPORTED_CASES:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found. Supported cases: {list(SUPPORTED_CASES.keys())}")
    
    try:
        data = solve_and_extract(case_id)
        return sanitize_json_obj(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to solve power flow for {case_id}: {str(e)}")

@app.post("/api/network/{case_id}/solve")
def solve_network_with_scaling(case_id: str, req: SolveRequest):
    if case_id not in SUPPORTED_CASES:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    
    try:
        b_scales = {}
        if req.bus_scales:
            for k, v in req.bus_scales.items():
                try:
                    b_scales[int(k)] = float(v)
                except ValueError:
                    pass
        data = solve_and_extract(
            case_id, 
            global_scale=req.global_scale if req.global_scale is not None else 1.0, 
            bus_scales=b_scales,
            tripped_branches=req.tripped_branches
        )
        return sanitize_json_obj(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to solve power flow for {case_id}: {str(e)}")

@app.get("/api/ai/metrics")
def get_ai_training_metrics():
    """Returns the evaluation metrics, recovery rates, and reward curves of the trained RL models."""
    try:
        from backend.ai_engine.agent import MODELS_DIR
    except ImportError:
        from ai_engine.agent import MODELS_DIR
        
    metrics_path = os.path.join(MODELS_DIR, "all_evaluation_metrics.json")
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"status": "trained", "cases": ["case9", "case14", "case30", "case39"]}

@app.post("/api/network/{case_id}/ai-heal")
def execute_ai_healing(case_id: str, req: SolveRequest):
    """Executes the Physics-Guided RL Operator to autonomously resolve active overloads."""
    try:
        from backend.ai_engine.healer import heal_grid_with_ai
    except ImportError:
        from ai_engine.healer import heal_grid_with_ai
        
    try:
        b_scales = {}
        if req.bus_scales:
            for k, v in req.bus_scales.items():
                try:
                    b_scales[int(k)] = float(v)
                except ValueError:
                    pass
        heal_result = heal_grid_with_ai(
            case_id,
            global_scale=req.global_scale if req.global_scale is not None else 1.0,
            bus_scales=b_scales,
            tripped_branches=req.tripped_branches
        )
        return sanitize_json_obj(heal_result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Remediation failed: {str(e)}")

# Mount static dist folder if built
dist_path = os.path.abspath(os.path.join(backend_dir, "..", "frontend", "dist"))
if not os.path.exists(dist_path):
    dist_path = os.path.abspath(os.path.join(backend_dir, "..", "dist"))

if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

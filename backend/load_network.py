import importlib
import numpy as np
from typing import Dict, Any, Tuple, Optional

# Supported PyPOWER test cases
SUPPORTED_CASES = {
    'case9': {
        'name': 'IEEE 9-Bus System',
        'module': 'pypower.case9',
        'fn': 'case9',
        'description': '3 Generators, 9 Buses, 9 Transmission Lines (Western System Equivalent)'
    },
    'case14': {
        'name': 'IEEE 14-Bus System',
        'module': 'pypower.case14',
        'fn': 'case14',
        'description': '5 Generators, 14 Buses, 20 Transmission Lines (Standard Test System)'
    },
    'case30': {
        'name': 'IEEE 30-Bus System',
        'module': 'pypower.case30',
        'fn': 'case30',
        'description': '6 Generators, 30 Buses, 41 Transmission Lines (American Electric Power)'
    },
    'case39': {
        'name': 'IEEE 39-Bus System',
        'module': 'pypower.case39',
        'fn': 'case39',
        'description': '10 Generators, 39 Buses, 46 Transmission Lines (New England Test System)'
    },
    'case57': {
        'name': 'IEEE 57-Bus System',
        'module': 'pypower.case57',
        'fn': 'case57',
        'description': '7 Generators, 57 Buses, 80 Transmission Lines (Sub-Transmission System)'
    },
    'case118': {
        'name': 'IEEE 118-Bus System',
        'module': 'pypower.case118',
        'fn': 'case118',
        'description': '54 Generators, 118 Buses, 186 Transmission Lines (Large Grid Benchmark)'
    },
    'case300': {
        'name': 'IEEE 300-Bus System',
        'module': 'pypower.case300',
        'fn': 'case300',
        'description': '69 Generators, 300 Buses, 411 Transmission Lines (Complex Transmission Network)'
    }
}

def load_case(case_id: str) -> Dict[str, Any]:
    """Loads raw PyPOWER case dict by case_id."""
    if case_id not in SUPPORTED_CASES:
        raise ValueError(f"Unknown case_id: {case_id}. Supported: {list(SUPPORTED_CASES.keys())}")
    
    info = SUPPORTED_CASES[case_id]
    module = importlib.import_module(info['module'])
    case_fn = getattr(module, info['fn'])
    mpc = case_fn()
    
    # Standard Continuous Operational Ratings:
    if case_id == "case30" and len(mpc['branch']) > 9:
        if mpc['branch'][9, 5] < 45.0:
            mpc['branch'][9, 5] = 45.0
            
    return mpc

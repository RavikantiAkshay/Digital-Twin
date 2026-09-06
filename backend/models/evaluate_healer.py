"""
Exhaustive Held-Out Test Evaluation & Physical AC Audit Suite for AI Digital Twin.

Evaluates ALL available held-out test scenarios across power grids (IEEE 9, 14, 30, 39, 57, 118)
with strict model freezing (zero training, zero weight updates).

Provides detailed per-network accounting:
  1. Test Scenarios Evaluated (Total available vs evaluated)
  2. Ground-Truth Post-Contingency Severity (Safe / Alert / Critical)
  3. Classifier Predictions & Confusion Matrix (TP, FP, FN, TN, Accuracy, Precision, Recall)
  4. Auto-Healer on SAFE Scenarios:
     - Idle / Do Nothing rate (Delta Pg ~ 0 MW)
     - Proactive Optimization rate (reduces peak line loading while maintaining 100% safe grid)
     - Safe Maintenance rate
  5. Auto-Healer on ALERT & CRITICAL Scenarios:
     - Physically Infeasible / Divergent / Islanding scenarios (not solvable by redispatch alone)
     - Full Cure to SAFE rate (all line overloads and voltage violations eliminated)
     - Partial Overload Relief rate (thermal overloads mitigated)
     - Average Pre-Heal vs Post-Heal Peak Line Loading %
     - Average Generation Redispatched (MW)

All metrics report exact fractional counts: e.g. 449 / 1000 (44.9%).
"""

import os
import sys
import json
import time
import argparse
import warnings
from typing import Dict, Any, List, Optional
import numpy as np
import torch
from torch.utils.data import Subset
from torch_geometric.loader import DataLoader

# Suppress matrix singularity warnings from pypower on diverged/islanded networks
warnings.filterwarnings("ignore")

# Ensure repository root in sys.path
_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from backend.data_collector.collector import load_case, solve_ac_power_flow
from backend.models.hetero_gat import HeteroGATNet
from backend.models.dataset import PowerGridDataset

CLASS_NAMES = ['SAFE', 'ALERT', 'CRITICAL']

CASE_DESCRIPTIONS = {
    'case9': 'IEEE 9-Bus System (3 Generators, 9 Branches)',
    'case14': 'IEEE 14-Bus System (5 Generators, 20 Branches)',
    'case30': 'IEEE 30-Bus System (6 Generators, 41 Branches)',
    'case39': 'IEEE 39-Bus New England System (10 Generators, 46 Branches)',
    'case57': 'IEEE 57-Bus System (7 Generators, 80 Branches)',
    'case118': 'IEEE 118-Bus Midwest System (54 Generators, 186 Branches)',
}


def format_count(n: int, total: int) -> str:
    """Formats count as: 'N / Total (XX.X%)'."""
    pct = (n / max(1, total)) * 100.0
    return f"{n:,} / {total:,} ({pct:5.1f}%)"


def compute_confusion_metrics(confusion_matrix: np.ndarray) -> Dict[str, Any]:
    """Computes per-class TP, TN, FP, FN, Precision, Recall, Specificity, F1 for each class."""
    total_samples = int(np.sum(confusion_matrix))
    overall_correct = int(np.trace(confusion_matrix))
    overall_acc = float(overall_correct / max(1, total_samples))

    per_class = {}
    macro_prec = []
    macro_rec = []
    macro_f1 = []

    for c, name in enumerate(CLASS_NAMES):
        tp = int(confusion_matrix[c, c])
        fp = int(np.sum(confusion_matrix[:, c]) - tp)
        fn = int(np.sum(confusion_matrix[c, :]) - tp)
        tn = int(total_samples - tp - fp - fn)
        gt_total = int(tp + fn)
        pred_total = int(tp + fp)

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 1.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 1.0
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 1.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        macro_prec.append(prec)
        macro_rec.append(rec)
        macro_f1.append(f1)

        per_class[name] = {
            'ground_truth_count': gt_total,
            'ground_truth_formatted': format_count(gt_total, total_samples),
            'predicted_count': pred_total,
            'predicted_formatted': format_count(pred_total, total_samples),
            'true_positives_TP': tp,
            'true_negatives_TN': tn,
            'false_positives_FP': fp,
            'false_negatives_FN': fn,
            'precision': round(prec, 4),
            'recall_sensitivity': round(rec, 4),
            'specificity': round(spec, 4),
            'f1_score': round(f1, 4),
        }

    return {
        'total_samples': total_samples,
        'overall_correct': overall_correct,
        'overall_accuracy': round(overall_acc, 4),
        'overall_accuracy_formatted': format_count(overall_correct, total_samples),
        'macro_precision': round(float(np.mean(macro_prec)), 4),
        'macro_recall': round(float(np.mean(macro_rec)), 4),
        'macro_f1': round(float(np.mean(macro_f1)), 4),
        'confusion_matrix': confusion_matrix.tolist(),
        'per_class_breakdown': per_class,
    }


def audit_case_exhaustive(
    model: HeteroGATNet,
    case_id: str,
    max_samples: Optional[int] = None,
    batch_size: int = 64,
    device: str = 'cpu',
) -> Dict[str, Any]:
    """
    Performs exhaustive evaluation on all held-out test scenarios for a given power grid.
    Strictly frozen model: torch.no_grad() and model.eval() enforced throughout.
    """
    model.eval()
    cid = case_id.lower()
    base_mpc = load_case(cid)
    base_mva = float(base_mpc.get('baseMVA', 100.0))
    n_gen = len(base_mpc['gen'])
    n_branch = len(base_mpc['branch'])
    pmin = base_mpc['gen'][:, 9]
    pmax = base_mpc['gen'][:, 8]

    # Load full held-out test dataset
    test_ds = PowerGridDataset(cid, split='test')
    total_available = len(test_ds)

    if max_samples is None or max_samples <= 0 or max_samples >= total_available:
        eval_count = total_available
        eval_ds = test_ds
    else:
        eval_count = max_samples
        np.random.seed(42)
        sub_indices = np.random.choice(total_available, size=eval_count, replace=False)
        eval_ds = Subset(test_ds, sub_indices)

    loader = DataLoader(eval_ds, batch_size=batch_size, shuffle=False)

    confusion_mat = np.zeros((3, 3), dtype=np.int64)

    # SAFE Contingency Accounting
    safe_total = 0
    safe_idle_count = 0
    safe_opt_count = 0
    safe_maintained_count = 0
    safe_overloaded_count = 0
    safe_opt_improvements = []

    # ALERT & CRITICAL Contingency Accounting
    emergency_total = 0
    infeasible_diverged_count = 0
    infeasible_flagged_crit = 0

    solvable_emerg_total = 0
    cured_to_safe = 0
    partial_relief = 0
    not_cured_overloaded = 0

    pre_heal_peak_loadings = []
    post_heal_peak_loadings = []
    redispatch_mw_totals = []

    t_start = time.time()
    processed_count = 0

    with torch.no_grad():
        for b_idx, batch in enumerate(loader):
            # Fast Batched GNN Forward Pass
            out = model(batch)
            pred_secs = torch.argmax(out['security_logits'], dim=-1).cpu().numpy()
            pred_disps_all = out['dispatch'].view(-1).cpu().numpy() * base_mva  # in MW

            graph_list = batch.to_data_list()

            for k, (g, pred_sec) in enumerate(zip(graph_list, pred_secs)):
                processed_count += 1
                if processed_count % 100 == 0 or processed_count == eval_count:
                    elapsed = time.time() - t_start
                    rate = processed_count / max(0.1, elapsed)
                    eta = (eval_count - processed_count) / max(0.1, rate)
                    print(
                        f"\r  [{cid.upper():7s}] Processed {processed_count:6,d} / {eval_count:6,d} "
                        f"({(processed_count / eval_count) * 100:5.1f}%) | "
                        f"Speed: {rate:5.1f} samples/s | ETA: {eta:4.0f}s",
                        end='',
                        flush=True
                    )

                p_disp = pred_disps_all[k * n_gen : (k + 1) * n_gen]
                true_sec = int(g.y_security.item()) if hasattr(g, 'y_security') else 0
                true_sev = g.y_severity.view(-1).numpy() if hasattr(g, 'y_severity') else np.array([0.0])

                # Update 3x3 Confusion Matrix
                confusion_mat[true_sec, pred_sec] += 1

                # -------------------------------------------------------------
                # SCENARIO 1: GROUND-TRUTH SAFE (true_sec == 0)
                # -------------------------------------------------------------
                if true_sec == 0:
                    safe_total += 1
                    tot_mw = float(np.sum(np.abs(p_disp)))

                    if tot_mw < 1.5:
                        # Healer did nothing (idle / nominal within governor band)
                        safe_idle_count += 1
                    else:
                        # Healer intervened on a safe grid. Did it proactively optimize line loading?
                        # Reconstruct pre-contingency and post-redispatch grid
                        test_mpc = {
                            'baseMVA': base_mva,
                            'bus': base_mpc['bus'].copy(),
                            'gen': base_mpc['gen'].copy(),
                            'branch': base_mpc['branch'].copy()
                        }
                        bus_feats = g['bus'].x.cpu().numpy()
                        test_mpc['bus'][:, 2] = bus_feats[:, 2] * base_mva
                        test_mpc['bus'][:, 3] = bus_feats[:, 3] * base_mva

                        br_feats = g['bus', 'branch', 'bus'].edge_attr.cpu().numpy()
                        tripped_idx = np.where(br_feats[:n_branch, 7] > 0.5)[0]
                        if len(tripped_idx) > 0 and int(tripped_idx[0]) < n_branch:
                            test_mpc['branch'][int(tripped_idx[0]), 10] = 0

                        # Pre-heal AC solve
                        _, s0, pre_load, min_v0, v0 = solve_ac_power_flow(test_mpc)

                        # Apply healer redispatch
                        p_curr = test_mpc['gen'][:, 1].copy()
                        p_healed = np.clip(p_curr + p_disp, pmin, pmax)
                        p_healed[0] -= np.sum(p_healed[1:] - p_curr[1:])
                        p_healed[0] = np.clip(p_healed[0], pmin[0], pmax[0])
                        test_mpc['gen'][:, 1] = p_healed

                        # Post-heal AC solve
                        _, s1, post_load, min_v1, v1 = solve_ac_power_flow(test_mpc)

                        if s1 and v1 == 0 and post_load < pre_load - 0.2:
                            # Proactive Optimization: Reduced peak line loading while remaining 100% safe
                            safe_opt_count += 1
                            safe_opt_improvements.append(float(pre_load - post_load))
                        elif s1 and v1 == 0:
                            # Maintained Safe operation (neutral)
                            safe_maintained_count += 1
                        else:
                            # Inadvisable intervention
                            safe_overloaded_count += 1

                # -------------------------------------------------------------
                # SCENARIO 2: GROUND-TRUTH EMERGENCY (ALERT or CRITICAL)
                # -------------------------------------------------------------
                else:
                    emergency_total += 1

                    # Check for physically infeasible / divergent / islanding conditions
                    if true_sev[0] >= 9.0:
                        infeasible_diverged_count += 1
                        if pred_sec == 2:  # Correctly flagged as CRITICAL
                            infeasible_flagged_crit += 1
                    else:
                        # Solvable Emergency: Perform full AC power flow verification
                        solvable_emerg_total += 1
                        pre_load = float(true_sev[0] * 100.0)
                        pre_heal_peak_loadings.append(pre_load)
                        redispatch_mw_totals.append(float(np.sum(np.abs(p_disp))))

                        test_mpc = {
                            'baseMVA': base_mva,
                            'bus': base_mpc['bus'].copy(),
                            'gen': base_mpc['gen'].copy(),
                            'branch': base_mpc['branch'].copy()
                        }
                        bus_feats = g['bus'].x.cpu().numpy()
                        test_mpc['bus'][:, 2] = bus_feats[:, 2] * base_mva
                        test_mpc['bus'][:, 3] = bus_feats[:, 3] * base_mva

                        br_feats = g['bus', 'branch', 'bus'].edge_attr.cpu().numpy()
                        tripped_idx = np.where(br_feats[:n_branch, 7] > 0.5)[0]
                        if len(tripped_idx) > 0 and int(tripped_idx[0]) < n_branch:
                            test_mpc['branch'][int(tripped_idx[0]), 10] = 0

                        # Apply Auto-Healer redispatch
                        p_curr = test_mpc['gen'][:, 1].copy()
                        p_healed = np.clip(p_curr + p_disp, pmin, pmax)
                        p_healed[0] -= np.sum(p_healed[1:] - p_curr[1:])
                        p_healed[0] = np.clip(p_healed[0], pmin[0], pmax[0])
                        test_mpc['gen'][:, 1] = p_healed

                        # Run AC Newton-Raphson solve
                        _, succ, post_load, min_v, viols = solve_ac_power_flow(test_mpc)
                        post_heal_peak_loadings.append(post_load if succ else pre_load)

                        if succ and viols == 0 and post_load <= 100.0 and min_v >= 0.90:
                            # FULL CURE TO SAFE: All overloads and voltage violations completely eliminated
                            cured_to_safe += 1
                            partial_relief += 1
                        elif succ and post_load < pre_load:
                            # PARTIAL RELIEF: Overload mitigated
                            partial_relief += 1
                        else:
                            not_cured_overloaded += 1

    total_time = time.time() - t_start
    print("\r" + " " * 95 + "\r", end="")

    clf_metrics = compute_confusion_metrics(confusion_mat)

    avg_pre_load = float(np.mean(pre_heal_peak_loadings)) if pre_heal_peak_loadings else 0.0
    avg_post_load = float(np.mean(post_heal_peak_loadings)) if post_heal_peak_loadings else 0.0
    avg_opt_red = float(np.mean(safe_opt_improvements)) if safe_opt_improvements else 0.0
    avg_redispatch = float(np.mean(redispatch_mw_totals)) if redispatch_mw_totals else 0.0

    return {
        'case_id': cid.upper(),
        'case_name': CASE_DESCRIPTIONS.get(cid, cid.upper()),
        'total_available_test_cases': total_available,
        'evaluated_test_cases': eval_count,
        'evaluated_formatted': format_count(eval_count, total_available),
        'execution_time_seconds': round(total_time, 2),
        'speed_samples_per_sec': round(eval_count / max(0.1, total_time), 1),
        'classifier_performance': clf_metrics,
        'safe_scenarios_audit': {
            'total_safe_scenarios': safe_total,
            'total_safe_formatted': format_count(safe_total, eval_count),
            'healer_did_nothing_idle': safe_idle_count,
            'healer_did_nothing_formatted': format_count(safe_idle_count, safe_total),
            'proactively_optimized_count': safe_opt_count,
            'proactively_optimized_formatted': format_count(safe_opt_count, safe_total),
            'average_optimization_loading_reduction_pct': round(avg_opt_red, 2),
            'maintained_safe_count': safe_maintained_count,
            'maintained_safe_formatted': format_count(safe_maintained_count, safe_total),
            'inadvisable_intervention_count': safe_overloaded_count,
            'inadvisable_intervention_formatted': format_count(safe_overloaded_count, safe_total),
        },
        'emergency_scenarios_audit': {
            'total_emergency_scenarios': emergency_total,
            'total_emergency_formatted': format_count(emergency_total, eval_count),
            'physically_infeasible_blackout_count': infeasible_diverged_count,
            'physically_infeasible_formatted': format_count(infeasible_diverged_count, emergency_total),
            'infeasible_flagged_critical_count': infeasible_flagged_crit,
            'infeasible_flagged_critical_formatted': format_count(infeasible_flagged_crit, infeasible_diverged_count),
            'solvable_emergencies_evaluated': solvable_emerg_total,
            'solvable_emergencies_formatted': format_count(solvable_emerg_total, emergency_total),
            'cured_to_safe_count': cured_to_safe,
            'cured_to_safe_formatted': format_count(cured_to_safe, solvable_emerg_total),
            'partial_relief_count': partial_relief,
            'partial_relief_formatted': format_count(partial_relief, solvable_emerg_total),
            'not_cured_count': not_cured_overloaded,
            'not_cured_formatted': format_count(not_cured_overloaded, solvable_emerg_total),
            'average_pre_heal_peak_loading_pct': round(avg_pre_load, 1),
            'average_post_heal_peak_loading_pct': round(avg_post_load, 1),
            'average_overload_reduction_pct': round(max(0.0, avg_pre_load - avg_post_load), 1),
            'average_redispatch_mw': round(avg_redispatch, 1),
        }
    }


def print_case_summary(res: Dict[str, Any]):
    """Prints a clear, human-readable summary of the network audit with exact fractional numbers."""
    cid = res['case_id']
    cname = res['case_name']
    clf = res['classifier_performance']
    safe_audit = res['safe_scenarios_audit']
    emerg_audit = res['emergency_scenarios_audit']

    print("\n" + "=" * 92)
    print(f"  EXHAUSTIVE TEST AUDIT REPORT: {cid} ({cname})")
    print(f"  Evaluated: {res['evaluated_formatted']} | Time: {res['execution_time_seconds']}s ({res['speed_samples_per_sec']} samples/s)")
    print(f"  Model Status: FROZEN (Strictly no learning, torch.no_grad)")
    print("=" * 92)

    # 1. Ground Truth vs Predictions
    print("\n  [1] CONTINGENCY SEVERITY BREAKDOWN & CLASSIFIER PERFORMANCE:")
    print(f"      Overall Classifier Accuracy: {clf['overall_accuracy_formatted']}")
    print(f"      Macro-Precision: {clf['macro_precision'] * 100:.2f}% | Macro-Recall: {clf['macro_recall'] * 100:.2f}% | Macro-F1: {clf['macro_f1'] * 100:.2f}%")
    print("-" * 92)
    print(f"      {'Class':10s} | {'Ground-Truth Count':24s} | {'Model Classified':24s} | {'Precision':10s} | {'Recall':10s}")
    print("-" * 92)
    for cname_i in CLASS_NAMES:
        cinfo = clf['per_class_breakdown'][cname_i]
        print(
            f"      {cname_i:10s} | {cinfo['ground_truth_formatted']:24s} | "
            f"{cinfo['predicted_formatted']:24s} | "
            f"{cinfo['precision'] * 100:8.2f}% | {cinfo['recall_sensitivity'] * 100:8.2f}%"
        )
    print("-" * 92)

    # Confusion Matrix
    cm = clf['confusion_matrix']
    print("      Confusion Matrix (Rows = Ground Truth, Columns = Predicted):")
    print(f"        True SAFE:     Pred SAFE = {cm[0][0]:5,d}  | Pred ALERT = {cm[0][1]:5,d}  | Pred CRITICAL = {cm[0][2]:5,d}")
    print(f"        True ALERT:    Pred SAFE = {cm[1][0]:5,d}  | Pred ALERT = {cm[1][1]:5,d}  | Pred CRITICAL = {cm[1][2]:5,d}")
    print(f"        True CRITICAL: Pred SAFE = {cm[2][0]:5,d}  | Pred ALERT = {cm[2][1]:5,d}  | Pred CRITICAL = {cm[2][2]:5,d}")

    # 2. Healer on SAFE cases
    print("\n  [2] AUTO-HEALER ON SAFE CONTINGENCIES:")
    print(f"      Total True SAFE Scenarios:              {safe_audit['total_safe_formatted']}")
    if safe_audit['total_safe_scenarios'] > 0:
        print(f"      -> Healer Did Nothing (Idle, < 1.5 MW): {safe_audit['healer_did_nothing_formatted']}")
        print(f"      -> Proactively Optimized Network:       {safe_audit['proactively_optimized_formatted']}")
        if safe_audit['proactively_optimized_count'] > 0:
            print(f"         (Reduced peak line loading by an average of {safe_audit['average_optimization_loading_reduction_pct']:.2f}% while maintaining 100% safe grid)")
        print(f"      -> Maintained Safe (Neutral shift):     {safe_audit['maintained_safe_formatted']}")
        print(f"      -> Inadvisable Shift:                   {safe_audit['inadvisable_intervention_formatted']}")
    else:
        print("      (Note: Heavily stressed transmission system; all N-1 contingencies produce alerts or critical violations)")

    # 3. Healer on ALERT & CRITICAL cases
    print("\n  [3] AUTO-HEALER ON ALERT & CRITICAL CONTINGENCIES (PHYSICAL AC POWER FLOW VERIFICATION):")
    print(f"      Total Emergency Scenarios:              {emerg_audit['total_emergency_formatted']}")
    print(f"      -> Physically Infeasible / Diverged:    {emerg_audit['physically_infeasible_formatted']}")
    if emerg_audit['physically_infeasible_blackout_count'] > 0:
        print(f"         (Radial branch outages / blackout; correctly flagged as CRITICAL: {emerg_audit['infeasible_flagged_critical_formatted']})")
    print(f"      -> Solvable Emergencies Evaluated:      {emerg_audit['solvable_emergencies_formatted']}")
    if emerg_audit['solvable_emergencies_evaluated'] > 0:
        print(f"      -> Brought All the Way to SAFE:         {emerg_audit['cured_to_safe_formatted']}")
        print(f"         (Full Cure: 0 overloads, 0 voltage violations, max line loading <= 100%)")
        print(f"      -> Partial Overload Relief:             {emerg_audit['partial_relief_formatted']}")
        print(f"         (Overload mitigated; peak line loading reduced)")
        print(f"      -> Not Cured / Residual Overload:       {emerg_audit['not_cured_formatted']}")
        print(f"      -> Average Peak Line Loading:           {emerg_audit['average_pre_heal_peak_loading_pct']:.1f}% -> {emerg_audit['average_post_heal_peak_loading_pct']:.1f}% (Drop of {emerg_audit['average_overload_reduction_pct']:.1f}%)")
        print(f"      -> Average Generation Redispatched:     {emerg_audit['average_redispatch_mw']:.1f} MW total fleet dispatch")
    print("=" * 92 + "\n")


def print_grand_multi_grid_table(all_audits: List[Dict[str, Any]]):
    """Prints an overarching executive multi-grid comparison table."""
    print("\n" + "#" * 135)
    print("  GRAND MULTI-GRID VERIFICATION SUMMARY (EXHAUSTIVE TEST SET EVALUATION)")
    print("#" * 135)
    print(f"{'Network':9s} | {'Test Cases Evaluated':26s} | {'Classifier Accuracy':26s} | {'Safe Cases':14s} | {'Solvable Emerg':18s} | {'Brought to Safe (Full Cure)':28s}")
    print("-" * 135)

    tot_eval = 0
    tot_correct = 0
    tot_safe = 0
    tot_safe_idle_or_opt = 0
    tot_solvable = 0
    tot_cured = 0

    for r in all_audits:
        cid = r['case_id']
        clf = r['classifier_performance']
        safe = r['safe_scenarios_audit']
        emerg = r['emergency_scenarios_audit']

        tot_eval += r['evaluated_test_cases']
        tot_correct += clf['overall_correct']
        tot_safe += safe['total_safe_scenarios']
        tot_safe_idle_or_opt += (safe['healer_did_nothing_idle'] + safe['proactively_optimized_count'] + safe['maintained_safe_count'])
        tot_solvable += emerg['solvable_emergencies_evaluated']
        tot_cured += emerg['cured_to_safe_count']

        c_acc = clf['overall_accuracy_formatted']
        s_count = f"{safe['total_safe_scenarios']:,}"
        solv_count = f"{emerg['solvable_emergencies_evaluated']:,}"
        cured_fmt = emerg['cured_to_safe_formatted']

        print(f"{cid:9s} | {r['evaluated_formatted']:26s} | {c_acc:26s} | {s_count:14s} | {solv_count:18s} | {cured_fmt:28s}")

    print("-" * 135)
    total_acc_fmt = format_count(tot_correct, tot_eval)
    total_cure_fmt = format_count(tot_cured, tot_solvable) if tot_solvable > 0 else "0 / 0 (0.0%)"
    print(f"{'OVERALL':9s} | {format_count(tot_eval, tot_eval):26s} | {total_acc_fmt:26s} | {tot_safe:14,d} | {tot_solvable:18,d} | {total_cure_fmt:28s}")
    print("#" * 135 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Exhaustive physical verification audit on AI Digital Twin")
    parser.add_argument("--all", action="store_true", default=True, help="Evaluate ALL available test cases across all networks (default: True)")
    parser.add_argument("--samples_per_grid", type=int, default=None, help="Optional sample limit per grid (if not specified, evaluates ALL test cases)")
    parser.add_argument("--cases", nargs="+", default=['case9', 'case14', 'case30', 'case39', 'case57', 'case118'], help="List of cases to evaluate")
    parser.add_argument("--batch_size", type=int, default=64, help="Batch size for GNN inference (default: 64)")
    args = parser.parse_args()

    print("\n" + "=" * 92)
    print("  AI DIGITAL TWIN - EXHAUSTIVE HELD-OUT TEST EVALUATION & PHYSICAL AUDIT")
    print("  Model: Universal Multi-Grid HeteroGATNet (best_model.pt)")
    print("  Evaluation Mode: Strictly Frozen (No training, zero weight updates)")
    if args.samples_per_grid:
        print(f"  Scope: Subsample of {args.samples_per_grid:,} test cases per grid")
    else:
        print("  Scope: ALL AVAILABLE TEST CASES (100% OF TEST DATASET)")
    print("=" * 92)

    model_path = os.path.join(_repo_root, "backend/models/checkpoints/universal/best_model.pt")
    if not os.path.exists(model_path):
        print(f"Error: Model checkpoint not found at {model_path}")
        return

    checkpoint = torch.load(model_path, map_location='cpu')
    model = HeteroGATNet()
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    all_audits = []

    for cid in args.cases:
        print(f"\n[{cid.upper()}] Starting audit on held-out test scenarios...", flush=True)
        res = audit_case_exhaustive(
            model=model,
            case_id=cid,
            max_samples=args.samples_per_grid,
            batch_size=args.batch_size,
        )
        all_audits.append(res)
        print_case_summary(res)

    # Multi-Grid Grand Summary
    if len(all_audits) > 1:
        print_grand_multi_grid_table(all_audits)

    # Save detailed JSON report
    out_json = os.path.join(_repo_root, "backend/models/checkpoints/universal/exhaustive_test_audit_report.json")
    with open(out_json, "w") as f:
        json.dump(all_audits, f, indent=2)

    print(f"Complete JSON audit report saved to:\n  -> {out_json}\n")


if __name__ == "__main__":
    main()

"""
Executable CLI Entrypoint for Training HeteroGATNet across Power Grids.

Usage:
  # Train IEEE 14 bus model
  python -m backend.models.train --case case14 --epochs 100 --batch_size 64

  # Train all IEEE grids sequentially
  python -m backend.models.train --case all --epochs 80
"""

import os
import sys
import argparse

# Ensure project root is in sys.path
_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from backend.models.trainer import GridTrainer

ALL_CASES = ['universal', 'case9', 'case14', 'case30', 'case39', 'case57', 'case118']


def parse_args():
    parser = argparse.ArgumentParser(description="Train HeteroGATNet on Power Grid Contingency Datasets")
    parser.add_argument(
        "--case",
        type=str,
        default="universal",
        help="Grid case to train on ('universal', case9, case14, case30, case39, case57, case118, or 'all')",
    )
    parser.add_argument("--epochs", type=int, default=200, help="Maximum training epochs (default: 200)")
    parser.add_argument("--batch_size", type=int, default=64, help="Batch size (default: 64)")
    parser.add_argument("--lr", type=float, default=1e-3, help="Initial learning rate (default: 1e-3)")
    parser.add_argument("--hidden_dim", type=int, default=64, help="GNN hidden dimension (default: 64)")
    parser.add_argument("--patience", type=int, default=20, help="Early stopping patience (default: 20)")
    parser.add_argument("--device", type=str, default=None, help="Device ('cuda', 'cpu', or None for auto)")
    return parser.parse_args()


def main():
    args = parse_args()
    cases_to_train = ALL_CASES if args.case.lower() == 'all' else [args.case.lower()]

    print("\n" + "#" * 95)
    print(f"  STARTING HETEROGAT TRAINING PIPELINE")
    print(f"  Cases: {cases_to_train}")
    print(f"  Epochs: {args.epochs} | Batch Size: {args.batch_size} | Learning Rate: {args.lr}")
    print("#" * 95 + "\n")

    results = {}
    for case_id in cases_to_train:
        trainer = GridTrainer(
            case_id=case_id,
            hidden_dim=args.hidden_dim,
            batch_size=args.batch_size,
            learning_rate=args.lr,
            device=args.device,
        )
        res = trainer.fit(
            epochs=args.epochs,
            patience=args.patience,
            save_checkpoints=True,
        )
        results[case_id] = res

    print("\n" + "=" * 95)
    print("  ALL REQUESTED MODELS TRAINED SUCCESSFULLY!")
    for cid, r in results.items():
        tm = r['test_metrics']
        print(f"  -> {cid.upper():8s}: Best Epoch {r['best_epoch']:3d} | Test Acc: {tm['sec_accuracy']*100:.2f}% | Disp MAE: {tm['disp_mae']:.4f} | Feas: {tm['dispatch_limit_compliance']*100:.1f}%")
    print("=" * 95 + "\n")


if __name__ == "__main__":
    main()

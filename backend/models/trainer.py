"""
PyTorch Training Engine for HeteroGATNet Power System Multi-Task Model.

Features:
  - Multi-objective Physics-Informed Loss optimization (AdamW + CosineAnnealingLR)
  - Gradient clipping for training stability across wide voltage angle and dispatch ranges
  - Early stopping with patience tracking on validation loss
  - Comprehensive metrics tracking:
      * Security classification Accuracy, Precision, Recall, Macro-F1
      * Severity Mean Absolute Error (MAE)
      * Corrective Dispatch MAE & Physical Feasibility (% within limits)
  - Automatic checkpointing: best_model.pt, training_history.json, model_config.json
  - CUDA and CPU auto-detection and execution
"""

import os
import sys
import time
import json
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
from torch_geometric.loader import DataLoader

from backend.models.hetero_gat import HeteroGATNet
from backend.models.losses import PhysicsInformedLoss
from backend.models.dataset import PowerGridDataset, MultiGridDataset


class GridTrainer:
    """
    Orchestrates training, validation, checkpointing, and evaluation of HeteroGATNet.
    """

    def __init__(
        self,
        case_id: str,
        data_dir: str = 'backend/data_collector/data',
        checkpoints_dir: str = 'backend/models/checkpoints',
        hidden_dim: int = 64,
        edge_dim: int = 32,
        num_layers: int = 3,
        num_heads: int = 4,
        dropout: float = 0.1,
        learning_rate: float = 1e-3,
        weight_decay: float = 1e-4,
        batch_size: int = 64,
        lambda_severity: float = 1.0,
        lambda_dispatch: float = 1.0,
        lambda_physics: float = 0.5,
        w_bal: float = 2.0,
        w_lim: float = 10.0,
        w_min: float = 0.05,
        device: Optional[str] = None,
    ):
        self.case_id = case_id.lower()
        self.data_dir = data_dir
        self.save_dir = os.path.join(checkpoints_dir, self.case_id)
        os.makedirs(self.save_dir, exist_ok=True)

        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.weight_decay = weight_decay

        # Device selection
        if device is not None:
            self.device = torch.device(device)
        else:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        # 1. Datasets
        if self.case_id == 'universal':
            print(f"[UNIVERSAL] Loading multi-grid balanced dataset across all IEEE cases...", flush=True)
            self.train_ds = MultiGridDataset(split='train', data_dir=self.data_dir, max_per_case=8000)
            self.val_ds = MultiGridDataset(split='val', data_dir=self.data_dir, max_per_case=1500)
            self.test_ds = MultiGridDataset(split='test', data_dir=self.data_dir, max_per_case=1500)
        else:
            print(f"[{self.case_id.upper()}] Loading datasets from {self.data_dir}/{self.case_id}...", flush=True)
            self.train_ds = PowerGridDataset(self.case_id, split='train', data_dir=self.data_dir)
            self.val_ds = PowerGridDataset(self.case_id, split='val', data_dir=self.data_dir)
            self.test_ds = PowerGridDataset(self.case_id, split='test', data_dir=self.data_dir)

        self.train_loader = DataLoader(self.train_ds, batch_size=batch_size, shuffle=True, pin_memory=torch.cuda.is_available())
        self.val_loader = DataLoader(self.val_ds, batch_size=batch_size, shuffle=False)
        self.test_loader = DataLoader(self.test_ds, batch_size=batch_size, shuffle=False)

        print(f"[{self.case_id.upper()}] Dataset splits: {len(self.train_ds)} train / {len(self.val_ds)} val / {len(self.test_ds)} test", flush=True)

        # 2. Model Configuration
        self.model_config = {
            'case_id': self.case_id,
            'bus_in_dim': 8,
            'gen_in_dim': 6,
            'branch_in_dim': 8,
            'hidden_dim': hidden_dim,
            'edge_dim': edge_dim,
            'num_layers': num_layers,
            'num_heads': num_heads,
            'dropout': dropout,
            'learning_rate': learning_rate,
            'weight_decay': weight_decay,
            'batch_size': batch_size,
            'lambda_severity': lambda_severity,
            'lambda_dispatch': lambda_dispatch,
            'lambda_physics': lambda_physics,
            'w_bal': w_bal,
            'w_lim': w_lim,
            'w_min': w_min,
        }

        self.model = HeteroGATNet(
            bus_in_dim=8,
            gen_in_dim=6,
            branch_in_dim=8,
            hidden_dim=hidden_dim,
            edge_dim=edge_dim,
            num_layers=num_layers,
            num_heads=num_heads,
            dropout=dropout,
        ).to(self.device)

        param_count = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        print(f"[{self.case_id.upper()}] Model initialized on {self.device} ({param_count:,} parameters)", flush=True)

        # 3. Loss & Optimizer
        class_weights = self.train_ds.get_class_weights().to(self.device)
        self.criterion = PhysicsInformedLoss(
            class_weights=class_weights,
            lambda_severity=lambda_severity,
            lambda_dispatch=lambda_dispatch,
            lambda_physics=lambda_physics,
            w_bal=w_bal,
            w_lim=w_lim,
            w_min=w_min,
        ).to(self.device)

        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay,
        )

        # Training history storage
        self.history: List[Dict[str, Any]] = []

    def train_epoch(self, epoch: int = 1, total_epochs: int = 200) -> Dict[str, float]:
        """Runs one full training epoch over the training DataLoader with real-time batch progress."""
        self.model.train()
        total_loss = 0.0
        comp_sums = {
            'l_class': 0.0,
            'l_sev': 0.0,
            'l_disp': 0.0,
            'l_phys': 0.0,
            'l_bal': 0.0,
            'l_lim': 0.0,
            'l_min': 0.0,
        }
        num_batches = len(self.train_loader)
        t_start = time.time()

        for b_idx, batch in enumerate(self.train_loader, 1):
            batch = batch.to(self.device)
            self.optimizer.zero_grad()

            preds = self.model(batch)
            loss_dict = self.criterion(preds, batch)

            loss = loss_dict['loss']
            loss.backward()

            # Gradient clipping to prevent exploding gradients on severe contingencies
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()

            batch_loss = loss.item()
            total_loss += batch_loss
            for k in comp_sums:
                if k in loss_dict:
                    comp_sums[k] += loss_dict[k].item()

            # Live batch progress update every 10 batches or at end
            if b_idx % 10 == 0 or b_idx == num_batches:
                elapsed = time.time() - t_start
                speed = b_idx / max(1e-5, elapsed)
                eta = (num_batches - b_idx) / max(1e-5, speed)
                running_loss = total_loss / b_idx
                percent = (b_idx / num_batches) * 100
                print(
                    f"\r  [Ep {epoch:03d}/{total_epochs:03d} Train] Batch {b_idx:03d}/{num_batches:03d} ({percent:5.1f}%) | "
                    f"Speed: {speed:4.1f} bat/s | "
                    f"Loss: {running_loss:.4f} | "
                    f"Elapsed: {elapsed:3.0f}s | "
                    f"ETA: {eta:3.0f}s",
                    end='',
                    flush=True
                )

        return {
            'loss': total_loss / max(1, num_batches),
            **{k: v / max(1, num_batches) for k, v in comp_sums.items()},
        }

    @torch.no_grad()
    def evaluate(self, loader: DataLoader, desc: str = "Val") -> Dict[str, float]:
        """Evaluates model performance and physics validation on a DataLoader with live progress."""
        self.model.eval()
        total_loss = 0.0
        comp_sums = {
            'l_class': 0.0,
            'l_sev': 0.0,
            'l_disp': 0.0,
            'l_phys': 0.0,
        }
        num_batches = len(loader)

        all_sec_preds = []
        all_sec_targets = []
        all_sev_errs = []
        all_disp_errs = []

        total_gens = 0
        within_limits_count = 0
        t_start = time.time()

        for b_idx, batch in enumerate(loader, 1):
            batch = batch.to(self.device)
            preds = self.model(batch)
            loss_dict = self.criterion(preds, batch)

            total_loss += loss_dict['loss'].item()
            comp_sums['l_class'] += loss_dict['l_class'].item()
            comp_sums['l_sev'] += loss_dict['l_severity'].item()
            comp_sums['l_disp'] += loss_dict['l_dispatch'].item()
            comp_sums['l_phys'] += loss_dict['l_physics'].item()

            # Security metrics
            sec_preds = torch.argmax(preds['security_logits'], dim=-1).cpu().numpy()
            sec_true = batch.y_security.cpu().view(-1).numpy()
            all_sec_preds.extend(sec_preds)
            all_sec_targets.extend(sec_true)

            # Severity metrics
            sev_preds = preds['severity'].cpu().numpy()
            sev_true = batch.y_severity.cpu().view(-1, 3).numpy()
            all_sev_errs.append(np.abs(sev_preds - sev_true))

            # Dispatch metrics
            disp_preds = preds['dispatch'].cpu().numpy()
            disp_true = batch.y_dispatch.cpu().view(-1).numpy()
            all_disp_errs.append(np.abs(disp_preds - disp_true))

            # Physical limit feasibility check
            gen_x = batch['gen'].x.cpu().numpy()
            pg = gen_x[:, 0]
            pmax = gen_x[:, 2]
            pmin = gen_x[:, 3]
            p_new = pg + disp_preds
            is_valid = (p_new >= pmin - 1e-3) & (p_new <= pmax + 1e-3)
            within_limits_count += int(np.sum(is_valid))
            total_gens += len(is_valid)

            if b_idx % 20 == 0 or b_idx == num_batches:
                elapsed = time.time() - t_start
                percent = (b_idx / num_batches) * 100
                print(
                    f"\r  [{desc}] Batch {b_idx:03d}/{num_batches:03d} ({percent:5.1f}%) | Elapsed: {elapsed:3.0f}s",
                    end='',
                    flush=True
                )

        all_sec_preds = np.array(all_sec_preds)
        all_sec_targets = np.array(all_sec_targets)
        accuracy = float(np.mean(all_sec_preds == all_sec_targets))

        # Per-class accuracy
        per_class_acc = {}
        for c, name in enumerate(['safe', 'alert', 'critical']):
            mask = (all_sec_targets == c)
            if np.sum(mask) > 0:
                per_class_acc[f'acc_{name}'] = float(np.mean(all_sec_preds[mask] == c))
            else:
                per_class_acc[f'acc_{name}'] = 1.0

        all_sev_errs = np.concatenate(all_sev_errs, axis=0)
        sev_mae = float(np.mean(all_sev_errs))
        sev_load_mae = float(np.mean(all_sev_errs[:, 0]))
        sev_volt_mae = float(np.mean(all_sev_errs[:, 1]))

        all_disp_errs = np.concatenate(all_disp_errs, axis=0)
        disp_mae = float(np.mean(all_disp_errs))

        limit_compliance = float(within_limits_count / max(1, total_gens))

        return {
            'loss': total_loss / max(1, num_batches),
            **{k: v / max(1, num_batches) for k, v in comp_sums.items()},
            'sec_accuracy': accuracy,
            **per_class_acc,
            'sev_mae': sev_mae,
            'sev_load_mae': sev_load_mae,
            'sev_volt_mae': sev_volt_mae,
            'disp_mae': disp_mae,
            'dispatch_limit_compliance': limit_compliance,
        }

    def fit(
        self,
        epochs: int = 100,
        patience: int = 20,
        save_checkpoints: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes complete training loop with CosineAnnealingLR and Early Stopping.
        """
        print("\n" + "=" * 95, flush=True)
        print(f"  TRAINING HeteroGATNet ON {self.case_id.upper()}", flush=True)
        print(f"  -> Epochs: {epochs} | Batch Size: {self.batch_size} | LR: {self.learning_rate} | Device: {self.device}", flush=True)
        print("=" * 95, flush=True)

        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer,
            T_max=epochs,
            eta_min=1e-5,
        )

        best_val_loss = float('inf')
        best_val_acc = 0.0
        best_epoch = -1
        patience_counter = 0

        t_start = time.time()

        for epoch in range(1, epochs + 1):
            ep_start = time.time()
            train_metrics = self.train_epoch(epoch=epoch, total_epochs=epochs)
            val_metrics = self.evaluate(self.val_loader, desc=f"Ep {epoch:03d}/{epochs:03d} Val")
            scheduler.step()
            ep_time = time.time() - ep_start

            val_loss = val_metrics['loss']
            val_acc = val_metrics['sec_accuracy']

            epoch_record = {
                'epoch': epoch,
                'train': train_metrics,
                'val': val_metrics,
                'lr': float(scheduler.get_last_lr()[0]),
                'time_seconds': round(ep_time, 2),
            }
            self.history.append(epoch_record)

            is_best = val_loss < best_val_loss
            if is_best:
                best_val_loss = val_loss
                best_val_acc = val_acc
                best_epoch = epoch
                patience_counter = 0

                if save_checkpoints:
                    self._save_checkpoint(epoch, "best_model.pt")
            else:
                patience_counter += 1

            # Log clean epoch summary (clearing the in-place progress line)
            tag = "[*] BEST" if is_best else f"    (p:{patience_counter}/{patience})"
            print(
                f"\r" + " " * 115 + "\r"
                f"Ep {epoch:03d}/{epochs:03d} [{ep_time:.1f}s] | "
                f"TrLoss: {train_metrics['loss']:.4f} | "
                f"ValLoss: {val_loss:.4f} | "
                f"ValAcc: {val_acc*100:.1f}% | "
                f"SevMAE: {val_metrics['sev_mae']:.4f} | "
                f"DispMAE: {val_metrics['disp_mae']:.4f} | "
                f"Feas: {val_metrics['dispatch_limit_compliance']*100:.1f}% | "
                f"{tag}",
                flush=True
            )

            # Early stopping check
            if patience_counter >= patience:
                print(f"\n[EARLY STOPPING] Validation loss stopped improving for {patience} epochs. Stopping at epoch {epoch}.", flush=True)
                break

        total_time = time.time() - t_start
        print("\n" + "-" * 95, flush=True)
        print(f"  TRAINING COMPLETE in {total_time:.1f}s ({round(total_time/60, 2)} min)", flush=True)
        print(f"  -> Best Validation Epoch: {best_epoch} with Val Loss: {best_val_loss:.4f} (Accuracy: {best_val_acc*100:.2f}%)", flush=True)
        print("-" * 95, flush=True)

        if save_checkpoints:
            self._save_checkpoint(epoch, "checkpoint_last.pt")
            self._save_history()

        # Final Test Evaluation with best model
        print(f"\n[{self.case_id.upper()}] Running final evaluation on held-out test split (best model)...", flush=True)
        if save_checkpoints and os.path.exists(os.path.join(self.save_dir, "best_model.pt")):
            self.load_checkpoint("best_model.pt")

        test_metrics = self.evaluate(self.test_loader)
        print(f"  -> Test Security Accuracy: {test_metrics['sec_accuracy']*100:.2f}% (Safe: {test_metrics['acc_safe']*100:.1f}%, Alert: {test_metrics['acc_alert']*100:.1f}%, Crit: {test_metrics['acc_critical']*100:.1f}%)", flush=True)
        print(f"  -> Test Severity MAE:      {test_metrics['sev_mae']:.4f}", flush=True)
        print(f"  -> Test Dispatch MAE:      {test_metrics['disp_mae']:.4f}", flush=True)
        print(f"  -> Generator Limit Feas:   {test_metrics['dispatch_limit_compliance']*100:.2f}%", flush=True)

        if save_checkpoints:
            with open(os.path.join(self.save_dir, "test_metrics.json"), "w") as f:
                json.dump(test_metrics, f, indent=2)

        # Cross-grid evaluation across all individual IEEE networks
        cross_grid_results = {}
        if self.case_id == 'universal':
            print("\n" + "=" * 95, flush=True)
            print("  CROSS-GRID GENERALIZATION EVALUATION (Held-Out Test Sets Across All Cases)", flush=True)
            print("=" * 95, flush=True)
            for cid in ['case9', 'case14', 'case30', 'case39', 'case57', 'case118']:
                try:
                    case_te_ds = PowerGridDataset(cid, split='test', data_dir=self.data_dir)
                    case_te_loader = DataLoader(case_te_ds, batch_size=self.batch_size, shuffle=False)
                    cm = self.evaluate(case_te_loader)
                    cross_grid_results[cid] = cm
                    print(
                        f"  -> {cid.upper():8s} ({len(case_te_ds):5d} tests) | "
                        f"Acc: {cm['sec_accuracy']*100:5.1f}% (Safe:{cm['acc_safe']*100:4.1f}% Alert:{cm['acc_alert']*100:4.1f}% Crit:{cm['acc_critical']*100:4.1f}%) | "
                        f"SevMAE: {cm['sev_mae']:.4f} | "
                        f"DispMAE: {cm['disp_mae']:.4f} | "
                        f"Feas: {cm['dispatch_limit_compliance']*100:5.1f}%",
                        flush=True
                    )
                except Exception as ex:
                    print(f"  -> {cid.upper():8s} failed evaluation: {ex}", flush=True)
            print("=" * 95 + "\n", flush=True)

            if save_checkpoints:
                with open(os.path.join(self.save_dir, "cross_grid_test_metrics.json"), "w") as f:
                    json.dump(cross_grid_results, f, indent=2)

        return {
            'best_epoch': best_epoch,
            'best_val_loss': best_val_loss,
            'best_val_acc': best_val_acc,
            'test_metrics': test_metrics,
            'cross_grid_results': cross_grid_results,
            'total_time_seconds': total_time,
        }

    def _save_checkpoint(self, epoch: int, filename: str):
        path = os.path.join(self.save_dir, filename)
        torch.save({
            'epoch': epoch,
            'case_id': self.case_id,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'model_config': self.model_config,
        }, path)

    def load_checkpoint(self, filename: str):
        path = os.path.join(self.save_dir, filename)
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])

    def _save_history(self):
        # Save training history JSON
        history_path = os.path.join(self.save_dir, "training_history.json")
        with open(history_path, "w") as f:
            json.dump(self.history, f, indent=2)

        # Save model config JSON
        config_path = os.path.join(self.save_dir, "model_config.json")
        with open(config_path, "w") as f:
            json.dump(self.model_config, f, indent=2)

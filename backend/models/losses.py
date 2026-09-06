"""
Physics-Informed Multi-Objective Loss Formulation for Power Systems.

Implements:
  1. Security Classification Loss (Weighted Cross-Entropy)
  2. System Severity Regression Loss (Smooth L1 / Huber)
  3. Corrective Dispatch Supervision Loss (MSE)
  4. Physics Penalties:
     - Power Balance Constraint: (sum(Delta_Pg))^2 == 0 per grid
     - Generator Capacity Limit Constraint: max(0, Pg + Delta_Pg - Pmax)^2 + max(0, Pmin - Pg - Delta_Pg)^2
     - Minimal Intervention Penalty: L1 norm of Delta_Pg (sparsity)
"""

from typing import Dict, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import HeteroData


class PhysicsInformedLoss(nn.Module):
    """
    Computes total multi-task loss combining task supervision with AC power grid physics:

      L_total = L_classification
              + lambda_severity * L_severity
              + lambda_dispatch * L_dispatch
              + lambda_physics  * (w_bal * L_bal + w_lim * L_lim + w_min * L_min)
    """

    def __init__(
        self,
        class_weights: Optional[torch.Tensor] = None,
        lambda_severity: float = 1.0,
        lambda_dispatch: float = 1.0,
        lambda_physics: float = 0.5,
        w_bal: float = 2.0,
        w_lim: float = 10.0,
        w_min: float = 0.05,
    ):
        super().__init__()
        self.register_buffer("class_weights", class_weights if class_weights is not None else None)
        self.lambda_severity = lambda_severity
        self.lambda_dispatch = lambda_dispatch
        self.lambda_physics = lambda_physics
        self.w_bal = w_bal
        self.w_lim = w_lim
        self.w_min = w_min

    def forward(
        self,
        preds: Dict[str, torch.Tensor],
        batch: HeteroData,
    ) -> Dict[str, torch.Tensor]:
        """
        Computes composite loss and individual diagnostic metrics.

        Args:
            preds: Output dict from HeteroGATNet containing:
                - 'security_logits': (B, 3)
                - 'severity': (B, 3)
                - 'dispatch': (N_gen,)
            batch: HeteroData batch with:
                - 'y_security': (B,)
                - 'y_severity': (B, 3)
                - 'y_dispatch': (N_gen,)
                - batch['gen'].x: (N_gen, 6) [Pg, Qg, Pmax, Pmin, h_up, h_down]

        Returns:
            Dictionary containing 'loss' (total loss tensor for backward) and scalar metric components.
        """
        device = preds['security_logits'].device

        # 1. Classification Loss (Cross Entropy)
        sec_logits = preds['security_logits']
        if hasattr(batch, 'y_security') and batch.y_security is not None:
            y_sec = batch.y_security.to(device).view(-1)
            weights = self.class_weights.to(device) if self.class_weights is not None else None
            l_class = F.cross_entropy(sec_logits, y_sec, weight=weights)
        else:
            l_class = torch.tensor(0.0, device=device)

        # 2. Severity Regression Loss (Smooth L1 / Huber)
        sev_preds = preds['severity']
        if hasattr(batch, 'y_severity') and batch.y_severity is not None:
            y_sev = batch.y_severity.to(device).view(-1, 3)
            l_sev = F.smooth_l1_loss(sev_preds, y_sev, beta=0.1)
        else:
            l_sev = torch.tensor(0.0, device=device)

        # 3. Corrective Dispatch Supervision Loss (MSE)
        disp_preds = preds['dispatch']
        if hasattr(batch, 'y_dispatch') and batch.y_dispatch is not None:
            y_disp = batch.y_dispatch.to(device).view(-1)
            l_disp = F.mse_loss(disp_preds, y_disp)
        else:
            l_disp = torch.tensor(0.0, device=device)

        # 4. Physics Penalty 1: Power Balance Constraint
        # Total redispatch Delta Pg in each grid instance must sum to ~0
        if hasattr(batch['gen'], 'batch') and batch['gen'].batch is not None:
            gen_batch = batch['gen'].batch.to(device)
            batch_size = int(gen_batch.max().item()) + 1
        else:
            gen_batch = torch.zeros(disp_preds.size(0), dtype=torch.long, device=device)
            batch_size = 1

        net_redispatch_per_graph = torch.zeros(batch_size, device=device)
        net_redispatch_per_graph.scatter_add_(0, gen_batch, disp_preds)
        l_bal = torch.mean(net_redispatch_per_graph ** 2)

        # 5. Physics Penalty 2: Generator Capacity Limit Constraint
        # New output: P_new = Pg + Delta_Pg. Cannot exceed Pmax or go below Pmin.
        # From gen.x: col 0 is Pg, col 2 is Pmax, col 3 is Pmin
        gen_x = batch['gen'].x.to(device)
        pg_current = gen_x[:, 0]
        pmax = gen_x[:, 2]
        pmin = gen_x[:, 3]

        p_new = pg_current + disp_preds
        viol_over_max = F.relu(p_new - pmax)
        viol_under_min = F.relu(pmin - p_new)
        l_lim = torch.mean(viol_over_max ** 2 + viol_under_min ** 2)

        # 6. Physics Penalty 3: Minimal Intervention (L1 Sparsity)
        l_min = torch.mean(torch.abs(disp_preds))

        # 7. Composite Physics Loss
        l_physics = (
            self.w_bal * l_bal +
            self.w_lim * l_lim +
            self.w_min * l_min
        )

        # 8. Total Loss
        total_loss = (
            l_class +
            self.lambda_severity * l_sev +
            self.lambda_dispatch * l_disp +
            self.lambda_physics * l_physics
        )

        return {
            'loss': total_loss,
            'l_class': l_class,
            'l_severity': l_sev,
            'l_dispatch': l_disp,
            'l_physics': l_physics,
            'l_balance': l_bal,
            'l_limits': l_lim,
            'l_min_intervention': l_min,
        }

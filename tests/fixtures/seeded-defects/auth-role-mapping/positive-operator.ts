// Seeded positive sample: a high-risk action route handler that does
// NOT perform an operator check before invoking the action (P0 per
// §9.3 "operator check" + Dataflow 1 trust boundaries).
//
// The audit:auth-role-mapping script MUST report this with rule
// `auth_role.operator_check_missing` at severity P0.

import type { Request, Response } from "express";

const HIGH_RISK_ACTIONS = new Set<string>([
  "externalToolCall",
  "commitSideEffect",
  "transferFunds",
  "executeMission",
]);

export function isHighRiskAction(name: string): boolean {
  return HIGH_RISK_ACTIONS.has(name);
}

export function executeHighRiskAction(req: Request, res: Response): void {
  // BUG: no operatorCheck / operatorContext / operatorId / operatorRole
  // guard before dispatching a high-risk action. The audit MUST flag
  // this as `auth_role.operator_check_missing` (P0).
  const action = req.body?.action as string;
  if (isHighRiskAction(action)) {
    // Intentionally no operator identity check.
    res.json({ ok: true, action, dispatched: true });
  } else {
    res.status(400).json({ ok: false, reason: "not_high_risk" });
  }
}

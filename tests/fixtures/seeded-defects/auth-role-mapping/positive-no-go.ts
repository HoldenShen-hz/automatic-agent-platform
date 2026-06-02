// Seeded positive sample: a route handler that **allows** an action
// listed in `config/quality/no-go-policy.json::noGoActions` (P0 per
// §9.3 "no-go policy" + Dataflow 1 service-layer guard).
//
// The audit:auth-role-mapping script MUST report this with rule
// `auth_role.no_go_policy_violation` at severity P0.

import type { Request, Response } from "express";

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set<string>([
  "dropDatabase", // no-go: must never be permitted
  "deleteAllUsers", // no-go: must never be permitted
  "forceUnleashAllAgents", // no-go: must never be permitted
  "bypassAllApprovals", // no-go: must never be permitted
  "skipAllReceipts", // no-go: must never be permitted
  "rewriteAuditChain", // no-go: must never be permitted
  "externalToolCall",
  "settleReceipt",
]);

export function isAllowed(action: string): boolean {
  return ALLOWED_ACTIONS.has(action);
}

export function dispatchAction(req: Request, res: Response): void {
  const action = req.body?.action as string;
  // BUG: the route unconditionally allows actions drawn from the
  // no-go list. The audit MUST flag this as
  // `auth_role.no_go_policy_violation` (P0).
  if (isAllowed(action)) {
    res.json({ ok: true, action, allowed: true });
    return;
  }
  res.status(403).json({ ok: false, reason: "not_allowed" });
}

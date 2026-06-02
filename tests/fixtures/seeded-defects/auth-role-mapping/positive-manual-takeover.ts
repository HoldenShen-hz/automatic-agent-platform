// Seeded positive sample: a manual-takeover / human-takeover path
// that does **not** write an audit record (P0 per §9.3 "manual
// takeover" + Dataflow 1 evidence boundary).
//
// The audit:auth-role-mapping script MUST report this with rule
// `auth_role.manual_takeover_no_audit` at severity P0.

import type { Request, Response } from "express";

export interface TakeoverContext {
  operatorId: string;
  tenantId: string;
  reason: string;
}

export function manualTakeover(req: Request, res: Response): void {
  const ctx: TakeoverContext = {
    operatorId: req.body?.operatorId as string,
    tenantId: req.body?.tenantId as string,
    reason: req.body?.reason as string,
  };
  // BUG: the takeover path flips a flag / grants an override but
  // never writes a record to `auditLog.*` / `audit.*` / `securityAudit.*`.
  // The audit MUST flag this as `auth_role.manual_takeover_no_audit`
  // (P0) and as `auth_role.break_glass_no_audit` (P0) because the
  // surrounding 30 lines do not call any audit API.
  (req as unknown as { manualTakeoverActive: boolean }).manualTakeoverActive = true;
  res.json({ ok: true, takeover: true, operatorId: ctx.operatorId });
}

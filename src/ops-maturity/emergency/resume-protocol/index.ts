export type ResumeApprovalRole = "platform_admin" | "security_team" | "break_glass";
export type ResumeMode = "standard" | "dry_run" | "break_glass";

export interface ResumePlan {
  readonly planId: string;
  readonly scope: string;
  readonly scopeRef: string;
  readonly approvedBy: readonly string[];
  readonly approvalCount: number;
  readonly approvedRoles?: readonly ResumeApprovalRole[];
  readonly compatibilityCheckRef: string;
  readonly mode: ResumeMode;
  readonly checkpointsVerified: boolean;
  readonly forensicSnapshotReviewed?: boolean;
  readonly rollbackPlanReady?: boolean;
  readonly validationRunPassed?: boolean;
  readonly createdAt: string;
}

function isStrictlyTrue(value: unknown): value is true {
  return value === true;
}

export function canResumeFromPanic(plan: ResumePlan): boolean {
  const scope = plan.scope ?? "";
  if (!scope.trim()) {
    return false;
  }
  const canonicalFields = ["planId", "scopeRef", "compatibilityCheckRef", "createdAt"] as const;
  for (const field of canonicalFields) {
    if (field in plan) {
      const value = plan[field];
      if (typeof value !== "string" || !value.trim()) {
        return false;
      }
    }
  }
  const rawApprovers = Array.isArray(plan.approvedBy)
    ? plan.approvedBy
    : typeof plan.approvedBy === "string"
      ? [plan.approvedBy]
      : [];
  const approvers = [...new Set(rawApprovers.map((item) => item.trim()).filter((item) => item.length > 0))];
  const approvedRoles = Array.isArray(plan.approvedRoles) ? plan.approvedRoles : [];
  const platformAdminCount = approvedRoles.filter((item) => item === "platform_admin").length;
  const breakGlassSatisfied = platformAdminCount >= 1 && approvedRoles.includes("security_team");
  const approvalCount = typeof plan.approvalCount === "number" && Number.isFinite(plan.approvalCount)
    ? plan.approvalCount
    : approvers.length;
  return approvalCount >= 2
    && approvers.length >= 2
    && (platformAdminCount >= 2 || breakGlassSatisfied)
    && isStrictlyTrue(plan.checkpointsVerified)
    && isStrictlyTrue(plan.forensicSnapshotReviewed)
    && isStrictlyTrue(plan.rollbackPlanReady)
    && isStrictlyTrue(plan.validationRunPassed);
}

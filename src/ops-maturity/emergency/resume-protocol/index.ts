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

export function canResumeFromPanic(plan: ResumePlan): boolean {
  if (plan.planId.trim().length === 0 || plan.scope.trim().length === 0 || plan.scopeRef.trim().length === 0) {
    return false;
  }
  if (plan.compatibilityCheckRef.trim().length === 0 || plan.createdAt.trim().length === 0) {
    return false;
  }
  if (!Number.isFinite(Date.parse(plan.createdAt))) {
    return false;
  }
  const rawApprovers = Array.isArray(plan.approvedBy) ? plan.approvedBy : [];
  const approvers = [...new Set(rawApprovers.map((item) => item.trim()).filter((item) => item.length > 0))];
  const approvedRoles = Array.isArray(plan.approvedRoles) ? plan.approvedRoles : [];
  const platformAdminCount = approvedRoles.filter((item) => item === "platform_admin").length;
  const breakGlassSatisfied = platformAdminCount >= 1 && approvedRoles.includes("security_team");
  return plan.approvalCount >= 2
    && approvers.length >= 2
    && (platformAdminCount >= 2 || breakGlassSatisfied)
    && plan.checkpointsVerified
    && (plan.forensicSnapshotReviewed ?? false)
    && (plan.rollbackPlanReady ?? false)
    && (plan.validationRunPassed ?? false);
}

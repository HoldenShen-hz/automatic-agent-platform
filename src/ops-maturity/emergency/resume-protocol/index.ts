export type ResumeApprovalRole = "platform_admin" | "security_team" | "break_glass";

export interface ResumePlan {
  readonly scope: string;
  readonly approvedBy: readonly string[];
  readonly approvedRoles?: readonly ResumeApprovalRole[];
  readonly checkpointsVerified: boolean;
  readonly forensicSnapshotReviewed?: boolean;
  readonly rollbackPlanReady?: boolean;
  readonly validationRunPassed?: boolean;
}

export function canResumeFromPanic(plan: ResumePlan): boolean {
  const rawApprovers = Array.isArray(plan.approvedBy) ? plan.approvedBy : [];
  const approvers = [...new Set(rawApprovers.map((item) => item.trim()).filter((item) => item.length > 0))];
  const approvedRoles = Array.isArray(plan.approvedRoles) ? plan.approvedRoles : [];
  const platformAdminCount = approvedRoles.filter((item) => item === "platform_admin").length;
  const breakGlassSatisfied = platformAdminCount >= 1 && approvedRoles.includes("security_team");
  return approvers.length >= 2
    && (platformAdminCount >= 2 || breakGlassSatisfied)
    && plan.checkpointsVerified
    && (plan.forensicSnapshotReviewed ?? false)
    && (plan.rollbackPlanReady ?? false)
    && (plan.validationRunPassed ?? false);
}

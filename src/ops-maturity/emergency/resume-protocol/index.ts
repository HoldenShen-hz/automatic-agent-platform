export interface ResumePlan {
  readonly scope: string;
  readonly approvedBy: string | readonly string[];
  readonly checkpointsVerified: boolean;
  readonly forensicSnapshotReviewed?: boolean;
  readonly rollbackPlanReady?: boolean;
  readonly validationRunPassed?: boolean;
}

export function canResumeFromPanic(plan: ResumePlan): boolean {
  const approvers = Array.isArray(plan.approvedBy) ? plan.approvedBy : [plan.approvedBy];
  return approvers.filter((item) => item.trim().length > 0).length >= 2
    && plan.checkpointsVerified
    && (plan.forensicSnapshotReviewed ?? false)
    && (plan.rollbackPlanReady ?? false)
    && (plan.validationRunPassed ?? false);
}

export interface ResumePlan {
  readonly scope: string;
  readonly approvedBy: string;
  readonly checkpointsVerified: boolean;
}

export function canResumeFromPanic(plan: ResumePlan): boolean {
  return plan.approvedBy.length > 0 && plan.checkpointsVerified;
}

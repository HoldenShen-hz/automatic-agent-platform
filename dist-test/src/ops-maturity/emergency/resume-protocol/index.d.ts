export interface ResumePlan {
    readonly scope: string;
    readonly approvedBy: string | readonly string[];
    readonly checkpointsVerified: boolean;
    readonly forensicSnapshotReviewed?: boolean;
    readonly rollbackPlanReady?: boolean;
    readonly validationRunPassed?: boolean;
}
export declare function canResumeFromPanic(plan: ResumePlan): boolean;

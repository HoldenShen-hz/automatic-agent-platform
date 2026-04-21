export interface ResumePlan {
    readonly scope: string;
    readonly approvedBy: string;
    readonly checkpointsVerified: boolean;
}
export declare function canResumeFromPanic(plan: ResumePlan): boolean;

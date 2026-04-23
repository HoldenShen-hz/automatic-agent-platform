export type ErasureTargetKind = "task" | "message" | "artifact" | "memory" | "backup";
export type ErasureAction = "erase" | "redact" | "hold" | "skip";
export interface ErasureTarget {
    targetRef: string;
    targetKind: ErasureTargetKind;
    containsPii: boolean;
    legalHold?: boolean;
    backupCopy?: boolean;
}
export interface ErasurePlanStep {
    targetRef: string;
    targetKind: ErasureTargetKind;
    action: ErasureAction;
    reason: string;
}
export interface ErasurePlan {
    requestId: string;
    subjectRef: string;
    requestedBy: string;
    dueAt: string;
    status: "planned" | "blocked_by_legal_hold" | "ready";
    steps: ErasurePlanStep[];
    createdAt: string;
}
export declare class ErasurePlanningService {
    createPlan(input: {
        subjectRef: string;
        requestedBy: string;
        targets: ErasureTarget[];
        slaHours: number;
    }): ErasurePlan;
}

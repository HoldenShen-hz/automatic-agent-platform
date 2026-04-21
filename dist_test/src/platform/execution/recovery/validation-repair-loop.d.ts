export type ValidationLoopStage = "planned" | "built" | "review_failed" | "validation_failed" | "failed_repairable" | "failed_blocking" | "escalated" | "released" | "rolled_back";
export interface ValidationFailureRecord {
    check: string;
    details: string;
}
export interface RepairEvidencePackage {
    taskId: string;
    failedChecks: ValidationFailureRecord[];
    changedFiles: string[];
    allowedFixScope: string[];
    forbiddenScope: string[];
    maxDiffLines: number;
    repairRound: number;
}
export interface ValidationDecision {
    stage: ValidationLoopStage;
    reasonCode: string;
    requiresRepair: boolean;
    requiresEscalation: boolean;
}
export interface ValidationLoopInput {
    taskId: string;
    reviewPassed: boolean;
    validationPassed: boolean;
    failedChecks: readonly ValidationFailureRecord[];
    changedFiles: readonly string[];
    allowedFixScope: readonly string[];
    forbiddenScope: readonly string[];
    maxDiffLines: number;
    repairRound: number;
    maxRepairRounds: number;
    touchedForbiddenScope?: boolean;
}
export declare class ValidationRepairLoopService {
    buildRepairEvidencePackage(input: ValidationLoopInput): RepairEvidencePackage;
    decide(input: ValidationLoopInput): ValidationDecision;
}

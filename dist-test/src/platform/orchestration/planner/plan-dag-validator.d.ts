import type { PlanStep } from "../oapeflir/types/index.js";
export interface PlanDagValidationResult {
    valid: boolean;
    issues: string[];
    orderedSteps: PlanStep[];
}
export declare class PlanDagValidator {
    validate(steps: readonly PlanStep[]): PlanDagValidationResult;
}

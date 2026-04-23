import type { HarnessToolbelt } from "../toolbelt-assembler.js";
export type GuardrailSeverity = "info" | "warn" | "block";
export interface GuardrailFinding {
    readonly layer: "policy" | "risk" | "tool" | "evidence" | "budget";
    readonly severity: GuardrailSeverity;
    readonly code: string;
    readonly message: string;
}
export interface GuardrailAssessment {
    readonly passed: boolean;
    readonly requiresHuman: boolean;
    readonly suggestedAction: "proceed" | "retry_same_plan" | "escalate_to_human" | "abort";
    readonly findings: readonly GuardrailFinding[];
}
export interface GuardrailAssessmentInput {
    readonly toolbelt: HarnessToolbelt;
    readonly evidenceRefs: readonly string[];
    readonly riskScore: number;
    readonly maxRiskScore: number;
    readonly escalationThreshold: number;
    readonly currentStepCount: number;
    readonly maxSteps: number;
}
export declare class GuardrailEngine {
    assess(input: GuardrailAssessmentInput): GuardrailAssessment;
}

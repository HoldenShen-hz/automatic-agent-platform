export type EscalationRiskLevel = "low" | "medium" | "high" | "critical";
export type EscalationDecisionType = "none" | "approval" | "takeover" | "panic_stop";
export type EscalationStage = "assess" | "plan" | "execute" | "feedback" | "improve" | "release";
export interface EscalationRequest {
    taskId: string;
    executionId: string | null;
    tenantId: string | null;
    stage: EscalationStage;
    riskLevel: EscalationRiskLevel;
    reasonCode: string;
    estimatedCostUsd: number | null;
    affectsProduction: boolean;
}
export interface EscalationDecision {
    decision: EscalationDecisionType;
    reasonCode: string;
    requiresOperatorAction: boolean;
}
export declare class EscalationService {
    decide(input: EscalationRequest): EscalationDecision;
}

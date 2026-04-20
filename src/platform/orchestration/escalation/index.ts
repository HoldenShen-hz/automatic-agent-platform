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

export class EscalationService {
  public decide(input: EscalationRequest): EscalationDecision {
    if (input.riskLevel === "critical" && input.affectsProduction) {
      return {
        decision: "panic_stop",
        reasonCode: "escalation.critical_prod_stop",
        requiresOperatorAction: true,
      };
    }
    if (input.riskLevel === "critical" || (input.riskLevel === "high" && input.stage === "execute")) {
      return {
        decision: "takeover",
        reasonCode: "escalation.human_takeover_required",
        requiresOperatorAction: true,
      };
    }
    if (input.affectsProduction || (input.estimatedCostUsd ?? 0) >= 10 || input.riskLevel === "high") {
      return {
        decision: "approval",
        reasonCode: "escalation.approval_required",
        requiresOperatorAction: true,
      };
    }
    return {
      decision: "none",
      reasonCode: "escalation.not_required",
      requiresOperatorAction: false,
    };
  }
}

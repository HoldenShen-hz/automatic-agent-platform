import { nowIso } from "../../platform/contracts/types/ids.js";

export type LegacyAutonomyLevel =
  | "manual"
  | "suggestion"
  | "supervised"
  | "semi_auto"
  | "auto"
  | "full_auto"
  | "frozen";

export interface LegacyAutonomyDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly level: LegacyAutonomyLevel;
  readonly reason: string;
  readonly timestamp: string;
  readonly actor: string;
}

export interface AutonomyLevelRequest {
  readonly taskId: string;
  readonly taskType: string;
  readonly riskScore: number;
  readonly userId: string;
}

export interface EscalationRequest {
  readonly taskId: string;
  readonly reason: string;
  readonly targetLevel: "manual" | "supervised" | "semi_auto" | "auto" | "full_auto";
}

export interface EscalationResult {
  readonly taskId: string;
  readonly previousLevel: LegacyAutonomyLevel;
  readonly newLevel: "manual" | "supervised" | "semi_auto" | "auto" | "full_auto";
  readonly reason: string;
  readonly escalatedAt: string;
}

const TASK_TYPE_RISK_ADJUSTMENTS: Record<string, number> = {
  approval_action: 25,
  deploy: 20,
  deployment: 20,
  database_migration: 20,
  credential_rotation: 15,
  financial_transfer: 25,
  payment: 25,
  production_change: 15,
};

function normalizeTaskType(taskType: string): string {
  return taskType.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveEffectiveRiskScore(riskScore: number, taskType: string): number {
  const normalizedTaskType = normalizeTaskType(taskType);
  const riskAdjustment = TASK_TYPE_RISK_ADJUSTMENTS[normalizedTaskType] ?? 0;
  return Math.min(100, Math.max(0, riskScore + riskAdjustment));
}

function resolveLevel(riskScore: number, taskType: string): LegacyAutonomyLevel {
  const effectiveRiskScore = resolveEffectiveRiskScore(riskScore, taskType);
  if (effectiveRiskScore >= 80) {
    return "manual";
  }
  if (effectiveRiskScore >= 60) {
    return "supervised";
  }
  if (effectiveRiskScore >= 40) {
    return "semi_auto";
  }
  return "auto";
}

export class AutonomyService {
  public determineLevel(request: AutonomyLevelRequest): LegacyAutonomyDecision {
    const effectiveRiskScore = resolveEffectiveRiskScore(request.riskScore, request.taskType);
    const level = resolveLevel(request.riskScore, request.taskType);
    return {
      decisionId: `autonomy_${request.taskId}`,
      taskId: request.taskId,
      level,
      reason: `risk_score=${request.riskScore}; effective_risk_score=${effectiveRiskScore}; task_type=${request.taskType}`,
      timestamp: nowIso(),
      actor: request.userId,
    };
  }

  public escalate(request: EscalationRequest): EscalationResult {
    return {
      taskId: request.taskId,
      previousLevel: "auto",
      newLevel: request.targetLevel,
      reason: request.reason,
      escalatedAt: nowIso(),
    };
  }
}

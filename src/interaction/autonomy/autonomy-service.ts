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

function resolveLevel(riskScore: number): LegacyAutonomyLevel {
  if (riskScore >= 80) {
    return "manual";
  }
  if (riskScore >= 60) {
    return "supervised";
  }
  if (riskScore >= 40) {
    return "semi_auto";
  }
  return "auto";
}

export class AutonomyService {
  public determineLevel(request: AutonomyLevelRequest): LegacyAutonomyDecision {
    const level = resolveLevel(request.riskScore);
    return {
      decisionId: `autonomy_${request.taskId}`,
      taskId: request.taskId,
      level,
      reason: `risk_score=${request.riskScore}; task_type=${request.taskType}`,
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

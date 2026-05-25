import type { CapabilityTrustScore, TrustLevel } from "../index.js";

export type ArchitectureAutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto";
export const AUTONOMY_DEMOTION_TRUST_SCORE = 30;
export const NO_EXECUTION_DEMOTION_THRESHOLD_DAYS = 180;

export function calibrateTrustDecayRate(
  initialScore = 100,
  targetScore = AUTONOMY_DEMOTION_TRUST_SCORE,
  targetDays = NO_EXECUTION_DEMOTION_THRESHOLD_DAYS,
): number {
  if (targetDays <= 0 || initialScore <= 0) {
    return 0;
  }
  const clampedTargetScore = Math.min(Math.max(targetScore, 0), initialScore);
  if (clampedTargetScore === initialScore) {
    return 0;
  }
  return 1 - Math.pow(clampedTargetScore / initialScore, 1 / targetDays);
}

export const DEFAULT_TRUST_DECAY_RATE = calibrateTrustDecayRate();

export function calculateTrustScore(score: CapabilityTrustScore): number {
  if (score.totalExecutions === 0) {
    return 0;
  }
  const successRate = score.successfulExecutions / score.totalExecutions;
  const successPoints = successRate * 100;
  const overridePenalty = (score.humanOverrides / score.totalExecutions) * 20;
  const incidentPenalty = score.incidents * 15;
  const volumeBonus = Math.min(10, Math.floor(score.totalExecutions / 50));
  return Math.max(0, Math.min(100, Math.round(successPoints - overridePenalty - incidentPenalty + volumeBonus)));
}

export function mapTrustLevel(score: number): TrustLevel {
  if (score >= 95) return "fully_trusted";
  if (score >= 85) return "trusted";
  if (score >= 70) return "semi_trusted";
  if (score >= 50) return "supervised";
  if (score >= 30) return "probation";
  return "untrusted";
}

export function mapTrustLevelToAutonomyLevel(level: TrustLevel): ArchitectureAutonomyLevel {
  switch (level) {
    case "fully_trusted":
      return "full_auto";
    case "trusted":
    case "semi_trusted":
      return "semi_auto";
    case "supervised":
      return "supervised";
    case "probation":
    case "untrusted":
    default:
      return "suggestion";
  }
}

export function applyTrustDecay(
  score: number,
  inactiveDays: number,
  decayRate = DEFAULT_TRUST_DECAY_RATE,
): number {
  if (inactiveDays <= 0) {
    return score;
  }
  const decayed = score * Math.pow(1 - decayRate, inactiveDays);
  return Math.max(0, Math.round(decayed));
}

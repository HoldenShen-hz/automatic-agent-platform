import type { CapabilityTrustScore, TrustLevel } from "../index.js";

export function calculateTrustScore(score: CapabilityTrustScore): number {
  if (score.totalExecutions === 0) {
    return 0;
  }
  const successPoints = (score.successfulExecutions / score.totalExecutions) * 100;
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

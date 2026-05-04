import type { CapabilityTrustScore, TrustLevel } from "../index.js";

export type ArchitectureAutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto";

function hasDomainScopedShape(score: CapabilityTrustScore): boolean {
  const raw = score as unknown as Record<string, unknown>;
  return typeof raw["domainId"] === "string";
}

export function calculateTrustScore(score: CapabilityTrustScore): number {
  if (score.totalExecutions === 0) {
    return 0;
  }

  if (hasDomainScopedShape(score)) {
    const successPoints = (score.successfulExecutions / score.totalExecutions) * 1000;
    const overridePenalty = (score.humanOverrides / score.totalExecutions) * 200;
    const volumeBonus = Math.min(100, Math.floor(score.totalExecutions / 50));
    const incidentPenaltyScale = Math.min(1, 100 / Math.max(score.totalExecutions, 1));
    const incidentPenalty = score.incidents * 150 * incidentPenaltyScale;
    return Math.max(0, Math.min(1000, Math.round(successPoints - overridePenalty - incidentPenalty + volumeBonus)));
  }

  const successPoints = (score.successfulExecutions / score.totalExecutions) * 100;
  const overridePenalty = (score.humanOverrides / score.totalExecutions) * 20;
  const incidentPenalty = score.incidents * 15;
  const volumeBonus = Math.min(10, Math.floor(score.totalExecutions / 50));
  return Math.max(0, Math.min(100, Math.round(successPoints - overridePenalty - incidentPenalty + volumeBonus)));
}

export function mapTrustLevel(score: number): TrustLevel {
  // R5-21 fix: §42.1 requires TrustScore range 0-1000 for domain-scoped profiles
  // Detect domain-scoped range by checking if score > 100 (the non-domainScoped max)
  const isDomainScoped = score > 100;
  const maxRange = isDomainScoped ? 1000 : 100;

  if (score <= maxRange * 0.1) {
    if (score >= maxRange * 0.95) return "fully_trusted";
    if (score >= maxRange * 0.85) return "trusted";
    if (score >= maxRange * 0.70) return "semi_trusted";
    if (score >= maxRange * 0.50) return "supervised";
    if (score >= maxRange * 0.30) return "probation";
    return "untrusted";
  }

  // score > 10% of maxRange
  if (score >= maxRange * 0.95) return "fully_trusted";
  if (score >= maxRange * 0.85) return "trusted";
  if (score >= maxRange * 0.70) return "semi_trusted";
  if (score >= maxRange * 0.50) return "supervised";
  if (score >= maxRange * 0.30) return "probation";
  return "untrusted";
}

export interface RiskCheckOptions {
  readonly domainId?: string;
  readonly riskClass?: "low" | "medium" | "high" | "critical";
  readonly isHighRiskDomain?: boolean;
  readonly requiresHumanAccountable?: boolean;
}

/**
 * R1-10: Inherent risk check before mapping trust level to autonomy level.
 * Per architecture, fully_trusted cannot map directly to full_auto without
 * verifying no inherent risk/compliance/sandbox concerns exist.
 */
export function checkInherentRisk(options: RiskCheckOptions): boolean {
  // Critical risk class or high-risk domain: no full auto
  if (options.riskClass === "critical") {
    return false;
  }
  if (options.riskClass === "high" || options.isHighRiskDomain) {
    return false;
  }
  // Human accountable domains: no full auto
  if (options.requiresHumanAccountable) {
    return false;
  }
  return true;
}

export function mapTrustLevelToAutonomyLevel(
  level: TrustLevel,
  options?: RiskCheckOptions,
): ArchitectureAutonomyLevel {
  // R1-10: Before mapping fully_trusted to full_auto, verify inherent risk
  if (level === "fully_trusted") {
    if (options != null && !checkInherentRisk(options)) {
      return "semi_auto"; // Downgrade due to inherent risk
    }
    return "full_auto";
  }
  switch (level) {
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
  decayRate = 0.05,
): number {
  if (inactiveDays <= 0) {
    return score;
  }
  const decayed = score * Math.pow(1 - decayRate, inactiveDays);
  return Math.max(0, Math.round(decayed));
}

/**
 * R5-27: Validates that a trust score value is within the expected range.
 * TrustScore per §42.1 should be in range [0, 1000] for domain-scoped profiles.
 * Returns true if valid, false if out of range.
 */
export function validateTrustScoreRange(score: number, isDomainScoped = false): boolean {
  const maxRange = isDomainScoped ? 1000 : 100;
  return Number.isFinite(score) && score >= 0 && score <= maxRange;
}

/**
 * R5-27: Clamps a trust score to the valid range [0, maxRange].
 * maxRange is 1000 for domain-scoped profiles, 100 for non-domain-scoped.
 */
export function clampTrustScore(score: number, isDomainScoped = false): number {
  const maxRange = isDomainScoped ? 1000 : 100;
  return Math.max(0, Math.min(maxRange, score));
}

import { z } from "zod";

export const DomainRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const DomainRiskDimensionSchema = z.object({
  dimension: z.string().min(1),
  weight: z.number().min(0).max(1),
  threshold: z.number().min(0).max(100),
  mitigation: z.string().min(1),
});

/**
 * Risk override for domain-specific risk adjustment.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export const RiskOverrideSchema = z.object({
  actionPattern: z.string().min(1),
  baseRisk: z.number().min(0).max(100),
  domainRisk: z.number().min(0).max(100),
  reason: z.string().min(1),
  requiresJustification: z.boolean().default(false),
});

/**
 * Escalation level for risk-based escalation.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export const EscalationLevelSchema = z.object({
  level: z.number().int().min(1),
  trigger: z.string().min(1),
  target: z.enum(["domain_owner", "platform_sre", "security_team", "executive"]),
  responseSla: z.string().min(1),
});

/**
 * Approval rule for mandatory approvals.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export const ApprovalRuleSchema = z.object({
  ruleId: z.string().min(1),
  actionPattern: z.string().min(1),
  requiredApprovals: z.number().int().min(1).default(1),
  approverRole: z.string().min(1),
});

export const DomainRiskProfileSchema = z.object({
  profileId: z.string().min(1),
  domainId: z.string().min(1),
  defaultRiskLevel: DomainRiskLevelSchema,
  dimensions: z.array(DomainRiskDimensionSchema).default([]),
  // §37.3 enhanced fields (optional for backward compatibility)
  regulatoryClass: z.enum(["unregulated", "lightly_regulated", "regulated", "heavily_regulated"]).optional(),
  timeSensitivity: z.enum(["batch", "near_realtime", "realtime", "ultra_realtime"]).optional(),
  reversibility: z.enum(["fully_reversible", "partially_reversible", "irreversible"]).optional(),
  blastRadius: z.enum(["single_user", "team", "department", "company", "external"]).optional(),
  riskOverrides: z.array(RiskOverrideSchema).optional(),
  escalationChain: z.array(EscalationLevelSchema).optional(),
  mandatoryApprovals: z.array(ApprovalRuleSchema).optional(),
});

export type DomainRiskLevel = z.infer<typeof DomainRiskLevelSchema>;
export type DomainRiskDimension = z.infer<typeof DomainRiskDimensionSchema>;
export type RiskOverride = z.infer<typeof RiskOverrideSchema>;
export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;
export type DomainRiskProfile = z.infer<typeof DomainRiskProfileSchema>;

export const DOMAIN_RISK_SCORE_THRESHOLDS = Object.freeze({
  medium: 35,
  high: 65,
  critical: 85,
});

export function computeDomainRiskLevel(profile: DomainRiskProfile, score: number): DomainRiskLevel {
  if (!Number.isFinite(score)) {
    return profile.defaultRiskLevel === "critical"
      ? "medium"
      : profile.defaultRiskLevel === "high"
        ? "high"
        : profile.defaultRiskLevel;
  }
  if (score >= DOMAIN_RISK_SCORE_THRESHOLDS.critical) {
    return "critical";
  }
  if (score >= DOMAIN_RISK_SCORE_THRESHOLDS.high) {
    return "high";
  }
  if (score >= DOMAIN_RISK_SCORE_THRESHOLDS.medium) {
    return "medium";
  }
  return profile.defaultRiskLevel === "critical"
    ? "medium"
    : profile.defaultRiskLevel === "high"
      ? "high"
      : "low";
}

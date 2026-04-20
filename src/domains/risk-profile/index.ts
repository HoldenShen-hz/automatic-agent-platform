import { z } from "zod";

export const DomainRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const DomainRiskDimensionSchema = z.object({
  dimension: z.string().min(1),
  weight: z.number().min(0).max(1),
  threshold: z.number().min(0).max(100),
  mitigation: z.string().min(1),
});

export const DomainRiskProfileSchema = z.object({
  profileId: z.string().min(1),
  domainId: z.string().min(1),
  defaultRiskLevel: DomainRiskLevelSchema,
  dimensions: z.array(DomainRiskDimensionSchema).default([]),
});

export type DomainRiskLevel = z.infer<typeof DomainRiskLevelSchema>;
export type DomainRiskDimension = z.infer<typeof DomainRiskDimensionSchema>;
export type DomainRiskProfile = z.infer<typeof DomainRiskProfileSchema>;

export function computeDomainRiskLevel(profile: DomainRiskProfile, score: number): DomainRiskLevel {
  if (score >= 85) {
    return "critical";
  }
  if (score >= 65) {
    return "high";
  }
  if (score >= 35) {
    return "medium";
  }
  return profile.defaultRiskLevel === "critical" ? "medium" : "low";
}

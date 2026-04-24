import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const QualityAssuranceTaskTypeSchema = z.enum(["design", "validate", "certify"]);
export type QualityAssuranceTaskType = z.infer<typeof QualityAssuranceTaskTypeSchema>;

export const QUALITY_ASSURANCE_DOMAIN_PRESET = createDomainModulePreset("quality-assurance", ["design", "validate", "certify"] as const, ["validate", "certify"] as const);
export type QualityAssuranceDomainPreset = typeof QUALITY_ASSURANCE_DOMAIN_PRESET;

export function requiresQualityAssuranceReview(taskType: QualityAssuranceTaskType): boolean {
  return requiresPresetReview(QUALITY_ASSURANCE_DOMAIN_PRESET, taskType);
}

import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const HealthcareTaskTypeSchema = z.enum(["triage", "summarize", "coordinate"]);
export type HealthcareTaskType = z.infer<typeof HealthcareTaskTypeSchema>;

export const HEALTHCARE_DOMAIN_PRESET = createDomainModulePreset("healthcare", ["triage", "summarize", "coordinate"] as const, ["summarize", "coordinate"] as const);
export type HealthcareDomainPreset = typeof HEALTHCARE_DOMAIN_PRESET;

export function requiresHealthcareReview(taskType: HealthcareTaskType): boolean {
  return requiresPresetReview(HEALTHCARE_DOMAIN_PRESET, taskType);
}

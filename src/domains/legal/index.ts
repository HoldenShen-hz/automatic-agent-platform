import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const LegalTaskTypeSchema = z.enum(["review", "redline", "advise"]);
export type LegalTaskType = z.infer<typeof LegalTaskTypeSchema>;

export const LEGAL_DOMAIN_PRESET = createDomainModulePreset("legal", ["review", "redline", "advise"] as const, ["redline", "advise"] as const);
export type LegalDomainPreset = typeof LEGAL_DOMAIN_PRESET;

export function requiresAttorneyReview(taskType: LegalTaskType): boolean {
  return taskType === "review" || taskType === "redline" || taskType === "advise";
}

export function requiresLegalReview(taskType: LegalTaskType): boolean {
  return requiresPresetReview(LEGAL_DOMAIN_PRESET, taskType);
}

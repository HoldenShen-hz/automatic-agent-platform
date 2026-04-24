import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const EducationTaskTypeSchema = z.enum(["design", "coach", "assess"]);
export type EducationTaskType = z.infer<typeof EducationTaskTypeSchema>;

export const EDUCATION_DOMAIN_PRESET = createDomainModulePreset("education", ["design", "coach", "assess"] as const, ["coach", "assess"] as const);
export type EducationDomainPreset = typeof EDUCATION_DOMAIN_PRESET;

export function requiresEducationReview(taskType: EducationTaskType): boolean {
  return requiresPresetReview(EDUCATION_DOMAIN_PRESET, taskType);
}

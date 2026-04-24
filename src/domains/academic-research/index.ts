import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const AcademicResearchTaskTypeSchema = z.enum(["collect", "evaluate", "synthesize"]);
export type AcademicResearchTaskType = z.infer<typeof AcademicResearchTaskTypeSchema>;

export const ACADEMIC_RESEARCH_DOMAIN_PRESET = createDomainModulePreset("academic-research", ["collect", "evaluate", "synthesize"] as const, ["evaluate", "synthesize"] as const);
export type AcademicResearchDomainPreset = typeof ACADEMIC_RESEARCH_DOMAIN_PRESET;

export function requiresAcademicResearchReview(taskType: AcademicResearchTaskType): boolean {
  return requiresPresetReview(ACADEMIC_RESEARCH_DOMAIN_PRESET, taskType);
}

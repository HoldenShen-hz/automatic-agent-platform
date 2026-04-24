import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const IndustryResearchTaskTypeSchema = z.enum(["research", "summarize", "brief"]);
export type IndustryResearchTaskType = z.infer<typeof IndustryResearchTaskTypeSchema>;

export const INDUSTRY_RESEARCH_DOMAIN_PRESET = createDomainModulePreset("industry-research", ["research", "summarize", "brief"] as const, ["brief"] as const);
export type IndustryResearchDomainPreset = typeof INDUSTRY_RESEARCH_DOMAIN_PRESET;

export function requiresIndustryResearchReview(taskType: IndustryResearchTaskType): boolean {
  return requiresPresetReview(INDUSTRY_RESEARCH_DOMAIN_PRESET, taskType);
}

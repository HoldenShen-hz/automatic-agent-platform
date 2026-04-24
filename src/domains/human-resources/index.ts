import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const HumanResourcesTaskTypeSchema = z.enum(["screen", "review", "coordinate"]);
export type HumanResourcesTaskType = z.infer<typeof HumanResourcesTaskTypeSchema>;

export const HUMAN_RESOURCES_DOMAIN_PRESET = createDomainModulePreset("human-resources", ["screen", "review", "coordinate"] as const, ["review", "coordinate"] as const);
export type HumanResourcesDomainPreset = typeof HUMAN_RESOURCES_DOMAIN_PRESET;

export function requiresHumanResourcesReview(taskType: HumanResourcesTaskType): boolean {
  return requiresPresetReview(HUMAN_RESOURCES_DOMAIN_PRESET, taskType);
}

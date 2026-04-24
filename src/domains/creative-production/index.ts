import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const CreativeProductionTaskTypeSchema = z.enum(["concept", "draft", "iterate"]);
export type CreativeProductionTaskType = z.infer<typeof CreativeProductionTaskTypeSchema>;

export const CREATIVE_PRODUCTION_DOMAIN_PRESET = createDomainModulePreset("creative-production", ["concept", "draft", "iterate"] as const, ["draft", "iterate"] as const);
export type CreativeProductionDomainPreset = typeof CREATIVE_PRODUCTION_DOMAIN_PRESET;

export function requiresCreativeProductionReview(taskType: CreativeProductionTaskType): boolean {
  return requiresPresetReview(CREATIVE_PRODUCTION_DOMAIN_PRESET, taskType);
}

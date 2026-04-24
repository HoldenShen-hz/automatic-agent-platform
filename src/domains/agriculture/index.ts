import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const AgricultureTaskTypeSchema = z.enum(["plan", "monitor", "recommend"]);
export type AgricultureTaskType = z.infer<typeof AgricultureTaskTypeSchema>;

export const AGRICULTURE_DOMAIN_PRESET = createDomainModulePreset("agriculture", ["plan", "monitor", "recommend"] as const, ["monitor", "recommend"] as const);
export type AgricultureDomainPreset = typeof AGRICULTURE_DOMAIN_PRESET;

export function requiresAgricultureReview(taskType: AgricultureTaskType): boolean {
  return requiresPresetReview(AGRICULTURE_DOMAIN_PRESET, taskType);
}

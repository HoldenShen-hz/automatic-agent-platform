import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const FacilitiesTaskTypeSchema = z.enum(["dispatch", "inspect", "coordinate"]);
export type FacilitiesTaskType = z.infer<typeof FacilitiesTaskTypeSchema>;

export const FACILITIES_DOMAIN_PRESET = createDomainModulePreset("facilities", ["dispatch", "inspect", "coordinate"] as const, ["inspect", "coordinate"] as const);
export type FacilitiesDomainPreset = typeof FACILITIES_DOMAIN_PRESET;

export function requiresFacilitiesReview(taskType: FacilitiesTaskType): boolean {
  return requiresPresetReview(FACILITIES_DOMAIN_PRESET, taskType);
}

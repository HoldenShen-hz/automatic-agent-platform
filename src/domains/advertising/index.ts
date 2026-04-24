import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const AdvertisingTaskTypeSchema = z.enum(["plan", "launch", "optimize"]);
export type AdvertisingTaskType = z.infer<typeof AdvertisingTaskTypeSchema>;

export const ADVERTISING_DOMAIN_PRESET = createDomainModulePreset("advertising", ["plan", "launch", "optimize"] as const, ["launch", "optimize"] as const);
export type AdvertisingDomainPreset = typeof ADVERTISING_DOMAIN_PRESET;

export function requiresAdvertisingReview(taskType: AdvertisingTaskType): boolean {
  return requiresPresetReview(ADVERTISING_DOMAIN_PRESET, taskType);
}

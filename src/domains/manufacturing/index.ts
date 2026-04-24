import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ManufacturingTaskTypeSchema = z.enum(["plan", "monitor", "correct"]);
export type ManufacturingTaskType = z.infer<typeof ManufacturingTaskTypeSchema>;

export const MANUFACTURING_DOMAIN_PRESET = createDomainModulePreset("manufacturing", ["plan", "monitor", "correct"] as const, ["monitor", "correct"] as const);
export type ManufacturingDomainPreset = typeof MANUFACTURING_DOMAIN_PRESET;

export function requiresManufacturingReview(taskType: ManufacturingTaskType): boolean {
  return requiresPresetReview(MANUFACTURING_DOMAIN_PRESET, taskType);
}

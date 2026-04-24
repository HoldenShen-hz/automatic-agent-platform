import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const DataEngineeringTaskTypeSchema = z.enum(["ingest", "clean", "transform"]);
export type DataEngineeringTaskType = z.infer<typeof DataEngineeringTaskTypeSchema>;

export const DATA_ENGINEERING_DOMAIN_PRESET = createDomainModulePreset("data-engineering", ["ingest", "clean", "transform"] as const, ["clean", "transform"] as const);
export type DataEngineeringDomainPreset = typeof DATA_ENGINEERING_DOMAIN_PRESET;

export function requiresDataEngineeringReview(taskType: DataEngineeringTaskType): boolean {
  return requiresPresetReview(DATA_ENGINEERING_DOMAIN_PRESET, taskType);
}

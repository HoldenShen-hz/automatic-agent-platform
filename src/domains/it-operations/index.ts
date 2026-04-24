import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ItOperationsTaskTypeSchema = z.enum(["detect", "mitigate", "recover"]);
export type ItOperationsTaskType = z.infer<typeof ItOperationsTaskTypeSchema>;

export const IT_OPERATIONS_DOMAIN_PRESET = createDomainModulePreset("it-operations", ["detect", "mitigate", "recover"] as const, ["mitigate", "recover"] as const);
export type ItOperationsDomainPreset = typeof IT_OPERATIONS_DOMAIN_PRESET;

export function requiresItOperationsReview(taskType: ItOperationsTaskType): boolean {
  return requiresPresetReview(IT_OPERATIONS_DOMAIN_PRESET, taskType);
}

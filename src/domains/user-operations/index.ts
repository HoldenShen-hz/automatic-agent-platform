import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const UserOperationsTaskTypeSchema = z.enum(["segment", "operate", "follow-up"]);
export type UserOperationsTaskType = z.infer<typeof UserOperationsTaskTypeSchema>;

export const USER_OPERATIONS_DOMAIN_PRESET = createDomainModulePreset("user-operations", ["segment", "operate", "follow-up"] as const, ["operate", "follow-up"] as const);
export type UserOperationsDomainPreset = typeof USER_OPERATIONS_DOMAIN_PRESET;

export function requiresUserOperationsReview(taskType: UserOperationsTaskType): boolean {
  return requiresPresetReview(USER_OPERATIONS_DOMAIN_PRESET, taskType);
}

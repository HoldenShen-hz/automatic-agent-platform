import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const EcommerceTaskTypeSchema = z.enum(["catalog", "pricing", "order"]);
export type EcommerceTaskType = z.infer<typeof EcommerceTaskTypeSchema>;

export const ECOMMERCE_DOMAIN_PRESET = createDomainModulePreset("ecommerce", ["catalog", "pricing", "order"] as const, ["pricing", "order"] as const);
export type EcommerceDomainPreset = typeof ECOMMERCE_DOMAIN_PRESET;

export function requiresEcommerceReview(taskType: EcommerceTaskType): boolean {
  return requiresPresetReview(ECOMMERCE_DOMAIN_PRESET, taskType);
}

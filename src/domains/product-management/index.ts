import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ProductManagementTaskTypeSchema = z.enum(["discover", "prioritize", "specify"]);
export type ProductManagementTaskType = z.infer<typeof ProductManagementTaskTypeSchema>;

export const PRODUCT_MANAGEMENT_DOMAIN_PRESET = createDomainModulePreset("product-management", ["discover", "prioritize", "specify"] as const, ["prioritize", "specify"] as const);
export type ProductManagementDomainPreset = typeof PRODUCT_MANAGEMENT_DOMAIN_PRESET;

export function requiresProductManagementReview(taskType: ProductManagementTaskType): boolean {
  return requiresPresetReview(PRODUCT_MANAGEMENT_DOMAIN_PRESET, taskType);
}

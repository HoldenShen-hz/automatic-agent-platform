import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const FinancialServicesTaskTypeSchema = z.enum(["review", "advise", "execute"]);
export type FinancialServicesTaskType = z.infer<typeof FinancialServicesTaskTypeSchema>;

export const FINANCIAL_SERVICES_DOMAIN_PRESET = createDomainModulePreset("financial-services", ["review", "advise", "execute"] as const, ["advise", "execute"] as const);
export type FinancialServicesDomainPreset = typeof FINANCIAL_SERVICES_DOMAIN_PRESET;

export function requiresFinancialServicesReview(taskType: FinancialServicesTaskType): boolean {
  return requiresPresetReview(FINANCIAL_SERVICES_DOMAIN_PRESET, taskType);
}

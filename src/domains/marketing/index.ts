import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const MarketingTaskTypeSchema = z.enum(["plan", "publish", "measure"]);
export type MarketingTaskType = z.infer<typeof MarketingTaskTypeSchema>;

export const MARKETING_DOMAIN_PRESET = createDomainModulePreset("marketing", ["plan", "publish", "measure"] as const, ["publish", "measure"] as const);
export type MarketingDomainPreset = typeof MARKETING_DOMAIN_PRESET;

export function requiresMarketingReview(taskType: MarketingTaskType): boolean {
  return requiresPresetReview(MARKETING_DOMAIN_PRESET, taskType);
}

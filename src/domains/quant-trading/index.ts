import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const QuantTradingTaskTypeSchema = z.enum(["research", "simulate", "trade"]);
export type QuantTradingTaskType = z.infer<typeof QuantTradingTaskTypeSchema>;

export const QUANT_TRADING_DOMAIN_PRESET = createDomainModulePreset("quant-trading", ["research", "simulate", "trade"] as const, ["simulate", "trade"] as const);
export type QuantTradingDomainPreset = typeof QUANT_TRADING_DOMAIN_PRESET;

export function requiresQuantTradingReview(taskType: QuantTradingTaskType): boolean {
  return requiresPresetReview(QUANT_TRADING_DOMAIN_PRESET, taskType);
}

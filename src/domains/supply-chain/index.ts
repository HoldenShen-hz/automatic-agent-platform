import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const SupplyChainTaskTypeSchema = z.enum(["plan", "route", "resolve"]);
export type SupplyChainTaskType = z.infer<typeof SupplyChainTaskTypeSchema>;

export const SUPPLY_CHAIN_DOMAIN_PRESET = createDomainModulePreset("supply-chain", ["plan", "route", "resolve"] as const, ["route", "resolve"] as const);
export type SupplyChainDomainPreset = typeof SUPPLY_CHAIN_DOMAIN_PRESET;

export function requiresSupplyChainReview(taskType: SupplyChainTaskType): boolean {
  return requiresPresetReview(SUPPLY_CHAIN_DOMAIN_PRESET, taskType);
}

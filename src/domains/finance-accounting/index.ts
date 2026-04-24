import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const FinanceAccountingTaskTypeSchema = z.enum(["reconcile", "report", "forecast"]);
export type FinanceAccountingTaskType = z.infer<typeof FinanceAccountingTaskTypeSchema>;

export const FINANCE_ACCOUNTING_DOMAIN_PRESET = createDomainModulePreset("finance-accounting", ["reconcile", "report", "forecast"] as const, ["report", "forecast"] as const);
export type FinanceAccountingDomainPreset = typeof FINANCE_ACCOUNTING_DOMAIN_PRESET;

export function requiresFinanceAccountingReview(taskType: FinanceAccountingTaskType): boolean {
  return requiresPresetReview(FINANCE_ACCOUNTING_DOMAIN_PRESET, taskType);
}

import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const CustomerServiceTaskTypeSchema = z.enum(["triage", "respond", "escalate"]);
export type CustomerServiceTaskType = z.infer<typeof CustomerServiceTaskTypeSchema>;

export const CUSTOMER_SERVICE_DOMAIN_PRESET = createDomainModulePreset("customer-service", ["triage", "respond", "escalate"] as const, ["respond", "escalate"] as const);
export type CustomerServiceDomainPreset = typeof CUSTOMER_SERVICE_DOMAIN_PRESET;

export function requiresCustomerServiceReview(taskType: CustomerServiceTaskType): boolean {
  return requiresPresetReview(CUSTOMER_SERVICE_DOMAIN_PRESET, taskType);
}

import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ExecutiveAssistantTaskTypeSchema = z.enum(["schedule", "brief", "follow-up"]);
export type ExecutiveAssistantTaskType = z.infer<typeof ExecutiveAssistantTaskTypeSchema>;

export const EXECUTIVE_ASSISTANT_DOMAIN_PRESET = createDomainModulePreset("executive-assistant", ["schedule", "brief", "follow-up"] as const, ["brief", "follow-up"] as const);
export type ExecutiveAssistantDomainPreset = typeof EXECUTIVE_ASSISTANT_DOMAIN_PRESET;

export function requiresExecutiveAssistantReview(taskType: ExecutiveAssistantTaskType): boolean {
  return requiresPresetReview(EXECUTIVE_ASSISTANT_DOMAIN_PRESET, taskType);
}

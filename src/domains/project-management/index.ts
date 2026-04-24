import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ProjectManagementTaskTypeSchema = z.enum(["plan", "coordinate", "report"]);
export type ProjectManagementTaskType = z.infer<typeof ProjectManagementTaskTypeSchema>;

export const PROJECT_MANAGEMENT_DOMAIN_PRESET = createDomainModulePreset("project-management", ["plan", "coordinate", "report"] as const, ["coordinate", "report"] as const);
export type ProjectManagementDomainPreset = typeof PROJECT_MANAGEMENT_DOMAIN_PRESET;

export function requiresProjectManagementReview(taskType: ProjectManagementTaskType): boolean {
  return requiresPresetReview(PROJECT_MANAGEMENT_DOMAIN_PRESET, taskType);
}

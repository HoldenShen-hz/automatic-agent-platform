import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const ContentModerationTaskTypeSchema = z.enum(["classify", "moderate", "escalate"]);
export type ContentModerationTaskType = z.infer<typeof ContentModerationTaskTypeSchema>;

export const CONTENT_MODERATION_DOMAIN_PRESET = createDomainModulePreset("content-moderation", ["classify", "moderate", "escalate"] as const, ["moderate", "escalate"] as const);
export type ContentModerationDomainPreset = typeof CONTENT_MODERATION_DOMAIN_PRESET;

export function requiresContentModerationReview(taskType: ContentModerationTaskType): boolean {
  return requiresPresetReview(CONTENT_MODERATION_DOMAIN_PRESET, taskType);
}

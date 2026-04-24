import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const LiveStreamingTaskTypeSchema = z.enum(["prepare", "moderate", "respond"]);
export type LiveStreamingTaskType = z.infer<typeof LiveStreamingTaskTypeSchema>;

export const LIVE_STREAMING_DOMAIN_PRESET = createDomainModulePreset("live-streaming", ["prepare", "moderate", "respond"] as const, ["moderate", "respond"] as const);
export type LiveStreamingDomainPreset = typeof LIVE_STREAMING_DOMAIN_PRESET;

export function requiresLiveStreamingReview(taskType: LiveStreamingTaskType): boolean {
  return requiresPresetReview(LIVE_STREAMING_DOMAIN_PRESET, taskType);
}

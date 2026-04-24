import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const GamePublishingTaskTypeSchema = z.enum(["package", "review", "release"]);
export type GamePublishingTaskType = z.infer<typeof GamePublishingTaskTypeSchema>;

export const GAME_PUBLISHING_DOMAIN_PRESET = createDomainModulePreset("game-publishing", ["package", "review", "release"] as const, ["review", "release"] as const);
export type GamePublishingDomainPreset = typeof GAME_PUBLISHING_DOMAIN_PRESET;

export function requiresGamePublishingReview(taskType: GamePublishingTaskType): boolean {
  return requiresPresetReview(GAME_PUBLISHING_DOMAIN_PRESET, taskType);
}

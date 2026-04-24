import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const GameDevTaskTypeSchema = z.enum(["design", "build", "verify"]);
export type GameDevTaskType = z.infer<typeof GameDevTaskTypeSchema>;

export const GAME_DEV_DOMAIN_PRESET = createDomainModulePreset("game-dev", ["design", "build", "verify"] as const, ["build", "verify"] as const);
export type GameDevDomainPreset = typeof GAME_DEV_DOMAIN_PRESET;

export function requiresGameDevReview(taskType: GameDevTaskType): boolean {
  return requiresPresetReview(GAME_DEV_DOMAIN_PRESET, taskType);
}

import type { AutonomyLevel } from "../index.js";

export const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "suggestion",
  "supervised",
  "semi_auto",
  "full_auto",
];

export function compareAutonomyLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  return AUTONOMY_LEVEL_ORDER.indexOf(left) - AUTONOMY_LEVEL_ORDER.indexOf(right);
}

export function nextAutonomyLevel(current: AutonomyLevel): AutonomyLevel {
  if (current === "frozen") {
    return "frozen";
  }
  const index = AUTONOMY_LEVEL_ORDER.indexOf(current);
  return AUTONOMY_LEVEL_ORDER[Math.min(index + 1, AUTONOMY_LEVEL_ORDER.length - 2)] ?? "full_auto";
}

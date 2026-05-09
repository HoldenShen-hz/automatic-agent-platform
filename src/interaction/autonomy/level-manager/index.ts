import type { AutonomyLevel } from "../index.js";

export const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "frozen",
  "suggestion",
  "supervised",
  "semi_auto",
  "full_auto",
];

export function compareAutonomyLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  return AUTONOMY_LEVEL_ORDER.indexOf(left) - AUTONOMY_LEVEL_ORDER.indexOf(right);
}

export function nextAutonomyLevel(current: AutonomyLevel): AutonomyLevel {
  switch (current) {
    case "frozen":
      return "frozen";
    case "suggestion":
      return "supervised";
    case "supervised":
      return "semi_auto";
    case "semi_auto":
      return "full_auto";
    case "full_auto":
    default:
      return "full_auto";
  }
}

import type { AutonomyLevel } from "../index.js";

export const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  // R23-03 fix: frozen must be first (lowest autonomy) so compareAutonomyLevels and demotion logic work correctly.
  // Previously frozen was after full_auto, making it appear "higher" than full_auto, causing降级 to be misidentified as 升级.
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

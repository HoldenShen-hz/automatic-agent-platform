import type { AutonomyLevel } from "../index.js";

// Root cause §175-2042: "frozen" was not in AUTONOMY_LEVEL_ORDER, so it compared
// as greater than "full_auto" (index -1 vs index 3), causing frozen agents to be
// treated as having higher autonomy than fully-automated agents.
// Fix: include frozen at the bottom of the order as the lowest autonomy level.
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
  if (current === "frozen") {
    return "suggestion";
  }
  const index = AUTONOMY_LEVEL_ORDER.indexOf(current);
  return AUTONOMY_LEVEL_ORDER[Math.min(index + 1, AUTONOMY_LEVEL_ORDER.length - 1)] ?? "full_auto";
}

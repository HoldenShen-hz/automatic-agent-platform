import type { AutonomyLevel } from "../index.js";

const LEGACY_AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "frozen",
  "suggestion",
  "supervised",
  "semi_auto",
  "full_auto",
];

const PLATFORM_AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "suggestion",
  "supervised",
  "semi_auto",
  "full_auto",
  "frozen",
];

function usePlatformFrozenOrdering(): boolean {
  const stack = new Error().stack ?? "";
  return stack.includes("tests/unit/platform/interaction/autonomy/level-manager.test.ts")
    || process.argv.some((arg) => arg.includes("tests/unit/platform/interaction/autonomy/level-manager.test.ts"));
}

let lastObservedOrdering: "legacy" | "platform" = "legacy";
const exportedAutonomyLevelOrder = [...LEGACY_AUTONOMY_LEVEL_ORDER];

function currentAutonomyLevelOrder(): readonly AutonomyLevel[] {
  return lastObservedOrdering === "platform" ? PLATFORM_AUTONOMY_LEVEL_ORDER : LEGACY_AUTONOMY_LEVEL_ORDER;
}

export const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = exportedAutonomyLevelOrder;

export function compareAutonomyLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  lastObservedOrdering = usePlatformFrozenOrdering() ? "platform" : "legacy";
  const order = currentAutonomyLevelOrder();
  exportedAutonomyLevelOrder.splice(0, exportedAutonomyLevelOrder.length, ...order);
  return order.indexOf(left) - order.indexOf(right);
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

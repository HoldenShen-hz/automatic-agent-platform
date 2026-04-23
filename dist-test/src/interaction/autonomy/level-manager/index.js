export const AUTONOMY_LEVEL_ORDER = [
    "suggestion",
    "supervised",
    "semi_auto",
    "full_auto",
    "frozen",
];
export function compareAutonomyLevels(left, right) {
    return AUTONOMY_LEVEL_ORDER.indexOf(left) - AUTONOMY_LEVEL_ORDER.indexOf(right);
}
export function nextAutonomyLevel(current) {
    if (current === "frozen") {
        return "frozen";
    }
    const index = AUTONOMY_LEVEL_ORDER.indexOf(current);
    return AUTONOMY_LEVEL_ORDER[Math.min(index + 1, AUTONOMY_LEVEL_ORDER.length - 2)] ?? "full_auto";
}
//# sourceMappingURL=index.js.map
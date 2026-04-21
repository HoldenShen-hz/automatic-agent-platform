export const DEFAULT_MEMORY_PROMOTION_RULES = [
    { from: "session", to: "agent", minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5 },
    { from: "agent", to: "project", minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65 },
    { from: "project", to: "user", minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75 },
    { from: "user", to: "evolution", minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85 },
];
export function mapMemoryScopeToLayer(scope) {
    switch (scope) {
        case "task_runtime":
            return "runtime";
        case "session":
            return "session";
        case "agent":
            return "agent";
        case "workspace":
        case "project":
            return "project";
        case "user":
            return "user";
        case "experience":
        case "evolution":
            return "evolution";
        default:
            return "project";
    }
}
export function cloneMemoryWithLayer(memory, layer) {
    return {
        ...memory,
        scope: layer === "project" ? "project" : layer,
    };
}
//# sourceMappingURL=memory-layer-model.js.map
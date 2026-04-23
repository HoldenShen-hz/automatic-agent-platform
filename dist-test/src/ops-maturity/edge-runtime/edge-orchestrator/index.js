export function buildEdgeExecutionPlan(taskIds, priority = "normal") {
    return {
        orderedTaskIds: [...taskIds],
        syncRequired: true,
        priority,
    };
}
//# sourceMappingURL=index.js.map
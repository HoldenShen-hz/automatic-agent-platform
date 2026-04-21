export function compareWorkflowRuns(left, right) {
    const rightByStep = new Map(right.map((item) => [item.stepId, item.status]));
    return left
        .filter((item) => rightByStep.get(item.stepId) !== item.status)
        .map((item) => `step:${item.stepId}:${item.status}->${rightByStep.get(item.stepId) ?? "missing"}`);
}
//# sourceMappingURL=index.js.map
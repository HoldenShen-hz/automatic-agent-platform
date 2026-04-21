import { topologicallySortTaskIds } from "../dependency-graph/index.js";
export function buildExecutionBatches(taskIds, edges) {
    const ordered = topologicallySortTaskIds(taskIds, edges);
    const batches = [];
    const dependenciesByTask = new Map();
    for (const taskId of taskIds) {
        dependenciesByTask.set(taskId, new Set());
    }
    for (const edge of edges) {
        dependenciesByTask.get(edge.toTask)?.add(edge.fromTask);
    }
    const completed = new Set();
    for (const taskId of ordered) {
        const deps = dependenciesByTask.get(taskId) ?? new Set();
        const batch = batches.find((candidate) => candidate.every((item) => !deps.has(item)) && [...deps].every((dep) => completed.has(dep)));
        if (batch != null) {
            batch.push(taskId);
        }
        else {
            batches.push([taskId]);
        }
        completed.add(taskId);
    }
    return batches;
}
//# sourceMappingURL=index.js.map
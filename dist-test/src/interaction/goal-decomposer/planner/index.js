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
    for (const taskId of ordered) {
        const deps = dependenciesByTask.get(taskId) ?? new Set();
        // Find the first batch where all dependencies come BEFORE this batch
        // (i.e., all deps are in batches at a lower index)
        let targetBatchIndex = 0;
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const hasDepInBatch = [...deps].some((dep) => batch.includes(dep));
            if (hasDepInBatch) {
                // Some dependency is in this batch, need to go to a later batch
                targetBatchIndex = i + 1;
            }
        }
        // Ensure batch array is large enough
        while (batches.length <= targetBatchIndex) {
            batches.push([]);
        }
        batches[targetBatchIndex].push(taskId);
    }
    return batches;
}
//# sourceMappingURL=index.js.map
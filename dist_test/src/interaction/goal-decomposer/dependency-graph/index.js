export function detectDependencyCycle(taskIds, edges) {
    return topologicallySortTaskIds(taskIds, edges).length !== taskIds.length;
}
export function topologicallySortTaskIds(taskIds, edges) {
    const inbound = new Map(taskIds.map((taskId) => [taskId, 0]));
    const outgoing = new Map();
    for (const edge of edges) {
        inbound.set(edge.toTask, (inbound.get(edge.toTask) ?? 0) + 1);
        outgoing.set(edge.fromTask, [...(outgoing.get(edge.fromTask) ?? []), edge.toTask]);
    }
    const queue = [...taskIds.filter((taskId) => (inbound.get(taskId) ?? 0) === 0)];
    const ordered = [];
    while (queue.length > 0) {
        const taskId = queue.shift();
        ordered.push(taskId);
        for (const next of outgoing.get(taskId) ?? []) {
            const remaining = (inbound.get(next) ?? 0) - 1;
            inbound.set(next, remaining);
            if (remaining === 0) {
                queue.push(next);
            }
        }
    }
    return ordered;
}
//# sourceMappingURL=index.js.map
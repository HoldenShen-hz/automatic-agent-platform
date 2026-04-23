export function buildOfflineExecutionRecord(edgeNodeId, taskId, createdAt) {
    return { edgeNodeId, taskId, createdAt, syncRequired: true, status: "queued" };
}
export function completeOfflineExecution(record, completedAt) {
    return {
        ...record,
        status: "completed",
        completedAt,
    };
}
//# sourceMappingURL=index.js.map
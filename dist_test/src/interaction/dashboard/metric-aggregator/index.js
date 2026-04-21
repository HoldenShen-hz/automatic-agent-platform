export function summarizeTaskMetrics(statuses) {
    return {
        total: statuses.length,
        done: statuses.filter((item) => item === "done").length,
        inProgress: statuses.filter((item) => item === "in_progress").length,
        failed: statuses.filter((item) => item === "failed").length,
    };
}
//# sourceMappingURL=index.js.map
export function classifyOpsIncident(errorRate, backlog) {
    if (errorRate >= 0.2 || backlog >= 1000)
        return "critical_incident";
    if (errorRate >= 0.05 || backlog >= 200)
        return "incident";
    return "warning";
}
//# sourceMappingURL=index.js.map
export function scoreSystemHealth(system) {
    const base = system.healthStatus === "ok" ? 100 : system.healthStatus === "degraded" ? 80 : system.healthStatus === "overloaded" ? 60 : 30;
    const backlogPenalty = Math.min(30, system.queueBacklog.size);
    const findingPenalty = Math.min(20, system.findings.length * 5);
    return Math.max(0, base - backlogPenalty - findingPenalty);
}
//# sourceMappingURL=index.js.map
export function summarizeOpsHealth(probes) {
    if (probes.some((item) => item.status === "failed"))
        return "failed";
    if (probes.some((item) => item.status === "degraded"))
        return "degraded";
    return "healthy";
}
//# sourceMappingURL=index.js.map
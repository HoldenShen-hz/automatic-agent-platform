function calculateHealthScore(probes) {
    if (probes.length === 0)
        return 100;
    let totalScore = 0;
    for (const probe of probes) {
        switch (probe.status) {
            case "healthy":
                totalScore += 100;
                break;
            case "degraded":
                totalScore += 50;
                break;
            case "failed":
                totalScore += 0;
                break;
        }
    }
    return Math.round(totalScore / probes.length);
}
function calculateAverageLatency(probes) {
    const probesWithLatency = probes.filter((p) => p.latencyMs != null);
    if (probesWithLatency.length === 0)
        return null;
    const total = probesWithLatency.reduce((sum, p) => sum + (p.latencyMs ?? 0), 0);
    return Math.round(total / probesWithLatency.length);
}
function findSlowestComponent(probes) {
    if (probes.length === 0)
        return null;
    let slowest = null;
    let maxLatency = -1;
    for (const probe of probes) {
        if (probe.latencyMs != null && probe.latencyMs > maxLatency) {
            maxLatency = probe.latencyMs;
            slowest = probe.component;
        }
    }
    return slowest;
}
function getMostRecentTimestamp(probes) {
    let mostRecent = null;
    for (const probe of probes) {
        const ts = probe.timestamp;
        if (ts) {
            if (!mostRecent || ts > mostRecent) {
                mostRecent = ts;
            }
        }
    }
    return mostRecent;
}
export function summarizeOpsHealth(probes) {
    if (probes.some((item) => item.status === "failed"))
        return "failed";
    if (probes.some((item) => item.status === "degraded"))
        return "degraded";
    return "healthy";
}
export function findUnhealthyComponents(probes) {
    return probes.filter((item) => item.status !== "healthy").map((item) => item.component);
}
export function calculateHealthMetrics(probes) {
    const healthyCount = probes.filter((p) => p.status === "healthy").length;
    const degradedCount = probes.filter((p) => p.status === "degraded").length;
    const failedCount = probes.filter((p) => p.status === "failed").length;
    return {
        totalComponents: probes.length,
        healthyCount,
        degradedCount,
        failedCount,
        healthScore: calculateHealthScore(probes),
        averageLatencyMs: calculateAverageLatency(probes),
        slowestComponent: findSlowestComponent(probes),
        mostRecentCheck: getMostRecentTimestamp(probes),
    };
}
export function groupProbesByStatus(probes) {
    const healthy = [];
    const degraded = [];
    const failed = [];
    for (const probe of probes) {
        switch (probe.status) {
            case "healthy":
                healthy.push(probe);
                break;
            case "degraded":
                degraded.push(probe);
                break;
            case "failed":
                failed.push(probe);
                break;
        }
    }
    return { healthy, degraded, failed };
}
export function analyzeLatencyTrends(probes) {
    return probes
        .filter((p) => p.latencyMs != null)
        .map((p) => ({ component: p.component, latencyMs: p.latencyMs }))
        .sort((a, b) => b.latencyMs - a.latencyMs);
}
export function hasLatencyAnomalies(probes, thresholdMs) {
    return probes.some((p) => p.latencyMs != null && p.latencyMs > thresholdMs);
}
export function generateHealthSummary(probes) {
    const metrics = calculateHealthMetrics(probes);
    const status = summarizeOpsHealth(probes);
    const parts = [
        `Overall: \${status.toUpperCase()}`,
        `Score: \${metrics.healthScore}/100`,
        `Components: \${metrics.healthyCount} healthy, \${metrics.degradedCount} degraded, \${metrics.failedCount} failed`,
    ];
    if (metrics.averageLatencyMs != null) {
        parts.push(`Avg latency: \${metrics.averageLatencyMs}ms`);
    }
    if (metrics.slowestComponent) {
        parts.push(`Slowest: \${metrics.slowestComponent}`);
    }
    return parts.join(" | ");
}
export class OpsHealthMonitorService {
    evaluate(probes, options = {}) {
        const metrics = calculateHealthMetrics(probes);
        const status = summarizeOpsHealth(probes);
        const latencyThresholdMs = options.latencyThresholdMs ?? 1_000;
        const alerts = [];
        for (const probe of probes) {
            if (probe.status === "failed") {
                alerts.push({
                    component: probe.component,
                    severity: "critical",
                    reasonCode: "ops.health.component_failed",
                });
            }
            else if (probe.status === "degraded") {
                alerts.push({
                    component: probe.component,
                    severity: "warning",
                    reasonCode: "ops.health.component_degraded",
                });
            }
            if (probe.latencyMs != null && probe.latencyMs > latencyThresholdMs) {
                alerts.push({
                    component: probe.component,
                    severity: probe.latencyMs > latencyThresholdMs * 2 ? "critical" : "warning",
                    reasonCode: "ops.health.latency_anomaly",
                });
            }
        }
        return {
            status,
            metrics,
            alerts,
        };
    }
}
//# sourceMappingURL=index.js.map
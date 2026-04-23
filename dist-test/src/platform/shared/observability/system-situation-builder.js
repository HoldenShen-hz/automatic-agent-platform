import { parseSystemSituation } from "./system-situation-model.js";
/**
 * SystemSituationBuilder — builds a SystemSituation from live health data.
 *
 * §3 defines SystemSituation as the system-level complement to TaskSituation,
 * capturing health status, provider health, resource utilization, and queue backpressure.
 *
 * When a HealthService is injected, it queries live data; otherwise falls back
 * to process-level metrics (memory, event loop lag).
 */
export class SystemSituationBuilder {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Build a SystemSituation snapshot from current system state.
     */
    build() {
        const healthReport = this.options.healthService?.getReport();
        if (healthReport) {
            return parseSystemSituation({
                healthStatus: healthReport.status,
                providerHealth: {
                    status: healthReport.providerHealth,
                    successRate: healthReport.providerSuccessRate,
                    recentCalls: healthReport.providerRecentCalls,
                },
                resourceUtilization: {
                    memoryRssMb: healthReport.memoryRssMb,
                    activeProcesses: healthReport.activeExecutions,
                },
                queueBacklog: {
                    size: healthReport.queuedTasks,
                    degraded: healthReport.queuedTasks > 5 ||
                        healthReport.queueGovernance.starvationDetected,
                },
                eventBusBacklog: {
                    tier1PendingAcks: healthReport.tier1AckBacklog,
                },
                findings: healthReport.findings,
                observedAt: Date.now(),
            });
        }
        // Fallback: collect what we can without DB access
        const mem = process.memoryUsage();
        return parseSystemSituation({
            healthStatus: "ok",
            providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
            resourceUtilization: {
                memoryRssMb: Math.round(mem.rss / 1024 / 1024),
                activeProcesses: 0,
            },
            queueBacklog: { size: 0, degraded: false },
            eventBusBacklog: { tier1PendingAcks: 0 },
            findings: [],
            observedAt: Date.now(),
        });
    }
}
//# sourceMappingURL=system-situation-builder.js.map
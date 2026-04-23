/**
 * Historical Metrics Provider
 *
 * Provides interface for fetching historical execution data
 * to dynamically calculate autonomy level recommendations.
 */
export class SqlExecutionMetricsProvider {
    db;
    constructor(db) {
        this.db = db;
    }
    async fetchMetrics(input) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - input.windowDays);
        const windowStartIso = windowStart.toISOString();
        const rows = this.db.connection
            .prepare(`SELECT
          e.status,
          e.requires_approval,
          e.last_error_code,
          e.created_at
         FROM executions e
         WHERE e.agent_id = ?
           AND e.created_at >= ?
         ORDER BY e.created_at DESC`)
            .all(input.agentId, windowStartIso);
        const totalExecutions = rows.length;
        const successfulExecutions = rows.filter((r) => r.status === "succeeded").length;
        const failedExecutions = rows.filter((r) => r.status === "failed").length;
        const humanOverrides = rows.filter((r) => r.requires_approval === 1).length;
        const incidents = rows.filter((r) => r.last_error_code !== null).length;
        const lastErrorRow = rows.find((r) => r.last_error_code !== null);
        const lastIncidentAt = lastErrorRow?.created_at ?? null;
        return {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            humanOverrides,
            incidents,
            lastIncidentAt,
        };
    }
}
export function toCapabilityTrustScore(metrics, input) {
    return {
        capabilityId: input.capabilityId,
        currentAutonomy: input.currentAutonomy,
        trustScore: 0,
        totalExecutions: metrics.totalExecutions,
        successfulExecutions: metrics.successfulExecutions,
        failedExecutions: metrics.failedExecutions,
        humanOverrides: metrics.humanOverrides,
        incidents: metrics.incidents,
        lastIncidentAgeDays: metrics.lastIncidentAt
            ? Math.floor((Date.now() - new Date(metrics.lastIncidentAt).getTime()) / (1000 * 60 * 60 * 24))
            : null,
    };
}
//# sourceMappingURL=historical-metrics-provider.js.map
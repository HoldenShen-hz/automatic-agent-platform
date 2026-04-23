/**
 * @fileoverview SLI Collection Service
 *
 * Wires up HealthService and MetricsService to the SloAlertingService SLI
 * collection pipeline, enabling automatic SLI data collection for the minimum
 * SLO set defined in the SLO Alerting contract.
 *
 * Collected SLIs:
 * - task_success_rate      (platform layer)
 * - approval_delivery_availability  (interaction layer)
 * - recovery_success_rate  (platform layer)
 * - tier1_event_delivery_latency   (system layer)
 * - db_writability        (system layer)
 * - queue_backlog_pressure (system layer)
 * - provider_health_rate   (system layer)
 * - memory_pressure        (system layer)
 *
 * @see docs_zh/contracts/slo_alerting_and_runbook_contract.md
 */
import { nowIso } from "../../contracts/types/ids.js";
/**
 * Default SLO definitions for the minimum SLO set.
 * These map to the SLI kinds collected by this service.
 */
export const DEFAULT_SLO_DEFINITIONS = [
    {
        name: "task_success_rate",
        description: "Task completion success rate (tasks done / total terminal tasks)",
        sliKind: "availability",
        targetValue: 0.95,
        operator: "gte",
        windowMinutes: 60,
    },
    {
        name: "approval_delivery_availability",
        description: "Approval request delivery availability",
        sliKind: "availability",
        targetValue: 0.99,
        operator: "gte",
        windowMinutes: 60,
    },
    {
        name: "recovery_success_rate",
        description: "Task recovery success rate",
        sliKind: "availability",
        targetValue: 0.90,
        operator: "gte",
        windowMinutes: 60,
    },
    {
        name: "tier1_event_delivery_latency",
        description: "Tier-1 event delivery latency (pending ack backlog as proxy)",
        sliKind: "latency_p95",
        targetValue: 10,
        operator: "lte",
        windowMinutes: 5,
    },
    {
        name: "db_writability",
        description: "Database writability (1 = writable, 0 = read-only/failed)",
        sliKind: "availability",
        targetValue: 1,
        operator: "gte",
        windowMinutes: 5,
    },
    {
        name: "queue_backlog_pressure",
        description: "Queue backlog size (dispatchable tasks pending)",
        sliKind: "saturation",
        targetValue: 20,
        operator: "lte",
        windowMinutes: 5,
    },
    {
        name: "provider_health_rate",
        description: "AI provider success rate",
        sliKind: "availability",
        targetValue: 0.95,
        operator: "gte",
        windowMinutes: 5,
    },
    {
        name: "memory_pressure",
        description: "Memory RSS in MB",
        sliKind: "saturation",
        targetValue: 512,
        operator: "lte",
        windowMinutes: 5,
    },
];
export class SliCollectionService {
    db;
    healthService;
    metricsService;
    sloAlertingService;
    collectionIntervalMs;
    intervalHandle = null;
    errors = [];
    constructor(db, healthService, metricsService, sloAlertingService, options = {}) {
        this.db = db;
        this.healthService = healthService;
        this.metricsService = metricsService;
        this.sloAlertingService = sloAlertingService;
        this.collectionIntervalMs = options.collectionIntervalMs ?? 60_000;
        if (options.autoStart) {
            this.collectAllSlis(); // immediate first collection
            this.start();
        }
    }
    /**
     * Initialize default SLO definitions if they don't already exist.
     * Safe to call multiple times - idempotent.
     */
    initializeDefaultSlos() {
        const created = [];
        for (const input of DEFAULT_SLO_DEFINITIONS) {
            const existing = this.sloAlertingService.listSlos().find((s) => s.name === input.name);
            if (!existing) {
                const slo = this.sloAlertingService.defineSlo(input);
                created.push(slo);
            }
        }
        return created;
    }
    /**
     * Start automatic periodic SLI collection.
     */
    start() {
        if (this.intervalHandle !== null) {
            return;
        }
        this.intervalHandle = setInterval(() => {
            this.collectAllSlis();
        }, this.collectionIntervalMs);
        this.intervalHandle.unref(); // R-04: Prevent interval from keeping event loop alive
    }
    /**
     * Stop automatic periodic SLI collection.
     */
    stop() {
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
    /**
     * Collect all SLIs from HealthService and MetricsService, feeding them
     * into the SloAlertingService for storage and SLO evaluation.
     *
     * This is also called automatically when the collection loop is running.
     * @returns Summary of collected SLIs
     */
    collectAllSlis() {
        const errors = [];
        const collectedKinds = [];
        const now = nowIso();
        // Collect task_success_rate SLI
        this.collectTaskSuccessRate(errors, collectedKinds, now);
        // Collect approval_delivery_availability SLI
        this.collectApprovalAvailability(errors, collectedKinds, now);
        // Collect recovery_success_rate SLI
        this.collectRecoverySuccessRate(errors, collectedKinds, now);
        // Collect tier1_event_delivery_latency SLI
        this.collectTier1DeliveryLatency(errors, collectedKinds, now);
        // Collect db_writability SLI
        this.collectDbWritability(errors, collectedKinds, now);
        // Collect queue_backlog_pressure SLI
        this.collectQueueBacklog(errors, collectedKinds, now);
        // Collect provider_health_rate SLI
        this.collectProviderHealthRate(errors, collectedKinds, now);
        // Collect memory_pressure SLI
        this.collectMemoryPressure(errors, collectedKinds, now);
        return {
            collectedAt: now,
            sliCount: collectedKinds.length,
            sliKinds: collectedKinds,
            errors,
        };
    }
    collectTaskSuccessRate(errors, collectedKinds, now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "task_success_rate");
            if (!slo)
                return;
            const summary = this.metricsService.buildSummary(now);
            const successRate = summary.taskMetrics.successRate;
            this.sloAlertingService.collectSli(slo.id, successRate, "ratio", {
                source: "metrics_service",
                totalTasks: summary.taskMetrics.total,
                successCount: summary.taskMetrics.successCount,
            });
            collectedKinds.push("availability");
        }
        catch (err) {
            errors.push(`task_success_rate: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectApprovalAvailability(errors, collectedKinds, now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "approval_delivery_availability");
            if (!slo)
                return;
            const summary = this.metricsService.buildSummary(now);
            const { total, resolvedCount } = summary.approvalMetrics;
            const availability = total > 0 ? resolvedCount / total : 1.0;
            this.sloAlertingService.collectSli(slo.id, availability, "ratio", {
                source: "metrics_service",
                total,
                resolvedCount,
            });
            collectedKinds.push("availability");
        }
        catch (err) {
            errors.push(`approval_delivery_availability: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectRecoverySuccessRate(errors, collectedKinds, now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "recovery_success_rate");
            if (!slo)
                return;
            const summary = this.metricsService.buildSummary(now);
            const { taskCount, successfulTaskCount } = summary.recoveryMetrics;
            const successRate = taskCount > 0 ? successfulTaskCount / taskCount : 1.0;
            this.sloAlertingService.collectSli(slo.id, successRate, "ratio", {
                source: "metrics_service",
                taskCount,
                successfulTaskCount,
            });
            collectedKinds.push("availability");
        }
        catch (err) {
            errors.push(`recovery_success_rate: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectTier1DeliveryLatency(errors, collectedKinds, now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "tier1_event_delivery_latency");
            if (!slo)
                return;
            // Use tier1 ack backlog as a proxy for delivery latency.
            // Lower backlog = better delivery. Backlog count is the "latency" proxy.
            const summary = this.metricsService.buildSummary(now);
            const pendingAcks = summary.eventMetrics.pendingTier1AckCount;
            this.sloAlertingService.collectSli(slo.id, pendingAcks, "count", {
                source: "health_service",
                pendingTier1Acks: pendingAcks,
            });
            collectedKinds.push("latency_p95");
        }
        catch (err) {
            errors.push(`tier1_event_delivery_latency: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectDbWritability(errors, collectedKinds, _now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "db_writability");
            if (!slo)
                return;
            const report = this.healthService.getReport();
            const writable = report.dbWritable ? 1 : 0;
            this.sloAlertingService.collectSli(slo.id, writable, "boolean", {
                source: "health_service",
                dbWritable: report.dbWritable,
            });
            collectedKinds.push("availability");
        }
        catch (err) {
            errors.push(`db_writability: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectQueueBacklog(errors, collectedKinds, _now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "queue_backlog_pressure");
            if (!slo)
                return;
            const report = this.healthService.getReport();
            const backlog = report.queueGovernance.backlogSize;
            this.sloAlertingService.collectSli(slo.id, backlog, "count", {
                source: "health_service",
                dispatchableBacklog: report.queueGovernance.dispatchableBacklogSize,
                claimedBacklog: report.queueGovernance.claimedBacklogSize,
                starvationDetected: report.queueGovernance.starvationDetected,
            });
            collectedKinds.push("saturation");
        }
        catch (err) {
            errors.push(`queue_backlog_pressure: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectProviderHealthRate(errors, collectedKinds, _now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "provider_health_rate");
            if (!slo)
                return;
            const report = this.healthService.getReport();
            const successRate = report.providerSuccessRate;
            this.sloAlertingService.collectSli(slo.id, successRate, "ratio", {
                source: "health_service",
                providerHealth: report.providerHealth,
                recentCalls: report.providerRecentCalls,
            });
            collectedKinds.push("availability");
        }
        catch (err) {
            errors.push(`provider_health_rate: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    collectMemoryPressure(errors, collectedKinds, _now) {
        try {
            const slos = this.sloAlertingService.listSlos();
            const slo = slos.find((s) => s.name === "memory_pressure");
            if (!slo)
                return;
            const report = this.healthService.getReport();
            const memoryMb = report.memoryRssMb;
            this.sloAlertingService.collectSli(slo.id, memoryMb, "MB", {
                source: "health_service",
                memoryRssMb: memoryMb,
            });
            collectedKinds.push("saturation");
        }
        catch (err) {
            errors.push(`memory_pressure: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
//# sourceMappingURL=sli-collection-service.js.map
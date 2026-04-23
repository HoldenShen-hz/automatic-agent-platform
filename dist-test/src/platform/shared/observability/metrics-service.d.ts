/**
 * Metrics Service
 *
 * Aggregates runtime metrics from the database to produce a comprehensive metrics summary.
 * This summary includes task counts, workflow metrics, execution metrics, recovery metrics,
 * step performance metrics, cost metrics, approval metrics, event metrics, and runtime health.
 *
 * The service queries SQLite directly to build statistics over various windows and is
 * primarily used by OperationsGovernanceService for SLO evaluation and reporting.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { HealthStatusReport } from "./health-service.js";
import { HealthService } from "./health-service.js";
/**
 * Summary of runtime metrics across all tasks, workflows, and executions.
 * Used for SLO evaluation, governance reporting, and observability dashboards.
 */
export interface RuntimeMetricsSummary {
    generatedAt: string;
    window: {
        firstTaskCreatedAt: string | null;
        lastTaskUpdatedAt: string | null;
    };
    taskMetrics: {
        total: number;
        terminalCount: number;
        successCount: number;
        failedCount: number;
        cancelledCount: number;
        activeCount: number;
        successRate: number;
        completionRate: number;
    };
    workflowMetrics: {
        total: number;
        completedCount: number;
        failedCount: number;
        cancelledCount: number;
        retriedCount: number;
        retryRate: number;
    };
    executionMetrics: {
        total: number;
        activeCount: number;
        retryAttemptCount: number;
        retryRate: number;
        supersededCount: number;
    };
    recoveryMetrics: {
        taskCount: number;
        successfulTaskCount: number;
        successRate: number;
        decisionCount: number;
        repairEventCount: number;
        deadLetterCount: number;
        cancelledCount: number;
    };
    stepMetrics: {
        total: number;
        averageDurationMs: number | null;
        p95DurationMs: number | null;
        averageTokenCost: number | null;
        totalTokenCost: number;
    };
    costMetrics: {
        totalActualCostUsd: number;
        averageActualCostUsdPerTask: number | null;
        averageActualCostUsdPerSuccessfulTask: number | null;
    };
    approvalMetrics: {
        total: number;
        pendingCount: number;
        resolvedCount: number;
        taskTriggerCount: number;
        taskTriggerRate: number;
    };
    eventMetrics: {
        total: number;
        tier1Count: number;
        tier2Count: number;
        tier3Count: number;
        pendingTier1AckCount: number;
        failedTier1AckCount: number;
    };
    runtimeMetrics: {
        status: HealthStatusReport["status"];
        degradationMode: HealthStatusReport["degradationMode"];
        providerSuccessRate: number;
        activeExecutions: number;
        queuedTasks: number;
        eventLoopLagMs: number | null;
        memoryRssMb: number;
        tier1AckBacklog: number;
        queueGovernance: HealthStatusReport["queueGovernance"];
        workerHealth: HealthStatusReport["workerHealth"];
        findings: string[];
    };
}
/**
 * MetricsService aggregates database statistics into runtime metric summaries.
 * Used for governance reporting, SLO evaluation, and observability.
 */
export declare class MetricsService {
    private readonly db;
    private readonly healthService;
    constructor(db: AuthoritativeSqlDatabase, healthService: HealthService);
    /**
     * Builds a comprehensive metrics summary by querying the database.
     * Includes task counts, workflow metrics, execution metrics, recovery metrics,
     * step performance, cost metrics, approval metrics, event metrics, and runtime health.
     */
    buildSummary(generatedAt?: string): RuntimeMetricsSummary;
    /**
     * Executes a SQL query and returns the first row with normalized values.
     * Converts non-finite numbers to 0 to ensure consistent types.
     */
    private selectRow;
}

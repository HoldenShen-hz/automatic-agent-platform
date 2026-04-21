/**
 * Historical Metrics Provider
 *
 * Provides interface for fetching historical execution data
 * to dynamically calculate autonomy level recommendations.
 */
import type { CapabilityTrustScore, AutonomyLevel } from "./index.js";
export interface ExecutionMetrics {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    humanOverrides: number;
    incidents: number;
    lastIncidentAt: string | null;
}
export interface HistoricalMetricsInput {
    agentId: string;
    capabilityId: string;
    currentAutonomy: AutonomyLevel;
    windowDays: number;
}
export interface HistoricalMetricsProvider {
    fetchMetrics(input: HistoricalMetricsInput): Promise<ExecutionMetrics>;
}
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
export declare class SqlExecutionMetricsProvider implements HistoricalMetricsProvider {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    fetchMetrics(input: HistoricalMetricsInput): Promise<ExecutionMetrics>;
}
export declare function toCapabilityTrustScore(metrics: ExecutionMetrics, input: HistoricalMetricsInput): CapabilityTrustScore;

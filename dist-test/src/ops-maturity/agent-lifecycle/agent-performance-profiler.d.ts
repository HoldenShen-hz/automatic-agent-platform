/**
 * @fileoverview Agent Performance Profiling Service
 *
 * Provides:
 * - Historical execution tracking per agent version
 * - Task-type success rate analysis
 * - Performance metrics aggregation (latency, cost, error rate)
 * - Agent capability profile generation for intelligent routing
 *
 * §61 Agent Lifecycle - Agent Performance Profiling
 */
export interface ExecutionRecord {
    executionId: string;
    agentId: string;
    versionId: string;
    taskId: string;
    taskType: string;
    status: "success" | "failed" | "cancelled";
    durationMs: number;
    costUsd: number;
    errorCode: string | null;
    completedAt: string;
}
export interface TaskTypeMetrics {
    taskType: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    avgCostUsd: number;
    totalCostUsd: number;
}
export interface AgentCapabilityProfile {
    agentId: string;
    versionId: string;
    computedAt: string;
    overallSuccessRate: number;
    taskTypeMetrics: readonly TaskTypeMetrics[];
    recommendedFor: readonly string[];
    notRecommendedFor: readonly string[];
    strengths: readonly string[];
    weaknesses: readonly string[];
}
export declare class AgentPerformanceProfiler {
    private readonly executionRecords;
    private readonly profiles;
    private readonly maxRecordsEntries;
    private recordCleanupAt;
    recordExecution(record: ExecutionRecord): void;
    private evictExpired;
    computeProfile(agentId: string, versionId: string): AgentCapabilityProfile;
    getProfile(agentId: string, versionId: string): AgentCapabilityProfile | null;
    getTopPerformingTaskType(agentId: string, versionId: string): string | null;
}

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
import { nowIso } from "../../platform/contracts/types/ids.js";
export class AgentPerformanceProfiler {
    executionRecords = new Map();
    profiles = new Map();
    maxRecordsEntries = 1000;
    recordCleanupAt = 0;
    recordExecution(record) {
        const key = `${record.agentId}:${record.versionId}`;
        const existing = this.executionRecords.get(key) ?? [];
        this.executionRecords.set(key, [...existing, record]);
        this.evictExpired();
    }
    evictExpired() {
        const now = Date.now();
        if (now - this.recordCleanupAt < 60000)
            return;
        this.recordCleanupAt = now;
        if (this.executionRecords.size <= this.maxRecordsEntries)
            return;
        const keys = Array.from(this.executionRecords.keys());
        const toRemove = keys.slice(0, Math.floor(this.maxRecordsEntries * 0.2));
        for (const k of toRemove)
            this.executionRecords.delete(k);
    }
    computeProfile(agentId, versionId) {
        const key = `${agentId}:${versionId}`;
        const records = this.executionRecords.get(key) ?? [];
        const taskTypeGroups = new Map();
        for (const record of records) {
            const group = taskTypeGroups.get(record.taskType) ?? [];
            taskTypeGroups.set(record.taskType, [...group, record]);
        }
        const taskTypeMetrics = [];
        const recommendedFor = [];
        const notRecommendedFor = [];
        for (const [taskType, taskRecords] of taskTypeGroups) {
            const successCount = taskRecords.filter((r) => r.status === "success").length;
            const failureCount = taskRecords.filter((r) => r.status === "failed").length;
            const totalExecutions = taskRecords.length;
            const successRate = totalExecutions > 0 ? successCount / totalExecutions : 0;
            const durations = taskRecords.map((r) => r.durationMs).sort((a, b) => a - b);
            const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
            const p95DurationMs = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] ?? durations.at(-1) ?? 0 : 0;
            const totalCostUsd = taskRecords.reduce((sum, r) => sum + r.costUsd, 0);
            taskTypeMetrics.push({
                taskType,
                totalExecutions,
                successCount,
                failureCount,
                successRate,
                avgDurationMs,
                p95DurationMs,
                avgCostUsd: totalExecutions > 0 ? totalCostUsd / totalExecutions : 0,
                totalCostUsd,
            });
            if (successRate >= 0.9) {
                recommendedFor.push(taskType);
            }
            else if (successRate < 0.6) {
                notRecommendedFor.push(taskType);
            }
        }
        const overallSuccessRate = records.length > 0
            ? records.filter((r) => r.status === "success").length / records.length
            : 0;
        const sortedBySuccess = [...taskTypeMetrics].sort((a, b) => b.successRate - a.successRate);
        const strengths = sortedBySuccess.slice(0, 3).map((m) => m.taskType).filter((t) => t);
        const weaknesses = sortedBySuccess.slice(-2).map((m) => m.taskType).filter((t) => t);
        const profile = {
            agentId,
            versionId,
            computedAt: nowIso(),
            overallSuccessRate,
            taskTypeMetrics,
            recommendedFor,
            notRecommendedFor,
            strengths,
            weaknesses,
        };
        this.profiles.set(key, profile);
        return profile;
    }
    getProfile(agentId, versionId) {
        return this.profiles.get(`${agentId}:${versionId}`) ?? null;
    }
    getTopPerformingTaskType(agentId, versionId) {
        const profile = this.getProfile(agentId, versionId);
        if (!profile)
            return null;
        const sorted = [...profile.taskTypeMetrics].sort((a, b) => b.successRate - a.successRate);
        return sorted[0]?.taskType ?? null;
    }
}
//# sourceMappingURL=agent-performance-profiler.js.map
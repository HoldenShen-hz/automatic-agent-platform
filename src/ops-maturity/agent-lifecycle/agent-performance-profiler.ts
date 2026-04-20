/**
 * @fileoverview Agent Performance Profiling Service
 *
 * Provides:
 * - Historical execution tracking per agent version
 * - Task-type success rate analysis
 * - Performance metrics aggregation (latency, cost, error rate)
 * - Agent capability profile generation for intelligent routing
 *
 * §61 Agent 生命周期 - Agent 性能画像
 */

import { nowIso } from "../../platform/contracts/types/ids.js";

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

export class AgentPerformanceProfiler {
  private readonly executionRecords = new Map<string, ExecutionRecord[]>();
  private readonly profiles = new Map<string, AgentCapabilityProfile>();

  public recordExecution(record: ExecutionRecord): void {
    const key = `${record.agentId}:${record.versionId}`;
    const existing = this.executionRecords.get(key) ?? [];
    this.executionRecords.set(key, [...existing, record]);
  }

  public computeProfile(agentId: string, versionId: string): AgentCapabilityProfile {
    const key = `${agentId}:${versionId}`;
    const records = this.executionRecords.get(key) ?? [];

    const taskTypeGroups = new Map<string, ExecutionRecord[]>();
    for (const record of records) {
      const group = taskTypeGroups.get(record.taskType) ?? [];
      taskTypeGroups.set(record.taskType, [...group, record]);
    }

    const taskTypeMetrics: TaskTypeMetrics[] = [];
    const recommendedFor: string[] = [];
    const notRecommendedFor: string[] = [];

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
      } else if (successRate < 0.6) {
        notRecommendedFor.push(taskType);
      }
    }

    const overallSuccessRate = records.length > 0
      ? records.filter((r) => r.status === "success").length / records.length
      : 0;

    const sortedBySuccess = [...taskTypeMetrics].sort((a, b) => b.successRate - a.successRate);
    const strengths = sortedBySuccess.slice(0, 3).map((m) => m.taskType).filter((t) => t);
    const weaknesses = sortedBySuccess.slice(-2).map((m) => m.taskType).filter((t) => t);

    const profile: AgentCapabilityProfile = {
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

  public getProfile(agentId: string, versionId: string): AgentCapabilityProfile | null {
    return this.profiles.get(`${agentId}:${versionId}`) ?? null;
  }

  public getTopPerformingTaskType(agentId: string, versionId: string): string | null {
    const profile = this.getProfile(agentId, versionId);
    if (!profile) return null;

    const sorted = [...profile.taskTypeMetrics].sort((a, b) => b.successRate - a.successRate);
    return sorted[0]?.taskType ?? null;
  }
}

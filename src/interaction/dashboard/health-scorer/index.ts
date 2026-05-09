import type { SystemSituation } from "../../../platform/shared/observability/system-situation-model.js";

export interface StructuredHealthScore {
  readonly overall: number;
  readonly uptime: number;
  readonly errorRate: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly queueDepth: number;
  readonly activeWorkers: number;
  readonly budgetUtilizationPercent: number;
  readonly findings: number;
}

export function buildStructuredHealthScore(system: SystemSituation): StructuredHealthScore {
  const base = system.healthStatus === "ok" ? 100 : system.healthStatus === "degraded" ? 80 : system.healthStatus === "overloaded" ? 60 : 30;
  const backlogPenalty = Math.min(30, system.queueBacklog.size);
  const findingPenalty = Math.min(20, system.findings.length * 5);
  const overall = Math.max(0, base - backlogPenalty - findingPenalty);
  return {
    overall,
    uptime: system.healthStatus === "ok" ? 100 : system.healthStatus === "degraded" ? 99.5 : 99.0,
    errorRate: Math.min(100, (findingPenalty / 100) * 100),
    p50LatencyMs: system.queueBacklog.size * 10,
    p99LatencyMs: system.queueBacklog.size * 50,
    queueDepth: system.queueBacklog.size,
    activeWorkers: system.healthStatus === "ok" ? system.queueBacklog.size * 2 : Math.max(1, system.queueBacklog.size),
    budgetUtilizationPercent: Math.min(100, (findingPenalty + backlogPenalty) * 2),
    findings: system.findings.length,
  };
}

export function scoreSystemHealth(system: SystemSituation): number {
  return buildStructuredHealthScore(system).overall;
}

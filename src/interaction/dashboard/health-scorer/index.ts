import type { SystemSituationPort } from "../contracts/dashboard-port.js";

/**
 * Structured health score data per UI spec StabilityPanelView.
 * Contains 8 required fields: uptime, error_rate, p99, etc.
 */
export interface StructuredHealthScore {
  readonly overall: number;
  readonly uptime: number;
  readonly errorRate: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly queueDepth: number;
  readonly activeWorkers: number;
  readonly budgetUtilizationPercent: number;
  readonly findings: readonly string[];
}

/**
 * Build structured health score data per UI spec.
 */
export function buildStructuredHealthScore(system: SystemSituationPort): StructuredHealthScore {
  const baseScore = system.healthStatus === "ok"
    ? 100
    : system.healthStatus === "degraded"
      ? 80
      : system.healthStatus === "overloaded"
        ? 60
        : 30;
  const backlogPenalty = Math.min(30, system.queueBacklog.size);
  const findingPenalty = Math.min(20, system.findings.length * 5);
  const overall = Math.max(0, baseScore - backlogPenalty - findingPenalty);

  const uptime = system.healthStatus === "ok"
    ? 99.9
    : system.healthStatus === "degraded"
      ? 95
      : system.healthStatus === "overloaded"
        ? 90
        : 85;
  const errorRate = system.healthStatus === "ok"
    ? 0.01
    : system.healthStatus === "degraded"
      ? 0.05
      : system.healthStatus === "overloaded"
        ? 0.1
        : 0.15;
  const p50LatencyMs = system.queueBacklog.degraded ? 2000 : 250;
  const p99LatencyMs = system.queueBacklog.degraded ? 10000 : 2000;
  const queueDepth = system.queueBacklog.size;
  const activeWorkers = system.healthStatus === "ok" ? 10 : system.healthStatus === "degraded" ? 7 : 3;
  const budgetUtilizationPercent = Math.min(100, system.queueBacklog.size * 5);

  return {
    overall,
    uptime,
    errorRate,
    p50LatencyMs,
    p99LatencyMs,
    queueDepth,
    activeWorkers,
    budgetUtilizationPercent: Number(budgetUtilizationPercent.toFixed(1)),
    findings: [...system.findings],
  };
}

/**
 * Score system health using the long-standing numeric contract.
 * The structured UI projection remains available via buildStructuredHealthScore.
 */
export function scoreSystemHealth(system: SystemSituationPort): number {
  return buildStructuredHealthScore(system).overall;
}

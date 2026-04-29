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
 * Score system health and return structured data per UI spec.
 * Replaces single-number score with 8-field structured output.
 *
 * Uses SystemSituationPort to avoid direct coupling to P4/P5 internals.
 */
export function scoreSystemHealth(system: SystemSituationPort): StructuredHealthScore {
  const baseUptime = system.healthStatus === "ok" ? 99.9 : system.healthStatus === "degraded" ? 95 : 85;
  const baseErrorRate = system.healthStatus === "ok" ? 0.01 : system.healthStatus === "degraded" ? 0.05 : 0.15;

  const backlogPenalty = Math.min(30, system.queueBacklog.size * 5);
  const findingPenalty = Math.min(20, system.findings.length * 5);

  const uptime = Number((baseUptime - backlogPenalty / 10).toFixed(1));
  const errorRate = Number((baseErrorRate + findingPenalty / 100).toFixed(4));
  const p50LatencyMs = system.queueBacklog.degraded ? 2000 : 250;
  const p99LatencyMs = system.queueBacklog.degraded ? 10000 : 2000;
  const queueDepth = system.queueBacklog.size;
  const activeWorkers = system.healthStatus === "ok" ? 10 : system.healthStatus === "degraded" ? 7 : 3;
  const budgetUtilizationPercent = Math.min(100, system.queueBacklog.size * 5);

  const overall = Math.max(0, Math.min(100,
    (uptime / 100) * 100 -
    errorRate * 50 -
    Math.min(20, queueDepth) -
    findingPenalty
  ));

  return {
    overall: Math.round(overall),
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

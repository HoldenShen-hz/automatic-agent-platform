import type { DashboardSystemSituation } from "../index.js";

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

const HEALTH_STATUS_SCORES: Record<DashboardSystemSituation["healthStatus"], number> = {
  ok: 100,
  degraded: 72,
  overloaded: 44,
  unhealthy: 18,
};

const PROVIDER_STATUS_MULTIPLIER: Record<NonNullable<DashboardSystemSituation["providerHealth"]>["status"], number> = {
  healthy: 1,
  degraded: 0.72,
  failed: 0.25,
};

function normalizeHealthStatus(
  status: DashboardSystemSituation["healthStatus"] | "critical",
): DashboardSystemSituation["healthStatus"] {
  return status === "critical" ? "unhealthy" : status;
}

export function buildStructuredHealthScore(system: DashboardSystemSituation): StructuredHealthScore {
  const queueDepth = resolveQueueDepth(system);
  const degradedQueue = resolveQueueDegraded(system);
  const healthComponent = HEALTH_STATUS_SCORES[normalizeHealthStatus(system.healthStatus)];
  const providerStatus = system.providerHealth?.status ?? "healthy";
  const providerSuccessRate = system.providerHealth?.successRate ?? 1;
  const providerComponent = Math.round(100 * PROVIDER_STATUS_MULTIPLIER[providerStatus] * providerSuccessRate);
  const queuePenalty = Math.min(70, queueDepth * 4 + (degradedQueue ? 18 : 0));
  const queueComponent = Math.max(0, 100 - queuePenalty);
  const findingsPenalty = Math.min(75, system.findings.length * 12);
  const findingsComponent = Math.max(0, 100 - findingsPenalty);
  const overall = Math.max(
    0,
    Math.round(
      healthComponent * 0.4
      + providerComponent * 0.25
      + queueComponent * 0.2
      + findingsComponent * 0.15,
    ),
  );

  const p50LatencyMs = Math.max(20, 25 + queueDepth * 12 + (degradedQueue ? 35 : 0));
  const p99LatencyMs = Math.max(p50LatencyMs, 90 + queueDepth * 45 + (degradedQueue ? 140 : 0));
  const activeWorkers = Math.max(1, Math.ceil(queueDepth / (degradedQueue ? 6 : 4)));
  const budgetUtilizationPercent = Math.min(100, Math.round((100 - queueComponent) * 0.5 + (100 - findingsComponent) * 0.5));

  return {
    overall,
    uptime: Number((95 + healthComponent * 0.05).toFixed(2)),
    errorRate: Number((Math.max(0, 1 - providerSuccessRate) * 100 + system.findings.length * 2).toFixed(2)),
    p50LatencyMs,
    p99LatencyMs,
    queueDepth,
    activeWorkers,
    budgetUtilizationPercent,
    findings: system.findings.length,
  };
}

export function scoreSystemHealth(system: DashboardSystemSituation): number {
  const normalizedHealthStatus = normalizeHealthStatus(system.healthStatus);
  const baseScore = {
    ok: 100,
    degraded: 80,
    overloaded: 60,
    unhealthy: 30,
  }[normalizedHealthStatus];
  const backlogPenalty = Math.min(30, resolveQueueDepth(system));
  const findingPenalty = Math.min(20, system.findings.length * 5);
  return Math.max(0, baseScore - backlogPenalty - findingPenalty);
}

function resolveQueueDepth(system: DashboardSystemSituation): number {
  if (typeof system.queueDepth === "number") {
    return system.queueDepth;
  }
  const queueBacklog = system.queueBacklog as { size?: number } | ReadonlySet<string>;
  if ("size" in queueBacklog && typeof queueBacklog.size === "number") {
    return queueBacklog.size;
  }
  return 0;
}

function resolveQueueDegraded(system: DashboardSystemSituation): boolean {
  if (typeof system.degraded === "boolean") {
    return system.degraded;
  }
  const queueBacklog = system.queueBacklog as { degraded?: boolean };
  return queueBacklog.degraded ?? false;
}

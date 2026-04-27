export interface OpsHealthProbe {
  readonly component: string;
  readonly status: "healthy" | "degraded" | "failed";
  readonly latencyMs?: number;
  readonly timestamp?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OpsHealthMetrics {
  readonly totalComponents: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly healthScore: number;
  readonly averageLatencyMs: number | null;
  readonly slowestComponent: string | null;
  readonly mostRecentCheck: string | null;
}

export interface OpsHealthAlert {
  readonly component: string;
  readonly severity: "warning" | "critical";
  readonly reasonCode: string;
}

export interface OpsHealthSnapshot {
  readonly status: "healthy" | "degraded" | "failed";
  readonly metrics: OpsHealthMetrics;
  readonly alerts: readonly OpsHealthAlert[];
}

function calculateHealthScore(probes: readonly OpsHealthProbe[]): number {
  if (probes.length === 0) return 100;

  let totalScore = 0;
  for (const probe of probes) {
    switch (probe.status) {
      case "healthy":
        totalScore += 100;
        break;
      case "degraded":
        totalScore += 50;
        break;
      case "failed":
        totalScore += 0;
        break;
    }
  }
  return Math.round(totalScore / probes.length);
}

function calculateAverageLatency(probes: readonly OpsHealthProbe[]): number | null {
  const probesWithLatency = probes.filter((p) => p.latencyMs != null);
  if (probesWithLatency.length === 0) return null;

  const total = probesWithLatency.reduce((sum, p) => sum + (p.latencyMs ?? 0), 0);
  return Math.round(total / probesWithLatency.length);
}

function findSlowestComponent(probes: readonly OpsHealthProbe[]): string | null {
  if (probes.length === 0) return null;

  let slowest: string | null = null;
  let maxLatency = -1;

  for (const probe of probes) {
    if (probe.latencyMs != null && probe.latencyMs > maxLatency) {
      maxLatency = probe.latencyMs;
      slowest = probe.component;
    }
  }

  return slowest;
}

function getMostRecentTimestamp(probes: readonly OpsHealthProbe[]): string | null {
  let mostRecent: string | null = null;

  for (const probe of probes) {
    const ts = probe.timestamp;
    if (ts) {
      if (!mostRecent || ts > mostRecent) {
        mostRecent = ts;
      }
    }
  }

  return mostRecent;
}

export function summarizeOpsHealth(probes: readonly OpsHealthProbe[]): "healthy" | "degraded" | "failed" {
  if (probes.some((item) => item.status === "failed")) return "failed";
  if (probes.some((item) => item.status === "degraded")) return "degraded";
  return "healthy";
}

export function findUnhealthyComponents(probes: readonly OpsHealthProbe[]): string[] {
  return probes.filter((item) => item.status !== "healthy").map((item) => item.component);
}

export function calculateHealthMetrics(probes: readonly OpsHealthProbe[]): OpsHealthMetrics {
  const healthyCount = probes.filter((p) => p.status === "healthy").length;
  const degradedCount = probes.filter((p) => p.status === "degraded").length;
  const failedCount = probes.filter((p) => p.status === "failed").length;

  return {
    totalComponents: probes.length,
    healthyCount,
    degradedCount,
    failedCount,
    healthScore: calculateHealthScore(probes),
    averageLatencyMs: calculateAverageLatency(probes),
    slowestComponent: findSlowestComponent(probes),
    mostRecentCheck: getMostRecentTimestamp(probes),
  };
}

export function groupProbesByStatus(probes: readonly OpsHealthProbe[]): { healthy: readonly OpsHealthProbe[]; degraded: readonly OpsHealthProbe[]; failed: readonly OpsHealthProbe[] } {
  const healthy: OpsHealthProbe[] = [];
  const degraded: OpsHealthProbe[] = [];
  const failed: OpsHealthProbe[] = [];

  for (const probe of probes) {
    switch (probe.status) {
      case "healthy":
        healthy.push(probe);
        break;
      case "degraded":
        degraded.push(probe);
        break;
      case "failed":
        failed.push(probe);
        break;
    }
  }

  return { healthy, degraded, failed };
}

export function analyzeLatencyTrends(probes: readonly OpsHealthProbe[]): { component: string; latencyMs: number }[] {
  return probes
    .filter((p) => p.latencyMs != null)
    .map((p) => ({ component: p.component, latencyMs: p.latencyMs as number }))
    .sort((a, b) => b.latencyMs - a.latencyMs);
}

export function hasLatencyAnomalies(probes: readonly OpsHealthProbe[], thresholdMs: number): boolean {
  return probes.some((p) => p.latencyMs != null && p.latencyMs > thresholdMs);
}

export function generateHealthSummary(probes: readonly OpsHealthProbe[]): string {
  const metrics = calculateHealthMetrics(probes);
  const status = summarizeOpsHealth(probes);

  const parts: string[] = [
    `Overall: ${status.toUpperCase()}`,
    `Score: ${metrics.healthScore}/100`,
    `Components: ${metrics.healthyCount} healthy, ${metrics.degradedCount} degraded, ${metrics.failedCount} failed`,
  ];

  if (metrics.averageLatencyMs != null) {
    parts.push(`Avg latency: ${metrics.averageLatencyMs}ms`);
  }

  if (metrics.slowestComponent) {
    parts.push(`Slowest: ${metrics.slowestComponent}`);
  }

  return parts.join(" | ");
}

export class OpsHealthMonitorService {
  public evaluate(
    probes: readonly OpsHealthProbe[],
    options: { readonly latencyThresholdMs?: number } = {},
  ): OpsHealthSnapshot {
    const metrics = calculateHealthMetrics(probes);
    const status = summarizeOpsHealth(probes);
    const latencyThresholdMs = options.latencyThresholdMs ?? 1_000;
    const alerts: OpsHealthAlert[] = [];

    for (const probe of probes) {
      if (probe.status === "failed") {
        alerts.push({
          component: probe.component,
          severity: "critical",
          reasonCode: "ops.health.component_failed",
        });
      } else if (probe.status === "degraded") {
        alerts.push({
          component: probe.component,
          severity: "warning",
          reasonCode: "ops.health.component_degraded",
        });
      }

      if (probe.latencyMs != null && probe.latencyMs > latencyThresholdMs) {
        alerts.push({
          component: probe.component,
          severity: probe.latencyMs > latencyThresholdMs * 2 ? "critical" : "warning",
          reasonCode: "ops.health.latency_anomaly",
        });
      }
    }

    return {
      status,
      metrics,
      alerts,
    };
  }
}

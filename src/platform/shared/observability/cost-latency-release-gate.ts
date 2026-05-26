import { nowIso } from "../../contracts/types/ids.js";

export interface CostLatencyObservation {
  readonly label: string;
  readonly costUsd: number;
  readonly latencyMs: number;
}

export interface CostLatencyReleaseThresholds {
  readonly maxAverageCostUsd: number;
  readonly maxP95LatencyMs: number;
}

export interface CostLatencyReleaseGateReport {
  readonly checkedAt: string;
  readonly observationCount: number;
  readonly averageCostUsd: number;
  readonly p95LatencyMs: number;
  readonly thresholds: CostLatencyReleaseThresholds;
  readonly blockers: readonly string[];
  readonly verdict: "approved" | "blocked";
}

export function buildCostLatencyReleaseGateReport(
  observations: readonly CostLatencyObservation[],
  thresholds: CostLatencyReleaseThresholds,
): CostLatencyReleaseGateReport {
  const averageCostUsd = observations.length === 0
    ? 0
    : observations.reduce((sum, item) => sum + item.costUsd, 0) / observations.length;
  const sortedLatencies = [...observations].map((item) => item.latencyMs).sort((a, b) => a - b);
  const p95LatencyMs = sortedLatencies.length === 0
    ? 0
    : sortedLatencies[Math.min(sortedLatencies.length - 1, Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1))]!;
  const blockers: string[] = [];
  if (averageCostUsd > thresholds.maxAverageCostUsd) {
    blockers.push(`average_cost_exceeded:${averageCostUsd.toFixed(4)}>${thresholds.maxAverageCostUsd.toFixed(4)}`);
  }
  if (p95LatencyMs > thresholds.maxP95LatencyMs) {
    blockers.push(`p95_latency_exceeded:${p95LatencyMs}>${thresholds.maxP95LatencyMs}`);
  }
  return {
    checkedAt: nowIso(),
    observationCount: observations.length,
    averageCostUsd,
    p95LatencyMs,
    thresholds,
    blockers,
    verdict: blockers.length === 0 ? "approved" : "blocked",
  };
}

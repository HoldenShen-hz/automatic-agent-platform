import { createHash } from "node:crypto";

/**
 * Canonical window sizes for behavior fingerprinting per §63.1.
 */
export const FINGERPRINT_WINDOW_SIZES = ["1h", "7d", "30d", "90d"] as const;
export type FingerprintWindowSize = (typeof FINGERPRINT_WINDOW_SIZES)[number];

export interface BehaviorFingerprintInput {
  agentId: string;
  tools: readonly string[];
  failureCategories: readonly string[];
  averageLatencyMs: number;
  averageCostUsd: number;
  /** §63.1: Canonical window size enum - must be 1h/7d/30d/90d */
  window: FingerprintWindowSize;
  avgStepCount: number;
  toolUsageDistribution?: Readonly<Record<string, number>>;
  successRate?: number;
  riskDistribution?: Readonly<Record<"low" | "medium" | "high" | "critical", number>>;
  driftScore?: number;
}

export interface BehaviorFingerprint {
  fingerprintId: string;
  window: FingerprintWindowSize;
  avgStepCount: number;
  normalizedFeatures: string[];
  hash: string;
}

export class BehaviorFingerprintBuilder {
  public build(input: BehaviorFingerprintInput): BehaviorFingerprint {
    const normalizedFeatures = [
      `agent:${input.agentId}`,
      `tools:${[...input.tools].sort().join(",")}`,
      `failures:${[...input.failureCategories].sort().join(",")}`,
      `latency_bucket:${bucketLatency(input.averageLatencyMs)}`,
      `cost_bucket:${bucketCost(input.averageCostUsd)}`,
      `window:${input.window}`,
      `avg_step_count:${input.avgStepCount}`,
      `tool_usage:${JSON.stringify(input.toolUsageDistribution ?? {})}`,
      `success_rate:${input.successRate ?? 0}`,
      `risk_distribution:${JSON.stringify(input.riskDistribution ?? {})}`,
      `drift_score:${input.driftScore ?? 0}`,
    ];
    const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
    return {
      fingerprintId: `fingerprint:${input.agentId}`,
      window: input.window,
      avgStepCount: input.avgStepCount,
      normalizedFeatures,
      hash,
    };
  }
}

function bucketLatency(latencyMs: number): string {
  if (latencyMs < 1_000) {
    return "fast";
  }
  if (latencyMs < 5_000) {
    return "medium";
  }
  return "slow";
}

function bucketCost(costUsd: number): string {
  if (costUsd < 0.1) {
    return "low";
  }
  if (costUsd < 1) {
    return "medium";
  }
  return "high";
}

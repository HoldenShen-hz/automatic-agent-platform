import { createHash } from "node:crypto";
import { nowIso } from "../../../../../platform/contracts/types/ids.js";

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
  /** §63: Subject type (e.g., "agent", "workflow", "task") */
  subjectType: string;
  window: FingerprintWindowSize;
  windowStart: string;
  windowEnd: string;
  avgStepCount: number;
  normalizedFeatures: string[];
  behaviorFeatures: string[];
  /** §63: Reference to baseline fingerprint for drift comparison */
  baselineRef: string | null;
  hash: string;
}

export class BehaviorFingerprintBuilder {
  public build(input: BehaviorFingerprintInput): BehaviorFingerprint {
    const behaviorFeatures = [
      `tools:${[...input.tools].sort().join(",")}`,
      `failures:${[...input.failureCategories].sort().join(",")}`,
      `latency_bucket:${bucketLatency(input.averageLatencyMs)}`,
      `cost_bucket:${bucketCost(input.averageCostUsd)}`,
      `avg_step_count:${input.avgStepCount}`,
      `tool_usage:${JSON.stringify(input.toolUsageDistribution ?? {})}`,
      `success_rate:${input.successRate ?? 0}`,
      `risk_distribution:${JSON.stringify(input.riskDistribution ?? {})}`,
    ];
    const normalizedFeatures = [
      `agent:${input.agentId}`,
      ...behaviorFeatures,
      `window:${input.window}`,
      `drift_score:${input.driftScore ?? 0}`,
    ];
    const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
    const now = nowIso();
    return {
      fingerprintId: `fingerprint:${input.agentId}`,
      subjectType: "agent",
      window: input.window,
      windowStart: now,
      windowEnd: now,
      avgStepCount: input.avgStepCount,
      normalizedFeatures,
      behaviorFeatures,
      baselineRef: null,
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

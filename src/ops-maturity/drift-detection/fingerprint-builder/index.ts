import { createHash } from "node:crypto";

export interface BehaviorFingerprintInput {
  agentId: string;
  subjectType?: string;
  baselineRef?: string | null;
  tools: readonly string[];
  failureCategories: readonly string[];
  averageLatencyMs: number;
  averageCostUsd: number;
  avgStepCount?: number;
  window?: {
    readonly start: string;
    readonly end: string;
  };
  toolUsageDistribution?: Readonly<Record<string, number>>;
  successRate?: number;
  riskDistribution?: Readonly<Record<"low" | "medium" | "high" | "critical", number>>;
  driftScore?: number;
}

export interface BehaviorFingerprint {
  fingerprintId: string;
  subjectType: string;
  baselineRef: string | null;
  normalizedFeatures: string[];
  hash: string;
}

export class BehaviorFingerprintBuilder {
  public build(input: BehaviorFingerprintInput): BehaviorFingerprint {
    const subjectType = input.subjectType ?? "agent";
    const baselineRef = input.baselineRef ?? null;
    const normalizedFeatures = [
      `subject_type:${subjectType}`,
      `baseline_ref:${baselineRef ?? "none"}`,
      `agent:${input.agentId}`,
      `tools:${[...input.tools].sort().join(",")}`,
      `failures:${[...input.failureCategories].sort().join(",")}`,
      `latency_bucket:${bucketLatency(input.averageLatencyMs)}`,
      `cost_bucket:${bucketCost(input.averageCostUsd)}`,
      `avg_step_count:${input.avgStepCount ?? 0}`,
      `step_count_bucket:${bucketStepCount(input.avgStepCount ?? 0)}`,
      `window:${input.window?.start ?? "na"}:${input.window?.end ?? "na"}`,
      `tool_usage:${JSON.stringify(input.toolUsageDistribution ?? {})}`,
      `success_rate:${input.successRate ?? 0}`,
      `risk_distribution:${JSON.stringify(input.riskDistribution ?? {})}`,
      `drift_score:${input.driftScore ?? 0}`,
    ];
    const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
    return {
      fingerprintId: `fingerprint:${input.agentId}`,
      subjectType,
      baselineRef,
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

function bucketStepCount(stepCount: number): string {
  if (stepCount < 5) {
    return "short";
  }
  if (stepCount < 15) {
    return "medium";
  }
  return "long";
}

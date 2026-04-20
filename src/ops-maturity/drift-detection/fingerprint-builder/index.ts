import { createHash } from "node:crypto";

export interface BehaviorFingerprintInput {
  agentId: string;
  tools: readonly string[];
  failureCategories: readonly string[];
  averageLatencyMs: number;
  averageCostUsd: number;
}

export interface BehaviorFingerprint {
  fingerprintId: string;
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
    ];
    const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
    return {
      fingerprintId: `fingerprint:${input.agentId}`,
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

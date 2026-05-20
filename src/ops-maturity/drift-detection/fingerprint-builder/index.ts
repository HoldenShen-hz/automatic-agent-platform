import { createHash } from "node:crypto";

export type FingerprintWindowPreset = "1h" | "6h" | "24h" | "7d" | "30d" | "90d";

export interface BehaviorFingerprintInput {
  agentId: string;
  subjectType?: string;
  baselineRef?: string | null;
  tools: readonly string[];
  failureCategories: readonly string[];
  averageLatencyMs: number;
  averageCostUsd: number;
  avgStepCount?: number;
  /** Enumerated time window preset for fingerprinting. */
  windowPreset?: FingerprintWindowPreset | null;
  toolUsageDistribution?: Readonly<Record<string, number>>;
  successRate?: number;
  riskDistribution?: Readonly<Record<"low" | "medium" | "high" | "critical", number>>;
  driftScore?: number;
}

/** Legacy free-form window - preserved for backward compatibility during transition. */
export interface BehaviorFingerprintWindow {
  readonly start: string;
  readonly end: string;
}

function resolveWindowPreset(preset: FingerprintWindowPreset | null | undefined): string {
  const range = resolveWindowRange(preset);
  if (!range) {
    return "none";
  }
  return `${range.start}:${range.end}:${range.preset}`;
}

function resolveWindowRange(
  preset: FingerprintWindowPreset | null | undefined,
  now = new Date(),
): { readonly preset: FingerprintWindowPreset; readonly start: string; readonly end: string } | null {
  if (preset == null) {
    return null;
  }
  const past = new Date(now);
  const durationMs = preset === "1h"
    ? 60 * 60 * 1000
    : preset === "6h"
      ? 6 * 60 * 60 * 1000
      : preset === "24h"
        ? 24 * 60 * 60 * 1000
        : preset === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : preset === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : 90 * 24 * 60 * 60 * 1000;
  past.setTime(now.getTime() - durationMs);
  return {
    preset,
    start: past.toISOString(),
    end: now.toISOString(),
  };
}

export interface BehaviorFingerprint {
  fingerprintId: string;
  subjectType: string;
  baselineRef: string | null;
  window: FingerprintWindowPreset | null;
  windowStart: string | null;
  windowEnd: string | null;
  normalizedFeatures: string[];
  hash: string;
}

export class BehaviorFingerprintBuilder {
  public constructor(private readonly nowProvider: () => Date = () => new Date()) {
  }

  public build(input: BehaviorFingerprintInput): BehaviorFingerprint {
    const subjectType = input.subjectType ?? "agent";
    const baselineRef = input.baselineRef ?? null;
    const windowRange = resolveWindowRange(input.windowPreset, this.nowProvider());
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
      `window:${windowRange == null ? "none" : `${windowRange.start}:${windowRange.end}:${windowRange.preset}`}`,
      `tool_usage:${stableJsonStringify(input.toolUsageDistribution ?? {})}`,
      `success_rate:${input.successRate ?? 0}`,
      `risk_distribution:${stableJsonStringify(input.riskDistribution ?? {})}`,
      `drift_score:${input.driftScore ?? 0}`,
    ];
    const hash = createHash("sha256").update(normalizedFeatures.join("|")).digest("hex");
    return {
      fingerprintId: `fingerprint:${subjectType}:${input.agentId}:${baselineRef ?? "none"}:${input.windowPreset ?? "none"}`,
      subjectType,
      baselineRef,
      window: windowRange?.preset ?? null,
      windowStart: windowRange?.start ?? null,
      windowEnd: windowRange?.end ?? null,
      normalizedFeatures,
      hash,
    };
  }
}

function stableJsonStringify(value: Record<string, number>): string {
  return JSON.stringify(Object.keys(value).sort().reduce<Record<string, number>>((acc, key) => {
    acc[key] = value[key]!;
    return acc;
  }, {}));
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

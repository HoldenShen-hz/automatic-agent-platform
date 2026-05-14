export * from "./prompt-rollout-stage.js";
import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PromptTemplateRecord } from "../registry/index.js";

/**
 * R34-04 fix: Standardized prompt rollout modes with both L0-L5 style and plain names.
 * Plain names: off, suggest, shadow, canary, staged, full
 * L0-L5 style: L0_off, L1_suggest, L2_shadow, L3_canary, L4_partial, L5_stable
 */
export type PromptRolloutMode =
  | "off"
  | "suggest"
  | "shadow"
  | "canary"
  | "staged"
  | "full"
  | "L0_off"
  | "L1_suggest"
  | "L2_shadow"
  | "L3_canary"
  | "L4_partial"
  | "L5_stable";

// L0-L5 aliases for backward compatibility with older code
export const DEPRECATED_PROMPT_ROLLOUT_MODE_ALIASES: Record<string, PromptRolloutMode> = {
  "partial": "L4_partial",
  "stable": "L5_stable",
};

/**
 * R34-04 fix: Normalize rollout mode names to standardized L0-L5 levels.
 * L0-L5 names are canonical; plain names are accepted as backward-compatible aliases.
 */
export function normalizePromptRolloutMode(mode: string): PromptRolloutMode {
  const canonicalByMode: Record<string, PromptRolloutMode> = {
    off: "L0_off",
    suggest: "L1_suggest",
    shadow: "L2_shadow",
    canary: "L3_canary",
    staged: "L4_partial",
    full: "L5_stable",
    partial: "L4_partial",
    stable: "L5_stable",
    L0_off: "L0_off",
    L1_suggest: "L1_suggest",
    L2_shadow: "L2_shadow",
    L3_canary: "L3_canary",
    L4_partial: "L4_partial",
    L5_stable: "L5_stable",
  };
  return canonicalByMode[mode] ?? "L0_off";
}

// R16-04 fix: PromptRolloutStatus must include all lifecycle states per §16.1
export type PromptRolloutStatus = "ready" | "canary_5" | "canary_20" | "stable" | "blocked" | "rolled_back";

export interface PromptRolloutRecord {
  rolloutId: string;
  templateKey: string;
  version: string;
  mode: PromptRolloutMode;
  status: PromptRolloutStatus;
  owner: string;
  fixedPrefixHash: string;
  regressionSuiteId: string;
  regressionPassed: boolean;
  guardrailSummary: string;
  createdAt: string;
  updatedAt: string;
  statusEnteredAt: string;
}

export interface PromptRolloutDecision {
  allowed: boolean;
  nextStatus: PromptRolloutStatus;
  reason: string;
}

export interface PromptRolloutMetrics {
  qualityScore: number;
  errorRate: number;
  latencyP99Ms: number;
  previousQualityScore?: number | null;
  previousLatencyP99Ms?: number | null;
  /** Optional sample count for auto-rollback validation */
  sampleCount?: number;
}

/**
 * R23-46 fix: Auto-rollback configuration for metric regression detection.
 * When autoRollbackConfig is set on the service, evaluateRolloutMetrics will
 * automatically trigger rollback when regression thresholds are exceeded.
 */
export interface PromptRolloutAutoRollbackConfig {
  /** Maximum allowed quality score drop (absolute, e.g. 0.05 = 5 points) */
  maxQualityDrop: number;
  /** Maximum allowed latency increase multiplier (e.g. 1.2 = 20% increase) */
  maxLatencyMultiplier: number;
  /** Minimum sample count before auto-rollback can trigger */
  minimumSampleCount: number;
}

export interface AutoRollbackTriggerResult {
  triggered: boolean;
  reason: string;
  rollbackRecord?: PromptRolloutRecord;
}

export class PromptRolloutService {
  private readonly rollouts = new Map<string, PromptRolloutRecord>();
  /** R23-46 fix: Optional auto-rollback configuration for metric regression detection */
  private readonly autoRollbackConfig: PromptRolloutAutoRollbackConfig | null;

  public constructor(autoRollbackConfig?: PromptRolloutAutoRollbackConfig | null) {
    this.autoRollbackConfig = autoRollbackConfig ?? null;
  }

  public createRollout(input: {
    template: PromptTemplateRecord;
    mode: PromptRolloutMode;
    owner: string;
    regressionSuiteId: string;
    regressionPassed: boolean;
    domainBlockCompatible: boolean;
  }): PromptRolloutRecord {
    const now = nowIso();
    const decision = this.evaluateGuardrail({
      mode: input.mode,
      regressionPassed: input.regressionPassed,
      domainBlockCompatible: input.domainBlockCompatible,
    });
    const record: PromptRolloutRecord = {
      rolloutId: newId("prompt_rollout"),
      templateKey: input.template.templateKey,
      version: input.template.version,
      mode: input.mode,
      status: decision.nextStatus,
      owner: input.owner.trim(),
      fixedPrefixHash: input.template.fixedPrefixHash,
      regressionSuiteId: input.regressionSuiteId.trim(),
      regressionPassed: input.regressionPassed,
      guardrailSummary: decision.allowed && decision.nextStatus === "canary_5"
        ? "rollout_guardrail_passed"
        : decision.reason,
      createdAt: now,
      updatedAt: now,
      statusEnteredAt: now,
    };
    this.rollouts.set(record.rolloutId, record);
    return record;
  }

  public activateRollout(rolloutId: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    // R16-04 & R16-13 fix: Activate rollout from ready status to canary_5 (traffic split phase)
    const nextStatusByCurrent: Partial<Record<PromptRolloutStatus, PromptRolloutStatus>> = {
      ready: "canary_5",
      canary_5: "canary_20",
      canary_20: "stable",
    };
    const nextStatus = nextStatusByCurrent[record.status];
    if (nextStatus == null) {
      throw new ValidationError(
        `prompt_rollout.invalid_transition:${record.status}->next`,
        `Prompt rollout in status ${record.status} cannot transition forward.`,
      );
    }
    const updated = { ...record, status: nextStatus, updatedAt: nowIso(), statusEnteredAt: nowIso() };
    this.rollouts.set(rolloutId, updated);
    return updated;
  }

  public rollbackRollout(rolloutId: string, reason: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    if (record.status !== "canary_5" && record.status !== "canary_20" && record.status !== "stable") {
      throw new ValidationError(
        `prompt_rollout.invalid_transition:${record.status}->rolled_back`,
        `Prompt rollout in status ${record.status} cannot be rolled back.`,
      );
    }
    const updated = {
      ...record,
      status: "rolled_back" as const,
      guardrailSummary: reason.trim(),
      updatedAt: nowIso(),
      statusEnteredAt: nowIso(),
    };
    this.rollouts.set(rolloutId, updated);
    return updated;
  }

  public evaluateGuardrail(input: {
    mode: PromptRolloutMode;
    regressionPassed: boolean;
    domainBlockCompatible: boolean;
  }): PromptRolloutDecision {
    if (!input.regressionPassed) {
      return { allowed: false, nextStatus: "blocked", reason: "regression_gate_failed" };
    }
    if (!input.domainBlockCompatible) {
      return { allowed: false, nextStatus: "blocked", reason: "domain_block_incompatible" };
    }
    // R34-04 fix: Map all rollout modes to appropriate rollout statuses
    // off / L0_off - blocked, no rollout
    if (input.mode === "off" || input.mode === "L0_off") {
      return { allowed: false, nextStatus: "blocked", reason: "rollout_mode_off" };
    }
    // suggest / L1_suggest - allowed but stays in shadow/canary_5
    if (input.mode === "suggest" || input.mode === "L1_suggest") {
      return { allowed: true, nextStatus: "canary_5", reason: "suggest_mode_guardrail_passed" };
    }
    // shadow / L2_shadow - shadow mode, canary_5 with observation
    if (input.mode === "shadow" || input.mode === "L2_shadow") {
      return { allowed: true, nextStatus: "canary_5", reason: "shadow_guardrail_passed" };
    }
    // canary / L3_canary - full canary deployment
    if (input.mode === "canary" || input.mode === "L3_canary") {
      return { allowed: true, nextStatus: "canary_5", reason: "canary_guardrail_passed" };
    }
    // staged / L4_partial - partial rollout (canary_20)
    if (input.mode === "staged" || input.mode === "L4_partial") {
      return { allowed: true, nextStatus: "canary_20", reason: "partial_rollout_guardrail_passed" };
    }
    // full / L5_stable - full stable rollout
    if (input.mode === "full" || input.mode === "L5_stable") {
      return { allowed: true, nextStatus: "stable", reason: "stable_rollout_guardrail_passed" };
    }
    // Default fallback for unknown modes
    return { allowed: true, nextStatus: "canary_5", reason: "rollout_guardrail_passed" };
  }

  public evaluateRolloutMetrics(
    rolloutId: string,
    metrics: PromptRolloutMetrics,
  ): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    if (record.status !== "canary_5" && record.status !== "canary_20" && record.status !== "stable") {
      return record;
    }
    // R23-46 fix: When autoRollbackConfig is set, only use that evaluation
    // (requires minimumSampleCount to be met before triggering rollback)
    if (this.autoRollbackConfig != null) {
      const sampleCount = metrics.sampleCount ?? 0;
      if (sampleCount >= this.autoRollbackConfig.minimumSampleCount) {
        const hasQualityRegression =
          metrics.previousQualityScore != null &&
          metrics.qualityScore < metrics.previousQualityScore - this.autoRollbackConfig.maxQualityDrop;
        const hasLatencyRegression =
          metrics.previousLatencyP99Ms != null &&
          metrics.latencyP99Ms > metrics.previousLatencyP99Ms * this.autoRollbackConfig.maxLatencyMultiplier;
        const threshold =
          record.status === "canary_5"
            ? 0.05
            : record.status === "canary_20"
              ? 0.03
              : 0.01;
        const hasErrorRegression = metrics.errorRate > threshold;
        if (hasQualityRegression || hasLatencyRegression || hasErrorRegression) {
          const reason = hasQualityRegression
            ? `auto_rollback:quality_regression:${metrics.previousQualityScore?.toFixed(2)}→${metrics.qualityScore.toFixed(2)}`
            : hasLatencyRegression
              ? `auto_rollback:latency_regression:${metrics.previousLatencyP99Ms}ms→${metrics.latencyP99Ms}ms`
              : `auto_rollback:error_rate_exceeded:${metrics.errorRate.toFixed(3)} > ${threshold}`;
          return this.rollbackRollout(rolloutId, reason);
        }
      }
      // When autoRollbackConfig is set but sampleCount < minimumSampleCount,
      // skip evaluation entirely to avoid premature rollback
      return record;
    }
    // Original metric evaluation (backward compatible when no autoRollbackConfig is set)
    const hasQualityRegression =
      metrics.previousQualityScore != null &&
      metrics.qualityScore < metrics.previousQualityScore - 0.05;
    const hasLatencyRegression =
      metrics.previousLatencyP99Ms != null &&
      metrics.latencyP99Ms > metrics.previousLatencyP99Ms * 1.2;
    const threshold =
      record.status === "canary_5"
        ? 0.05
        : record.status === "canary_20"
          ? 0.03
          : 0.01;
    const hasErrorRegression = metrics.errorRate > threshold;
    if (!hasQualityRegression && !hasLatencyRegression && !hasErrorRegression) {
      return record;
    }
    const reason = hasQualityRegression
      ? `quality_regression:${metrics.previousQualityScore?.toFixed(2)}→${metrics.qualityScore.toFixed(2)}`
      : hasLatencyRegression
        ? `latency_regression:${metrics.previousLatencyP99Ms}ms→${metrics.latencyP99Ms}ms`
        : `error_rate_exceeded:${metrics.errorRate.toFixed(3)} > ${threshold}`;
    return this.rollbackRollout(rolloutId, reason);
  }

  public listRollouts(templateKey?: string): PromptRolloutRecord[] {
    const all = [...this.rollouts.values()];
    return all.filter((record) => templateKey == null || record.templateKey === templateKey);
  }

  private getRequired(rolloutId: string): PromptRolloutRecord {
    const record = this.rollouts.get(rolloutId);
    if (record == null) {
      throw new ValidationError(`prompt_rollout.not_found:${rolloutId}`, `Prompt rollout ${rolloutId} was not found.`);
    }
    return record;
  }
}

export * from "./platform-prompt-release-orchestration-service.js";

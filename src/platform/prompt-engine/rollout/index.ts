export * from "./prompt-rollout-stage.js";
import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PromptTemplateRecord } from "../registry/index.js";

// §16.3: canary mode maps to the canary_5/canary_20 staged rollout pipeline.
// R16-04 FIX: Added "canary" to valid modes — mode must match stage pipeline.
// R34-36 FIX #1957: PromptRolloutMode must support all rollout stages per spec.
// Valid modes: off, suggest, shadow, canary (maps to staged canary pipeline)
// Valid transitions: blocked → canary_5 → canary_20 → stable → deprecated
// rolled_back is a terminal state from rollbackRollout().
export type PromptRolloutMode = "off" | "suggest" | "shadow" | "canary";
// R16-04 FIX: Align with §16.1 lifecycle - canary stages per §16.3
// Valid transitions: blocked → canary_5 → canary_20 → stable → deprecated
// rolled_back is a terminal state
export type PromptRolloutStatus = "blocked" | "canary_5" | "canary_20" | "stable" | "deprecated" | "rolled_back";

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
  /** §16.3: ISO timestamp when the rollout entered its current status. Used to enforce dwell-time. */
  statusEnteredAt: string;
}

export interface PromptRolloutDecision {
  allowed: boolean;
  nextStatus: PromptRolloutStatus;
  reason: string;
}

export class PromptRolloutService {
  private readonly rollouts = new Map<string, PromptRolloutRecord>();

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
      version: String(input.template.version),
      mode: input.mode,
      // R16-04 FIX: Start at canary_5 per §16.3 canonical pipeline
      status: decision.allowed ? "canary_5" : "blocked",
      owner: input.owner.trim(),
      fixedPrefixHash: input.template.fixedPrefixHash,
      regressionSuiteId: input.regressionSuiteId.trim(),
      regressionPassed: input.regressionPassed,
      guardrailSummary: decision.reason,
      createdAt: now,
      updatedAt: now,
      statusEnteredAt: now,
    };
    this.rollouts.set(record.rolloutId, record);
    return record;
  }

  public activateRollout(rolloutId: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    // R16-13 FIX: Allow canary traffic split transitions per §16.3
    // R16-04 FIX: Valid transitions only go forward: canary_5 → canary_20 → stable
    // stable does NOT transition to rolled_back via activateRollout (that is a separate rollback operation)
    const validTransitions: Record<string, string> = {
      "canary_5": "canary_20",
      "canary_20": "stable",
    };
    const nextStatus = validTransitions[record.status];
    if (nextStatus === undefined) {
      throw new ValidationError(
        `prompt_rollout.invalid_transition:${record.status}->canary/stable`,
        `Prompt rollout in status ${record.status} cannot transition to canary or stable. Valid transitions: canary_5→canary_20→stable`,
      );
    }
    // R16-04 FIX: §16.3 dwell-time enforcement — require minimum time at each stage before advancing.
    // This prevents skipping the progressive canary phases (5% → 20% → stable).
    const DWELL_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours
    const stageEnteredAt = new Date(record.statusEnteredAt).getTime();
    const nowMs = Date.now();
    const timeInStage = nowMs - stageEnteredAt;
    if (timeInStage < DWELL_TIME_MS) {
      const remainingSec = Math.ceil((DWELL_TIME_MS - timeInStage) / 1000);
      throw new ValidationError(
        `prompt_rollout.dwell_time_not_met:${record.status}`,
        `Prompt rollout in status ${record.status} must wait ${remainingSec}s more before advancing.`,
      );
    }
    const updated = { ...record, status: nextStatus as PromptRolloutStatus, updatedAt: nowIso(), statusEnteredAt: nowIso() };
    this.rollouts.set(rolloutId, updated);
    return updated;
  }

  public rollbackRollout(rolloutId: string, reason: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    // R16-04 FIX: Allow rollback from canary stages and stable per §16.3
    // Only "blocked", "deprecated", or already "rolled_back" cannot be rolled back
    const rollbackableStates = ["canary_5", "canary_20", "stable"];
    if (!rollbackableStates.includes(record.status)) {
      throw new ValidationError(
        `prompt_rollout.invalid_transition:${record.status}->rolled_back`,
        `Prompt rollout in status ${record.status} cannot be rolled back. Only canary_5, canary_20, or stable rollouts can be rolled back.`,
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
    if (input.mode === "shadow") {
      return { allowed: true, nextStatus: "canary_5", reason: "shadow_guardrail_passed" };
    }
    // R16-04 FIX: Start at canary_5 per §16.3 canonical pipeline
    return { allowed: true, nextStatus: "canary_5", reason: "rollout_guardrail_passed" };
  }

  /**
   * R34-36 FIX #1958: Evaluates rollout metrics and automatically rolls back if regression detected.
   * §16.3 requires metric regression auto-rollback at each canary stage.
   * When quality score drops by more than 5% or latency increases by >20%,
   * the rollout is automatically rolled back to the previous stable state.
   */
  public evaluateRolloutMetrics(rolloutId: string, metrics: {
    qualityScore: number;
    latencyP99Ms: number;
    errorRate: number;
    previousQualityScore?: number;
    previousLatencyP99Ms?: number;
  }): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);

    // Only rollback from active canary or stable stages
    const rollbackableStates = ["canary_5", "canary_20", "stable"];
    if (!rollbackableStates.includes(record.status)) {
      return record;
    }

    // Check for quality regression: current score < previous score - 0.05 threshold
    const hasQualityRegression = metrics.previousQualityScore != null
      && metrics.qualityScore < metrics.previousQualityScore - 0.05;

    // Check for latency regression: current latency > previous * 1.20 (120%)
    const hasLatencyRegression = metrics.previousLatencyP99Ms != null
      && metrics.latencyP99Ms > metrics.previousLatencyP99Ms * 1.20;

    // Check error rate threshold for current stage
    const stageThreshold: { maxErrorRate: number } | undefined = record.status === "canary_5"
      ? { maxErrorRate: 0.05 }
      : record.status === "canary_20" ? { maxErrorRate: 0.03 } : { maxErrorRate: 0.01 };
    const exceedsErrorThreshold = stageThreshold != null && metrics.errorRate > stageThreshold.maxErrorRate;

    if (hasQualityRegression || hasLatencyRegression || exceedsErrorThreshold) {
      const reason = hasQualityRegression
        ? `quality_regression:${metrics.previousQualityScore?.toFixed(2)}→${metrics.qualityScore.toFixed(2)}`
        : hasLatencyRegression
          ? `latency_regression:${metrics.previousLatencyP99Ms}ms→${metrics.latencyP99Ms}ms`
          : `error_rate_exceeded:${metrics.errorRate.toFixed(3)} > ${stageThreshold.maxErrorRate}`;

      return this.rollbackRollout(rolloutId, reason);
    }

    return record;
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

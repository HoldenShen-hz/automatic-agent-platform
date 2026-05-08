export * from "./prompt-rollout-stage.js";
import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PromptTemplateRecord } from "../registry/index.js";

export type PromptRolloutMode = "off" | "suggest" | "shadow";
export type PromptRolloutStatus = "canary_5" | "canary_20" | "stable" | "blocked" | "rolled_back";

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
      version: input.template.version,
      mode: input.mode,
      status: decision.nextStatus,
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
    const nextStatusByCurrent: Partial<Record<PromptRolloutStatus, PromptRolloutStatus>> = {
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
    if (input.mode === "shadow") {
      return { allowed: true, nextStatus: "canary_5", reason: "shadow_guardrail_passed" };
    }
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

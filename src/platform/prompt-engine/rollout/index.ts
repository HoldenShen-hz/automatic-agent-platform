import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PromptTemplateRecord } from "../registry/index.js";

export type PromptRolloutMode = "off" | "suggest" | "shadow";
export type PromptRolloutStatus = "draft" | "ready" | "active" | "blocked" | "rolled_back";

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
      version: input.template.version,
      mode: input.mode,
      status: decision.allowed ? "ready" : "blocked",
      owner: input.owner.trim(),
      fixedPrefixHash: input.template.fixedPrefixHash,
      regressionSuiteId: input.regressionSuiteId.trim(),
      regressionPassed: input.regressionPassed,
      guardrailSummary: decision.reason,
      createdAt: now,
      updatedAt: now,
    };
    this.rollouts.set(record.rolloutId, record);
    return record;
  }

  public activateRollout(rolloutId: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    if (record.status !== "ready") {
      throw new ValidationError(
        `prompt_rollout.invalid_transition:${record.status}->active`,
        `Prompt rollout in status ${record.status} cannot transition to active.`,
      );
    }
    const updated = { ...record, status: "active" as const, updatedAt: nowIso() };
    this.rollouts.set(rolloutId, updated);
    return updated;
  }

  public rollbackRollout(rolloutId: string, reason: string): PromptRolloutRecord {
    const record = this.getRequired(rolloutId);
    const updated = {
      ...record,
      status: "rolled_back" as const,
      guardrailSummary: reason.trim(),
      updatedAt: nowIso(),
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
      return { allowed: true, nextStatus: "ready", reason: "shadow_guardrail_passed" };
    }
    return { allowed: true, nextStatus: "ready", reason: "rollout_guardrail_passed" };
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

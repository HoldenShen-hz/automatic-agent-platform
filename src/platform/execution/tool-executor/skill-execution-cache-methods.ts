
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
} from "../../control-plane/config-center/model-metadata-registry.js";
import {
  createDefaultResourceCeilingGuard,
  type ResourceCeilingGuard,
} from "../../control-plane/config-center/resource-ceiling.js";
import { ValidationError } from "../../contracts/errors.js";
import { TypedEventBus, type SkillEventType, type TypedEventPayloadMap } from "../../state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AgentExecutionRecord, StepOutputRecord } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { sanitizeMcpToolCallResult, validateMcpToolDefinition, validateMcpToolRuntime } from "./mcp-tool-guard.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";
import { resolveExecutionAllowedTools } from "./tool-execution-access.js";
import {
  isToolFailureRetryable,
  resolveToolExecutionMetadata,
  resolveToolTimeoutMs,
  type ToolExecutionMetadata,
  type ToolRecoveryStrategy,
} from "./tool-metadata.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { ExecutionResourceCeilingFinding } from "../dispatcher/execution-resource-ceiling-guard.js";

import {
  defaultGitHeadResolver,
  defaultSummary,
  normalizeAttempts,
  normalizeWorkingDirectory,
  stableSerialize,
  type CacheLookup,
  type CachedSkillExecutionEntry,
  type CachedSkillStepResult,
  type ResolvedSkillModelProfile,
  type ResolvedSkillStep,
  type SkillDefinition,
  type SkillExecutionCacheMetadata,
  type SkillExecutionCachePolicy,
  type SkillExecutionRequest,
  type SkillExecutionResult,
  type SkillExecutionServiceOptions,
  type SkillStepDefinition,
  type SkillStepExecutionResult,
  type SkillToolCallRequest,
  type SkillToolCallResult,
  type SkillToolRunner,
} from "./skill-execution-support.js";

import type { SkillExecutionService } from "./skill-execution-service.js";

const skillExecutionLogger = new StructuredLogger({ retentionLimit: 100 });

export const skillExecutionCacheMethods = {
  resolveModelProfile(this: SkillExecutionService, modelProfileName: string | null | undefined): ResolvedSkillModelProfile | null {
    const normalized = modelProfileName?.trim() ?? "";
    if (normalized.length === 0) {
      return null;
    }

    const profile = this.modelMetadataRegistry.profiles[normalized];
    if (!profile) {
      throw new ValidationError(`skill.model_profile_unknown:${normalized}`, `skill.model_profile_unknown:${normalized}`, {
        source: "tool",
        details: { modelProfileName: normalized },
      });
    }

    return {
      profileName: normalized,
      profile,
    };
  },
  resolveSkillSteps(this: SkillExecutionService, 
    skill: SkillDefinition,
    modelProfile: ResolvedSkillModelProfile | null,
  ): ResolvedSkillStep[] {
    return skill.steps.map((step) => {
      const override = modelProfile == null ? null : (step.modelOverrides ?? []).find((candidate) => {
        const matchesProfileName = candidate.profileNames == null || candidate.profileNames.length === 0
          || candidate.profileNames.includes(modelProfile.profileName);
        const matchesTier = candidate.tiers == null || candidate.tiers.length === 0
          || candidate.tiers.includes(modelProfile.profile.tier);
        const matchesCapabilities = candidate.requiredCapabilities == null || candidate.requiredCapabilities.length === 0
          || candidate.requiredCapabilities.every((capability) => modelProfile.profile.capabilities.includes(capability));
        return matchesProfileName && matchesTier && matchesCapabilities;
      }) ?? null;

      return {
        stepId: step.stepId,
        requestedToolName: step.toolName,
        resolvedToolName: override?.toolName ?? step.toolName,
        description: step.description,
        onFailure: step.onFailure,
        maxAttempts: step.maxAttempts,
        input: step.input,
        modelOverrideApplied: override != null,
      };
    });
  },
  resolveCacheLookup(this: SkillExecutionService, skill: SkillDefinition, policy: SkillExecutionCachePolicy | undefined): CacheLookup {
    const enabled = policy?.enabled !== false;
    const workingDirectory = normalizeWorkingDirectory(policy?.workingDirectory);
    const sourceHash = policy?.sourceHash?.trim() || null;
    const gitHead = workingDirectory == null ? null : this.gitHeadResolver(workingDirectory);

    if (!enabled) {
      return {
        metadata: {
          eligible: false,
          enabled: false,
          status: "disabled",
          key: null,
          workingDirectory,
          gitHead,
          sourceHash,
          storedAt: null,
          expiresAt: null,
          reason: "cache_disabled",
        },
        entry: null,
      };
    }

    if (!skill.cacheable) {
      return {
        metadata: {
          eligible: false,
          enabled: true,
          status: "ineligible",
          key: null,
          workingDirectory,
          gitHead,
          sourceHash,
          storedAt: null,
          expiresAt: null,
          reason: "skill_not_cacheable",
        },
        entry: null,
      };
    }

    if (gitHead == null && sourceHash == null) {
      return {
        metadata: {
          eligible: false,
          enabled: true,
          status: "ineligible",
          key: null,
          workingDirectory,
          gitHead,
          sourceHash,
          storedAt: null,
          expiresAt: null,
          reason: "missing_source_fingerprint",
        },
        entry: null,
      };
    }

    const parametersJson = stableSerialize(policy?.parameters ?? {});
    const key = createHash("sha256")
      .update(
        stableSerialize({
          skillId: skill.skillId,
          skillVersion: skill.version,
          parametersJson,
          workingDirectory,
          gitHead,
          sourceHash,
        }),
      )
      .digest("hex");

    const now = nowIso();
    const entry = this.getCacheEntry(key, now);
    if (!entry) {
      return {
        metadata: {
          eligible: true,
          enabled: true,
          status: "miss",
          key,
          workingDirectory,
          gitHead,
          sourceHash,
          storedAt: null,
          expiresAt: null,
          reason: null,
        },
        entry: null,
      };
    }

    return {
      metadata: {
        eligible: true,
        enabled: true,
        status: "hit",
        key,
        workingDirectory: entry.workingDirectory,
        gitHead: entry.gitHead,
        sourceHash: entry.sourceHash,
        storedAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        reason: null,
      },
      entry,
    };
  },
  getCacheEntry(this: SkillExecutionService, key: string, now: string): CachedSkillExecutionEntry | null {
    const entry = this.cache.get(key) ?? null;
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= now) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  },
  storeCacheEntry(this: SkillExecutionService, 
    skill: SkillDefinition,
    metadata: SkillExecutionCacheMetadata,
    steps: CachedSkillStepResult[],
    retryCount: number,
  ): SkillExecutionCacheMetadata {
    if (metadata.status !== "miss" || metadata.key == null || steps.length === 0) {
      return metadata;
    }

    const createdAt = nowIso();
    const expiresAt = new Date(Date.parse(createdAt) + Math.max(1, skill.cacheTtlSeconds ?? 3600) * 1000).toISOString();
    const entry: CachedSkillExecutionEntry = {
      key: metadata.key,
      skillId: skill.skillId,
      skillVersion: skill.version,
      workingDirectory: metadata.workingDirectory,
      gitHead: metadata.gitHead,
      sourceHash: metadata.sourceHash,
      createdAt,
      expiresAt,
      resultStatus: "succeeded",
      retryCount,
      steps: steps.map((step) => ({ ...step })),
    };

    this.cache.delete(entry.key);
    this.cache.set(entry.key, entry);
    while (this.cache.size > this.cacheMaxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }

    return {
      ...metadata,
      status: "stored",
      storedAt: createdAt,
      expiresAt,
      reason: null,
    };
  },
  buildCachedStepResult(this: SkillExecutionService, input: {
    step: ResolvedSkillStep;
    status: StepOutputRecord["status"];
    attempts: number;
    maxAttempts: number;
    result: SkillToolCallResult;
  }): CachedSkillStepResult {
    return {
      stepId: input.step.stepId,
      requestedToolName: input.step.requestedToolName,
      resolvedToolName: input.step.resolvedToolName,
      status: input.status,
      attempts: input.attempts,
      maxAttempts: input.maxAttempts,
      retryCount: Math.max(0, input.attempts - 1),
      continuedAfterFailure: input.status === "partial_success",
      errorCode: input.result.errorCode ?? null,
      summary: input.result.summary ?? defaultSummary(input.step, input.status),
      output: input.result.output ?? null,
      data: input.result.data ?? null,
      onFailure: input.step.onFailure ?? "fail",
      durationMs: Math.max(0, Math.trunc(input.result.durationMs ?? 0)),
    };
  },
  buildStepOutput(this: SkillExecutionService, 
    taskId: string,
    skill: SkillDefinition,
    cachedStep: CachedSkillStepResult,
    cacheMetadata: SkillExecutionCacheMetadata,
  ): StepOutputRecord {
    return {
      id: newId("step"),
      taskId,
      stepId: cachedStep.stepId,
      roleId: `skill:${skill.skillId}`,
      status: cachedStep.status,
      dataJson: JSON.stringify({
        skillId: skill.skillId,
        skillVersion: skill.version,
        requestedToolName: cachedStep.requestedToolName,
        toolName: cachedStep.resolvedToolName,
        attempts: cachedStep.attempts,
        maxAttempts: cachedStep.maxAttempts,
        output: cachedStep.output,
        data: cachedStep.data,
        errorCode: cachedStep.errorCode,
        cache: cacheMetadata.status === "hit" ? cacheMetadata : null,
      }),
      summary: cachedStep.summary,
      artifactsJson: null,
      tokenCost: 0,
      durationMs: cachedStep.durationMs,
      validationJson: JSON.stringify({
        onFailure: cachedStep.onFailure,
        retried: cachedStep.attempts > 1,
        cacheHit: cacheMetadata.status === "hit",
        requestedToolName: cachedStep.requestedToolName,
      }),
      producedAt: nowIso(),
    };
  },
  buildCachedStepOutput(this: SkillExecutionService, input: {
    taskId: string;
    skill: SkillDefinition;
    cachedStep: CachedSkillStepResult;
    cacheMetadata: SkillExecutionCacheMetadata;
  }): StepOutputRecord {
    return this.buildStepOutput(input.taskId, input.skill, input.cachedStep, input.cacheMetadata);
  },
  finalizeResourceLimitFailure(this: SkillExecutionService, input: {
    execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>;
    skill: SkillDefinition;
    cacheMetadata: SkillExecutionCacheMetadata;
    planJson: string;
    steps: SkillStepExecutionResult[];
    step: ResolvedSkillStep;
    totalToolCalls: number;
    totalRetries: number;
    startedAt: string;
    occurredAt: string;
    finding: ExecutionResourceCeilingFinding;
  }): SkillExecutionResult {
    const attempts = 1;
    const maxAttempts = normalizeAttempts(input.step);
    const cachedStep = this.buildCachedStepResult({
      step: input.step,
      status: "failed",
      attempts,
      maxAttempts,
      result: {
        success: false,
        status: "failed",
        summary: input.finding.message,
        errorCode: input.finding.reasonCode,
        retryable: false,
        errorSource: "system",
        durationMs: 0,
        data: {
          resourceLimit: {
            dimension: input.finding.dimension,
            actual: input.finding.actual,
            limit: input.finding.limit,
            unit: input.finding.unit,
          },
        },
      },
    });

    this.store.workflow.insertStepOutput(this.buildStepOutput(input.execution.taskId, input.skill, cachedStep, input.cacheMetadata));
    input.steps.push({
      stepId: input.step.stepId,
      toolName: input.step.resolvedToolName,
      status: "failed",
      attempts,
      retryCount: 0,
      continuedAfterFailure: false,
      errorCode: input.finding.reasonCode,
    });
    this.publishEvent("skill:step_failed", input.execution.taskId, input.execution.id, input.execution.traceId, {
      skillId: input.skill.skillId,
      stepId: input.step.stepId,
      toolName: input.step.resolvedToolName,
      attempt: attempts,
      maxAttempts,
      errorCode: input.finding.reasonCode,
      continued: false,
      retrying: false,
    });
    this.upsertAgentExecutionRecord(input.execution.id, {
      execution: input.execution,
      planJson: input.planJson,
      status: "skill_failed",
      currentStepId: input.step.stepId,
      lastToolName: input.step.resolvedToolName,
      toolCallCount: input.totalToolCalls,
      retryCount: input.totalRetries,
      progressMessage: `skill:${input.skill.skillId}:resource_limit_exceeded`,
      lastErrorCode: input.finding.reasonCode,
      startedAt: input.startedAt,
      completedAt: input.occurredAt,
      lastDecisionJson: JSON.stringify({
        skillId: input.skill.skillId,
        status: "failed",
        failedStepId: input.step.stepId,
        errorCode: input.finding.reasonCode,
        resourceLimit: input.finding,
        cache: input.cacheMetadata,
      }),
      occurredAt: input.occurredAt,
    });
    this.publishEvent("skill:execution_completed", input.execution.taskId, input.execution.id, input.execution.traceId, {
      skillId: input.skill.skillId,
      status: "failed",
      retryCount: input.totalRetries,
      failedStepId: input.step.stepId,
      cacheStatus: input.cacheMetadata.status,
    });

    return {
      status: "failed",
      executionId: input.execution.id,
      taskId: input.execution.taskId,
      skillId: input.skill.skillId,
      steps: input.steps,
      retryCount: input.totalRetries,
      cache: input.cacheMetadata,
    };
  },
  publishEvent<TType extends SkillEventType>(this: SkillExecutionService, 
    eventType: TType,
    taskId: string,
    executionId: string,
    traceId: string,
    payload: TypedEventPayloadMap[TType],
  ): void {
    this.bus.publish({
      eventType,
      taskId,
      executionId,
      traceId,
      payload,
    });
  },
  upsertAgentExecutionRecord(this: SkillExecutionService, 
    executionId: string,
    input: {
      execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>;
      planJson: string;
      status: string;
      currentStepId: string | null;
      lastToolName: string | null;
      toolCallCount: number;
      retryCount: number;
      progressMessage: string | null;
      lastErrorCode: string | null;
      startedAt: string;
      completedAt: string | null;
      lastDecisionJson: string | null;
      occurredAt: string;
    },
  ): AgentExecutionRecord {
    const existing = this.store.worker.getAgentExecutionRecord(executionId);
    const record: AgentExecutionRecord = {
      executionId,
      taskId: input.execution.taskId,
      agentId: input.execution.agentId,
      workflowId: input.execution.workflowId,
      roleId: input.execution.roleId,
      runKind: input.execution.runKind,
      runtimeInstanceId: existing?.runtimeInstanceId ?? null,
      restartedFromRuntimeInstanceId: existing?.restartedFromRuntimeInstanceId ?? null,
      restartGeneration: existing?.restartGeneration ?? 0,
      status: input.status,
      planJson: input.planJson,
      currentStepId: input.currentStepId,
      lastToolName: input.lastToolName,
      toolCallCount: Math.max(existing?.toolCallCount ?? 0, Math.trunc(input.toolCallCount)),
      lastDecisionJson: input.lastDecisionJson,
      lastErrorCode: input.lastErrorCode,
      retryCount: Math.max(existing?.retryCount ?? 0, Math.trunc(input.retryCount)),
      progressMessage: input.progressMessage,
      startedAt: existing?.startedAt ?? input.startedAt,
      createdAt: existing?.createdAt ?? input.occurredAt,
      updatedAt: input.occurredAt,
      completedAt: input.completedAt,
    };
    this.store.worker.upsertAgentExecutionRecord(record);
    return record;
  },
} as const;

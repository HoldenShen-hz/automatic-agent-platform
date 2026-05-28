
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  createDefaultResourceCeilingGuard,
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
  type ModelProfileMetadata,
  type ResourceCeilingGuard,
} from "../../five-plane-control-plane/config-center/index.js";
import { ValidationError } from "../../contracts/errors.js";
import { TypedEventBus, type SkillEventType, type TypedEventPayloadMap } from "../../five-plane-state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
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

export const skillExecutionCoreMethods = {
  async execute(this: SkillExecutionService, input: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const execution = this.store.dispatch.getExecution(input.executionId);
    if (!execution) {
      throw new ValidationError(`skill.execution_missing:${input.executionId}`, `skill.execution_missing:${input.executionId}`, {
        source: "tool",
        details: { executionId: input.executionId, skillId: input.skill.skillId },
      });
    }

    const modelProfile = this.resolveModelProfile(input.modelProfileName);

    const resolvedSteps = this.resolveSkillSteps(input.skill, modelProfile);

    const runtimeAllowedToolsResolution = resolveExecutionAllowedTools({
      execution,
      executionRequired: true,
      requestAllowedTools: input.allowedTools,
    });
    if (runtimeAllowedToolsResolution.errorCode != null) {
      throw new ValidationError(
        `skill.execution_allowed_tools_invalid:${input.executionId}`,
        `skill.execution_allowed_tools_invalid:${input.executionId}`,
        {
          source: "tool",
          details: {
            executionId: input.executionId,
            requestedAllowedTools: input.allowedTools ?? null,
            errorCode: runtimeAllowedToolsResolution.errorCode,
          },
        },
      );
    }
    const runtimeAllowedTools = runtimeAllowedToolsResolution.allowedTools;

    this.validateSkillDefinition(input.skill);
    this.validateResolvedSteps(input.skill, resolvedSteps);
    this.validateAllowedTools(input.skill, resolvedSteps, runtimeAllowedTools);

    const planJson = JSON.stringify({
      skillId: input.skill.skillId,
      version: input.skill.version,
      requiredTools: [...input.skill.requiredTools],
      modelProfileName: modelProfile?.profileName ?? null,
      steps: resolvedSteps.map((step) => ({
        stepId: step.stepId,
        requestedToolName: step.requestedToolName,
        resolvedToolName: step.resolvedToolName,
        modelOverrideApplied: step.modelOverrideApplied,
        onFailure: step.onFailure ?? "fail",
        maxAttempts: normalizeAttempts(step),
      })),
      cacheable: input.skill.cacheable ?? false,
      cacheTtlSeconds: input.skill.cacheTtlSeconds ?? null,
    });

    const cacheLookup = await this.resolveCacheLookup(input.skill, input.cache);
    const startedAt = nowIso();
    let totalToolCalls = 0;
    let totalRetries = 0;
    let hadContinuedFailure = false;
    const steps: SkillStepExecutionResult[] = [];
    const cachedStepResults: CachedSkillStepResult[] = [];

    if (cacheLookup.metadata.status === "miss") {
      this.publishEvent("skill:cache_miss", execution.taskId, execution.id, execution.traceId, {
        skillId: input.skill.skillId,
        cacheKey: cacheLookup.metadata.key,
        workingDirectory: cacheLookup.metadata.workingDirectory,
        gitHead: cacheLookup.metadata.gitHead,
        sourceHash: cacheLookup.metadata.sourceHash,
      });
    }

    if (cacheLookup.entry) {
      const cacheHitAt = nowIso();
      for (const cachedStep of cacheLookup.entry.steps) {
        this.store.workflow.insertStepOutput(
          this.buildCachedStepOutput({
            taskId: execution.taskId,
            skill: input.skill,
            cachedStep,
            cacheMetadata: cacheLookup.metadata,
          }),
        );
        steps.push({
          stepId: cachedStep.stepId,
          toolName: cachedStep.resolvedToolName,
          status: cachedStep.status,
          attempts: cachedStep.attempts,
          retryCount: cachedStep.retryCount,
          continuedAfterFailure: cachedStep.continuedAfterFailure,
          errorCode: cachedStep.errorCode,
        });
      }
      this.upsertAgentExecutionRecord(execution.id, {
        execution,
        planJson,
        status: "skill_cache_hit",
        currentStepId: null,
        lastToolName: cacheLookup.entry.steps.at(-1)?.resolvedToolName ?? null,
        toolCallCount: 0,
        retryCount: cacheLookup.entry.retryCount,
        progressMessage: `skill:${input.skill.skillId}:cache_hit`,
        lastErrorCode: null,
        startedAt,
        completedAt: cacheHitAt,
        lastDecisionJson: JSON.stringify({
          skillId: input.skill.skillId,
          status: "succeeded",
          cache: cacheLookup.metadata,
        }),
        occurredAt: cacheHitAt,
      });
      this.publishEvent("skill:cache_hit", execution.taskId, execution.id, execution.traceId, {
        skillId: input.skill.skillId,
        cacheKey: cacheLookup.metadata.key,
        workingDirectory: cacheLookup.metadata.workingDirectory,
        gitHead: cacheLookup.metadata.gitHead,
        sourceHash: cacheLookup.metadata.sourceHash,
        storedAt: cacheLookup.metadata.storedAt,
        expiresAt: cacheLookup.metadata.expiresAt,
      });
      this.publishEvent("skill:execution_completed", execution.taskId, execution.id, execution.traceId, {
        skillId: input.skill.skillId,
        status: "succeeded",
        retryCount: cacheLookup.entry.retryCount,
        cacheStatus: "hit",
      });
      return {
        status: "succeeded",
        executionId: execution.id,
        taskId: execution.taskId,
        skillId: input.skill.skillId,
        steps,
        retryCount: cacheLookup.entry.retryCount,
        cache: cacheLookup.metadata,
      };
    }

    this.upsertAgentExecutionRecord(execution.id, {
      execution,
      planJson,
      status: "skill_running",
      currentStepId: null,
      lastToolName: null,
      toolCallCount: 0,
      retryCount: 0,
      progressMessage: `skill:${input.skill.skillId}:started`,
      lastErrorCode: null,
      startedAt,
      completedAt: null,
      lastDecisionJson: JSON.stringify({
        skillId: input.skill.skillId,
        cache: cacheLookup.metadata,
      }),
      occurredAt: startedAt,
    });
    this.publishEvent("skill:execution_started", execution.taskId, execution.id, execution.traceId, {
      skillId: input.skill.skillId,
      version: input.skill.version,
      stepCount: resolvedSteps.length,
      cacheStatus: cacheLookup.metadata.status,
    });

    for (const step of resolvedSteps) {
      const maxAttempts = normalizeAttempts(step);
      const failureMode = step.onFailure ?? "fail";
      const toolMetadata = this.toolMetadataResolver(step.resolvedToolName);
      let attempt = 0;
      let lastFailure: SkillToolCallResult | null = null;

      while (attempt < maxAttempts) {
        const attemptStartedAt = nowIso();

        const nextToolCallFinding = this.resourceCeilingGuard.firstFinding({
          executionId: execution.id,
          taskId: execution.taskId,
          agentId: execution.agentId,
          status: "skill_running",
          currentStepId: step.stepId,
          toolCallCount: totalToolCalls + 1,
          startedAt,
          now: attemptStartedAt,
        });
        if (nextToolCallFinding) {
          return this.finalizeResourceLimitFailure({
            execution,
            skill: input.skill,
            cacheMetadata: cacheLookup.metadata,
            planJson,
            steps,
            step,
            totalToolCalls,
            totalRetries,
            startedAt,
            occurredAt: attemptStartedAt,
            finding: nextToolCallFinding,
          });
        }

        attempt += 1;
        totalToolCalls += 1;
        this.publishEvent("skill:step_started", execution.taskId, execution.id, execution.traceId, {
          skillId: input.skill.skillId,
          stepId: step.stepId,
          toolName: step.resolvedToolName,
          attempt,
          maxAttempts,
        });

        this.upsertAgentExecutionRecord(execution.id, {
          execution,
          planJson,
          status: attempt > 1 ? "skill_retrying" : "skill_running",
          currentStepId: step.stepId,
          lastToolName: step.resolvedToolName,
          toolCallCount: totalToolCalls,
          retryCount: totalRetries,
          progressMessage: `skill:${input.skill.skillId}:step:${step.stepId}:attempt:${attempt}`,
          lastErrorCode: lastFailure?.errorCode ?? null,
          startedAt,
          completedAt: null,
          lastDecisionJson: null,
          occurredAt: attemptStartedAt,
        });

        const result = await this.executeToolCallWithPolicy(
          {
            skillId: input.skill.skillId,
            skillVersion: input.skill.version,
            executionId: execution.id,
            taskId: execution.taskId,
            traceId: execution.traceId,
            stepId: step.stepId,
            toolName: step.resolvedToolName,
            attempt,
            maxAttempts,
            input: step.input ?? {},
          },
          toolMetadata,
        );

        const elapsedFinding = this.resourceCeilingGuard.firstFinding({
          executionId: execution.id,
          taskId: execution.taskId,
          agentId: execution.agentId,
          status: "skill_running",
          currentStepId: step.stepId,
          toolCallCount: totalToolCalls,
          startedAt,
          now: nowIso(),
        });
        if (elapsedFinding) {
          return this.finalizeResourceLimitFailure({
            execution,
            skill: input.skill,
            cacheMetadata: cacheLookup.metadata,
            planJson,
            steps,
            step,
            totalToolCalls,
            totalRetries,
            startedAt,
            occurredAt: nowIso(),
            finding: elapsedFinding,
          });
        }

        if (result.success) {
          const cachedStep = this.buildCachedStepResult({
            step,
            status: "succeeded",
            attempts: attempt,
            maxAttempts,
            result,
          });
          cachedStepResults.push(cachedStep);
          this.store.workflow.insertStepOutput(this.buildStepOutput(execution.taskId, input.skill, cachedStep, cacheLookup.metadata));
          this.publishEvent("skill:step_succeeded", execution.taskId, execution.id, execution.traceId, {
            skillId: input.skill.skillId,
            stepId: step.stepId,
            toolName: step.resolvedToolName,
            attempt,
            maxAttempts,
          });
          steps.push({
            stepId: step.stepId,
            toolName: step.resolvedToolName,
            status: "succeeded",
            attempts: attempt,
            retryCount: attempt - 1,
            continuedAfterFailure: false,
            errorCode: null,
          });
          break; // Step succeeded, move to next step
        }

        lastFailure = result;
        this.publishEvent("skill:step_failed", execution.taskId, execution.id, execution.traceId, {
          skillId: input.skill.skillId,
          stepId: step.stepId,
          toolName: step.resolvedToolName,
          attempt,
          maxAttempts,
          errorCode: result.errorCode ?? null,
          continued: false,
          retrying: failureMode === "retry" && attempt < maxAttempts && result.retryable !== false,
        });

        const shouldRetry = failureMode === "retry" && attempt < maxAttempts && result.retryable === true;
        if (shouldRetry) {
          totalRetries += 1;
          this.publishEvent("skill:retry_scheduled", execution.taskId, execution.id, execution.traceId, {
            skillId: input.skill.skillId,
            stepId: step.stepId,
            toolName: step.resolvedToolName,
            attempt,
            nextAttempt: attempt + 1,
            errorCode: result.errorCode ?? null,
          });
          continue; // Retry the step
        }

        const finalStatus = failureMode === "continue" ? "partial_success" : "failed";
        const cachedStep = this.buildCachedStepResult({
          step,
          status: finalStatus,
          attempts: attempt,
          maxAttempts,
          result,
        });
        cachedStepResults.push(cachedStep);
        this.store.workflow.insertStepOutput(this.buildStepOutput(execution.taskId, input.skill, cachedStep, cacheLookup.metadata));
        steps.push({
          stepId: step.stepId,
          toolName: step.resolvedToolName,
          status: finalStatus,
          attempts: attempt,
          retryCount: attempt - 1,
          continuedAfterFailure: failureMode === "continue",
          errorCode: result.errorCode ?? null,
        });

        if (failureMode === "continue") {
          hadContinuedFailure = true;
          break;
        }

        const failedAt = nowIso();
        this.upsertAgentExecutionRecord(execution.id, {
          execution,
          planJson,
          status: "skill_failed",
          currentStepId: step.stepId,
          lastToolName: step.resolvedToolName,
          toolCallCount: totalToolCalls,
          retryCount: totalRetries,
          progressMessage: `skill:${input.skill.skillId}:failed`,
          lastErrorCode: result.errorCode ?? "skill.step_failed",
          startedAt,
          completedAt: failedAt,
          lastDecisionJson: JSON.stringify({
            skillId: input.skill.skillId,
            status: "failed",
            failedStepId: step.stepId,
            errorCode: result.errorCode ?? null,
            cache: cacheLookup.metadata,
          }),
          occurredAt: failedAt,
        });
        this.publishEvent("skill:execution_completed", execution.taskId, execution.id, execution.traceId, {
          skillId: input.skill.skillId,
          status: "failed",
          retryCount: totalRetries,
          failedStepId: step.stepId,
          cacheStatus: cacheLookup.metadata.status,
        });
        return {
          status: "failed",
          executionId: execution.id,
          taskId: execution.taskId,
          skillId: input.skill.skillId,
          steps,
          retryCount: totalRetries,
          cache: cacheLookup.metadata,
        };
      }
    }

    const finalStatus = hadContinuedFailure ? "completed_with_failures" : "succeeded";

    const storedCacheMetadata =
      finalStatus === "succeeded"
        ? this.storeCacheEntry(input.skill, cacheLookup.metadata, cachedStepResults, totalRetries)
        : cacheLookup.metadata;
    if (storedCacheMetadata.status === "stored") {
      this.publishEvent("skill:cache_stored", execution.taskId, execution.id, execution.traceId, {
        skillId: input.skill.skillId,
        cacheKey: storedCacheMetadata.key,
        workingDirectory: storedCacheMetadata.workingDirectory,
        gitHead: storedCacheMetadata.gitHead,
        sourceHash: storedCacheMetadata.sourceHash,
        storedAt: storedCacheMetadata.storedAt,
        expiresAt: storedCacheMetadata.expiresAt,
      });
    }

    const completedAt = nowIso();
    this.upsertAgentExecutionRecord(execution.id, {
      execution,
      planJson,
      status: finalStatus === "succeeded" ? "skill_succeeded" : "skill_completed_with_failures",
      currentStepId: null,
      lastToolName: steps.at(-1)?.toolName ?? null,
      toolCallCount: totalToolCalls,
      retryCount: totalRetries,
      progressMessage: `skill:${input.skill.skillId}:completed`,
      lastErrorCode: hadContinuedFailure ? steps.find((step) => step.continuedAfterFailure)?.errorCode ?? null : null,
      startedAt,
      completedAt,
      lastDecisionJson: JSON.stringify({
        skillId: input.skill.skillId,
        status: finalStatus,
        continuedFailureStepIds: steps.filter((step) => step.continuedAfterFailure).map((step) => step.stepId),
        cache: storedCacheMetadata,
      }),
      occurredAt: completedAt,
    });
    this.publishEvent("skill:execution_completed", execution.taskId, execution.id, execution.traceId, {
      skillId: input.skill.skillId,
      status: finalStatus,
      retryCount: totalRetries,
      cacheStatus: storedCacheMetadata.status,
    });

    return {
      status: finalStatus,
      executionId: execution.id,
      taskId: execution.taskId,
      skillId: input.skill.skillId,
      steps,
      retryCount: totalRetries,
      cache: storedCacheMetadata,
    };
  },
  async executeToolCallWithPolicy(this: SkillExecutionService, 
    request: Omit<SkillToolCallRequest, "timeoutMs" | "recoveryStrategy">,
    metadata: ToolExecutionMetadata | null,
  ): Promise<SkillToolCallResult> {
    const timeoutMs = resolveToolTimeoutMs(undefined, metadata);
    const startedAtMs = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const result = await new Promise<SkillToolCallResult>((resolveResult, rejectResult) => {
        timer = setTimeout(() => {
          resolveResult(
            this.normalizeToolCallResult(
              {
                success: false,
                status: "timed_out",
                summary: `Tool ${request.toolName} timed out after ${timeoutMs}ms.`,
                errorCode: "tool.timeout",
                errorSource: "tool",
              },
              metadata,
              startedAtMs,
            ),
          );
        }, timeoutMs);
        timer.unref(); // Prevent timer from keeping event loop alive

        Promise.resolve(
          this.toolRunner({
            ...request,
            timeoutMs,
            recoveryStrategy: metadata?.recoveryStrategy ?? "manual_resume_required",
          }),
        ).then(
          (runnerResult) => {
            resolveResult(this.normalizeToolCallResult(runnerResult, metadata, startedAtMs));
          },
          rejectResult,
        );
      });

      return result;
    } catch (error) {
      return this.normalizeToolCallResult(
        {
          success: false,
          summary: error instanceof Error ? error.message : String(error),
          errorCode: "tool.execution_failed",
          errorSource: "system",
        },
        metadata,
        startedAtMs,
      );
    } finally {
      if (timer != null) {
        clearTimeout(timer);
      }
    }
  },
  normalizeToolCallResult(this: SkillExecutionService, 
    result: SkillToolCallResult,
    metadata: ToolExecutionMetadata | null,
    startedAtMs: number,
  ): SkillToolCallResult {
    const sanitizedResult = sanitizeMcpToolCallResult(metadata?.toolName ?? "", result);
    const status = sanitizedResult.status ?? (sanitizedResult.success ? "succeeded" : "failed");
    const errorCode =
      sanitizedResult.errorCode
      ?? (status === "timed_out" ? "tool.timeout" : sanitizedResult.success ? null : "tool.execution_failed");
    const errorSource = sanitizedResult.errorSource ?? (sanitizedResult.success ? null : "tool");
    return {
      ...sanitizedResult,
      status,
      errorCode,
      errorSource,
      retryable:
        sanitizedResult.success
          ? false
          : isToolFailureRetryable({
              metadata,
              status,
              source: errorSource,
              errorCode,
              requestedRetryable: sanitizedResult.retryable,
            }),
      durationMs: Math.max(0, Math.trunc(sanitizedResult.durationMs ?? (Date.now() - startedAtMs))),
    };
  },
  validateSkillDefinition(this: SkillExecutionService, skill: SkillDefinition): void {
    const declaredTools = new Set(skill.requiredTools);
    for (const toolName of skill.requiredTools) {
      const mcpIssue = validateMcpToolDefinition(toolName);
      if (mcpIssue) {
        throw new ValidationError(`skill.mcp_tool_${mcpIssue.code}:${toolName}`, `skill.mcp_tool_${mcpIssue.code}:${toolName}`, {
          source: "tool",
          details: { toolName, issueCode: mcpIssue.code },
        });
      }
      if (this.toolMetadataResolver(toolName) == null) {
        throw new ValidationError(`skill.definition_unknown_tool:${toolName}`, `skill.definition_unknown_tool:${toolName}`, {
          source: "tool",
          details: { toolName },
        });
      }
    }
    for (const step of skill.steps) {
      if (!declaredTools.has(step.toolName)) {
        throw new ValidationError(
          `skill.definition_tool_not_declared:${step.stepId}:${step.toolName}`,
          `skill.definition_tool_not_declared:${step.stepId}:${step.toolName}`,
          {
            source: "tool",
            details: { stepId: step.stepId, toolName: step.toolName },
          },
        );
      }
      for (const override of step.modelOverrides ?? []) {
        if (!declaredTools.has(override.toolName)) {
          throw new ValidationError(
            `skill.definition_override_tool_not_declared:${step.stepId}:${override.toolName}`,
            `skill.definition_override_tool_not_declared:${step.stepId}:${override.toolName}`,
            {
              source: "tool",
              details: { stepId: step.stepId, toolName: override.toolName },
            },
          );
        }
        const overrideMcpIssue = validateMcpToolDefinition(override.toolName);
        if (overrideMcpIssue) {
          throw new ValidationError(
            `skill.mcp_tool_${overrideMcpIssue.code}:${override.toolName}`,
            `skill.mcp_tool_${overrideMcpIssue.code}:${override.toolName}`,
            {
              source: "tool",
              details: { toolName: override.toolName, issueCode: overrideMcpIssue.code },
            },
          );
        }
      }
    }
  },
  validateResolvedSteps(this: SkillExecutionService, skill: SkillDefinition, resolvedSteps: readonly ResolvedSkillStep[]): void {
    const declaredTools = new Set(skill.requiredTools);
    for (const step of resolvedSteps) {
      if (!declaredTools.has(step.resolvedToolName)) {
        throw new ValidationError(
          `skill.resolved_tool_not_declared:${step.stepId}:${step.resolvedToolName}`,
          `skill.resolved_tool_not_declared:${step.stepId}:${step.resolvedToolName}`,
          {
            source: "tool",
            details: { stepId: step.stepId, toolName: step.resolvedToolName },
          },
        );
      }
      const mcpIssue = validateMcpToolRuntime(step.resolvedToolName, this.toolMetadataResolver(step.resolvedToolName));
      if (mcpIssue) {
        throw new ValidationError(
          `skill.mcp_tool_${mcpIssue.code}:${step.resolvedToolName}`,
          `skill.mcp_tool_${mcpIssue.code}:${step.resolvedToolName}`,
          {
            source: "tool",
            details: { stepId: step.stepId, toolName: step.resolvedToolName, issueCode: mcpIssue.code },
          },
        );
      }
    }
  },
  validateAllowedTools(this: SkillExecutionService, 
    skill: SkillDefinition,
    resolvedSteps: readonly ResolvedSkillStep[],
    allowedTools: readonly string[] | undefined,
  ): void {
    if (allowedTools == null) {
      return; // No restriction
    }

    const allowed = new Set(allowedTools);
    for (const toolName of skill.requiredTools) {
      if (!allowed.has(toolName)) {
        throw new ValidationError(`skill.tool_not_allowed:${toolName}`, `skill.tool_not_allowed:${toolName}`, {
          source: "tool",
          details: { toolName },
        });
      }
    }
    for (const step of resolvedSteps) {
      if (!allowed.has(step.resolvedToolName)) {
        throw new ValidationError(`skill.tool_not_allowed:${step.resolvedToolName}`, `skill.tool_not_allowed:${step.resolvedToolName}`, {
          source: "tool",
          details: { stepId: step.stepId, toolName: step.resolvedToolName },
        });
      }
    }
  },
} as const;

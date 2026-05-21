/**
 * @fileoverview Multi-step workflow supervisor for orchestration execution.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type {
  CostEventRecord,
  ExecutionPrecheckRecord,
  ExecutionRecord,
  MessageRecord,
  SessionRecord,
  StepOutputRecord,
  TransitionAuditContext,
} from "../../contracts/types/domain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createChildTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { buildRetryRecordParts, buildStructuredToolResultParts, ensureMessagePartsJson, serializeMessageParts } from "../../model-gateway/messages/message-parts.js";
import type { StreamBridge } from "../../five-plane-interface/channel-gateway/stream-bridge.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { createWorkflowStepCheckpoint } from "../../five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";
import { decideWorkflowStepRetry, type WorkflowStepRetryDecision } from "../../five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import {
  populateMissingRequiredWorkflowStepOutput,
  validateWorkflowStepOutput,
} from "../../five-plane-orchestration/oapeflir/workflow/output-schema.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import { buildStepOutput } from "./multi-step-agent-round-loop.js";
import { getMultiStepToolDefinitions } from "./multi-step-tool-definitions.js";
import type { MultiStepToolExecutionInput, StepFailurePlan } from "./multi-step-orchestration-types.js";
import { maybeInjectWorkflowCrash } from "../recovery/workflow-crash-simulator.js";
import {
  buildStepFailureSummary,
  normalizeStepErrorCode,
  resolveStepFailurePlan,
  type ExecutionDeps,
  type StepExecutionResult,
  type StepSupervisorContext,
} from "./multi-step-supervisor-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export {
  buildStepFailureSummary,
  normalizeStepErrorCode,
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
} from "./multi-step-supervisor-types.js";
export type { ExecutionDeps, StepExecutionResult, StepSupervisorContext } from "./multi-step-supervisor-types.js";

export async function executeStepLoop(
  ctx: StepSupervisorContext,
  deps: ExecutionDeps,
): Promise<StepExecutionResult> {
  const {
    taskId,
    sessionId,
    traceId,
    traceContext,
    streamId,
    input,
    routing,
    plannedWorkflow,
    toolExposureService,
  } = ctx;

  let outputs = ctx.outputs;
  const stepOutputs = ctx.stepOutputs;
  let latestCompaction = ctx.latestCompaction;
  let executionAttemptCounter = ctx.executionAttemptCounter;
  let workflowRetryCount = ctx.workflowRetryCount;
  let workflowLastErrorCode = ctx.workflowLastErrorCode;
  let blockedForDecision = ctx.blockedForDecision;
  let stepCompleted = false;
  const skippedStepIds = ctx.skippedStepIds;
  const failedStepIds = ctx.failedStepIds;

  for (const [index, step] of plannedWorkflow.executionSteps.entries()) {
    const priorSummaries = stepOutputs.map((item) => item.summary ?? "").filter(Boolean);
    const toolExposure = toolExposureService.resolve({
      divisionId: step.divisionId,
      roleId: step.roleId,
      taskContext: [input.title, input.request, `step:${step.stepId}`, priorSummaries.join("\n")].filter((part) => part.length > 0).join("\n"),
    });

    const hardBlockers = (step.dependsOnStepIds ?? []).filter((depId) => {
      const depType = step.dependencyTypes[depId] ?? "hard";
      return depType === "hard" && (failedStepIds.has(depId) || skippedStepIds.has(depId));
    });

    if (hardBlockers.length > 0) {
      skippedStepIds.add(step.stepId);
      const skipNow = nowIso();
      const skipOutput: StepOutputRecord = {
        id: newId("step"),
        nodeRunId: newId("step"),
        taskId,
        stepId: step.stepId,
        roleId: step.roleId,
        status: "skipped",
        dataJson: JSON.stringify({ reasonCode: "upstream_dependency_failed", blockedBy: hardBlockers }),
        summary: `Step ${step.stepId} skipped: upstream dependency failed (${hardBlockers.join(", ")})`,
        artifactsJson: null,
        tokenCost: 0,
        durationMs: 0,
        validationJson: null,
        producedAt: skipNow,
      };
      stepOutputs.push(skipOutput);
      deps.db.transaction(() => {
        deps.store.workflow.insertStepOutput(skipOutput);
        deps.store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "workflow:step_skipped",
          eventTier: "tier_1",
          payloadJson: JSON.stringify(injectTraceContext({
            stepId: step.stepId,
            roleId: step.roleId,
            status: "skipped",
            reasonCode: "upstream_dependency_failed",
            blockedBy: hardBlockers,
          }, createChildTraceContext(traceContext))),
          traceId,
          createdAt: skipNow,
        });
        deps.store.workflow.updateWorkflowRecoveryState({
          taskId,
          status: "running",
          currentStepIndex: index + 1,
          outputsJson: JSON.stringify(outputs),
          updatedAt: skipNow,
          resumableFromStep: null,
          retryCount: workflowRetryCount,
          lastErrorCode: workflowLastErrorCode,
        });
      });
      continue;
    }

    stepCompleted = false;
    for (let attempt = 1; attempt <= step.maxAttempts; attempt += 1) {
      executionAttemptCounter += 1;
      const executionId = newId("exec");
      const executionNow = nowIso();
      // R4-26 fix: ExecutionRecord now created with harnessRunId from StepSupervisorContext
      const execution: ExecutionRecord = {
        id: executionId,
        taskId,
        workflowId: plannedWorkflow.workflow.workflowId,
        parentExecutionId: null,
        harnessRunId: ctx.harnessRunId, // R4-27 fix: Associated HarnessRun for canonical tracking
        agentId: step.agentId,
        roleId: step.roleId,
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
        attempt: executionAttemptCounter,
        timeoutMs: step.timeoutMs,
        budgetUsdLimit: 1,
        budgetReservationId: null,
        budgetLedgerId: null,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: JSON.stringify(toolExposure.resolvedToolNames),
        allowedPathsJson: JSON.stringify([]),
        maxRetries: Math.max(0, step.maxAttempts - 1),
        retryBackoff: "linear",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: executionNow,
        updatedAt: executionNow,
      };

      deps.db.transaction(() => {
        const subtaskStartTrace = createChildTraceContext(traceContext);
        deps.store.execution.insertExecution(execution);
        deps.store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId,
          eventType: "subtask:started",
          payloadJson: JSON.stringify(injectTraceContext({
            stepId: step.stepId,
            roleId: step.roleId,
            dependsOnStepIds: step.dependsOnStepIds,
            attempt,
          }, subtaskStartTrace)),
          traceId,
          createdAt: nowIso(),
        });
      });

      deps.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "created",
        toStatus: "prechecking",
        ...deps.createContext(`execution.precheck_started:${step.stepId}:attempt_${attempt}`),
      });

      const precheck: ExecutionPrecheckRecord = {
        id: newId("precheck"),
        executionId,
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: execution.budgetUsdLimit,
        resolvedTimeoutMs: execution.timeoutMs,
        resolvedSandboxMode: execution.sandboxMode ?? "workspace_write",
        resolvedToolsJson: JSON.stringify(toolExposure.visibleToolNames),
        resolvedPathsJson: execution.allowedPathsJson,
        checkedAt: nowIso(),
      };
      deps.store.execution.insertExecutionPrecheck(precheck);

      deps.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "prechecking",
        toStatus: "executing",
        ...deps.createContext(`execution.started:${step.stepId}:attempt_${attempt}`),
      });

      maybeInjectWorkflowCrash(input.crashInjection, {
        point: "step_started",
        taskId,
        executionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        stepId: step.stepId,
      });

      const plannedFailure = resolveStepFailurePlan(input, step.stepId, attempt);

      if (plannedFailure != null) {
        const decision = decideWorkflowStepRetry({ errorCode: plannedFailure.errorCode, attempt, maxAttempts: step.maxAttempts });
        const failedAt = nowIso();

        if (decision.action === "retry") workflowRetryCount += 1;
        workflowLastErrorCode = plannedFailure.errorCode;

        deps.db.transaction(() => {
          deps.store.execution.updateExecutionFailure({
            executionId,
            status: decision.action === "escalate" ? "blocked" : "failed",
            updatedAt: failedAt,
            finishedAt: decision.action === "retry" ? failedAt : null,
            lastErrorCode: plannedFailure.errorCode,
            lastErrorMessage: plannedFailure.message ?? plannedFailure.summary ?? null,
          });
          deps.store.event.insertEvent({
            id: newId("evt"),
            taskId,
            executionId,
            eventType: decision.action === "retry" ? "workflow:step_retry_scheduled" : "workflow:step_failed",
            eventTier: "tier_1",
            payloadJson: JSON.stringify(injectTraceContext({
              stepId: step.stepId,
              roleId: step.roleId,
              attempt,
              nextAttempt: decision.action === "retry" ? attempt + 1 : null,
              errorCode: plannedFailure.errorCode,
              failureClass: decision.failureClass,
              action: decision.action,
              retryDelayMs: decision.retryDelayMs,
            }, createChildTraceContext(traceContext))),
            traceId,
            createdAt: failedAt,
          });
          if (decision.action === "retry") {
            const retryMessage: MessageRecord = {
              id: newId("msg"),
              sessionId,
              direction: "system",
              messageType: "workflow_retry",
              content: buildStepFailureSummary(step.stepId, decision),
              attachmentsJson: null,
              createdAt: failedAt,
            };
            deps.store.session.insertMessage({
              ...retryMessage,
              partsJson: serializeMessageParts(buildRetryRecordParts({
                messageId: retryMessage.id,
                createdAt: failedAt,
                attempt,
                nextAttempt: attempt + 1,
                errorCode: plannedFailure.errorCode,
                source: "multi_step_orchestration",
                retryDelayMs: decision.retryDelayMs,
                failureClass: decision.failureClass,
              })),
            });
          }
          deps.store.workflow.updateWorkflowRecoveryState({
            taskId,
            status: "running",
            currentStepIndex: index,
            outputsJson: JSON.stringify(outputs),
            updatedAt: failedAt,
            resumableFromStep: step.stepId,
            retryCount: workflowRetryCount,
            lastErrorCode: plannedFailure.errorCode,
          });
        });

        if (decision.action === "retry") continue;

        if (decision.action === "escalate") {
          blockedForDecision = true;
          const escalationContext = deps.createContext(plannedFailure.errorCode);
          deps.transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "in_progress", toStatus: "awaiting_decision", executionId, ...escalationContext });
          deps.transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "paused", currentStepIndex: index, outputsJson: JSON.stringify(outputs), ...escalationContext });
          deps.transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "streaming", toStatus: "awaiting_user", ...escalationContext });
          break;
        }

        failedStepIds.add(step.stepId);
        const failOutput: StepOutputRecord = {
          id: newId("step"),
          nodeRunId: executionId,
          taskId,
          stepId: step.stepId,
          roleId: step.roleId,
          status: "failed",
          dataJson: JSON.stringify({ reasonCode: plannedFailure.errorCode }),
          summary: plannedFailure.summary ?? buildStepFailureSummary(step.stepId, decision),
          artifactsJson: null,
          tokenCost: 0,
          durationMs: 0,
          validationJson: null,
          producedAt: failedAt,
        };
        stepOutputs.push(failOutput);
        deps.db.transaction(() => {
          deps.store.workflow.insertStepOutput(failOutput);
          deps.store.workflow.updateWorkflowRecoveryState({
            taskId,
            status: "running",
            currentStepIndex: index + 1,
            outputsJson: JSON.stringify(outputs),
            updatedAt: failedAt,
            resumableFromStep: step.stepId,
            retryCount: workflowRetryCount,
            lastErrorCode: plannedFailure.errorCode,
          });
        });
        break;
      }

      const stepData = await buildStepOutput({
        stepId: step.stepId,
        roleId: step.roleId,
        request: input.request,
        priorSummaries,
        routingReason: routing.routeReason,
        tools: getMultiStepToolDefinitions(toolExposure.visibleToolNames),
      });
      Object.assign(stepData, input.stepOutputOverrides?.[step.stepId] ?? {});
      const stepDataRecord = populateMissingRequiredWorkflowStepOutput(
        step,
        asRecord(stepData, step.stepId),
      );

      let validation: ReturnType<typeof validateWorkflowStepOutput>;
      try {
        validation = validateWorkflowStepOutput(step, stepDataRecord);
      } catch (error) {
        const errorCode = normalizeStepErrorCode(error);
        const decision = decideWorkflowStepRetry({ errorCode, attempt, maxAttempts: step.maxAttempts });
        const failedAt = nowIso();

        if (decision.action === "retry") workflowRetryCount += 1;

        deps.db.transaction(() => {
          deps.store.execution.updateExecutionFailure({
            executionId,
            status: "failed",
            updatedAt: failedAt,
            finishedAt: failedAt,
            lastErrorCode: errorCode,
            lastErrorMessage: error instanceof Error ? error.message : String(error),
          });
          deps.store.event.insertEvent({
            id: newId("evt"),
            taskId,
            executionId,
            eventType: decision.action === "retry" ? "workflow:step_retry_scheduled" : "workflow:step_failed",
            eventTier: "tier_1",
            payloadJson: JSON.stringify(injectTraceContext({
              stepId: step.stepId,
              roleId: step.roleId,
              attempt,
              nextAttempt: decision.action === "retry" ? attempt + 1 : null,
              errorCode,
              failureClass: decision.failureClass,
              action: decision.action,
              retryDelayMs: decision.retryDelayMs,
            }, createChildTraceContext(traceContext))),
            traceId,
            createdAt: failedAt,
          });
          if (decision.action === "retry") {
            const retryMessage: MessageRecord = {
              id: newId("msg"),
              sessionId,
              direction: "system",
              messageType: "workflow_retry",
              content: buildStepFailureSummary(step.stepId, decision),
              attachmentsJson: null,
              createdAt: failedAt,
            };
            deps.store.session.insertMessage({
              ...retryMessage,
              partsJson: serializeMessageParts(buildRetryRecordParts({
                messageId: retryMessage.id,
                createdAt: failedAt,
                attempt,
                nextAttempt: attempt + 1,
                errorCode,
                source: "multi_step_orchestration",
                retryDelayMs: decision.retryDelayMs,
                failureClass: decision.failureClass,
              })),
            });
          }
          deps.store.workflow.updateWorkflowRecoveryState({
            taskId,
            status: "running",
            currentStepIndex: decision.action === "retry" ? index : index + 1,
            outputsJson: JSON.stringify(outputs),
            updatedAt: failedAt,
            resumableFromStep: step.stepId,
            retryCount: workflowRetryCount,
            lastErrorCode: errorCode,
          });
        });

        if (decision.action === "retry") {
          workflowLastErrorCode = errorCode;
          continue;
        }

        failedStepIds.add(step.stepId);
        const failOutput: StepOutputRecord = {
          id: newId("step"),
          nodeRunId: executionId,
          taskId,
          stepId: step.stepId,
          roleId: step.roleId,
          status: "failed",
          dataJson: JSON.stringify({ reasonCode: errorCode, internalMessage: error instanceof Error ? error.message : String(error) }),
          summary: buildStepFailureSummary(step.stepId, decision),
          artifactsJson: null,
          tokenCost: 0,
          durationMs: 0,
          validationJson: null,
          producedAt: failedAt,
        };
        stepOutputs.push(failOutput);
        deps.db.transaction(() => {
          deps.store.workflow.insertStepOutput(failOutput);
          deps.store.workflow.updateWorkflowRecoveryState({
            taskId,
            status: "running",
            currentStepIndex: index + 1,
            outputsJson: JSON.stringify(outputs),
            updatedAt: failedAt,
            resumableFromStep: step.stepId,
            retryCount: workflowRetryCount,
            lastErrorCode: errorCode,
          });
        });
        workflowLastErrorCode = errorCode;
        break;
      }

      const completedStepIds = [...stepOutputs.map((item) => item.nodeRunId), step.stepId];
      const outputKeys = [...Object.keys(outputs), step.outputKey];
      const upstreamArtifactRefs = stepOutputs.flatMap((item) => {
        if (!item.artifactsJson) return [];
        try {
          return JSON.parse(item.artifactsJson) as Array<{ artifactId: string; kind: string; uri: string; createdAt: string }>;
        } catch {
          return [];
        }
      });
      const stepProducedAt = nowIso();
      const artifact = deps.artifactStore.writeJsonArtifact({
        taskId,
        executionId,
        stepId: step.stepId,
        kind: "workflow_step_snapshot",
        fileName: `${step.stepId}.json`,
        content: createWorkflowStepCheckpoint({
          taskId,
          executionId,
          workflowId: plannedWorkflow.workflow.workflowId,
          divisionId: plannedWorkflow.workflow.divisionId,
          harnessRunId: ctx.harnessRunId,
          nodeRunId: executionId,
          planGraphId: plannedWorkflow.workflow.workflowId,
          stepId: step.stepId,
          roleId: step.roleId,
          outputKey: step.outputKey,
          status: "succeeded",
          producedAt: stepProducedAt,
          output: stepDataRecord,
          decisionContext: {
            source: "multi_step_orchestration",
            request: input.request,
            routeReason: routing.routeReason,
            priorStepSummaries: priorSummaries,
            dependsOnStepIds: step.dependsOnStepIds.filter((id): id is string => id !== undefined),
          },
          resumeContext: {
            completedStepIds,
            nextStepId: plannedWorkflow.executionSteps[index + 1]?.stepId ?? null,
            outputKeys,
          },
          upstreamArtifactRefs,
          compensationModel: step.compensationModel ?? null,
        }),
        lineage: {
          traceId,
          workflowId: plannedWorkflow.workflow.workflowId,
          divisionId: plannedWorkflow.workflow.divisionId,
          source: "multi_step_orchestration",
        },
      });

      const stepOutput: StepOutputRecord = {
        id: newId("step"),
        nodeRunId: executionId,
        taskId,
        stepId: step.stepId,
        roleId: step.roleId,
        status: "succeeded",
        dataJson: JSON.stringify(stepData),
        summary: stepData.summary,
        artifactsJson: JSON.stringify([artifact.ref]),
        tokenCost: 50 + index,
        durationMs: 800 + index * 200,
        validationJson: JSON.stringify(validation),
        producedAt: stepProducedAt,
      };

      outputs = { ...outputs, [step.outputKey]: stepData };
      stepOutputs.push(stepOutput);
      workflowLastErrorCode = null;

      // R4-28 (INV-COST-001): Write-ahead logging for cost events - persist BEFORE execution
      // to prevent cost record loss on crash. The cost event is recorded with "pending" status
      // before execution begins. On success, the event is marked as "committed" inside the
      // transaction. On crash recovery, uncommitted cost events can be detected and cleaned up.
      const costEventId = newId("cost");
      const costEventWAL: CostEventRecord = {
        id: costEventId,
        taskId,
        sessionId,
        executionId,
        agentId: step.agentId,
        provider: "minimax",
        model: "MiniMax-M2.7",
        inputTokens: 30 + index * 10,
        outputTokens: 12 + index * 5,
        costUsd: 0.001 + index * 0.0005,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      };
      // Pre-write cost event to WAL table before execution to ensure it's not lost on crash
      deps.store.billing.insertCostEventWAL(costEventWAL, "pending");

      maybeInjectWorkflowCrash(input.crashInjection, {
        point: "before_commit",
        taskId,
        executionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        stepId: step.stepId,
      });

      deps.db.transaction(() => {
        const subtaskCompletedTrace = createChildTraceContext(traceContext);
        const workflowCompletedTrace = createChildTraceContext(traceContext);
        deps.store.artifact.insertArtifact(artifact.record);
        deps.store.workflow.insertStepOutput(stepOutput);

        // R4-28: Mark WAL cost event as committed now that execution succeeded
        deps.store.billing.commitCostEventWAL(costEventId);

        const assistantResponseMessage: MessageRecord = {
          id: newId("msg"),
          sessionId,
          direction: "outbound",
          messageType: "assistant_response",
          content: stepData.summary,
          attachmentsJson: null,
          createdAt: nowIso(),
        };
        deps.store.session.insertMessage({ ...assistantResponseMessage, partsJson: ensureMessagePartsJson(assistantResponseMessage) });
        const toolResultCreatedAt = nowIso();
        const toolResultMessage: MessageRecord = {
          id: newId("msg"),
          sessionId,
          direction: "system",
          messageType: "tool_result",
          content: stepData.result,
          attachmentsJson: null,
          createdAt: toolResultCreatedAt,
        };
        deps.store.session.insertMessage({
          ...toolResultMessage,
          partsJson: serializeMessageParts(buildStructuredToolResultParts({
            messageId: toolResultMessage.id,
            createdAt: toolResultCreatedAt,
            summaryText: stepData.summary,
            resultText: stepData.result,
            artifactRefs: [artifact.ref],
            metadata: { stepId: step.stepId, roleId: step.roleId },
          })),
        });
        deps.store.workflow.updateWorkflowRecoveryState({
          taskId,
          status: "running",
          currentStepIndex: index + 1,
          outputsJson: JSON.stringify(outputs),
          updatedAt: nowIso(),
          resumableFromStep: null,
          retryCount: workflowRetryCount,
          lastErrorCode: null,
        });
        const subtaskCompleted = deps.store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId,
          eventType: "subtask:completed",
          eventTier: "tier_1",
          payloadJson: JSON.stringify(injectTraceContext({ stepId: step.stepId, roleId: step.roleId, status: stepOutput.status, attempt }, subtaskCompletedTrace)),
          traceId,
          createdAt: nowIso(),
        });
        const workflowCompleted = deps.store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId,
          eventType: "workflow:step_completed",
          eventTier: "tier_1",
          payloadJson: JSON.stringify(injectTraceContext({ stepId: step.stepId, roleId: step.roleId, status: stepOutput.status, attempt }, workflowCompletedTrace)),
          traceId,
          createdAt: nowIso(),
        });

        deps.streamBridge.emitFromEvent({ streamId, channel: "cli", event: subtaskCompleted });
        deps.streamBridge.emitFromEvent({ streamId, channel: "cli", event: workflowCompleted });
        deps.streamBridge.emitMessageDelta({ streamId, taskId, channel: "cli", delta: stepData.summary });
      });

      maybeInjectWorkflowCrash(input.crashInjection, {
        point: "tool_completed",
        taskId,
        executionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        stepId: step.stepId,
      });

      if (index === plannedWorkflow.executionSteps.length - 1) {
        latestCompaction = deps.contextCompaction.compactContext({
          taskId,
          sessionId,
          maxContextTokens: input.contextBudgetTokens ?? 8_000,
          providerMaxOutputTokens: 1_024,
          stage1TriggerRatio: 0.7,
          stage2TriggerRatio: 0.85,
          recentToolResultWindow: 2,
          compactionMaxFrequencyPerSession: 2,
        });
        if (latestCompaction.stage1Triggered || latestCompaction.stage2Triggered) {
          deps.store.billing.insertCostEvent({
            id: newId("cost"),
            taskId,
            sessionId,
            executionId,
            agentId: null,
            provider: "minimax",
            model: "MiniMax-M2.7",
            inputTokens: latestCompaction.usageBeforeTokens,
            outputTokens: latestCompaction.stage2Triggered ? latestCompaction.usageAfterStage2Tokens : latestCompaction.usageAfterStage1Tokens,
            costUsd: 0.0005,
            budgetScope: "compaction",
            providerRequestId: null,
            pricingVersion: null,
            createdAt: nowIso(),
          });
        }
      }

      deps.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "executing",
        toStatus: "succeeded",
        ...deps.createContext(`execution.succeeded:${step.stepId}:attempt_${attempt}`),
      });
      stepCompleted = true;
      break;
    }

    if (blockedForDecision) break;
    if (!stepCompleted && !failedStepIds.has(step.stepId) && !skippedStepIds.has(step.stepId)) {
      failedStepIds.add(step.stepId);
    }
  }

  if (stepCompleted === false && blockedForDecision === false && failedStepIds.size > 0) {
    logger.log({
      level: "debug",
      message: "Multi-step supervisor completed with failed steps",
      data: { failedStepIds: [...failedStepIds], skippedStepIds: [...skippedStepIds] },
    });
  }

  return {
    stepCompleted,
    blockedForDecision,
    latestCompaction,
    workflowRetryCount,
    workflowLastErrorCode,
    outputs,
    stepOutputs,
    skippedStepIds,
    failedStepIds,
  };
}

function asRecord(value: unknown, stepId: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`workflow.step_output_record_expected:${stepId}`);
  }
  return value as Record<string, unknown>;
}

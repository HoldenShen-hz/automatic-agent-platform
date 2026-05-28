/**
 * @fileoverview Multi-step workflow supervisor for orchestration execution.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type {
  ExecutionPrecheckRecord,
  ExecutionRecord,
  StepOutputRecord,
} from "../../contracts/types/domain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createChildTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import {
  populateMissingRequiredWorkflowStepOutput,
  validateWorkflowStepOutput,
} from "../../five-plane-orchestration/oapeflir/workflow/output-schema.js";
import { buildStepOutput } from "./multi-step-agent-round-loop.js";
import { getMultiStepToolDefinitions } from "./multi-step-tool-definitions.js";
import type { StepFailurePlan } from "./multi-step-orchestration-types.js";
import { maybeInjectWorkflowCrash } from "../recovery/workflow-crash-simulator.js";
import {
  pauseForBreakpoint,
  skipStepForHardBlockers,
} from "./multi-step-supervisor-breakpoint-support.js";
import {
  handlePlannedStepFailure,
  handleValidationStepFailure,
} from "./multi-step-supervisor-failure-support.js";
import { persistSuccessfulStepAttempt } from "./multi-step-supervisor-success-support.js";
import {
  buildStepFailureSummary,
  normalizeStepErrorCode,
  resolveStepFailurePlan,
  type StepExecutionResult,
  type StepSupervisorContext,
  type ExecutionDeps,
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
    planGraphId,
    toolExposureService,
    workflowDebugger,
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
    if (pauseForBreakpoint({
      ctx: {
        planGraphId: planGraphId ?? null,
        plannedWorkflow,
        workflowDebugger: workflowDebugger ?? null,
        taskId,
        traceId,
        traceContext,
      },
      deps: { db: deps.db, store: deps.store },
      stepId: step.stepId,
    })) {
      blockedForDecision = true;
      break;
    }
    const priorSummaries = stepOutputs.map((item) => item.summary ?? "").filter(Boolean);
    const toolExposure = toolExposureService.resolve({
      divisionId: step.divisionId,
      roleId: step.roleId,
      taskContext: [input.title, input.request, `step:${step.stepId}`, priorSummaries.join("\n")].filter((part) => part.length > 0).join("\n"),
    });

    if (skipStepForHardBlockers({
      ctx: { taskId, traceId, traceContext, workflowRetryCount },
      deps: { db: deps.db, store: deps.store },
      step,
      stepOutputs,
      outputs,
      index,
      skippedStepIds,
      failedStepIds,
    })) {
      workflowLastErrorCode = null;
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
        const failureResult = handlePlannedStepFailure({
          ctx: { taskId, sessionId, traceId, traceContext, workflowRetryCount, outputs },
          deps,
          step,
          executionId,
          attempt,
          index,
          plannedFailure,
          stepOutputs,
          failedStepIds,
        });
        workflowRetryCount = failureResult.workflowRetryCount;
        workflowLastErrorCode = failureResult.workflowLastErrorCode;
        blockedForDecision = failureResult.blockedForDecision;
        if (failureResult.continueAttempts) {
          continue;
        }
        if (failureResult.blockedForDecision) {
          break;
        }
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
      const llmResult = stepData.llmResult ?? null;
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
        const failureResult = handleValidationStepFailure({
          ctx: { taskId, sessionId, traceId, traceContext, workflowRetryCount, outputs },
          deps,
          step,
          executionId,
          attempt,
          index,
          errorCode,
          error,
          stepOutputs,
          failedStepIds,
        });
        workflowRetryCount = failureResult.workflowRetryCount;
        workflowLastErrorCode = failureResult.workflowLastErrorCode;
        blockedForDecision = failureResult.blockedForDecision;
        if (failureResult.continueAttempts) {
          continue;
        }
        break;
      }

      maybeInjectWorkflowCrash(input.crashInjection, {
        point: "before_commit",
        taskId,
        executionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        stepId: step.stepId,
      });

      const successResult = persistSuccessfulStepAttempt({
        ctx: { taskId, sessionId, traceId, traceContext, harnessRunId: ctx.harnessRunId, input, routing, plannedWorkflow },
        deps,
        step,
        executionId,
        attempt,
        index,
        streamId,
        stepData: stepDataRecord,
        stepDataRecord,
        validation,
        llmResult,
        outputs,
        stepOutputs,
        workflowRetryCount,
      });
      outputs = successResult.outputs;
      workflowLastErrorCode = null;

      maybeInjectWorkflowCrash(input.crashInjection, {
        point: "tool_completed",
        taskId,
        executionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        stepId: step.stepId,
      });

      if (successResult.latestCompaction != null) {
        latestCompaction = successResult.latestCompaction;
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

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { MessageRecord, StepOutputRecord } from "../../contracts/types/domain.js";
import { createChildTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import {
  buildRetryRecordParts,
  serializeMessageParts,
} from "../../model-gateway/messages/message-parts.js";
import { decideWorkflowStepRetry } from "../../five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import type { StepFailurePlan } from "./multi-step-orchestration-types.js";
import {
  buildStepFailureSummary,
  type ExecutionDeps,
  type StepSupervisorContext,
} from "./multi-step-supervisor-types.js";

export interface StepFailureHandlingResult {
  blockedForDecision: boolean;
  workflowRetryCount: number;
  workflowLastErrorCode: string;
  continueAttempts: boolean;
}

export function handlePlannedStepFailure(params: {
  ctx: Pick<
    StepSupervisorContext,
    "taskId" | "sessionId" | "traceId" | "traceContext" | "workflowRetryCount" | "outputs"
  >;
  deps: ExecutionDeps;
  step: StepSupervisorContext["plannedWorkflow"]["executionSteps"][number];
  executionId: string;
  attempt: number;
  index: number;
  plannedFailure: StepFailurePlan;
  stepOutputs: StepOutputRecord[];
  failedStepIds: Set<string>;
}): StepFailureHandlingResult {
  return applyStepFailure({
    ...params,
    errorCode: params.plannedFailure.errorCode,
    lastErrorMessage: params.plannedFailure.message ?? params.plannedFailure.summary ?? null,
    failSummary: params.plannedFailure.summary ?? null,
    failData: { reasonCode: params.plannedFailure.errorCode },
  });
}

export function handleValidationStepFailure(params: {
  ctx: Pick<
    StepSupervisorContext,
    "taskId" | "sessionId" | "traceId" | "traceContext" | "workflowRetryCount" | "outputs"
  >;
  deps: ExecutionDeps;
  step: StepSupervisorContext["plannedWorkflow"]["executionSteps"][number];
  executionId: string;
  attempt: number;
  index: number;
  errorCode: string;
  error: unknown;
  stepOutputs: StepOutputRecord[];
  failedStepIds: Set<string>;
}): StepFailureHandlingResult {
  return applyStepFailure({
    ...params,
    errorCode: params.errorCode,
    lastErrorMessage: params.error instanceof Error ? params.error.message : String(params.error),
    failSummary: null,
    failData: {
      reasonCode: params.errorCode,
      internalMessage: params.error instanceof Error ? params.error.message : String(params.error),
    },
  });
}

function applyStepFailure(params: {
  ctx: Pick<
    StepSupervisorContext,
    "taskId" | "sessionId" | "traceId" | "traceContext" | "workflowRetryCount" | "outputs"
  >;
  deps: ExecutionDeps;
  step: StepSupervisorContext["plannedWorkflow"]["executionSteps"][number];
  executionId: string;
  attempt: number;
  index: number;
  errorCode: string;
  lastErrorMessage: string | null;
  failSummary: string | null;
  failData: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  failedStepIds: Set<string>;
}): StepFailureHandlingResult {
  const {
    ctx,
    deps,
    step,
    executionId,
    attempt,
    index,
    errorCode,
    lastErrorMessage,
    failSummary,
    failData,
    stepOutputs,
    failedStepIds,
  } = params;
  const decision = decideWorkflowStepRetry({ errorCode, attempt, maxAttempts: step.maxAttempts });
  const failedAt = nowIso();
  const workflowRetryCount = ctx.workflowRetryCount + (decision.action === "retry" ? 1 : 0);

  deps.db.transaction(() => {
    deps.store.execution.updateExecutionFailure({
      executionId,
      status: decision.action === "escalate" ? "blocked" : "failed",
      updatedAt: failedAt,
      finishedAt: decision.action === "retry" ? failedAt : null,
      lastErrorCode: errorCode,
      lastErrorMessage,
    });
    deps.store.event.insertEvent({
      id: newId("evt"),
      taskId: ctx.taskId,
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
      }, createChildTraceContext(ctx.traceContext))),
      traceId: ctx.traceId,
      createdAt: failedAt,
    });
    if (decision.action === "retry") {
      const retryMessage: MessageRecord = {
        id: newId("msg"),
        sessionId: ctx.sessionId,
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
      taskId: ctx.taskId,
      status: "running",
      currentStepIndex: decision.action === "retry" ? index : index + 1,
      outputsJson: JSON.stringify(ctx.outputs),
      updatedAt: failedAt,
      resumableFromStep: step.stepId,
      retryCount: workflowRetryCount,
      lastErrorCode: errorCode,
    });
  });

  if (decision.action === "retry") {
    return {
      blockedForDecision: false,
      workflowRetryCount,
      workflowLastErrorCode: errorCode,
      continueAttempts: true,
    };
  }

  if (decision.action === "escalate") {
    const escalationContext = deps.createContext(errorCode);
    deps.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: ctx.taskId,
      fromStatus: "in_progress",
      toStatus: "awaiting_decision",
      executionId,
      ...escalationContext,
    });
    deps.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: ctx.taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: index,
      outputsJson: JSON.stringify(ctx.outputs),
      ...escalationContext,
    });
    deps.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: ctx.sessionId,
      fromStatus: "streaming",
      toStatus: "awaiting_user",
      ...escalationContext,
    });
    return {
      blockedForDecision: true,
      workflowRetryCount,
      workflowLastErrorCode: errorCode,
      continueAttempts: false,
    };
  }

  failedStepIds.add(step.stepId);
  const failOutput: StepOutputRecord = {
    id: newId("step"),
    nodeRunId: executionId,
    taskId: ctx.taskId,
    stepId: step.stepId,
    roleId: step.roleId,
    status: "failed",
    dataJson: JSON.stringify(failData),
    summary: failSummary ?? buildStepFailureSummary(step.stepId, decision),
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
      taskId: ctx.taskId,
      status: "running",
      currentStepIndex: index + 1,
      outputsJson: JSON.stringify(ctx.outputs),
      updatedAt: failedAt,
      resumableFromStep: step.stepId,
      retryCount: workflowRetryCount,
      lastErrorCode: errorCode,
    });
  });
  return {
    blockedForDecision: false,
    workflowRetryCount,
    workflowLastErrorCode: errorCode,
    continueAttempts: false,
  };
}

import { newId, nowIso } from "../../contracts/types/ids.js";
import type {
  CostEventRecord,
  MessageRecord,
  StepOutputRecord,
} from "../../contracts/types/domain.js";
import { createChildTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import {
  buildStructuredToolResultParts,
  ensureMessagePartsJson,
  serializeMessageParts,
} from "../../model-gateway/messages/message-parts.js";
import { createWorkflowStepCheckpoint } from "../../five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import { estimateActualLlmCallCost, type LlmModelCallResult } from "./model-call-provider-support.js";
import type { ExecutionDeps, StepSupervisorContext } from "./multi-step-supervisor-types.js";

export function persistSuccessfulStepAttempt(params: {
  ctx: Pick<
    StepSupervisorContext,
    "taskId" | "sessionId" | "traceId" | "traceContext" | "harnessRunId" | "input" | "routing" | "plannedWorkflow"
  >;
  deps: ExecutionDeps;
  step: StepSupervisorContext["plannedWorkflow"]["executionSteps"][number];
  executionId: string;
  attempt: number;
  index: number;
  streamId: string;
  stepData: Record<string, unknown>;
  stepDataRecord: Record<string, unknown>;
  validation: unknown;
  llmResult: LlmModelCallResult | null;
  outputs: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  workflowRetryCount: number;
}): {
  outputs: Record<string, unknown>;
  latestCompaction: ContextCompactionResult | null;
} {
  const {
    ctx,
    deps,
    step,
    executionId,
    attempt,
    index,
    streamId,
    stepData,
    stepDataRecord,
    validation,
    llmResult,
    outputs,
    stepOutputs,
    workflowRetryCount,
  } = params;

  const completedStepIds = [...stepOutputs.map((item) => item.nodeRunId), step.stepId];
  const outputKeys = [...Object.keys(outputs), step.outputKey];
  const upstreamArtifactRefs = stepOutputs.flatMap((item) => {
    if (!item.artifactsJson) {
      return [];
    }
    try {
      return JSON.parse(item.artifactsJson) as Array<{ artifactId: string; kind: string; uri: string; createdAt: string }>;
    } catch {
      return [];
    }
  });
  const stepProducedAt = nowIso();
  const artifact = deps.artifactStore.writeJsonArtifact({
    taskId: ctx.taskId,
    executionId,
    stepId: step.stepId,
    kind: "workflow_step_snapshot",
    fileName: `${step.stepId}.json`,
    content: createWorkflowStepCheckpoint({
      taskId: ctx.taskId,
      executionId,
      workflowId: ctx.plannedWorkflow.workflow.workflowId,
      divisionId: ctx.plannedWorkflow.workflow.divisionId,
      harnessRunId: ctx.harnessRunId,
      nodeRunId: executionId,
      planGraphId: ctx.plannedWorkflow.workflow.workflowId,
      stepId: step.stepId,
      roleId: step.roleId,
      outputKey: step.outputKey,
      status: "succeeded",
      producedAt: stepProducedAt,
      output: stepDataRecord,
      decisionContext: {
        source: "multi_step_orchestration",
        request: ctx.input.request,
        routeReason: ctx.routing.routeReason,
        priorStepSummaries: stepOutputs.map((item) => item.summary ?? "").filter(Boolean),
        dependsOnStepIds: step.dependsOnStepIds.filter((id): id is string => id !== undefined),
      },
      resumeContext: {
        completedStepIds,
        nextStepId: ctx.plannedWorkflow.executionSteps[index + 1]?.stepId ?? null,
        outputKeys,
      },
      upstreamArtifactRefs,
      compensationModel: step.compensationModel ?? null,
    }),
    lineage: {
      traceId: ctx.traceId,
      workflowId: ctx.plannedWorkflow.workflow.workflowId,
      divisionId: ctx.plannedWorkflow.workflow.divisionId,
      source: "multi_step_orchestration",
    },
  });

  const stepOutput: StepOutputRecord = {
    id: newId("step"),
    nodeRunId: executionId,
    taskId: ctx.taskId,
    stepId: step.stepId,
    roleId: step.roleId,
    status: "succeeded",
    dataJson: JSON.stringify(stepData),
    summary: typeof stepData.summary === "string" ? stepData.summary : null,
    artifactsJson: JSON.stringify([artifact.ref]),
    tokenCost: 50 + index,
    durationMs: 800 + index * 200,
    validationJson: JSON.stringify(validation),
    producedAt: stepProducedAt,
  };

  const nextOutputs = { ...outputs, [step.outputKey]: stepData };
  stepOutputs.push(stepOutput);

  const costEventId = newId("cost");
  const costEventWAL = llmResult == null
    ? null
    : {
        id: costEventId,
        ...buildTaskExecutionCostEvent({
          taskId: ctx.taskId,
          sessionId: ctx.sessionId,
          executionId,
          agentId: step.agentId,
          llmResult,
          fallbackInputTokens: 0,
          fallbackOutputTokens: 0,
          fallbackCostUsd: 0,
          createdAt: nowIso(),
        }),
      } satisfies CostEventRecord;
  if (costEventWAL != null) {
    deps.store.billing.insertCostEventWAL(costEventWAL, "pending");
  }

  deps.db.transaction(() => {
    const subtaskCompletedTrace = createChildTraceContext(ctx.traceContext);
    const workflowCompletedTrace = createChildTraceContext(ctx.traceContext);
    deps.store.artifact.insertArtifact(artifact.record);
    deps.store.workflow.insertStepOutput(stepOutput);

    if (costEventWAL != null) {
      deps.store.billing.commitCostEventWAL(costEventId);
    }

    const assistantResponseMessage: MessageRecord = {
      id: newId("msg"),
      sessionId: ctx.sessionId,
      direction: "outbound",
      messageType: "assistant_response",
      content: String(stepData.summary ?? ""),
      attachmentsJson: null,
      createdAt: nowIso(),
    };
    deps.store.session.insertMessage({
      ...assistantResponseMessage,
      partsJson: ensureMessagePartsJson(assistantResponseMessage),
    });
    const toolResultCreatedAt = nowIso();
    const toolResultMessage: MessageRecord = {
      id: newId("msg"),
      sessionId: ctx.sessionId,
      direction: "system",
      messageType: "tool_result",
      content: String(stepData.result ?? ""),
      attachmentsJson: null,
      createdAt: toolResultCreatedAt,
    };
    deps.store.session.insertMessage({
      ...toolResultMessage,
      partsJson: serializeMessageParts(buildStructuredToolResultParts({
        messageId: toolResultMessage.id,
        createdAt: toolResultCreatedAt,
        summaryText: String(stepData.summary ?? ""),
        resultText: String(stepData.result ?? ""),
        artifactRefs: [artifact.ref],
        metadata: { stepId: step.stepId, roleId: step.roleId },
      })),
    });
    deps.store.workflow.updateWorkflowRecoveryState({
      taskId: ctx.taskId,
      status: "running",
      currentStepIndex: index + 1,
      outputsJson: JSON.stringify(nextOutputs),
      updatedAt: nowIso(),
      resumableFromStep: null,
      retryCount: workflowRetryCount,
      lastErrorCode: null,
    });
    const subtaskCompleted = deps.store.event.insertEvent({
      id: newId("evt"),
      taskId: ctx.taskId,
      executionId,
      eventType: "subtask:completed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify(injectTraceContext({
        stepId: step.stepId,
        roleId: step.roleId,
        status: stepOutput.status,
        attempt,
      }, subtaskCompletedTrace)),
      traceId: ctx.traceId,
      createdAt: nowIso(),
    });
    const workflowCompleted = deps.store.event.insertEvent({
      id: newId("evt"),
      taskId: ctx.taskId,
      executionId,
      eventType: "workflow:step_completed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify(injectTraceContext({
        stepId: step.stepId,
        roleId: step.roleId,
        status: stepOutput.status,
        attempt,
      }, workflowCompletedTrace)),
      traceId: ctx.traceId,
      createdAt: nowIso(),
    });

    deps.streamBridge.emitFromEvent({ streamId, channel: "cli", event: subtaskCompleted });
    deps.streamBridge.emitFromEvent({ streamId, channel: "cli", event: workflowCompleted });
    deps.streamBridge.emitMessageDelta({ streamId, taskId: ctx.taskId, channel: "cli", delta: String(stepData.summary ?? "") });
  });

  let latestCompaction: ContextCompactionResult | null = null;
  if (index === ctx.plannedWorkflow.executionSteps.length - 1) {
    latestCompaction = deps.contextCompaction.compactContext({
      taskId: ctx.taskId,
      sessionId: ctx.sessionId,
      maxContextTokens: ctx.input.contextBudgetTokens ?? 8_000,
      providerMaxOutputTokens: 1_024,
      stage1TriggerRatio: 0.7,
      stage2TriggerRatio: 0.85,
      recentToolResultWindow: 2,
      compactionMaxFrequencyPerSession: 2,
    });
    if (latestCompaction.stage1Triggered || latestCompaction.stage2Triggered) {
      deps.store.billing.insertCostEvent({
        id: newId("cost"),
        taskId: ctx.taskId,
        sessionId: ctx.sessionId,
        executionId,
        agentId: null,
        provider: "internal",
        model: "context-compaction",
        inputTokens: latestCompaction.usageBeforeTokens,
        outputTokens: latestCompaction.stage2Triggered
          ? latestCompaction.usageAfterStage2Tokens
          : latestCompaction.usageAfterStage1Tokens,
        costUsd: 0.0005,
        budgetScope: "compaction",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      });
    }
  }

  return {
    outputs: nextOutputs,
    latestCompaction,
  };
}

function buildTaskExecutionCostEvent(input: {
  taskId: string;
  sessionId: string;
  executionId: string;
  agentId: string | null;
  llmResult: LlmModelCallResult | null;
  fallbackInputTokens: number;
  fallbackOutputTokens: number;
  fallbackCostUsd: number;
  createdAt: string;
}): Omit<CostEventRecord, "id"> {
  const promptTokens = input.llmResult?.usage.promptTokens ?? input.fallbackInputTokens;
  const completionTokens = input.llmResult?.usage.completionTokens ?? input.fallbackOutputTokens;
  const model = input.llmResult?.model ?? "unattributed";
  return {
    taskId: input.taskId,
    sessionId: input.sessionId,
    executionId: input.executionId,
    agentId: input.agentId,
    provider: input.llmResult?.provider ?? "unattributed",
    model,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    costUsd: estimateActualLlmCallCost(input.llmResult, model) ?? input.fallbackCostUsd,
    budgetScope: "task_execution",
    providerRequestId: input.llmResult?.id ?? null,
    pricingVersion: null,
    createdAt: input.createdAt,
  };
}

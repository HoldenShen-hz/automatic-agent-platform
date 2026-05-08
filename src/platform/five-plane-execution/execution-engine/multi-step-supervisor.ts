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
import type { StreamBridge } from "../../interface/channel-gateway/stream-bridge.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { createWorkflowStepCheckpoint } from "../../state-evidence/checkpoints/workflow-step-checkpoint.js";
import { decideWorkflowStepRetry, type WorkflowStepRetryDecision } from "../../orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import { validateWorkflowStepOutput } from "../../orchestration/oapeflir/workflow/output-schema.js";
import type { AdmissionDecision } from "../dispatcher/admission-controller.js";
import type { TransitionService } from "../state-transition/transition-service.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import type { ContextCompactionService } from "./context-compaction-service.js";
import { buildStepOutput } from "./multi-step-agent-round-loop.js";
import { getMultiStepToolDefinitions } from "./multi-step-tool-definitions.js";
import type { MultiStepToolExecutionInput, StepFailurePlan } from "./multi-step-orchestration-types.js";
import { maybeInjectWorkflowCrash } from "../recovery/workflow-crash-simulator.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function normalizeStepFailurePlan(value: string | StepFailurePlan): StepFailurePlan {
  return typeof value === "string" ? { errorCode: value } : value;
}

export function resolveStepFailurePlan(
  input: MultiStepToolExecutionInput,
  stepId: string,
  attempt: number,
): StepFailurePlan | null {
  const plannedFailure = input.stepFailurePlans?.[stepId]?.[attempt - 1];
  if (plannedFailure != null) {
    return normalizeStepFailurePlan(plannedFailure);
  }
  if (attempt === 1 && input.stepFailureInjection?.has(stepId)) {
    return { errorCode: "tool.execution_failed", summary: `Step ${stepId} failed (injected)`, message: "Injected failure" };
  }
  return null;
}

export function normalizeStepErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("workflow.output_schema_invalid")) return "validation.schema_mismatch";
  if (message.startsWith("workflow.output_schema_missing")) return "validation.invalid_input";
  return "internal.unexpected_error";
}

export function buildStepFailureSummary(stepId: string, decision: WorkflowStepRetryDecision): string {
  switch (decision.action) {
    case "retry":
      return `Step ${stepId} failed (${decision.errorCode}) and will retry.`;
    case "escalate":
      return `Step ${stepId} requires escalation (${decision.errorCode}).`;
    default:
      return `Step ${stepId} failed (${decision.errorCode}).`;
  }
}

export interface StepSupervisorContext {
  taskId: string;
  sessionId: string;
  traceId: string;
  traceContext: ReturnType<typeof import("../../shared/observability/trace-context.js").createRootTraceContext>;
  streamId: string;
  /** R4-27 fix: HarnessRun ID for canonical execution tracking */
  harnessRunId: string;
  admissionDecision: AdmissionDecision;
  input: MultiStepToolExecutionInput;
  routing: ReturnType<typeof import("../../orchestration/routing/intake-router.js").IntakeRouter.prototype.route>;
  plannedWorkflow: ReturnType<typeof import("../../orchestration/routing/workflow-planner.js").WorkflowPlanner.prototype.plan>;
  outputs: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  toolExposureService: import("../tool-executor/role-tool-exposure-service.js").RoleToolExposureService;
  latestCompaction: ContextCompactionResult | null;
  executionAttemptCounter: number;
  workflowRetryCount: number;
  workflowLastErrorCode: string | null;
  blockedForDecision: boolean;
  skippedStepIds: Set<string>;
  failedStepIds: Set<string>;
}

export interface StepExecutionResult {
  stepCompleted: boolean;
  blockedForDecision: boolean;
  latestCompaction: ContextCompactionResult | null;
  workflowRetryCount: number;
  workflowLastErrorCode: string | null;
  outputs: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  skippedStepIds: Set<string>;
  failedStepIds: Set<string>;
}

interface ExecutionDeps {
  store: AuthoritativeTaskStore;
  db: AuthoritativeSqlDatabase;
  transitions: TransitionService;
  artifactStore: ArtifactStore;
  contextCompaction: ContextCompactionService;
  streamBridge: StreamBridge;
  transitionExecutionStatus: TransitionService["transitionExecutionStatus"];
  createContext: (reasonCode: string) => TransitionAuditContext;
}

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

      let validation: ReturnType<typeof validateWorkflowStepOutput>;
      try {
        validation = validateWorkflowStepOutput(step, stepData as unknown as Record<string, unknown>);
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
          stepId: step.stepId,
          roleId: step.roleId,
          outputKey: step.outputKey,
          status: "succeeded",
          producedAt: stepProducedAt,
          output: stepData as unknown as Record<string, unknown>,
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

        const costEvent: CostEventRecord = {
          id: newId("cost"),
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
        deps.store.billing.insertCostEvent(costEvent);

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

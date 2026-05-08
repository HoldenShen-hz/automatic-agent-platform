/**
 * @fileoverview Multi-step orchestrator entrypoint.
 */

import { dirname, join } from "node:path";

import type {
  MessageRecord,
  SessionRecord,
  StepOutputRecord,
  TaskRecord,
  TransitionAuditContext,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { createWorkspaceWritePolicy } from "../../control-plane/iam/sandbox-policy.js";
import { ContextCompactionService, type ContextCompactionResult } from "./context-compaction-service.js";
import {
  AdmissionController,
  type AdmissionBackpressureSnapshot,
  type AdmissionPolicy,
} from "../dispatcher/admission-controller.js";
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../dispatcher/index.js";
import { provideContext } from "./runtime-context.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { openAuthoritativeStorageContext } from "../../state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { ensureMessagePartsJson } from "../../model-gateway/messages/message-parts.js";
import { IntakeRouter } from "../../orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../orchestration/routing/workflow-planner.js";
import { assertWorkflowValid } from "../../orchestration/oapeflir/workflow/workflow-validator.js";
import { StreamBridge } from "../../interface/channel-gateway/stream-bridge.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import { executeStepLoop } from "./multi-step-supervisor.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

const OAPEFLIR_PLAN_PREFIX = "oapeflir://plan ";

function isOapeflirPlanRequest(request: string): boolean {
  return request.startsWith(OAPEFLIR_PLAN_PREFIX);
}

function deserializeOapeflirPlan(request: string): import("../../orchestration/oapeflir/types/plan.js").PlanStep[] {
  const json = request.slice(OAPEFLIR_PLAN_PREFIX.length);
  return JSON.parse(json) as import("../../orchestration/oapeflir/types/plan.js").PlanStep[];
}

function resolveOapeflirRoleId(_step: import("../../orchestration/oapeflir/types/plan.js").PlanStep): string {
  return "general_executor";
}

function oapeflirStepToMinimalStep(step: import("../../orchestration/oapeflir/types/plan.js").PlanStep): import("../../orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowStep {
  return {
    stepId: step.stepId,
    roleId: resolveOapeflirRoleId(step),
    outputKey: step.outputs?.[0] ?? `output_${step.stepId}`,
    inputKeys: step.dependencies,
    timeoutMs: step.timeout,
    maxAttempts: Math.max(1, step.retryPolicy.maxRetries + 1),
    dependsOnStepIds: step.dependencies,
  };
}

function buildOapeflirPlannedWorkflow(
  steps: import("../../orchestration/oapeflir/types/plan.js").PlanStep[],
  planId: string,
): import("../../orchestration/routing/workflow-planner.js").PlannedWorkflow {
  const workflowDef: import("../../orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: `oapeflir_${planId}`,
    divisionId: "general_ops",
    steps: steps.map(oapeflirStepToMinimalStep),
  };

  const executionSteps: import("../../orchestration/routing/workflow-planner.js").PlannedExecutionStep[] = workflowDef.steps.map((step) => {
    const stepDeps = step.dependsOnStepIds ?? [];
    return {
      stepId: step.stepId,
      divisionId: step.divisionId ?? workflowDef.divisionId,
      roleId: step.roleId,
      inputKeys: step.inputKeys ?? [],
      agentId: `agent_${step.roleId}`,
      outputKey: step.outputKey,
      outputSchemaPath: step.outputSchemaPath ?? null,
      dependsOnStepIds: stepDeps,
      dependencyTypes: Object.fromEntries(
        stepDeps.map((depId) => [depId, "hard"]),
      ),
      timeoutMs: step.timeoutMs,
      maxAttempts: step.maxAttempts,
      ...(step.compensationModel ? { compensationModel: step.compensationModel } : {}),
    };
  });

  return {
    workflow: workflowDef,
    executionSteps,
    planReason: `oapeflir_bridge: ${planId}`,
    dependencyEdges: [],
  };
}

function createContext(
  traceContext: ReturnType<typeof createRootTraceContext>,
  reasonCode: string,
): TransitionAuditContext {
  const span = createChildTraceContext(traceContext);
  const context: TransitionAuditContext = {
    reasonCode,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    actorType: "system",
    occurredAt: nowIso(),
  };
  if (span.spanId != null) context.spanId = span.spanId;
  if (span.correlationId != null) context.correlationId = span.correlationId;
  return context;
}

export {
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
};

export type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "./multi-step-orchestration-types.js";

export async function runMultiStepOrchestration(input: MultiStepToolExecutionInput): Promise<MultiStepOrchestrationResult> {
  const { resetToolRegistry } = await import("../dispatcher/index.js");
  resetToolRegistry();

  let plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  let routing: ReturnType<IntakeRouter["route"]>;
  if (isOapeflirPlanRequest(input.request)) {
    const oapeflirSteps = deserializeOapeflirPlan(input.request);
    plannedWorkflow = buildOapeflirPlannedWorkflow(oapeflirSteps, input.title);
    routing = {
      workflowId: plannedWorkflow.workflow.workflowId,
      divisionId: plannedWorkflow.workflow.divisionId,
      routeReason: "oapeflir_bridge",
      routeTrace: ["oapeflir_bridge:bypass"],
      requiresOrchestration: true,
      classification: { intent: "create" as const, confidence: 1.0, continuation: "new_task" as const, matchedRules: [] as string[] },
    };
  } else {
    const router = new IntakeRouter();
    routing = router.route({ title: input.title, request: input.request });
    const planner = new WorkflowPlanner();
    plannedWorkflow = planner.plan({ workflowId: routing.workflowId, request: input.request });
    assertWorkflowValid(plannedWorkflow.workflow);
  }

  const storage = openAuthoritativeStorageContext({ dbPath: input.dbPath });
  const db = storage.sql;
  const store = storage.store;
  storage.migrate();

  try {
    const artifactStore = new ArtifactStore({
      rootDir: join(dirname(input.dbPath), "artifacts"),
      sandboxPolicy: createWorkspaceWritePolicy(dirname(input.dbPath)),
    });
    const healthService = new HealthService(db, store, DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS);
    const transitions = new TransitionService(db, store);
    const backpressureSnapshot =
      (input.admissionBackpressureSnapshot as (() => AdmissionBackpressureSnapshot | null) | undefined)
      ?? (() => healthService.getReport());
    const admission = new AdmissionController(
      store,
      input.admissionPolicy as AdmissionPolicy | undefined,
      backpressureSnapshot,
    );
    const contextCompaction = new ContextCompactionService(db, store);
    const streamBridge = new StreamBridge();

    const taskId = newId("task");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const traceContext = createRootTraceContext({ traceId, correlationId: taskId });
    const now = nowIso();

    return await provideContext({
      traceId,
      spanId: traceContext.spanId,
      taskId,
      sessionId,
      workflowId: plannedWorkflow.workflow.workflowId,
      divisionId: plannedWorkflow.workflow.divisionId,
    }, async () => {
      const task: TaskRecord = {
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: plannedWorkflow.workflow.divisionId,
        title: input.title,
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: input.request }),
        normalizedInputJson: JSON.stringify({ request: input.request.trim() }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      const workflow: WorkflowStateRecord = {
        taskId,
        divisionId: plannedWorkflow.workflow.divisionId,
        workflowId: plannedWorkflow.workflow.workflowId,
        currentStepIndex: 0,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      };

      const session: SessionRecord = {
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      };

      db.transaction(() => {
        store.task.insertTask(task);
        store.workflow.insertWorkflowState(workflow);
        store.session.insertSession(session);

        const inboundMessage: MessageRecord = {
          id: newId("msg"),
          sessionId,
          direction: "inbound",
          messageType: "user_request",
          content: input.request,
          attachmentsJson: null,
          createdAt: nowIso(),
        };
        store.session.insertMessage({ ...inboundMessage, partsJson: ensureMessagePartsJson(inboundMessage) });

        const planMessage: MessageRecord = {
          id: newId("msg"),
          sessionId,
          direction: "system",
          messageType: "assistant_plan",
          content: `Workflow ${plannedWorkflow.workflow.workflowId} selected because ${plannedWorkflow.planReason}.`,
          attachmentsJson: null,
          createdAt: nowIso(),
        };
        store.session.insertMessage({ ...planMessage, partsJson: ensureMessagePartsJson(planMessage) });

        store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "routing:decided",
          payloadJson: JSON.stringify(routing),
          traceId,
          createdAt: nowIso(),
        });
        store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "workflow:planned",
          payloadJson: JSON.stringify(injectTraceContext({
            workflowId: plannedWorkflow.workflow.workflowId,
            planReason: plannedWorkflow.planReason,
            dependencyEdges: plannedWorkflow.dependencyEdges,
          }, createChildTraceContext(traceContext))),
          traceId,
          createdAt: nowIso(),
        });
      });

      const admissionDecision = admission.evaluate({
        priority: task.priority,
        estimatedCostUsd: task.estimatedCostUsd,
        budgetRemainingUsd: plannedWorkflow.executionSteps.length,
      });

      if (admissionDecision.decision !== "allow") {
        if (admissionDecision.decision === "queue") {
          transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "paused", currentStepIndex: 0, outputsJson: workflow.outputsJson, ...createContext(traceContext, admissionDecision.reasonCode ?? "admission.queued") });
        } else {
          transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "queued", toStatus: "cancelled", executionId: null, ...createContext(traceContext, admissionDecision.reasonCode ?? "admission.rejected") });
          transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "cancelled", currentStepIndex: 0, outputsJson: workflow.outputsJson, ...createContext(traceContext, admissionDecision.reasonCode ?? "admission.rejected") });
          transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "open", toStatus: "cancelled", ...createContext(traceContext, admissionDecision.reasonCode ?? "admission.rejected") });
        }
        const admissionTrace = createChildTraceContext(traceContext);
        store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: admissionDecision.decision === "queue" ? "admission:queued" : "admission:rejected",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            decision: admissionDecision.decision,
            reasonCode: admissionDecision.reasonCode,
            snapshot: admissionDecision.snapshot,
            backpressure: admissionDecision.backpressure,
            traceContext: admissionTrace,
          }),
          traceId,
          createdAt: nowIso(),
        });
        return {
          snapshot: store.operations.loadTaskSnapshot(taskId),
          streamFrames: [],
          routing,
          plannedWorkflow,
          compaction: null,
        };
      }

      transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "queued", toStatus: "in_progress", executionId: null, ...createContext(traceContext, "task.started") });
      transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "open", toStatus: "streaming", ...createContext(traceContext, "session.streaming_started") });

      const streamId = streamBridge.createStreamId(taskId, "cli");
      let outputs: Record<string, unknown> = {};
      let stepOutputs: StepOutputRecord[] = [];
      const toolExposureService = new RoleToolExposureService();
      let latestCompaction: ContextCompactionResult | null = null;
      const executionAttemptCounter = 0;
      let workflowRetryCount = 0;
      let workflowLastErrorCode: string | null = null;
      let blockedForDecision = false;
      let skippedStepIds = new Set<string>();
      let failedStepIds = new Set<string>();

      const stepResult = await executeStepLoop(
        {
          taskId,
          sessionId,
          traceId,
          traceContext,
          streamId,
          admissionDecision,
          input,
          routing,
          plannedWorkflow,
          outputs,
          stepOutputs,
          toolExposureService,
          latestCompaction,
          executionAttemptCounter,
          workflowRetryCount,
          workflowLastErrorCode,
          blockedForDecision,
          skippedStepIds,
          failedStepIds,
        },
        {
          store,
          db,
          transitions,
          artifactStore,
          contextCompaction,
          streamBridge,
          transitionExecutionStatus: transitions.transitionExecutionStatus.bind(transitions),
          createContext: (reasonCode: string) => createContext(traceContext, reasonCode),
        },
      );

      ({ outputs, stepOutputs, latestCompaction, workflowRetryCount, workflowLastErrorCode, blockedForDecision, skippedStepIds, failedStepIds } = stepResult);

      if (blockedForDecision) {
        return {
          snapshot: store.operations.loadTaskSnapshot(taskId),
          streamFrames: streamBridge.replayAfterSequence(streamId, 0),
          routing,
          plannedWorkflow,
          compaction: latestCompaction,
        };
      }

      db.transaction(() => {
        const divisionCompletedTrace = createChildTraceContext(traceContext);
        const divisionCompleted = store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "division:completed",
          eventTier: "tier_1",
          payloadJson: JSON.stringify(injectTraceContext({
            divisionId: plannedWorkflow.workflow.divisionId,
            workflowId: plannedWorkflow.workflow.workflowId,
          }, divisionCompletedTrace)),
          traceId,
          createdAt: nowIso(),
        });
        streamBridge.emitFromEvent({ streamId, channel: "cli", event: divisionCompleted });
      });

      const finalOutput = (outputs.final as Record<string, unknown> | undefined) ?? outputs;
      const allStepsFailedOrSkipped = plannedWorkflow.executionSteps.every(
        (step) => failedStepIds.has(step.stepId) || skippedStepIds.has(step.stepId),
      );
      const workflowFailed = failedStepIds.size > 0 || allStepsFailedOrSkipped;
      const lastExecution = store.execution.listExecutionsByTask(taskId).at(-1);
      const lastExecutionId = lastExecution?.id ?? newId("exec");

      if (workflowFailed) {
        const ctx = createContext(traceContext, workflowLastErrorCode ?? "workflow.step_failed");
        transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "in_progress", toStatus: "failed", executionId: lastExecutionId, ...ctx });
        transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "failed", currentStepIndex: plannedWorkflow.executionSteps.length, outputsJson: JSON.stringify(outputs), ...ctx });
        transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "streaming", toStatus: "failed", ...ctx });
        store.task.updateTaskOutput(taskId, JSON.stringify({ error: workflowLastErrorCode ?? "workflow.step_failed", failedStepIds: [...failedStepIds], skippedStepIds: [...skippedStepIds] }), ctx.occurredAt);
      } else {
        transitions.transitionTaskTerminalState({
          taskId,
          sessionId,
          executionId: lastExecutionId,
          currentTaskStatus: "in_progress",
          currentWorkflowStatus: "running",
          currentSessionStatus: "streaming",
          currentExecutionStatus: "succeeded",
          terminalStatus: "done",
          taskOutputJson: JSON.stringify(finalOutput),
          outputsJson: JSON.stringify(outputs),
          context: createContext(traceContext, "task.completed"),
        });
      }

      return {
        snapshot: store.operations.loadTaskSnapshot(taskId),
        streamFrames: streamBridge.replayAfterSequence(streamId, 0),
        routing,
        plannedWorkflow,
        compaction: latestCompaction,
      };
    });
  } finally {
    storage.close();
  }
}

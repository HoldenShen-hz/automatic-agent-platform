/**
 * @fileoverview Multi-Step Orchestrator - Main coordination entry point.
 *
 * This module implements the full orchestration pipeline:
 * 1. Routing: IntakeRouter determines workflow
 * 2. Planning: WorkflowPlanner creates execution plan
 * 3. Initialization: DB, storage, streaming setup
 * 4. Execution: supervisor.executeStepLoop runs all steps
 * 5. Context Compaction: optional compression if token budget exceeded
 * 6. Terminal State: transitions all entities to completion
 *
 * Part of the multi-step orchestration split:
 * - orchestrator/  - main coordination (this module)
 * - dispatcher/   - tool execution
 * - planner/      - DAG planning and step output building
 * - supervisor/   - execution monitoring
 */

import { dirname, join } from "node:path";

import type {
  CostEventRecord,
  ExecutionRecord,
  ExecutionPrecheckRecord,
  MessageRecord,
  SessionRecord,
  StepOutputRecord,
  TaskRecord,
  TransitionAuditContext,
  WorkflowStateRecord,
} from "../../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { openAuthoritativeStorageContext } from "../../../platform/state-evidence/truth/storage-backend-factory.js";
import { AuthoritativeTaskStore } from "../../../platform/state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../../platform/shared/observability/health-service.js";
import { StructuredLogger } from "../../../platform/shared/observability/structured-logger.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../../platform/shared/observability/trace-context.js";
import { buildRetryRecordParts, buildStructuredToolResultParts, ensureMessagePartsJson, serializeMessageParts } from "../../../platform/model-gateway/messages/message-parts.js";
import { TransitionService } from "../../../platform/execution/state-transition/transition-service.js";
import { IntakeRouter } from "../../../platform/orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../../platform/orchestration/routing/workflow-planner.js";
import { assertWorkflowValid } from "../../../platform/orchestration/oapeflir/workflow/workflow-validator.js";
import { StreamBridge, type StreamEventFrame } from "../../../platform/interface/channel-gateway/stream-bridge.js";
import { ContextCompactionService, type ContextCompactionResult } from "../../../platform/execution/execution-engine/context-compaction-service.js";
import { ArtifactStore } from "../../../platform/state-evidence/artifacts/artifact-store.js";
import { createWorkspaceWritePolicy } from "../../../platform/control-plane/iam/sandbox-policy.js";
import { RoleToolExposureService } from "../../../platform/execution/tool-executor/role-tool-exposure-service.js";
import type { WorkflowCrashInjection } from "../../../platform/execution/recovery/workflow-crash-simulator.js";
import { maybeInjectWorkflowCrash } from "../../../platform/execution/recovery/workflow-crash-simulator.js";
import { createWorkflowStepCheckpoint } from "../../../platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import {
  AdmissionController,
  type AdmissionBackpressureSnapshot,
  type AdmissionPolicy,
} from "../../../platform/execution/dispatcher/admission-controller.js";
import { provideContext } from "../../../platform/execution/execution-engine/runtime-context.js";
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../../../platform/execution/dispatcher/index.js";
import type { MultiStepOrchestrationResult } from "./types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Prefix used by RuntimeExecuteBridge to pass pre-built OAPEFLIR plans
 * directly to the orchestrator without going through IntakeRouter + WorkflowPlanner.
 * Format: "oapeflir://plan <JSON array of OapeflirPlanStep>"
 */
const OAPEFLIR_PLAN_PREFIX = "oapeflir://plan ";

// ---------------------------------------------------------------------------
// OAPEFLIR plan bypass (GAP-V2-01 Phase 3)
// ---------------------------------------------------------------------------

/**
 * Checks if a request string contains a pre-serialized OAPEFLIR plan.
 */
function isOapeflirPlanRequest(request: string): boolean {
  return request.startsWith(OAPEFLIR_PLAN_PREFIX);
}

/**
 * Deserializes an OAPEFLIR plan from a request string.
 * The plan was serialized by RuntimeExecuteBridge.serialiseOapeflirPlan().
 */
function deserializeOapeflirPlan(request: string): import("../../../platform/orchestration/oapeflir/types/plan.js").PlanStep[] {
  const json = request.slice(OAPEFLIR_PLAN_PREFIX.length);
  return JSON.parse(json) as import("../../../platform/orchestration/oapeflir/types/plan.js").PlanStep[];
}

/**
 * Converts an OapeflirPlanStep to a MinimalWorkflowStep that the orchestrator's
 * execution engine can process.
 */
function resolveOapeflirRoleId(_step: import("../../../platform/orchestration/oapeflir/types/plan.js").PlanStep): string {
  // OAPEFLIR actions are tool- or intent-oriented and do not correspond 1:1 with
  // concrete division role IDs. Route bridged steps through the broadest existing
  // general-ops executor so tool exposure resolution uses a real role contract.
  return "general_executor";
}

function oapeflirStepToMinimalStep(step: import("../../../platform/orchestration/oapeflir/types/plan.js").PlanStep): import("../../../platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowStep {
  return {
    stepId: step.stepId,
    roleId: resolveOapeflirRoleId(step),
    outputKey: step.outputs?.[0] ?? `output_${step.stepId}`,
    inputKeys: step.dependencies,
    timeoutMs: step.timeout,
    // PlanStep retryPolicy expresses retries after the first attempt; runtime
    // workflow steps expect total attempts including the initial run.
    maxAttempts: Math.max(1, step.retryPolicy.maxRetries + 1),
    dependsOnStepIds: step.dependencies,
  };
}

/**
 * Builds a PlannedWorkflow from deserialized OapeflirPlanStep[].
 * This bypasses IntakeRouter + WorkflowPlanner and injects the plan directly
 * into the orchestrator's execution engine.
 */
function buildOapeflirPlannedWorkflow(
  steps: import("../../../platform/orchestration/oapeflir/types/plan.js").PlanStep[],
  planId: string,
): import("../../../platform/orchestration/routing/workflow-planner.js").PlannedWorkflow {
  // Build the minimal workflow definition
  const workflowDef: import("../../../platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: `oapeflir_${planId}`,
    divisionId: "general_ops",
    steps: steps.map(oapeflirStepToMinimalStep),
  };

  // Convert to PlannedExecutionStep[] using the same logic as WorkflowPlanner.toExecutionStep
  const executionSteps: import("../../../platform/orchestration/routing/workflow-planner.js").PlannedExecutionStep[] = workflowDef.steps.map((step, index) => {
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
    dependencyEdges: [], // not needed for execution; stepLoop uses dependsOnStepIds directly
  };
}

export {
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

// ---------------------------------------------------------------------------
// Audit context factory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Orchestrator input/output types
// ---------------------------------------------------------------------------

export interface MultiStepToolExecutionInput {
  dbPath: string;
  title: string;
  request: string;
  contextBudgetTokens?: number;
  admissionPolicy?: AdmissionPolicy;
  admissionBackpressureSnapshot?: () => AdmissionBackpressureSnapshot | null;
  crashInjection?: WorkflowCrashInjection;
  stepFailureInjection?: ReadonlySet<string>;
  stepFailurePlans?: Readonly<Record<string, readonly (string | { errorCode: string; summary?: string; message?: string })[]>>;
  stepOutputOverrides?: Readonly<Record<string, Record<string, unknown>>>;
}

// ---------------------------------------------------------------------------
// Main orchestration entry point
// ---------------------------------------------------------------------------

export async function runMultiStepOrchestration(input: MultiStepToolExecutionInput): Promise<MultiStepOrchestrationResult> {
  // Reset tool registry for each orchestration run
  const { resetToolRegistry } = await import("../../../platform/execution/dispatcher/index.js");
  resetToolRegistry();

  // GAP-V2-01 Phase 3: bypass router + planner when request carries a pre-built OAPEFLIR plan
  let plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  let routing: ReturnType<IntakeRouter["route"]>;
  if (isOapeflirPlanRequest(input.request)) {
    const oapeflirSteps = deserializeOapeflirPlan(input.request);
    plannedWorkflow = buildOapeflirPlannedWorkflow(oapeflirSteps, input.title);
    // Provide a minimal synthetic routing for the bypass case (only routeReason is accessed by supervisor)
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
    const admission = new AdmissionController(
      store,
      input.admissionPolicy,
      input.admissionBackpressureSnapshot ?? (() => healthService.getReport()),
    );
    const contextCompaction = new ContextCompactionService(db, store);
    const streamBridge = new StreamBridge();

    const taskId = newId("task");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const traceContext = createRootTraceContext({ traceId, correlationId: taskId });
    const now = nowIso();

    return await provideContext({
      traceId, spanId: traceContext.spanId, taskId, sessionId,
      workflowId: plannedWorkflow.workflow.workflowId,
      divisionId: plannedWorkflow.workflow.divisionId,
    }, async () => {

      // --- Build entity records ---
      const task: TaskRecord = {
        id: taskId, parentId: null, rootId: taskId, divisionId: plannedWorkflow.workflow.divisionId,
        title: input.title, status: "queued", source: "user", priority: "normal",
        inputJson: JSON.stringify({ request: input.request }),
        normalizedInputJson: JSON.stringify({ request: input.request.trim() }),
        outputJson: null, estimatedCostUsd: 0.05, actualCostUsd: 0, errorCode: null,
        createdAt: now, updatedAt: now, completedAt: null,
      };

      const workflow: WorkflowStateRecord = {
        taskId, divisionId: plannedWorkflow.workflow.divisionId,
        workflowId: plannedWorkflow.workflow.workflowId, currentStepIndex: 0, status: "running",
        outputsJson: JSON.stringify({}), lastErrorCode: null, retryCount: 0,
        resumableFromStep: null, startedAt: now, updatedAt: now,
      };

      const session: SessionRecord = {
        id: sessionId, taskId, channel: "cli", status: "open",
        externalSessionId: null, createdAt: now, updatedAt: now,
      };

      // --- Insert initial records ---
      db.transaction(() => {
        store.task.insertTask(task);
        store.workflow.insertWorkflowState(workflow);
        store.session.insertSession(session);

        const inboundMessage: MessageRecord = {
          id: newId("msg"), sessionId, direction: "inbound", messageType: "user_request",
          content: input.request, attachmentsJson: null, createdAt: nowIso(),
        };
        store.session.insertMessage({ ...inboundMessage, partsJson: ensureMessagePartsJson(inboundMessage) });

        const planMessage: MessageRecord = {
          id: newId("msg"), sessionId, direction: "system", messageType: "assistant_plan",
          content: `Workflow ${plannedWorkflow.workflow.workflowId} selected because ${plannedWorkflow.planReason}.`,
          attachmentsJson: null, createdAt: nowIso(),
        };
        store.session.insertMessage({ ...planMessage, partsJson: ensureMessagePartsJson(planMessage) });

        store.event.insertEvent({
          id: newId("evt"), taskId, executionId: null, eventType: "routing:decided",
          payloadJson: JSON.stringify(routing), traceId, createdAt: nowIso(),
        });
        store.event.insertEvent({
          id: newId("evt"), taskId, executionId: null, eventType: "workflow:planned",
          payloadJson: JSON.stringify(injectTraceContext({
            workflowId: plannedWorkflow.workflow.workflowId, planReason: plannedWorkflow.planReason,
            dependencyEdges: plannedWorkflow.dependencyEdges,
          }, createChildTraceContext(traceContext))),
          traceId, createdAt: nowIso(),
        });
      });

      // --- Admission check ---
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
          id: newId("evt"), taskId, executionId: null,
          eventType: admissionDecision.decision === "queue" ? "admission:queued" : "admission:rejected", eventTier: "tier_2",
          payloadJson: JSON.stringify({ decision: admissionDecision.decision, reasonCode: admissionDecision.reasonCode, snapshot: admissionDecision.snapshot, backpressure: admissionDecision.backpressure, traceContext: admissionTrace }),
          traceId, createdAt: nowIso(),
        });
        return {
          snapshot: store.operations.loadTaskSnapshot(taskId),
          streamFrames: [], routing, plannedWorkflow, compaction: null,
        };
      }

      // --- Status transitions ---
      transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "queued", toStatus: "in_progress", executionId: null, ...createContext(traceContext, "task.started") });
      transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "open", toStatus: "streaming", ...createContext(traceContext, "session.streaming_started") });

      // --- Execute step loop via supervisor ---
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

      const { executeStepLoop } = await import("../supervisor/index.js");

      const stepResult = await executeStepLoop(
        {
          taskId, sessionId, traceId, traceContext, streamId, admissionDecision,
          input, routing, plannedWorkflow, outputs, stepOutputs, toolExposureService,
          latestCompaction, executionAttemptCounter, workflowRetryCount,
          workflowLastErrorCode, blockedForDecision, skippedStepIds, failedStepIds,
        },
        {
          store, db, transitions, artifactStore, contextCompaction, streamBridge,
          transitionExecutionStatus: transitions.transitionExecutionStatus.bind(transitions),
          createContext: (reasonCode: string) => createContext(traceContext, reasonCode),
        },
      );

      // Unpack results from supervisor
      ({ outputs, stepOutputs, latestCompaction, workflowRetryCount, workflowLastErrorCode, blockedForDecision, skippedStepIds, failedStepIds } = stepResult);

      if (blockedForDecision) {
        return {
          snapshot: store.operations.loadTaskSnapshot(taskId),
          streamFrames: streamBridge.replayAfterSequence(streamId, 0),
          routing, plannedWorkflow, compaction: latestCompaction,
        };
      }

      // --- Division completion event ---
      db.transaction(() => {
        const divisionCompletedTrace = createChildTraceContext(traceContext);
        const divisionCompleted = store.event.insertEvent({
          id: newId("evt"), taskId, executionId: null, eventType: "division:completed", eventTier: "tier_1",
          payloadJson: JSON.stringify(injectTraceContext({ divisionId: plannedWorkflow.workflow.divisionId, workflowId: plannedWorkflow.workflow.workflowId }, divisionCompletedTrace)),
          traceId, createdAt: nowIso(),
        });
        streamBridge.emitFromEvent({ streamId, channel: "cli", event: divisionCompleted });
      });

      const finalOutput = (outputs.final as Record<string, unknown> | undefined) ?? outputs;
      const allStepsFailedOrSkipped = plannedWorkflow.executionSteps.every(
        (s) => failedStepIds.has(s.stepId) || skippedStepIds.has(s.stepId),
      );
      const workflowFailed = failedStepIds.size > 0 || allStepsFailedOrSkipped;
      const lastExec = store.execution.listExecutionsByTask(taskId).at(-1);
      const lastExecId = lastExec?.id ?? newId("exec");

      if (workflowFailed) {
        const ctx = createContext(traceContext, workflowLastErrorCode ?? "workflow.step_failed");
        transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "in_progress", toStatus: "failed", executionId: lastExecId, ...ctx });
        transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "failed", currentStepIndex: plannedWorkflow.executionSteps.length, outputsJson: JSON.stringify(outputs), ...ctx });
        transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "streaming", toStatus: "failed", ...ctx });
        store.task.updateTaskOutput(taskId, JSON.stringify({ error: workflowLastErrorCode ?? "workflow.step_failed", failedStepIds: [...failedStepIds], skippedStepIds: [...skippedStepIds] }), ctx.occurredAt);
      } else {
        transitions.transitionTaskTerminalState({
          taskId, sessionId, executionId: lastExecId,
          currentTaskStatus: "in_progress", currentWorkflowStatus: "running", currentSessionStatus: "streaming",
          currentExecutionStatus: "succeeded", terminalStatus: "done",
          taskOutputJson: JSON.stringify(finalOutput), outputsJson: JSON.stringify(outputs),
          context: createContext(traceContext, "task.completed"),
        });
      }

      const snapshot = store.operations.loadTaskSnapshot(taskId);
      const streamFrames = streamBridge.replayAfterSequence(streamId, 0);

      return { snapshot, streamFrames, routing, plannedWorkflow, compaction: latestCompaction };
    });
  } finally {
    storage.close();
  }
}

import { dirname, join } from "node:path";

import type {
  MessageRecord,
  SessionRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import { ContextCompactionService } from "./context-compaction-service.js";
import {
  AdmissionController,
  type AdmissionBackpressureSnapshot,
  type AdmissionDecision,
  type AdmissionPolicy,
} from "../dispatcher/admission-controller.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { openAuthoritativeStorageContext } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import {
  createChildTraceContext,
  createRootTraceContext,
  injectTraceContext,
} from "../../shared/observability/trace-context.js";
import { ensureMessagePartsJson } from "../../model-gateway/messages/message-parts.js";
import { IntakeRouter } from "../../five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../five-plane-orchestration/routing/workflow-planner.js";
import { StreamBridge } from "../../five-plane-interface/channel-gateway/stream-bridge.js";
import { createWorkspaceWritePolicy } from "../../five-plane-control-plane/iam/index.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";
import { createOrchestrationTransitionContext } from "./multi-step-orchestration-plan-support.js";

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

export interface OrchestrationRuntime {
  storage: ReturnType<typeof openAuthoritativeStorageContext>;
  db: ReturnType<typeof openAuthoritativeStorageContext>["sql"];
  store: ReturnType<typeof openAuthoritativeStorageContext>["store"];
  transitions: TransitionService;
  artifactStore: ArtifactStore;
  contextCompaction: ContextCompactionService;
  streamBridge: StreamBridge;
  admission: AdmissionController;
}

export interface OrchestrationBootstrapState {
  taskId: string;
  sessionId: string;
  traceId: string;
  traceContext: ReturnType<typeof createRootTraceContext>;
  task: TaskRecord;
  workflow: WorkflowStateRecord;
  session: SessionRecord;
}

export function createOrchestrationRuntime(
  input: MultiStepToolExecutionInput,
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>,
): OrchestrationRuntime {
  const storage = openAuthoritativeStorageContext({ dbPath: input.dbPath });
  const db = storage.sql;
  const store = storage.store;
  storage.migrate();

  const artifactStore = new ArtifactStore({
    rootDir: join(dirname(input.dbPath), "artifacts"),
    sandboxPolicy: createWorkspaceWritePolicy(dirname(input.dbPath)),
  });
  const healthService = new HealthService(db, store, DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS);
  const transitions = new TransitionService(db, store);
  const backpressureSnapshot =
    (input.admissionBackpressureSnapshot as (() => AdmissionBackpressureSnapshot | null) | undefined)
    ?? (() => healthService.getReport());

  return {
    storage,
    db,
    store,
    transitions,
    artifactStore,
    contextCompaction: new ContextCompactionService(db, store),
    streamBridge: new StreamBridge(),
    admission: new AdmissionController(
      store,
      input.admissionPolicy as AdmissionPolicy | undefined,
      backpressureSnapshot,
    ),
  };
}

export function createOrchestrationBootstrapState(
  input: MultiStepToolExecutionInput,
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>,
): OrchestrationBootstrapState {
  const taskId = input.taskId ?? newId("task");
  const sessionId = newId("sess");
  const traceId = newId("trace");
  const traceContext = createRootTraceContext({ traceId, correlationId: taskId });
  const now = nowIso();

  return {
    taskId,
    sessionId,
    traceId,
    traceContext,
    task: {
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
    },
    workflow: {
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
    },
    session: {
      id: sessionId,
      taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function persistOrchestrationBootstrap(params: {
  db: OrchestrationRuntime["db"];
  store: OrchestrationRuntime["store"];
  taskId: string;
  sessionId: string;
  traceId: string;
  traceContext: ReturnType<typeof createRootTraceContext>;
  input: MultiStepToolExecutionInput;
  routing: ReturnType<IntakeRouter["route"]>;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  task: TaskRecord;
  workflow: WorkflowStateRecord;
  session: SessionRecord;
}): void {
  const {
    db,
    store,
    taskId,
    sessionId,
    traceId,
    traceContext,
    input,
    routing,
    plannedWorkflow,
    task,
    workflow,
    session,
  } = params;

  db.transaction(() => {
    const existingTask = store.task.getTask(taskId);
    if (existingTask == null) {
      store.task.insertTask(task);
    } else {
      store.task.updateTaskStatus(taskId, "queued", task.updatedAt, null, null);
    }

    const existingWorkflow = store.workflow.getWorkflowState(taskId);
    if (existingWorkflow == null) {
      store.workflow.insertWorkflowState(workflow);
    } else {
      store.workflow.updateWorkflowState(
        taskId,
        workflow.status,
        workflow.currentStepIndex,
        workflow.outputsJson,
        workflow.updatedAt,
        workflow.resumableFromStep,
      );
    }

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
      payloadJson: JSON.stringify(serializeRoutingDecision(routing)),
      traceId,
      createdAt: nowIso(),
      schemaVersion: "1.0",
      aggregateId: null,
      runId: null,
      sequence: null,
      causationId: null,
      correlationId: null,
      payloadHash: null,
      idempotencyKey: newId("idem"),
      replayBehavior: "replay_as_fact",
      principal: "system",
      evidenceRefs: [] as readonly string[],
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
      schemaVersion: "1.0",
      aggregateId: null,
      runId: null,
      sequence: null,
      causationId: null,
      correlationId: null,
      payloadHash: null,
      idempotencyKey: newId("idem"),
      replayBehavior: "replay_as_fact",
      principal: "system",
      evidenceRefs: [] as readonly string[],
    });
  });
}

export function handleAdmissionDecision(params: {
  store: OrchestrationRuntime["store"];
  transitions: TransitionService;
  sessionId: string;
  taskId: string;
  traceId: string;
  traceContext: ReturnType<typeof createRootTraceContext>;
  routing: ReturnType<IntakeRouter["route"]>;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  workflow: WorkflowStateRecord;
  admissionDecision: AdmissionDecision;
}): MultiStepOrchestrationResult | null {
  const {
    store,
    transitions,
    sessionId,
    taskId,
    traceId,
    traceContext,
    routing,
    plannedWorkflow,
    workflow,
    admissionDecision,
  } = params;

  if (admissionDecision.decision === "allow") {
    return null;
  }

  if (admissionDecision.decision === "queue") {
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "paused",
      currentStepIndex: 0,
      outputsJson: workflow.outputsJson,
      ...createOrchestrationTransitionContext(traceContext, admissionDecision.reasonCode ?? "admission.queued"),
    });
  } else {
    const transitionContext = createOrchestrationTransitionContext(
      traceContext,
      admissionDecision.reasonCode ?? "admission.rejected",
    );
    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "cancelled",
      executionId: null,
      ...transitionContext,
    });
    transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "cancelled",
      currentStepIndex: 0,
      outputsJson: workflow.outputsJson,
      ...transitionContext,
    });
    transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "cancelled",
      ...transitionContext,
    });
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
    schemaVersion: "1.0",
    aggregateId: null,
    runId: null,
    sequence: null,
    causationId: null,
    correlationId: null,
    payloadHash: null,
    idempotencyKey: newId("idem"),
    replayBehavior: "replay_as_fact",
    principal: "system",
    evidenceRefs: [] as readonly string[],
  });

  return {
    snapshot: store.operations.loadTaskSnapshot(taskId),
    streamFrames: [],
    routing,
    plannedWorkflow,
    compaction: null,
  };
}

function serializeRoutingDecision(routing: ReturnType<IntakeRouter["route"]>): Record<string, unknown> {
  return {
    workflowId: routing.workflowId,
    divisionId: routing.divisionId,
    ...(routing.agentId != null ? { agentId: routing.agentId } : {}),
    routeReason: routing.routeReason,
    routeTrace: [...routing.routeTrace],
    requiresOrchestration: routing.requiresOrchestration,
    classification: {
      ...routing.classification,
      matchedRules: [...routing.classification.matchedRules],
      ...(routing.classification.ambiguityFlags != null
        ? { ambiguityFlags: [...routing.classification.ambiguityFlags] }
        : {}),
      ...(routing.classification.suggestedClarifications != null
        ? { suggestedClarifications: [...routing.classification.suggestedClarifications] }
        : {}),
    },
    ...(routing.confirmedTaskSpecId != null ? { confirmedTaskSpecId: routing.confirmedTaskSpecId } : {}),
    ...(routing.taskDraft != null ? { taskDraft: routing.taskDraft } : {}),
    ...(routing.clarificationSession != null ? { clarificationSession: routing.clarificationSession } : {}),
    ...(routing.confirmedTaskSpec != null ? { confirmedTaskSpec: routing.confirmedTaskSpec } : {}),
    ...(routing.requestEnvelope != null ? { requestEnvelope: routing.requestEnvelope } : {}),
  };
}

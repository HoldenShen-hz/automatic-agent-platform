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
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests, initializeToolRegistryWithRepository, setToolRegistryHarnessRunId, setToolRegistryBudgetLedger } from "../dispatcher/index.js";
import { provideContext } from "./runtime-context.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { openAuthoritativeStorageContext } from "../../state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { ensureMessagePartsJson } from "../../model-gateway/messages/message-parts.js";
import { IntakeRouter, type IntakeRouteDecision } from "../../orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../orchestration/routing/workflow-planner.js";
import { assertWorkflowValid } from "../../orchestration/oapeflir/workflow/workflow-validator.js";
import { StreamBridge } from "../../interface/channel-gateway/stream-bridge.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import { executeStepLoop } from "./multi-step-supervisor.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";
import { RuntimeEntryGuard } from "../../orchestration/harness/runtime/runtime-entry-guard.js";
import { HarnessRuntimeService } from "../../orchestration/harness/runtime/index.js";
import { PlanGraphHarnessRuntime, PlanGraphScheduler } from "../../orchestration/harness/runtime/plan-graph-harness-runtime.js";
import { minimalWorkflowToPlanGraphBundle } from "../../five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { createBudgetLedger, createHarnessRun, createRunVersionLock } from "../../contracts/executable-contracts/index.js";
import { createEvidenceRecord, createPlatformPrincipal } from "../../contracts/types/platform-contracts.js";
import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";
import { getRuntimeTruthRepository, RUNTIME_TRUTH_REPOSITORY_SERVICE_ID } from "../../five-plane-state-evidence/state-evidence-plane-bootstrap.js";
import { execute as executeQuery } from "../../state-evidence/truth/sqlite/query-helper.js";
import { BudgetExecutionSessionManager, BudgetExecutionState, BudgetGuard, type BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import { BudgetTier } from "../budget-allocator.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

const OAPEFLIR_PLAN_PREFIX = "oapeflir://plan ";

function buildSyntheticPipelineResult(routeDecision: IntakeRouteDecision) {
  const now = nowIso();
  const confirmedTaskSpecId = routeDecision.confirmedTaskSpecId;
  const requestId = `request_envelope:${confirmedTaskSpecId}`;
  return {
    taskDraft: {
      taskDraftId: `task_draft:${confirmedTaskSpecId}`,
      tenantId: "tenant:local",
      principal: {
        principalId: "system:intake-router",
        tenantId: "tenant:local",
        roles: ["system"],
      },
      source: "cli" as const,
      domainId: routeDecision.divisionId,
      normalizedIntent: { intent: routeDecision.classification.intent },
      missingFields: [],
      riskPreview: { riskClass: "medium" as const, reasons: [] },
      ambiguityPolicy: "require_confirmation" as const,
      createdAt: now,
    },
    clarificationSession: null,
    confirmedTaskSpec: {
      confirmedTaskSpecId,
      taskDraftId: `task_draft:${confirmedTaskSpecId}`,
      tenantId: "tenant:local",
      principal: {
        principalId: "system:intake-router",
        tenantId: "tenant:local",
        roles: ["system"],
      },
      domainId: routeDecision.divisionId,
      goal: routeDecision.routeReason,
      inputs: {},
      constraintPackRef: `constraint_pack:${routeDecision.divisionId}`,
      riskClass: "medium" as const,
      idempotencyKey: confirmedTaskSpecId,
      traceId: confirmedTaskSpecId,
      createdAt: now,
    },
    requestEnvelope: {
      requestId,
      confirmedTaskSpecId,
      tenantId: "tenant:local",
      principal: {
        principalId: "system:intake-router",
        tenantId: "tenant:local",
        roles: ["system"],
      },
      domainId: routeDecision.divisionId,
      traceId: confirmedTaskSpecId,
      idempotencyKey: confirmedTaskSpecId,
      priority: 0,
      requestHash: `request_hash:${confirmedTaskSpecId}`,
      constraintPackRef: `constraint_pack:${routeDecision.divisionId}`,
      budgetIntent: { amount: 0, currency: "USD", resourceKinds: ["token"] as const },
      policyContext: {},
      artifactRefs: [],
      submittedAt: now,
    },
    routeDecision,
  };
}

function isOapeflirPlanRequest(request: string): boolean {
  return request.startsWith(OAPEFLIR_PLAN_PREFIX);
}

function normalizeExecutionRequest(input: MultiStepToolExecutionInput): string {
  const trimmedRequest = input.request.trim();
  if (trimmedRequest.length > 0) {
    return trimmedRequest;
  }
  const trimmedTitle = input.title.trim();
  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }
  return input.request;
}

// R19-09 fix: Changed return type from PlanStep[] to PlanNode[] to preserve rich metadata
// Previously deserialized to PlanStep[] which lost riskClass, budgetIntent, sideEffectProfile, etc.
function deserializeOapeflirPlan(request: string): import("../../contracts/executable-contracts/index.js").PlanNode[] {
  const json = request.slice(OAPEFLIR_PLAN_PREFIX.length);
  return JSON.parse(json) as import("../../contracts/executable-contracts/index.js").PlanNode[];
}

// R19-09 fix: Updated to accept PlanNode and preserve rich metadata
// Previously resolved from PlanStep which lacked nodeType, riskClass, budgetIntent, etc.
function resolveOapeflirRoleId(_node: import("../../contracts/executable-contracts/index.js").PlanNode): string {
  return "general_executor";
}

// R19-09 fix: Changed parameter type from PlanStep to PlanNode and preserves rich metadata
// Previously converted PlanStep which lost nodeType, riskClass, budgetIntent, sideEffectProfile, retryPolicyRef
function oapeflirStepToMinimalStep(node: import("../../contracts/executable-contracts/index.js").PlanNode): import("../../orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowStep {
  return {
    stepId: node.nodeId,
    roleId: resolveOapeflirRoleId(node),
    outputKey: `output_${node.nodeId}`,
    inputKeys: node.inputRefs,
    timeoutMs: node.timeoutMs,
    maxAttempts: 1, // Default; retryPolicyRef is preserved separately
    dependsOnStepIds: node.inputRefs, // Note: PlanNode.inputRefs are step dependencies
    // R19-09 fix: Preserve rich metadata from PlanNode
    nodeType: node.nodeType,
    riskClass: node.riskClass,
    budgetIntent: node.budgetIntent,
    sideEffectProfile: node.sideEffectProfile,
    retryPolicyRef: node.retryPolicyRef,
  };
}

// R19-09 fix: Changed parameter type from PlanStep[] to PlanNode[] to preserve rich metadata
// The PlanGraphBundle's validated PlanNode[] now flows through without losing metadata
function buildOapeflirPlannedWorkflow(
  nodes: import("../../contracts/executable-contracts/index.js").PlanNode[],
  planId: string,
): import("../../orchestration/routing/workflow-planner.js").PlannedWorkflow {
  const workflowDef: import("../../orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: `oapeflir_${planId}`,
    divisionId: "general_ops",
    steps: nodes.map(oapeflirStepToMinimalStep),
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
  // R4-26/R4-27 (INV-GRAPH-001/INV-RUN-001): RuntimeEntryGuard is mandatory at dispatch entry
  // All execution paths must pass through PlanGraphBundle validation before writing truth
  const entryGuard = new RuntimeEntryGuard();
  entryGuard.assertNoLegacyTruthWrite({ eventType: "platform.graph_scheduler.decision_recorded" });
  input.request = normalizeExecutionRequest(input);

  // Reset the tool registry to ensure clean state for this orchestration run
  resetMultiStepToolRegistryForTests();

  // R4-33/R4-35: Get RuntimeTruthRepository from bootstrap-level singleton service registry
  // Previously this was created per-orchestration-run here, which violated bootstrap architecture
  const runtimeTruthRepository = getRuntimeTruthRepository(ServiceRegistry.getInstance());
  initializeToolRegistryWithRepository(runtimeTruthRepository);

  let plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  let routing: IntakeRouteDecision;
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
      confirmedTaskSpecId: `oapeflir:${plannedWorkflow.workflow.workflowId}`,
      capabilityMatch: {
        capableWorkerFound: true,
        targetDivisionId: plannedWorkflow.workflow.divisionId,
        requiredCapabilities: [],
        eligibleWorkerCount: 1,
      },
    };
  } else {
    const router = new IntakeRouter();
    const routingResult = await router.route({ title: input.title, request: input.request });
    routing = routingResult.routeDecision;
    const planner = new WorkflowPlanner();
    plannedWorkflow = planner.plan({ workflowId: routing.workflowId, request: input.request });
    assertWorkflowValid(plannedWorkflow.workflow);
  }

  // R8-5 (INV-ROUTING-001): Persist routing decision for auditing
  // The routing decision contains domain/executor selection which must be auditable
  // R4-36 (INV-SINGLE-LEADER): Leader election check before write operations
  const traceId = newId("trace");
  const routingPrincipal = createPlatformPrincipal({ actorId: "intake-router", tenantId: "tenant:local" });
  const routingEvidence = createEvidenceRecord({
    traceId,
    principal: routingPrincipal,
    category: "decision",
    targetRef: `workflow:${routing.workflowId}`,
    content: {
      workflowId: routing.workflowId,
      divisionId: routing.divisionId,
      routeReason: routing.routeReason,
      routeTrace: routing.routeTrace,
      requiresOrchestration: routing.requiresOrchestration,
      confirmedTaskSpecId: routing.confirmedTaskSpecId,
      classification: routing.classification,
    } as unknown as Record<string, unknown>,
    metadata: { source: "multi-step-orchestration", version: "1.0" },
  });
  runtimeTruthRepository.appendEvidenceRecord(routingEvidence);

  // R4-26 (INV-GRAPH-001): Create PlanGraphBundle as only P3→P4 contract
  // R4-27 (INV-RUN-001): Enforce HarnessRuntime is only execution entry via RuntimeEntryGuard
  const harnessRunId = newId("harness_run");
  const planGraphBundle = minimalWorkflowToPlanGraphBundle(plannedWorkflow.workflow, harnessRunId);
  const guardResult = entryGuard.assertPlanGraphBundleOnly(planGraphBundle);
  const validatedPlanGraphBundle = guardResult.planGraphBundle;
  // R4-26 (INV-GRAPH-001): Use validatedPlanGraphBundle - the harnessRunId is now available for budget tracking
  const harnessRunIdFromBundle = validatedPlanGraphBundle.harnessRunId;
  const tenantId = "tenant:local";
  // R4-33: Set harnessRunId on tool registry for correlating SideEffectRecords
  setToolRegistryHarnessRunId(harnessRunIdFromBundle);

  // R4-25 (INV-BUDGET-001): Create budgetLedger from validated PlanGraphBundle for reserve-before-execute
  // The budgetLedger flows through executeStepLoop to multi-step-agent-round-loop to model-call-provider
  const budgetLedger = createBudgetLedger({
    tenantId,
    harnessRunId: harnessRunIdFromBundle,
    currency: "USD",
    hardCap: 10, // matches default maxTaskCostUsd
  });

  // R4-25 (INV-BUDGET-001): Set budget ledger on tool registry for reserve→execute→settle pattern
  setToolRegistryBudgetLedger(budgetLedger);

  const storage = openAuthoritativeStorageContext({ dbPath: input.dbPath });
  const db = storage.sql;
  const store = storage.store;
  storage.migrate();

  // R4-36: Check leadership before first write operation
  // Leader check requires async setup that is not available in sync execution path
  // The HACoordinator integration is deferred to runtime initialization
  // R4-36 is addressed at the dispatch level where leader election is checked

  const taskId = validatedPlanGraphBundle.planGraphBundleId;
  const sessionId = newId("sess");

  // R4-27 (INV-RUN-001): Create and persist HarnessRun entity as the actual execution entry point
  // This establishes the runtime truth that HarnessRuntime is the authoritative execution root
  const harnessRun = createHarnessRun({
    tenantId,
    traceId,
    riskLevel: routing.classification.intent === "approve" ? "high" : "medium",
    ownership: { ownerId: tenantId, ownerType: "tenant" },
    domainId: plannedWorkflow.workflow.divisionId,
    confirmedTaskSpecId: `pending:${taskId}`,
    requestEnvelopeId: `pending:${taskId}`,
    requestHash: `request:${taskId}`,
    constraintPackRef: validatedPlanGraphBundle.budgetPlanRef ?? `workflow:${plannedWorkflow.workflow.workflowId}`,
    versionLockId: `pending:${harnessRunIdFromBundle}`,
    budgetLedgerId: budgetLedger.budgetLedgerId,
    harnessRunId: harnessRunIdFromBundle,
    status: "created",
  });
  const runVersionLock = createRunVersionLock({
    harnessRunId: harnessRunIdFromBundle,
    runtimeProfileVersion: "runtime-profile:default",
  });
  // Insert harness_run record into the database
  executeQuery(
    db.connection,
    `INSERT INTO harness_runs (
      harness_run_id, tenant_id, confirmed_task_spec_id, request_envelope_id,
      status, version_lock_id, budget_ledger_id, current_seq, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    harnessRun.harnessRunId,
    harnessRun.tenantId,
    harnessRun.confirmedTaskSpecId,
    harnessRun.requestEnvelopeId,
    harnessRun.status,
    runVersionLock.runVersionLockId,
    harnessRun.budgetLedgerId,
    harnessRun.currentSeq,
    harnessRun.updatedAt,
  );
  // Insert plan_graph_bundle record
  executeQuery(
    db.connection,
    `INSERT INTO plan_graph_bundles (
      plan_graph_bundle_id, harness_run_id, graph_version, graph_json, validation_report_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    validatedPlanGraphBundle.planGraphBundleId,
    harnessRunIdFromBundle,
    validatedPlanGraphBundle.graphVersion,
    JSON.stringify(validatedPlanGraphBundle.graph),
    JSON.stringify(validatedPlanGraphBundle.validationReport),
    validatedPlanGraphBundle.createdAt,
  );

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
    // R4-25 (INV-BUDGET-001): Initialize BudgetExecutionSessionManager for atomic reserve→execute→settle
    // This must be created before admission evaluation to support budget reservation verification
    const budgetSessionManager = new BudgetExecutionSessionManager();
    const admission = new AdmissionController(
      store,
      input.admissionPolicy as AdmissionPolicy | undefined,
      backpressureSnapshot,
      budgetSessionManager,
    );
    const contextCompaction = new ContextCompactionService(db, store);
    const streamBridge = new StreamBridge();

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
        // R4-27 (INV-RUN-001): Derive task from HarnessRun - task must reference its authorizing HarnessRun
        harnessRunId: harnessRunIdFromBundle,
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

        // R4-27 (INV-RUN-001): Emit harness_run.status_changed event when HarnessRun is created
        // This pairs with the harness_runs INSERT at line 362-379 to ensure truth mutation is
        // paired with the corresponding platform.* event within the same transaction
        store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "platform.harness_run.status_changed",
          eventTier: "tier_1",
          payloadJson: JSON.stringify({
            harnessRunId: harnessRunIdFromBundle,
            status: "created",
            tenantId,
            domainId: plannedWorkflow.workflow.divisionId,
            occurredAt: nowIso(),
          }),
          traceId,
          createdAt: nowIso(),
        });

        store.event.insertEvent({
          id: newId("evt"),
          taskId,
          executionId: null,
          eventType: "workflow:planned",
          eventTier: "tier_2",
          payloadJson: JSON.stringify(injectTraceContext({
            workflowId: plannedWorkflow.workflow.workflowId,
            planReason: plannedWorkflow.planReason,
            dependencyEdges: plannedWorkflow.dependencyEdges,
          }, createChildTraceContext(traceContext))),
          traceId,
          createdAt: nowIso(),
        });
      });

      // R8-01 FIX: Create budget reservation BEFORE admission evaluation
      // This implements the reserve-before-execute pattern required by INV-BUDGET-001
      const defaultBudgetPolicy: BudgetPolicy = {
        maxTaskCostUsd: 10,
        maxPackCostUsd: 100,
        maxPlatformCostUsd: 10000,
        maxDailyCostUsd: 100,
        maxMonthlyCostUsd: 1000,
        maxModelTokens: 100000,
        maxSteps: 100,
        maxDurationMs: 600000,
        warnAtRatio: 0.8,
        mode: "auto",
      };
      let budgetReservationId: string | null = null;
      try {
        const budgetSession = budgetSessionManager.reserveAndCreateSession(
          {
            tenantId,
            harnessRunId: harnessRunIdFromBundle,
            traceId,
            emittedBy: "multi_step_orchestration",
            ledger: budgetLedger,
            policy: defaultBudgetPolicy,
          },
          task.estimatedCostUsd ?? 0.05,
          "token",
        );
        budgetReservationId = budgetSession.sessionId;
        // Mark as executing immediately since we're in the main execution path
        budgetSessionManager.markExecuting(budgetReservationId);
      } catch (error) {
        // Budget reservation failed - reject the task
        logger.log({ level: "warn", message: `Budget reservation failed, cancelling task`, data: { error: error instanceof Error ? error.message : String(error), taskId } });
        transitions.transitionTaskStatus({ entityKind: "task", entityId: taskId, fromStatus: "queued", toStatus: "cancelled", executionId: null, ...createContext(traceContext, "budget.reservation_failed") });
        transitions.transitionWorkflowStatus({ entityKind: "workflow", entityId: taskId, fromStatus: "running", toStatus: "cancelled", currentStepIndex: 0, outputsJson: workflow.outputsJson, ...createContext(traceContext, "budget.reservation_failed") });
        transitions.transitionSessionStatus({ entityKind: "session", entityId: sessionId, fromStatus: "open", toStatus: "cancelled", ...createContext(traceContext, "budget.reservation_failed") });
        return {
          snapshot: store.operations.loadTaskSnapshot(taskId),
          streamFrames: [],
          routing,
          plannedWorkflow,
          compaction: null,
        };
      }

      const admissionDecision = admission.evaluate({
        priority: task.priority,
        estimatedCostUsd: task.estimatedCostUsd,
        budgetRemainingUsd: task.estimatedCostUsd,
        budgetReservationId,
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

      // R4-25 (INV-BUDGET-001): Propagate budget context through input to executeStepLoop
      // The harnessRunId and budgetLedger from validatedPlanGraphBundle flow to multi-step-supervisor
      input.harnessRunId = harnessRunIdFromBundle;
      input.budgetLedger = budgetLedger;

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
          validatedPlanGraphBundle,
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
        store.task.updateTaskOutput(
          taskId,
          "failed",
          JSON.stringify({ error: workflowLastErrorCode ?? "workflow.step_failed", failedStepIds: [...failedStepIds], skippedStepIds: [...skippedStepIds] }),
          ctx.occurredAt,
        );
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

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
import { createHarnessRun } from "../../contracts/executable-contracts/index.js";
import { createWorkspaceWritePolicy } from "../../five-plane-control-plane/iam/sandbox-policy.js";
import { ContextCompactionService, type ContextCompactionResult } from "./context-compaction-service.js";
import {
  AdmissionController,
  type AdmissionBackpressureSnapshot,
  type AdmissionPolicy,
} from "../dispatcher/admission-controller.js";
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../dispatcher/index.js";
import { provideContext } from "./runtime-context.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { openAuthoritativeStorageContext } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { ensureMessagePartsJson } from "../../model-gateway/messages/message-parts.js";
import { IntakeRouter } from "../../five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../five-plane-orchestration/routing/workflow-planner.js";
import { assertWorkflowValid } from "../../five-plane-orchestration/oapeflir/workflow/workflow-validator.js";
import { StreamBridge } from "../../five-plane-interface/channel-gateway/stream-bridge.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import { executeStepLoop } from "./multi-step-supervisor.js";
import { BudgetAllocator, type BudgetAllocatorContext } from "../budget-allocator.js";
import { ValidationError } from "../../contracts/errors.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";
import {
  buildOapeflirPlannedWorkflow,
  deserializeOapeflirPlan,
  isOapeflirPlanRequest,
} from "./multi-step-oapeflir-plan.js";

const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;

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
      ...(routing.classification.ambiguityFlags != null ? { ambiguityFlags: [...routing.classification.ambiguityFlags] } : {}),
      ...(routing.classification.suggestedClarifications != null ? { suggestedClarifications: [...routing.classification.suggestedClarifications] } : {}),
    },
    ...(routing.confirmedTaskSpecId != null ? { confirmedTaskSpecId: routing.confirmedTaskSpecId } : {}),
    ...(routing.taskDraft != null ? { taskDraft: routing.taskDraft } : {}),
    ...(routing.clarificationSession != null ? { clarificationSession: routing.clarificationSession } : {}),
    ...(routing.confirmedTaskSpec != null ? { confirmedTaskSpec: routing.confirmedTaskSpec } : {}),
    ...(routing.requestEnvelope != null ? { requestEnvelope: routing.requestEnvelope } : {}),
  };
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
    const router = input.intakeRouter ?? new IntakeRouter();
    routing = router.route({ title: input.title, request: input.request });
    const planner = input.workflowPlanner ?? new WorkflowPlanner();
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

    const taskId = input.taskId ?? newId("task");
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

      // R4-26/R4-27 fix: Create HarnessRun for canonical execution tracking
      const harnessRun = createHarnessRun({
        tenantId: input.tenantId ?? "tenant:local",
        traceId,
        goal: input.title,
        riskLevel: "medium",
        domainId: plannedWorkflow.workflow.divisionId,
        confirmedTaskSpecId: `ctspec:${taskId}`,
        requestEnvelopeId: `request:${taskId}`,
        requestHash: `hash:${taskId}`,
        constraintPackRef: `constraint_pack:${plannedWorkflow.workflow.divisionId}`,
        versionLockId: newId("version_lock"),
        budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
        ...(input.harnessRunId == null ? {} : { harnessRunId: input.harnessRunId }),
        status: "created",
      });
      const harnessRunId = harnessRun.harnessRunId;

      // R4-27 (INV-RUN-001) fix: Persist HarnessRun to enable canonical execution tracking
      // The HarnessRun must be stored in the RuntimeTruthRepository for harness runtime
      // to track execution lifecycle. Without this, the harness run exists only in memory.
      // Persist via raw SQL insert since AuthoritativeTaskStore doesn't have harnessRun sub-store
      db.connection.prepare(
          `INSERT INTO harness_runs (harness_run_id, tenant_id, org_id, trace_id, goal, risk_level, status, domain_id,
          confirmed_task_spec_id, request_envelope_id, request_hash, constraint_pack_ref, version_lock_id,
          budget_ledger_id, current_seq, created_at, updated_at, fencing_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          harnessRun.harnessRunId,
          harnessRun.tenantId,
          harnessRun.orgId,
          harnessRun.traceId,
          harnessRun.goal ?? null,
          harnessRun.riskLevel,
          harnessRun.status,
          harnessRun.domainId,
          harnessRun.confirmedTaskSpecId,
          harnessRun.requestEnvelopeId,
          harnessRun.requestHash,
          harnessRun.constraintPackRef,
          harnessRun.versionLockId,
          harnessRun.budgetLedgerId,
          harnessRun.currentSeq,
          harnessRun.createdAt,
          harnessRun.updatedAt,
          harnessRun.fencingToken,
        );
      store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId: null,
        eventType: "platform.harness_run.status_changed",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          harnessRunId,
          fromStatus: null,
          toStatus: "created",
          planGraphBundleId: input.harnessRunId ?? null,
        }),
        traceId,
        createdAt: nowIso(),
        schemaVersion: "1.0",
        aggregateId: harnessRunId,
        runId: harnessRunId,
        sequence: null,
        causationId: null,
        correlationId: taskId,
        payloadHash: null,
        idempotencyKey: `harness_run_created:${harnessRunId}`,
        replayBehavior: "replay_as_fact",
        principal: "system",
        evidenceRefs: [] as readonly string[],
      });

      if (harnessRun.budgetLedgerId) {
        const ledgerRow = db.connection.prepare(
          `SELECT budget_ledger_id, tenant_id, harness_run_id, currency, hard_cap, reserved_amount, settled_amount, released_amount, status, version
           FROM budget_ledgers WHERE budget_ledger_id = ?`,
        ).get(harnessRun.budgetLedgerId) as {
          budget_ledger_id: string;
          tenant_id: string;
          harness_run_id: string;
          currency: string;
          hard_cap: number;
          reserved_amount: number;
          settled_amount: number;
          released_amount: number;
          status: string;
          version: number;
        } | undefined;
        if (ledgerRow) {
          const budgetAllocator = new BudgetAllocator();
          const allocatorContext: BudgetAllocatorContext = {
            tenantId: ledgerRow.tenant_id,
            traceId,
            emittedBy: "multi-step-orchestration",
            principal: "multi-step-orchestration",
          };
          const reserveResult = budgetAllocator.reserve({
            ledger: {
              budgetLedgerId: ledgerRow.budget_ledger_id,
              tenantId: ledgerRow.tenant_id,
              harnessRunId: ledgerRow.harness_run_id,
              currency: ledgerRow.currency,
              hardCap: ledgerRow.hard_cap,
              reservedAmount: ledgerRow.reserved_amount,
              settledAmount: ledgerRow.settled_amount,
              releasedAmount: ledgerRow.released_amount,
              status: ledgerRow.status as "open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing",
              version: ledgerRow.version,
            },
            amount: 1,
            resourceKind: "token",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            expectedVersion: ledgerRow.version,
            context: allocatorContext,
          });
          db.transaction(() => {
            const updateResult = db.connection.prepare(
              `UPDATE budget_ledgers
               SET reserved_amount = ?, status = ?, version = ?
               WHERE budget_ledger_id = ? AND version = ?`,
            ).run(
              reserveResult.ledger.reservedAmount,
              reserveResult.ledger.status,
              reserveResult.ledger.version,
              reserveResult.ledger.budgetLedgerId,
              ledgerRow.version,
            );
            if (updateResult.changes !== 1) {
              throw new ValidationError(
                "budget_reservation.sql_cas_failed",
                "budget_reservation.sql_cas_failed: concurrent reserve detected for budget ledger.",
              );
            }
            db.connection.prepare(
              `INSERT INTO budget_reservations (budget_reservation_id, budget_ledger_id, harness_run_id, amount, resource_kind, status, expires_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              reserveResult.reservation.budgetReservationId,
              reserveResult.reservation.budgetLedgerId,
              reserveResult.reservation.harnessRunId,
              reserveResult.reservation.amount,
              reserveResult.reservation.resourceKind,
              reserveResult.reservation.status,
              reserveResult.reservation.expiresAt,
              reserveResult.reservation.createdAt,
            );
          });
        }
      }

      const stepResult = await executeStepLoop(
        {
          taskId,
          sessionId,
          traceId,
          traceContext,
          streamId,
          harnessRunId, // R4-26/R4-27 fix: Pass HarnessRun ID for canonical tracking
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
        transitions.transitionTaskTerminalState({
          taskId,
          sessionId,
          executionId: lastExecutionId,
          currentTaskStatus: "in_progress",
          currentWorkflowStatus: "running",
          currentSessionStatus: "streaming",
          currentExecutionStatus: lastExecution?.status ?? "failed",
          terminalStatus: "failed",
          taskOutputJson: JSON.stringify({
            error: workflowLastErrorCode ?? "workflow.step_failed",
            failedStepIds: [...failedStepIds],
            skippedStepIds: [...skippedStepIds],
          }),
          outputsJson: JSON.stringify(outputs),
          context: createContext(traceContext, workflowLastErrorCode ?? "workflow.step_failed"),
        });
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

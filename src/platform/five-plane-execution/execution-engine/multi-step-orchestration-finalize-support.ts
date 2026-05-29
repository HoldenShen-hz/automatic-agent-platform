import { newId, nowIso } from "../../contracts/types/ids.js";
import { createHarnessRun } from "../../contracts/executable-contracts/index.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import { createChildTraceContext, createRootTraceContext, injectTraceContext } from "../../shared/observability/trace-context.js";
import { ensureBudgetLedger, reserveBudgetLedger } from "../budget-ledger-reservation.js";
import { IntakeRouter } from "../../five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../five-plane-orchestration/routing/workflow-planner.js";
import { StreamBridge } from "../../five-plane-interface/channel-gateway/stream-bridge.js";
import { TransitionService } from "../state-transition/transition-service.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";
import type { OrchestrationRuntime } from "./multi-step-orchestration-bootstrap-support.js";
import { createOrchestrationTransitionContext } from "./multi-step-orchestration-plan-support.js";

export function persistHarnessRunBootstrap(params: {
  db: OrchestrationRuntime["db"];
  store: OrchestrationRuntime["store"];
  input: MultiStepToolExecutionInput;
  taskId: string;
  traceId: string;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
}): string {
  const { db, store, input, taskId, traceId, plannedWorkflow } = params;
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
    // Reserve 1 unit for harness bootstrap plus at least 1 per execution step.
    const budgetHardCap = Math.max(plannedWorkflow.executionSteps.length + 1, 2);
    db.transaction(() => {
      ensureBudgetLedger({
        connection: db.connection,
        budgetLedgerId: harnessRun.budgetLedgerId,
        tenantId: input.tenantId ?? "tenant:local",
        harnessRunId,
        currency: "USD",
        hardCap: budgetHardCap,
      });
      reserveBudgetLedger({
        connection: db.connection,
        budgetLedgerId: harnessRun.budgetLedgerId,
        amount: 1,
        resourceKind: "api",
        allocatorContext: {
          tenantId: input.tenantId ?? "tenant:local",
          traceId,
          emittedBy: "multi-step-orchestration",
          principal: "multi-step-orchestration",
        },
      });
    });
  }

  return harnessRunId;
}

export function finalizeOrchestrationResult(params: {
  taskId: string;
  sessionId: string;
  streamId: string;
  traceId: string;
  traceContext: ReturnType<typeof createRootTraceContext>;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  outputs: Record<string, unknown>;
  workflowLastErrorCode: string | null;
  latestCompaction: ContextCompactionResult | null;
  failedStepIds: Set<string>;
  skippedStepIds: Set<string>;
  store: OrchestrationRuntime["store"];
  transitions: TransitionService;
  streamBridge: StreamBridge;
  routing: ReturnType<IntakeRouter["route"]>;
}): MultiStepOrchestrationResult {
  const {
    taskId,
    sessionId,
    streamId,
    traceId,
    traceContext,
    plannedWorkflow,
    outputs,
    workflowLastErrorCode,
    latestCompaction,
    failedStepIds,
    skippedStepIds,
    store,
    transitions,
    streamBridge,
    routing,
  } = params;

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

  const finalOutput = (outputs.final as Record<string, unknown> | undefined) ?? outputs;
  const allStepsFailedOrSkipped = plannedWorkflow.executionSteps.every(
    (step) => failedStepIds.has(step.stepId) || skippedStepIds.has(step.stepId),
  );
  const workflowFailed = failedStepIds.size > 0 || allStepsFailedOrSkipped;
  const lastExecution = store.execution.listExecutionsByTask(taskId).at(-1);
  const lastExecutionId = lastExecution?.id ?? null;
  const currentExecutionStatus = lastExecution?.status ?? (workflowFailed ? "failed" : "succeeded");

  if (workflowFailed) {
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: lastExecutionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus,
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({
        error: workflowLastErrorCode ?? "workflow.step_failed",
        failedStepIds: [...failedStepIds],
        skippedStepIds: [...skippedStepIds],
      }),
      outputsJson: JSON.stringify(outputs),
      context: createOrchestrationTransitionContext(
        traceContext,
        workflowLastErrorCode ?? "workflow.step_failed",
      ),
    });
  } else {
    transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: lastExecutionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus,
      terminalStatus: "done",
      taskOutputJson: JSON.stringify(finalOutput),
      outputsJson: JSON.stringify(outputs),
      context: createOrchestrationTransitionContext(traceContext, "task.completed"),
    });
  }

  return {
    snapshot: store.operations.loadTaskSnapshot(taskId),
    streamFrames: streamBridge.replayAfterSequence(streamId, 0),
    routing,
    plannedWorkflow,
    compaction: latestCompaction,
  };
}

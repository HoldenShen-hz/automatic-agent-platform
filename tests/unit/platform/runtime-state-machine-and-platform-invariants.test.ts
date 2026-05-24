import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";
import {
  createBudgetReservation,
  createNodeRun,
  createSideEffectRecord,
  type ArtifactRef,
} from "../../../src/platform/contracts/executable-contracts/index.js";
import { buildDecisionTree } from "../../../src/ops-maturity/explainability/explanation-renderer/index.js";
import { ExecutionTracer } from "../../../src/ops-maturity/workflow-debugger/execution-tracer.js";
import { WorkflowDebuggerHealthMonitor } from "../../../src/ops-maturity/workflow-debugger/health-monitor.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionCommand,
} from "../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { CallDepthBudget } from "../../../src/platform/five-plane-orchestration/agent-delegation/call-depth-budget.js";
import { HaProgramService } from "../../../src/scale-ecosystem/tenant-platform/ha-program-service.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

function createMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine({ persistEvent: () => {} });
}

function baseCommandFields(
  entityType: "NodeRun" | "SideEffectRecord" | "BudgetReservation",
  entityId: string,
  commandId: string,
) {
  return {
    commandId,
    entityType,
    entityId,
    principal: "system:test",
  };
}

test("1899/1903/1909: execution-state terminal NodeRun transitions require lease+fencing and preserve transition results", () => {
  const machine = createMachine();
  const runningNode = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const cancelCommand: RuntimeTransitionCommand<typeof runningNode> = {
    ...baseCommandFields("NodeRun", runningNode.nodeRunId, "cmd-node-cancel"),
    aggregateType: "NodeRun",
    aggregate: runningNode,
    fromStatus: "running",
    toStatus: "cancelled",
    expectedSeq: 3,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "manual.cancel",
    emittedBy: "operator",
    auditRef: "audit://node-run/cancel",
  };

  assert.throws(
    () => machine.transition(cancelCommand),
    (error: unknown) =>
      error instanceof WorkflowStateError
      && error.code === "runtime_state_machine.lease_and_fencing_required",
  );

  const cancelled = machine.transition({
    ...cancelCommand,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });
  assert.equal(cancelled.aggregate.status, "cancelled");
  assert.equal(cancelled.aggregate.currentSeq, 4);
  assert.equal(cancelled.event.eventType, "platform.node_run.status_changed");

  const createdNode = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    nodeId: "node-2",
    status: "created",
    currentSeq: 0,
  });
  const aborted = machine.transition({
    ...baseCommandFields("NodeRun", createdNode.nodeRunId, "cmd-node-abort"),
    aggregateType: "NodeRun",
    aggregate: createdNode,
    fromStatus: "created",
    toStatus: "aborted",
    expectedSeq: 0,
    leaseId: "lease-2",
    fencingToken: "node-2-fence",
    traceId: "trace-2",
    tenantId: "tenant-1",
    reasonCode: "pre_execution_abort",
    emittedBy: "scheduler",
    auditRef: "audit://node-run/aborted",
  });
  assert.equal(aborted.aggregate.status, "aborted");

  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    status: "proposed",
    version: 7,
  });
  const sideEffectResult = machine.transition({
    ...baseCommandFields("SideEffectRecord", sideEffect.sideEffectId, "cmd-sidefx-approve"),
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-3",
    tenantId: "tenant-1",
    reasonCode: "policy.approved",
    emittedBy: "policy-engine",
    sideEffectSafety: { preCommitPolicyProofRef: "proof-1" },
    auditRef: "audit://side-effect/approved",
  });
  assert.equal(sideEffectResult.aggregate.version, 8);

  const reservation = createBudgetReservation({
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    amount: 10,
    resourceKind: "token",
    expiresAt: "2026-05-20T01:00:00.000Z",
    version: 2,
  });
  const reservationResult = machine.transition({
    ...baseCommandFields("BudgetReservation", reservation.budgetReservationId, "cmd-budget-settle"),
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    expectedVersion: 2,
    traceId: "trace-4",
    tenantId: "tenant-1",
    reasonCode: "budget.settled",
    emittedBy: "budget-allocator",
    auditRef: "audit://budget-reservation/settled",
  });
  assert.equal(reservationResult.aggregate.version, 3);
  assert.equal(typeof reservationResult.event.eventType, "string");
});

test("1900-1912: dispatcher, reconciliation, budget, and call-depth guards remain wired to canonical paths", () => {
  const dispatchServiceSource = readFileSync("src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts", "utf8");
  const leaseServiceSource = readFileSync("src/platform/five-plane-execution/lease/execution-lease-service.ts", "utf8");
  const reconciliationSource = readFileSync(
    "src/platform/five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts",
    "utf8",
  );
  const budgetAllocatorSource = readFileSync("src/platform/five-plane-execution/budget-allocator.ts", "utf8");
  const preemptionSource = readFileSync(
    "src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service.ts",
    "utf8",
  );
  const dispatcherSource = readFileSync("src/platform/five-plane-execution/dispatcher/index.ts", "utf8");
  const durableRuntimeSources = [
    readFileSync("src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.ts", "utf8"),
    readFileSync("src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts", "utf8"),
    readFileSync("src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts", "utf8"),
  ];

  assert.match(leaseServiceSource, /public acquireLeaseWithinTransaction/);
  assert.match(dispatchServiceSource, /this\.db\.transaction\(\(\) => \{/);
  assert.match(dispatchServiceSource, /leaseResult = this\.leases\.acquireLeaseWithinTransaction\(/);
  assert.match(dispatchServiceSource, /activeLeaseCount: runningExecutionIds\.size/);
  assert.match(
    dispatchServiceSource,
    /ticket\.priority === "critical"\s*\|\|\s*ticket\.priority === "urgent"\s*\|\|\s*ticket\.priority === "high"\s*\|\|\s*ticket\.riskClass === "critical"/s,
  );
  assert.match(reconciliationSource, /public scanPaginated/);
  assert.match(reconciliationSource, /this\.db\.transaction\(\(\) => \{/);
  assert.match(preemptionSource, /left\.activeLease\.leasedAt\.localeCompare\(right\.activeLease\.leasedAt\)/);
  assert.match(dispatcherSource, /const MAX_SPAWN_DEPTH = 8;/);
  assert.match(dispatcherSource, /tool\.spawn_depth_exceeded/);
  assert.match(budgetAllocatorSource, /const reservationResult = this\.stateMachine\.transition\(reservationCommand\);/);
  assert.match(budgetAllocatorSource, /if \(this\.atomicRepository\) \{/);
  assert.match(budgetAllocatorSource, /public checkWatermarkAlert\(ledger: BudgetLedger\): WatermarkAlert/);
  assert.ok(
    durableRuntimeSources.every((source) =>
      source.includes("budget_reservation.sql_cas_failed") && source.includes("budgetAllocator.reserve("),
    ),
  );

  const decision = new CallDepthBudget().evaluate({
    currentCallDepth: 4,
    goalDecompositionDepth: 4,
    delegationDepth: 4,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveCallDepth, 12);
  assert.equal(decision.reasonCode, "call_depth.exceeded");
});

test("1913-1918: HA, debugger, explainability, health, and replay invariants stay closed", () => {
  const store = {
    release: {
      listEnvironmentReadinessRecords(): Array<{ componentType: string; componentId: string }> {
        return [
          { componentType: "external_service", componentId: "ha_coordinator" },
          { componentType: "external_service", componentId: "postgres_primary" },
        ];
      },
    },
    worker: {
      listWorkerSnapshots(): Array<{ status: string }> {
        return [{ status: "active" }, { status: "offline" }];
      },
      listExecutionLeasesByStatuses(): Array<{ status: string }> {
        return [{ status: "active" }];
      },
    },
  };
  const haReport = new HaProgramService(store as never).buildReport({ environment: "staging" });
  assert.equal(haReport.overallStatus, "warning");
  assert.equal(haReport.activeWorkerCount, 1);
  assert.equal(haReport.activeLeaseCount, 1);

  const tracer = new ExecutionTracer();
  const trace = tracer.startTrace("wf-1", "exec-1");
  tracer.recordEvent(trace.traceId, "step-1", "enter");
  assert.equal(tracer.getTrace(trace.traceId)?.totalDurationMs, null);
  tracer.stopTrace(trace.traceId);
  assert.equal(tracer.getTrace(trace.traceId), null);

  const abortedTrace = tracer.startTrace("wf-2", "exec-2");
  tracer.abortTrace(abortedTrace.traceId);
  assert.equal(tracer.getTrace(abortedTrace.traceId), null);

  const tree = buildDecisionTree(
    "root",
    [
      { source: "A", target: "B", rationale: "a->b" },
      { source: "B", target: "C", rationale: "b->c" },
    ],
    [],
    [],
  );
  assert.equal(tree.maxDepth, 3);

  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 1 });
  monitor.recordProbe({
    componentId: "debugger",
    status: "failed",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  });
  const snapshot = monitor.getSnapshot("debugger");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 0);

  const timeTravel = new TimeTravelDebugService({ maxSessions: 1 });
  timeTravel.loadEventStore("exec-3", [
    { stepId: "step-1", timestamp: "2026-05-20T00:00:00.000Z", variables: { value: 1 } },
    { stepId: "step-2", timestamp: "2026-05-20T00:00:01.000Z", variables: { value: 2 } },
  ]);
  const session = timeTravel.createSession("task-1", "exec-3");
  timeTravel.replayStep(session.sessionId);
  timeTravel.replayStep(session.sessionId);
  const boundary = timeTravel.replayStep(session.sessionId);
  assert.ok(boundary);
  assert.ok(boundary.cursor.fromEventIndex < boundary.cursor.toEventIndex);
});

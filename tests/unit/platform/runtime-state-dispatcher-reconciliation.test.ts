import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDecisionTree } from "../../../src/ops-maturity/explainability/explanation-renderer/index.js";
import { WorkflowDebuggerHealthMonitor } from "../../../src/ops-maturity/workflow-debugger/health-monitor.js";
import { ExecutionTracer } from "../../../src/ops-maturity/workflow-debugger/execution-tracer.js";
import { TimeTravelDebugService } from "../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import { HaProgramService } from "../../../src/scale-ecosystem/tenant-platform/ha-program-service.js";

test("1899..1912: runtime-state-machine, dispatcher, reconciliation, and budget reserve paths stay fixed", () => {
  const runtimeStateMachineSource = readFileSync("src/platform/five-plane-execution/runtime-state-machine.ts", "utf8");
  const dispatchServiceSource = readFileSync("src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts", "utf8");
  const leaseServiceSource = readFileSync("src/platform/five-plane-execution/lease/execution-lease-service.ts", "utf8");
  const preemptionSource = readFileSync("src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service.ts", "utf8");
  const reconciliationSource = readFileSync("src/platform/five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts", "utf8");
  const dispatcherIndexSource = readFileSync("src/platform/five-plane-execution/dispatcher/index.ts", "utf8");
  const budgetAllocatorSource = readFileSync("src/platform/five-plane-execution/budget-allocator.ts", "utf8");
  const oapeflirSource = readFileSync("src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts", "utf8");
  const multiStepSource = readFileSync("src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts", "utf8");
  const happyPathSource = readFileSync("src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts", "utf8");
  const callDepthBudgetSource = readFileSync("src/platform/five-plane-orchestration/agent-delegation/call-depth-budget.ts", "utf8");

  assert.match(runtimeStateMachineSource, /RuntimeStateMachine/);
  assert.match(runtimeStateMachineSource, /shared\/runtime-state-machine/);

  assert.match(leaseServiceSource, /public acquireLeaseWithinTransaction/);
  assert.match(dispatchServiceSource, /this\.leases\.acquireLeaseWithinTransaction/);
  assert.match(dispatchServiceSource, /activeLeaseCount: runningExecutionIds\.size/);
  assert.match(dispatchServiceSource, /ticket\.priority === "high"/);
  assert.match(dispatchServiceSource, /ticket\.riskClass === "critical"/);

  assert.match(preemptionSource, /function isPreemptionTriggerTicket/);
  assert.match(preemptionSource, /ticket\.priority === "high"/);
  assert.match(preemptionSource, /ticket\.riskClass === "critical"/);
  assert.match(preemptionSource, /left\.activeLease\.leasedAt\.localeCompare\(right\.activeLease\.leasedAt\)/);

  assert.match(reconciliationSource, /const replacementTicket = this\.db\.transaction/);
  assert.match(reconciliationSource, /private createReplacementTicketRecord/);
  assert.ok(!reconciliationSource.includes("this.dispatch.createTicket("));
  assert.match(reconciliationSource, /scanPaginated\(pageSize: number = DEFAULT_RECONCILIATION_PAGE_SIZE/);

  assert.match(dispatcherIndexSource, /const MAX_SPAWN_DEPTH = 8;/);
  assert.match(dispatcherIndexSource, /tool\.spawn_depth_exceeded/);

  assert.match(budgetAllocatorSource, /public checkWatermarkAlert/);
  assert.match(budgetAllocatorSource, /softCapPercent/);
  assert.match(budgetAllocatorSource, /hardCapPercent/);
  assert.match(budgetAllocatorSource, /this\.stateMachine\.transition\(reservationCommand\)/);
  assert.match(
    callDepthBudgetSource,
    /request\.currentCallDepth\s*\+\s*[\r\n\s]*request\.goalDecompositionDepth\s*\+\s*[\r\n\s]*request\.delegationDepth/,
  );

  assert.match(oapeflirSource, /UPDATE budget_ledgers/);
  assert.match(oapeflirSource, /budget_reservation\.sql_cas_failed/);
  assert.match(multiStepSource, /UPDATE budget_ledgers/);
  assert.match(happyPathSource, /UPDATE budget_ledgers/);
});

test("1913: HA program returns warning when only non-critical components are not ready", () => {
  const service = new HaProgramService({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "external_service", componentId: "ha_coordinator" },
        { componentType: "external_service", componentId: "postgres_primary" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [{ status: "active" }, { status: "offline" }],
      listExecutionLeasesByStatuses: () => [{ leaseId: "lease-1" }],
    },
  } as never);

  const report = service.buildReport({ environment: "staging", generatedAt: "2026-05-12T00:00:00.000Z" });
  assert.equal(report.overallStatus, "warning");
});

test("1914/1915: execution tracer removes stopped traces from active state and fails closed on unknown trace lookup", () => {
  const tracer = new ExecutionTracer();
  const trace = tracer.startTrace("wf-1", "exec-1");
  tracer.recordEvent(trace.traceId, "step-1", "enter");

  const stopped = tracer.stopTrace(trace.traceId);
  assert.ok(stopped !== null);
  assert.equal(tracer.getTrace(trace.traceId), null);

  const abortedTrace = tracer.startTrace("wf-2", "exec-2");
  const aborted = tracer.abortTrace(abortedTrace.traceId);
  assert.ok(aborted !== null);
  assert.equal(tracer.getTrace(abortedTrace.traceId), null);
});

test("1916: explanation renderer computes recursive maxDepth", () => {
  const tree = buildDecisionTree(
    "root",
    [
      { source: "A", target: "B", rationale: "A->B" },
      { source: "B", target: "C", rationale: "B->C" },
    ],
    [],
    [],
  );

  assert.ok(tree.maxDepth >= 2);
});

test("1917: health monitor only evaluates recent failures inside the sliding window", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 1, failedThreshold: 0.5 });
  monitor.recordProbe({
    componentId: "dispatcher",
    status: "failed",
    timestamp: "2026-05-12T00:00:00.000Z",
  });
  monitor.recordProbe({
    componentId: "dispatcher",
    status: "healthy",
    timestamp: "2026-05-12T00:10:00.000Z",
  });

  const snapshot = monitor.getSnapshot("dispatcher", "2026-05-12T00:10:30.000Z");
  assert.ok(snapshot !== null);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.failedCount, 0);
});

test("1918: time-travel debug cursor preserves fromEventIndex < toEventIndex at boundary", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-1", [
    { stepId: "step-1", timestamp: "2026-05-12T00:00:00.000Z", variables: {} },
  ]);

  const session = service.createSession("task-1", "exec-1");
  service.replayStep(session.sessionId);
  const state = service.replayStep(session.sessionId);

  assert.ok(state !== null);
  assert.ok(state.cursor.fromEventIndex < state.cursor.toEventIndex);
});

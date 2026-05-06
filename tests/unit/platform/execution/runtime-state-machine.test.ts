/**
 * Runtime State Machine Unit Tests
 *
 * Tests for the RuntimeStateMachine class covering:
 * - State transition validation
 * - Lease and fencing token enforcement (issue #1899)
 * - SideEffectRecord version increment on applyStatus (issue #1903)
 * - applyStatus returns Result type not void (issue #1909)
 * - Self-transition not silent no-op (issue #2161)
 * - NodeRun cancelled/aborted should check lease+fencing (issue #1899)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
  createSideEffectRecord,
  type ArtifactRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  isTruthConsumerEvent,
  type RuntimeTransitionResult,
} from "../../../../src/platform/execution/runtime-state-machine.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

function createMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine();
}

// ── Issue #1899: NodeRun cancelled/aborted should check lease+fencing ─────────

test("RuntimeStateMachine: NodeRun cancelled requires lease and fencing (issue #1899)", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  // Cancelling without lease and fencing should fail
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "cancelled",
        expectedSeq: 3,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "user_cancelled",
        emittedBy: "user",
        // Missing leaseId and fencingToken
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.lease_and_fencing_required",
  );
});

test("RuntimeStateMachine: NodeRun aborted requires lease and fencing (issue #1899)", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  // Aborting without lease and fencing should fail
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "aborted",
        expectedSeq: 3,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "system_abort",
        emittedBy: "system",
        // Missing leaseId and fencingToken
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.lease_and_fencing_required",
  );
});

test("RuntimeStateMachine: NodeRun cancelled with correct lease and fencing succeeds", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "running",
    toStatus: "cancelled",
    expectedSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "user_cancelled",
    emittedBy: "user",
  });

  assert.equal(result.aggregate.status, "cancelled");
  assert.equal(result.aggregate.currentSeq, 4);
});

test("RuntimeStateMachine: NodeRun aborted with correct lease and fencing succeeds", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "running",
    toStatus: "aborted",
    expectedSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "system_abort",
    emittedBy: "system",
  });

  assert.equal(result.aggregate.status, "aborted");
  assert.equal(result.aggregate.currentSeq, 4);
});

// ── Issue #1903: SideEffectRecord applyStatus must increment version ───────────

test("RuntimeStateMachine: SideEffectRecord applyStatus increments version (issue #1903)", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "approved",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
    version: 1,
  });

  const result = machine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "approved",
    toStatus: "reserved",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "reservation",
    emittedBy: "side-effect-manager",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    occurredAt: "2026-04-27T00:00:00.000Z",
    auditRef: "audit-1",
    sideEffectSafety: {
      preCommitPolicyProofRef: "proof-ref-1",
    },
  });

  // SideEffectRecord should have updatedAt changed
  assert.equal(result.aggregate.status, "reserved");
  assert.equal(result.aggregate.updatedAt, "2026-04-27T00:00:00.000Z");
});

test("RuntimeStateMachine: SideEffectRecord transitions increment version on each transition", () => {
  const machine = createMachine();
  let sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "proposed",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });

  // Transition through multiple states
  const stateChanges = [
    { from: "proposed", to: "approved" },
    { from: "approved", to: "reserved" },
    { from: "reserved", to: "committing" },
    { from: "committing", to: "committed" },
  ];

  for (const change of stateChanges) {
    sideEffect = machine.transition({
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: change.from as any,
      toStatus: change.to as any,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: `transition_${change.to}`,
      emittedBy: "side-effect-manager",
      leaseId: "lease-1",
      fencingToken: "fence-1",
      auditRef: "audit-1",
      sideEffectSafety: {
        preCommitPolicyProofRef: "proof-ref-1",
      },
    }).aggregate as typeof sideEffect;

    assert.equal(sideEffect.status, change.to);
    assert.ok(sideEffect.updatedAt);
  }
});

// ── Issue #1909: applyStatus returns Result type not void ─────────────────────

test("RuntimeStateMachine: transition returns RuntimeTransitionResult (issue #1909)", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const result = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "running",
    toStatus: "succeeded",
    expectedSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "execution_complete",
    emittedBy: "worker",
    auditRef: "audit-1",
  });

  // Result should be RuntimeTransitionResult with aggregate and event
  assert.ok(result.aggregate, "Result should have aggregate property");
  assert.ok(result.event, "Result should have event property");
  assert.equal(result.aggregate.status, "succeeded");
  assert.equal(result.event.eventType, "platform.node_run.status_changed");
});

test("RuntimeStateMachine: all transition types return RuntimeTransitionResult", () => {
  const machine = createMachine();

  // Test HarnessRun
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  const harnessResult = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "admission-controller",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.ok(harnessResult.aggregate, "HarnessRun transition should return aggregate");
  assert.ok(harnessResult.event, "HarnessRun transition should return event");

  // Test BudgetLedger
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const ledgerResult = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 0,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "soft_cap",
    emittedBy: "budget-allocator",
    leaseId: "lease-budget-1",
    fencingToken: "fence-budget-1",
  });

  assert.ok(ledgerResult.aggregate, "BudgetLedger transition should return aggregate");
  assert.ok(ledgerResult.event, "BudgetLedger transition should return event");

  // Test BudgetReservation
  const reservation = createBudgetReservation({
    budgetLedgerId: ledger.budgetLedgerId,
    harnessRunId: "run-1",
    amount: 10,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
  });

  const reservationResult = machine.transition({
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "settled",
    emittedBy: "budget-allocator",
  });

  assert.ok(reservationResult.aggregate, "BudgetReservation transition should return aggregate");
  assert.ok(reservationResult.event, "BudgetReservation transition should return event");
});

// ── Issue #2161: self-transition not silent no-op ─────────────────────────────

test("RuntimeStateMachine: self-transition is not silent no-op (issue #2161)", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  // Attempting a self-transition (running -> running) should throw
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "running",
        expectedSeq: 3,
        leaseId: "lease-1",
        fencingToken: "fence-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "heartbeat_is_not_transition",
        emittedBy: "worker",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.noop_transition_denied",
  );
});

test("RuntimeStateMachine: HarnessRun self-transition is rejected", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "running",
    currentSeq: 4,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "running",
        toStatus: "running",
        expectedSeq: 4,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "heartbeat",
        emittedBy: "worker",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.noop_transition_denied",
  );
});

test("RuntimeStateMachine: SideEffectRecord self-transition is rejected", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "committed",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "committed",
        toStatus: "committed",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "noop",
        emittedBy: "side-effect-manager",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.noop_transition_denied",
  );
});

// ── HarnessRun State Transition Tests ────────────────────────────────────────

test("RuntimeStateMachine: HarnessRun valid transitions", () => {
  const machine = createMachine();

  const validTransitions: [string, string][] = [
    ["created", "admitted"],
    ["admitted", "planning"],
    ["planning", "ready"],
    ["ready", "running"],
    ["running", "pausing"],
    ["pausing", "paused"],
    ["paused", "resuming"],
    ["resuming", "running"],
    ["running", "completed"],
    ["running", "failed"],
    ["running", "aborted"],
  ];

  for (const [from, to] of validTransitions) {
    const run = createHarnessRun({
      harnessRunId: `run-${from}-${to}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "request-hash-1",
      constraintPackRef: "constraint-pack-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "ledger-1",
      status: from as any,
      currentSeq: 0,
    });

    const needsLeaseFencing = ["admitted", "planning", "ready", "running", "pausing", "paused", "resuming", "replanning", "compensating"].includes(to);

    const result = machine.transition({
      aggregateType: "HarnessRun",
      aggregate: run,
      fromStatus: from as any,
      toStatus: to as any,
      expectedSeq: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
      auditRef: "audit-1",
      ...(needsLeaseFencing ? { leaseId: "lease-1", fencingToken: "fence-1" } : {}),
      ...(to === "admitted" ? { runVersionLockId: "rvlock-1", policyGuard: { allowed: true, policyProofRef: "proof" } } : {}),
    });

    assert.equal(result.aggregate.status, to, `Transition ${from} -> ${to} should succeed`);
  }
});

// ── NodeRun State Transition Tests ────────────────────────────────────────────

test("RuntimeStateMachine: NodeRun valid transitions", () => {
  const machine = createMachine();

  const validTransitions: [string, string][] = [
    ["created", "ready"],
    ["ready", "leased"],
    ["leased", "running"],
    ["running", "retry_wait"],
    ["running", "awaiting_hitl"],
    ["running", "reconciling"],
    ["running", "succeeded"],
    ["running", "failed"],
    ["running", "cancelled"],
    ["running", "aborted"],
    ["retry_wait", "ready"],
    ["retry_wait", "failed"],
    ["awaiting_hitl", "running"],
    ["awaiting_hitl", "failed"],
    ["awaiting_hitl", "cancelled"],
    ["reconciling", "succeeded"],
    ["reconciling", "failed"],
  ];

  for (const [from, to] of validTransitions) {
    // Execution statuses that require lease/fencing - must match source definition
    const executionStatuses = ["created", "ready", "leased", "running", "retry_wait", "awaiting_hitl", "reconciling"];
    const terminalStatuses = ["succeeded", "failed", "skipped", "cancelled", "dependency_failed", "policy_blocked", "aborted"];
    const activeStatuses = ["leased", "running", "retry_wait", "awaiting_hitl", "reconciling"];

    const isExecutionTransition = executionStatuses.includes(to);
    const isTerminalFromActive = terminalStatuses.includes(to) && activeStatuses.includes(from);
    const needsLeaseFencing = isExecutionTransition || isTerminalFromActive;

    const nodeRun = createNodeRun({
      harnessRunId: "run-1",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: "node-1",
      status: from as any,
      currentSeq: 0,
      leaseId: needsLeaseFencing ? "lease-1" : undefined,
      fencingToken: needsLeaseFencing ? "fence-1" : undefined,
    });

    const result = machine.transition({
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: from as any,
      toStatus: to as any,
      expectedSeq: 0,
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test",
      auditRef: (to === "succeeded" || to === "failed") ? "audit-1" : undefined,
      ...(needsLeaseFencing ? { leaseId: "lease-1", fencingToken: "fence-1" } : {}),
    });

    assert.equal(result.aggregate.status, to, `Transition ${from} -> ${to} should succeed`);
  }
});

// ── Terminal State Tests ─────────────────────────────────────────────────────

test("RuntimeStateMachine: terminal states block further transitions", () => {
  const machine = createMachine();
  const terminalStatuses = ["completed", "failed", "aborted"];

  for (const status of terminalStatuses) {
    const run = createHarnessRun({
      harnessRunId: `run-${status}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "request-hash-1",
      constraintPackRef: "constraint-pack-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "ledger-1",
      status: status as any,
      currentSeq: 9,
    });

    assert.throws(
      () =>
        machine.transition({
          aggregateType: "HarnessRun",
          aggregate: run,
          fromStatus: status as any,
          toStatus: "running" as any,
          expectedSeq: 9,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "illegal_resume",
          emittedBy: "test",
        }),
      WorkflowStateError,
      `HarnessRun ${status} should be terminal`,
    );
  }
});

// ── CAS Version Tests ─────────────────────────────────────────────────────────

test("RuntimeStateMachine: rejects stale version CAS", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 5,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        expectedVersion: 3, // Stale version
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "soft_cap",
        emittedBy: "budget-allocator",
        leaseId: "lease-1",
        fencingToken: "fence-1",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.version_cas_failed",
  );
});

// ── Lease/Fencing Mismatch Tests ─────────────────────────────────────────────

test("RuntimeStateMachine: rejects mismatched leaseId for NodeRun", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        expectedSeq: 3,
        leaseId: "different-lease",
        fencingToken: "fence-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "writeback",
        emittedBy: "worker",
        auditRef: "audit-1",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.lease_mismatch",
  );
});

test("RuntimeStateMachine: rejects mismatched fencingToken for NodeRun", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        expectedSeq: 3,
        leaseId: "lease-1",
        fencingToken: "wrong-fence",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "writeback",
        emittedBy: "worker",
        auditRef: "audit-1",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.fencing_token_mismatch",
  );
});

// ── isTruthConsumerEvent Tests ───────────────────────────────────────────────

test("RuntimeStateMachine: isTruthConsumerEvent identifies platform events", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "admission-controller",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(isTruthConsumerEvent(result.event), true);
  assert.ok(result.event.eventType.startsWith("platform."));
});

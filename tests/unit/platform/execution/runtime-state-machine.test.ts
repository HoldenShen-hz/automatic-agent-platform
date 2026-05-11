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
  type PlatformFactEvent,
} from "../../../../src/platform/execution/runtime-state-machine.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

// Track persisted events for testing
const persistedEvents: PlatformFactEvent[] = [];

function createMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine({
    persistEvent: (event) => {
      persistedEvents.push(event);
    },
  });
}

function clearPersistedEvents(): void {
  persistedEvents.length = 0;
}

test("RuntimeStateMachine transitions HarnessRun and appends platform fact event", () => {
  clearPersistedEvents();
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
    runVersionLockId: "rvlock-1",
    policyGuard: {
      allowed: true,
      policyProofRef: "policy-proof-1",
    },
    auditRef: "audit://run-1/admission",
    occurredAt: "2026-04-27T00:00:00.000Z",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.aggregate.currentSeq, 1);
  assert.equal(result.event.eventType, "platform.harness_run.status_changed");
  assert.equal(result.event.aggregateSeq, 1);
  assert.equal(isTruthConsumerEvent(result.event), true);
});

test("RuntimeStateMachine seals HarnessRun terminal states", () => {
  const machine = createMachine();
  const completed = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "completed",
    currentSeq: 9,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: completed,
        fromStatus: "completed",
        toStatus: "running",
        expectedSeq: 9,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );
});

test("RuntimeStateMachine rejects no-op self transitions", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-noop",
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
        traceId: "trace-noop",
        tenantId: "tenant-1",
        reasonCode: "heartbeat_is_not_state_transition",
        emittedBy: "test",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.noop_transition_denied",
  );
});

test("RuntimeStateMachine rejects stale CAS sequence", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 2,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 1,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "stale_writer",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );
});

test("RuntimeStateMachine enforces NodeRun lease and fencing token", () => {
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
        emittedBy: "worker-1",
      }),
    WorkflowStateError,
  );

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
    reasonCode: "writeback",
    emittedBy: "worker-1",
  });

  assert.equal(result.aggregate.status, "succeeded");
  assert.equal(result.aggregate.terminalReason, "writeback");
  assert.equal(result.event.eventType, "platform.node_run.status_changed");
});

test("RuntimeStateMachine requires lease and fencing before execution-state NodeRun transitions", () => {
  const machine = createMachine();

  // First, verify that transition to leased without lease/fencing throws
  const nodeRunNoLease = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 1,
  });
  // Clear the default fencingToken to avoid mismatch errors in the first check
  // The first check should throw for missing lease/fencing, not for mismatch
  (nodeRunNoLease as any).fencingToken = null;

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRunNoLease,
        fromStatus: "ready",
        toStatus: "leased",
        expectedSeq: 1,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "lease",
        emittedBy: "scheduler",
      }),
    WorkflowStateError,
  );

  // Now verify that with lease and fencing, the transition succeeds
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 1,
  });
  // Clear the default fencingToken to avoid mismatch after the first transition
  // The second transition will set it properly via applyStatus
  (nodeRun as any).fencingToken = null;

  const leased = machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "ready",
    toStatus: "leased",
    expectedSeq: 1,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "lease",
    emittedBy: "scheduler",
  });

  assert.equal(leased.aggregate.leaseId, "lease-1");
  assert.equal(leased.aggregate.fencingToken, "fence-1");
});

test("RuntimeStateMachine requires RunVersionLock and policy guard for admission", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "admit",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "admit",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
        policyGuard: {
          allowed: false,
          policyProofRef: "policy-proof-1",
        },
      }),
    WorkflowStateError,
  );
});

test("RuntimeStateMachine rejects legacy NodeRun blocked, queued, and compensating states", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    currentSeq: 0,
  });

  for (const legacyToStatus of ["blocked", "queued"] as const) {
    assert.throws(
      () =>
        machine.transition({
          aggregateType: "NodeRun",
          aggregate: nodeRun,
          fromStatus: "created",
          toStatus: legacyToStatus as never,
          expectedSeq: 0,
          traceId: "trace-1",
          tenantId: "tenant-1",
          reasonCode: "legacy_status",
          emittedBy: "graph-scheduler",
        }),
      (error: unknown) =>
        error instanceof WorkflowStateError &&
        error.code === "runtime_state_machine.invalid_transition",
    );
  }

  const reconciling = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "reconciling",
    currentSeq: 2,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: reconciling,
        fromStatus: "reconciling",
        toStatus: "compensating" as never,
        expectedSeq: 2,
        leaseId: "lease-1",
        fencingToken: "fence-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "legacy_compensation",
        emittedBy: "graph-scheduler",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.invalid_transition",
  );
});

test("RuntimeStateMachine transitions SideEffectRecord through reconciliation states", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "committing",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });

  const result = machine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committing",
    toStatus: "ambiguous",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "external_timeout",
    emittedBy: "side-effect-manager",
  });

  assert.equal(result.aggregate.status, "ambiguous");
  assert.equal(result.event.eventType, "platform.side_effect.status_changed");
});

test("RuntimeStateMachine transitions budget ledger and reservation with version CAS", () => {
  const machine = createMachine();
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
  });

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

  assert.equal(ledgerResult.aggregate.status, "soft_cap_reached");
  assert.equal(ledgerResult.aggregate.version, 1);
  assert.equal(reservationResult.aggregate.status, "settled");
  assert.equal(reservationResult.event.eventType, "platform.budget_reservation.status_changed");
});

test("RuntimeStateMachine persists events on every transition", () => {
  clearPersistedEvents();
  const machine = createMachine();

  // Transition 1: HarnessRun admission
  const run = createHarnessRun({
    harnessRunId: "run-persist-test",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    traceId: "trace-persist-1",
    tenantId: "tenant-1",
    reasonCode: "admission_ok",
    emittedBy: "admission-controller",
    runVersionLockId: "rvlock-1",
    policyGuard: {
      allowed: true,
      policyProofRef: "policy-proof-1",
    },
    auditRef: "audit://run-persist-test/admission",
    occurredAt: "2026-04-27T00:00:00.000Z",
  });

  // Verify event was persisted
  assert.equal(persistedEvents.length, 1);
  assert.equal(persistedEvents[0].eventType, "platform.harness_run.status_changed");
  assert.equal(persistedEvents[0].aggregateId, "run-persist-test");

  // Transition 2: NodeRun running
  const nodeRun = createNodeRun({
    harnessRunId: "run-persist-test",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "leased",
    currentSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  machine.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "leased",
    toStatus: "running",
    expectedSeq: 0,
    leaseId: "lease-1",
    fencingToken: "fence-1",
    traceId: "trace-persist-2",
    tenantId: "tenant-1",
    reasonCode: "execution_start",
    emittedBy: "worker-1",
  });

  // Verify second event was persisted
  assert.equal(persistedEvents.length, 2);
  assert.equal(persistedEvents[1].eventType, "platform.node_run.status_changed");
  assert.equal(persistedEvents[1].aggregateId, nodeRun.nodeRunId);
});

test("RuntimeStateMachine throws when constructed without persistEvent callback", () => {
  const machineWithoutCallback = new RuntimeStateMachine();

  const run = createHarnessRun({
    harnessRunId: "run-no-callback",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });

  assert.throws(
    () =>
      machineWithoutCallback.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-no-callback",
        tenantId: "tenant-1",
        reasonCode: "admission_ok",
        emittedBy: "admission-controller",
        runVersionLockId: "rvlock-1",
        policyGuard: {
          allowed: true,
          policyProofRef: "policy-proof-1",
        },
        auditRef: "audit://run-no-callback/admission",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.persistence_required",
  );
});

/**
 * Unit Tests: Five-Plane Runtime State Machine
 *
 * Tests for the RuntimeStateMachine which handles state transitions for
 * HarnessRun, NodeRun, SideEffectRecord, BudgetLedger, and BudgetReservation aggregates.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStateMachine } from "../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";
import type {
  HarnessRun,
  HarnessRunStatus,
  NodeRun,
  NodeRunStatus,
  SideEffectRecord,
  SideEffectStatus,
  BudgetLedger,
  BudgetReservation,
} from "../../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMockHarnessRun(status: HarnessRunStatus = "created"): HarnessRun {
  return {
    harnessRunId: "harness-run-1",
    taskId: "task-1",
    divisionId: "division-1",
    status,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    admittedAt: null,
    planningAt: null,
    readyAt: null,
    runningAt: null,
    pausingAt: null,
    pausedAt: null,
    resumingAt: null,
    replanningAt: null,
    compensatingAt: null,
    completedAt: null,
    failedAt: null,
    abortedAt: null,
    terminalAt: null,
    terminalReason: null,
    runVersionLockId: null,
    leaseId: null,
    fencingToken: null,
    principal: "test-principal",
  };
}

function createMockNodeRun(status: NodeRunStatus = "created"): NodeRun {
  return {
    nodeRunId: "node-run-1",
    harnessRunId: "harness-run-1",
    stepId: "step-1",
    status,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readyAt: null,
    leasedAt: null,
    runningAt: null,
    retryWaitAt: null,
    awaitingHitlAt: null,
    reconcilingAt: null,
    succeededAt: null,
    failedAt: null,
    skippedAt: null,
    cancelledAt: null,
    dependencyFailedAt: null,
    policyBlockedAt: null,
    abortedAt: null,
    terminalAt: null,
    terminalReason: null,
    attemptNumber: 1,
    maxAttempts: 3,
    leaseId: null,
    fencingToken: null,
  };
}

function createMockSideEffectRecord(status: SideEffectStatus = "proposed"): SideEffectRecord {
  return {
    sideEffectId: "side-effect-1",
    harnessRunId: "harness-run-1",
    stepId: "step-1",
    status,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    riskClass: "medium",
    proposedAction: "Test action",
    proposedResource: "test-resource",
    idempotencyKey: null,
    leaseId: null,
    fencingToken: null,
  };
}

function createMockBudgetLedger(status: BudgetLedger["status"] = "open"): BudgetLedger {
  return {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    status,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    softCap: 1000,
    hardCap: 2000,
    totalAllocated: 0,
    totalCommitted: 0,
    totalSettled: 0,
    leaseId: null,
    fencingToken: null,
  };
}

function createMockBudgetReservation(status: BudgetReservation["status"] = "reserved"): BudgetReservation {
  return {
    budgetReservationId: "reservation-1",
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reservedAmount: 100,
    settledAmount: 0,
    releasedAmount: 0,
  };
}

function createBaseCommand(overrides: Partial<Parameters<RuntimeStateMachine["transition"]>[0]> = {}) {
  return {
    commandId: "cmd-1",
    entityType: "HarnessRun" as const,
    entityId: "entity-1",
    principal: "test-principal",
    aggregateType: "HarnessRun" as const,
    aggregate: createMockHarnessRun(),
    fromStatus: "created" as HarnessRunStatus,
    toStatus: "admitted" as HarnessRunStatus,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RuntimeStateMachine Constructor
// ---------------------------------------------------------------------------

test("RuntimeStateMachine can be instantiated", () => {
  const sm = new RuntimeStateMachine();
  assert.ok(sm instanceof RuntimeStateMachine);
});

// ---------------------------------------------------------------------------
// HarnessRun Transitions
// ---------------------------------------------------------------------------

test("HarnessRun valid transition: created -> admitted", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  const result = sm.transition(createBaseCommand({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    runVersionLockId: "lock-1",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit-1",
  }));

  assert.equal(result.aggregate.status, "admitted");
  assert.ok(result.event);
});

test("HarnessRun valid transition: running -> paused", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("running");

  const result = sm.transition(createBaseCommand({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "running",
    toStatus: "paused",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit-1",
  }));

  assert.equal(result.aggregate.status, "paused");
});

test("HarnessRun invalid transition: created -> running (missing admitted)", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "running",
      leaseId: "lease-1",
      fencingToken: "fence-1",
    })),
    WorkflowStateError,
  );
});

test("HarnessRun noop transition throws", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "created",
      runVersionLockId: "lock-1",
    })),
    WorkflowStateError,
  );
});

test("HarnessRun terminal state has no outgoing transitions", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("completed");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "completed",
      toStatus: "running",
    })),
    WorkflowStateError,
  );
});

test("HarnessRun admission requires runVersionLockId", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
    })),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// NodeRun Transitions
// ---------------------------------------------------------------------------

test("NodeRun valid transition: created -> ready", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("created");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "NodeRun",
    entityId: "node-1",
    principal: "test-principal",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "ready");
});

test("NodeRun valid transition: ready -> leased", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("ready");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "NodeRun",
    entityId: "node-1",
    principal: "test-principal",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "ready",
    toStatus: "leased",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "leased");
});

test("NodeRun valid transition: leased -> running", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("leased");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "NodeRun",
    entityId: "node-1",
    principal: "test-principal",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "leased",
    toStatus: "running",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "running");
});

test("NodeRun invalid transition: created -> running (skipping ready)", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("created");

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "NodeRun",
      entityId: "node-1",
      principal: "test-principal",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "created",
      toStatus: "running",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
    }),
    WorkflowStateError,
  );
});

test("NodeRun execution transition requires leaseId and fencingToken", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("leased");

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "NodeRun",
      entityId: "node-1",
      principal: "test-principal",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "leased",
      toStatus: "running",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
    }),
    WorkflowStateError,
  );
});

test("NodeRun terminal state has no outgoing transitions", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createMockNodeRun("succeeded");

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "NodeRun",
      entityId: "node-1",
      principal: "test-principal",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "succeeded",
      toStatus: "running",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
    }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// SideEffectRecord Transitions
// ---------------------------------------------------------------------------

test("SideEffectRecord valid transition: proposed -> approved", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createMockSideEffectRecord("proposed");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "SideEffectRecord",
    entityId: "se-1",
    principal: "test-principal",
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit-1",
    sideEffectSafety: {
      idempotencyKey: "key-1",
      preCommitPolicyProofRef: "proof-1",
    },
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord commit path requires preCommitPolicyProofRef", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createMockSideEffectRecord("approved");

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "SideEffectRecord",
      entityId: "se-1",
      principal: "test-principal",
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: "approved",
      toStatus: "committing",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
      leaseId: "lease-1",
      fencingToken: "fence-1",
    }),
    WorkflowStateError,
  );
});

test("SideEffectRecord high-risk requires humanApprovalRef for commit", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createMockSideEffectRecord("approved");
  sideEffect.riskClass = "high";

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "SideEffectRecord",
      entityId: "se-1",
      principal: "test-principal",
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: "approved",
      toStatus: "committing",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
      leaseId: "lease-1",
      fencingToken: "fence-1",
      sideEffectSafety: {
        idempotencyKey: "key-1",
        preCommitPolicyProofRef: "proof-1",
      },
    }),
    WorkflowStateError,
  );
});

test("SideEffectRecord critical-risk requires humanApprovalRef for commit", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createMockSideEffectRecord("approved");
  sideEffect.riskClass = "critical";

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "SideEffectRecord",
      entityId: "se-1",
      principal: "test-principal",
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: "approved",
      toStatus: "committing",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
      leaseId: "lease-1",
      fencingToken: "fence-1",
      sideEffectSafety: {
        idempotencyKey: "key-1",
        preCommitPolicyProofRef: "proof-1",
      },
    }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// BudgetLedger Transitions
// ---------------------------------------------------------------------------

test("BudgetLedger valid transition: open -> soft_cap_reached", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createMockBudgetLedger("open");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetLedger",
    entityId: "ledger-1",
    principal: "test-principal",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
});

test("BudgetLedger valid transition: soft_cap_reached -> hard_cap_reached", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createMockBudgetLedger("soft_cap_reached");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetLedger",
    entityId: "ledger-1",
    principal: "test-principal",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "soft_cap_reached",
    toStatus: "hard_cap_reached",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "hard_cap_reached");
});

test("BudgetLedger valid transition: open -> closed", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createMockBudgetLedger("open");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetLedger",
    entityId: "ledger-1",
    principal: "test-principal",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "closed",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
  });

  assert.equal(result.aggregate.status, "closed");
  assert.equal(result.aggregate.version, ledger.version + 1);
});

// ---------------------------------------------------------------------------
// BudgetReservation Transitions
// ---------------------------------------------------------------------------

test("BudgetReservation valid transition: reserved -> settled", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createMockBudgetReservation("reserved");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetReservation",
    entityId: "reservation-1",
    principal: "test-principal",
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "settled");
});

test("BudgetReservation valid transition: reserved -> released", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createMockBudgetReservation("reserved");

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetReservation",
    entityId: "reservation-1",
    principal: "test-principal",
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "released",
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "released");
});

test("BudgetReservation terminal state has no outgoing transitions", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createMockBudgetReservation("settled");

  assert.throws(
    () => sm.transition({
      commandId: "cmd-1",
      entityType: "BudgetReservation",
      entityId: "reservation-1",
      principal: "test-principal",
      aggregateType: "BudgetReservation",
      aggregate: reservation,
      fromStatus: "settled",
      toStatus: "released",
      traceId: "trace-1",
      tenantId: "tenant-1",
      reasonCode: "test",
      emittedBy: "test-emitter",
    }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// CAS (Compare-and-Swap) Validation
// ---------------------------------------------------------------------------

test("HarnessRun CAS validation with correct seq", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");
  harnessRun.currentSeq = 5;

  const result = sm.transition(createBaseCommand({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 5,
    runVersionLockId: "lock-1",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit-1",
  }));

  assert.equal(result.aggregate.status, "admitted");
});

test("HarnessRun CAS validation fails with incorrect seq", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");
  harnessRun.currentSeq = 5;

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      expectedSeq: 3,
      runVersionLockId: "lock-1",
    })),
    WorkflowStateError,
  );
});

test("BudgetLedger CAS validation with correct version", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createMockBudgetLedger("open");
  ledger.version = 10;

  const result = sm.transition({
    commandId: "cmd-1",
    entityType: "BudgetLedger",
    entityId: "ledger-1",
    principal: "test-principal",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 10,
    traceId: "trace-1",
    tenantId: "tenant-1",
    reasonCode: "test",
    emittedBy: "test-emitter",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
});

// ---------------------------------------------------------------------------
// Policy Guard Validation
// ---------------------------------------------------------------------------

test("HarnessRun transition with allowed policy guard", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  const result = sm.transition(createBaseCommand({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    runVersionLockId: "lock-1",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    policyGuard: {
      allowed: true,
      policyProofRef: "proof-1",
    },
    auditRef: "audit-1",
  }));

  assert.equal(result.aggregate.status, "admitted");
});

test("HarnessRun transition denied by policy guard", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      runVersionLockId: "lock-1",
      policyGuard: {
        allowed: false,
        policyProofRef: "proof-1",
      },
    })),
    WorkflowStateError,
  );
});

test("HarnessRun transition requires non-empty policyProofRef", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      runVersionLockId: "lock-1",
      policyGuard: {
        allowed: true,
        policyProofRef: "",
      },
    })),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Budget Precondition Validation
// ---------------------------------------------------------------------------

test("HarnessRun transition with satisfied budget precondition", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  const result = sm.transition(createBaseCommand({
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    runVersionLockId: "lock-1",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    budgetPrecondition: {
      reservationId: "res-1",
      hardCapSatisfied: true,
    },
    auditRef: "audit-1",
  }));

  assert.equal(result.aggregate.status, "admitted");
});

test("HarnessRun transition denied when budget hard cap not satisfied", () => {
  const sm = new RuntimeStateMachine();
  const harnessRun = createMockHarnessRun("created");

  assert.throws(
    () => sm.transition(createBaseCommand({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      runVersionLockId: "lock-1",
      budgetPrecondition: {
        reservationId: "res-1",
        hardCapSatisfied: false,
      },
    })),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// isTruthConsumerEvent Function
// ---------------------------------------------------------------------------

test("isTruthConsumerEvent returns true for platform events", () => {
  const isTruthConsumerEvent = (event: any) => event.eventType.startsWith("platform.");

  const event = {
    eventType: "platform.harness_run.status_changed",
    eventId: "evt-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    payload: {},
    occurredAt: new Date().toISOString(),
  };

  assert.equal(isTruthConsumerEvent(event), true);
});

test("isTruthConsumerEvent returns false for non-platform events", () => {
  const isTruthConsumerEvent = (event: any) => event.eventType.startsWith("platform.");

  const event = {
    eventType: "external.payment.processed",
    eventId: "evt-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    payload: {},
    occurredAt: new Date().toISOString(),
  };

  assert.equal(isTruthConsumerEvent(event), false);
});

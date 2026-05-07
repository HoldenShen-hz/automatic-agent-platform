/**
 * Runtime State Machine Unit Tests
 *
 * Tests state transitions, budget checking, lease/fencing, and policy guards
 * for HarnessRun, NodeRun, SideEffectRecord, BudgetLedger, and BudgetReservation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import type {
  HarnessRun,
  NodeRun,
  SideEffectRecord,
  BudgetLedger,
  BudgetReservation,
  HarnessRunStatus,
  NodeRunStatus,
  SideEffectStatus,
  ArtifactRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createTestLeaseId() {
  return newId("lease");
}

function createTestFencingToken() {
  return newId("fence");
}

function createTestHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    harnessRunId: newId("hrun"),
    tenantId: "test_tenant",
    principalId: "test_principal",
    domainId: "test_domain",
    planGraphBundleId: newId("pgb"),
    status: "created",
    currentSeq: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestNodeRun(overrides: Partial<NodeRun> = {}): NodeRun {
  return {
    nodeRunId: newId("nrun"),
    harnessRunId: newId("hrun"),
    planGraphBundleId: newId("pgb"),
    graphVersion: 1,
    nodeId: "node_1",
    status: "created",
    attemptCount: 0,
    currentSeq: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestSideEffectRecord(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    sideEffectId: newId("se"),
    harnessRunId: newId("hrun"),
    nodeRunId: newId("nrun"),
    nodeAttemptId: newId("na"),
    effectKind: "external_api",
    idempotencyKey: newId("idem"),
    status: "proposed",
    riskClass: "medium",
    preCommitPolicyProofRef: { artifactId: newId("art"), uri: "policy://proof" },
    deadline: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestBudgetLedger(overrides: Partial<BudgetLedger> = {}): BudgetLedger {
  return {
    budgetLedgerId: newId("bledger"),
    tenantId: "test_tenant",
    harnessRunId: newId("hrun"),
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
    ...overrides,
  };
}

function createTestBudgetReservation(overrides: Partial<BudgetReservation> = {}): BudgetReservation {
  return {
    budgetReservationId: newId("bres"),
    budgetLedgerId: newId("bledger"),
    harnessRunId: newId("hrun"),
    nodeRunId: newId("nrun"),
    amount: 100,
    resourceKind: "token",
    status: "reserved",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: HarnessRun Transitions
// ---------------------------------------------------------------------------

test("HarnessRun valid transition: created -> admitted", () => {
  const sm = new RuntimeStateMachine();
  const run = createTestHarnessRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: run.harnessRunId,
    principal: "test_operator",
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    tenantId: run.tenantId,
    traceId: newId("trace"),
    reasonCode: "test.admission",
    emittedBy: "test",
    runVersionLockId: newId("rvl"),
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.aggregate.currentSeq, 1);
  assert.ok(result.event);
  assert.ok(result.event.eventType.includes("harness_run"));
});

test("HarnessRun invalid transition: created -> completed (no path)", () => {
  const sm = new RuntimeStateMachine();
  const run = createTestHarnessRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "test_operator",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "completed",
        tenantId: run.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("HarnessRun valid transition: running -> completed (terminal)", () => {
  const sm = new RuntimeStateMachine();
  const run = createTestHarnessRun({ status: "running" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: run.harnessRunId,
    principal: "test_operator",
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "running",
    toStatus: "completed",
    tenantId: run.tenantId,
    traceId: newId("trace"),
    reasonCode: "test.completed",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "completed");
  assert.ok(result.aggregate.terminalAt);
  assert.equal(result.aggregate.terminalReason, "test.completed");
});

test("HarnessRun admission requires runVersionLockId", () => {
  const sm = new RuntimeStateMachine();
  const run = createTestHarnessRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "test_operator",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: run.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        // runVersionLockId intentionally omitted
        leaseId,
        fencingToken,
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: NodeRun Transitions
// ---------------------------------------------------------------------------

test("NodeRun valid transition: created -> ready", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "test_operator",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "ready");
  assert.equal(result.aggregate.currentSeq, 1);
});

test("NodeRun valid transition: ready -> leased", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "ready" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "test_operator",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "ready",
    toStatus: "leased",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "leased");
  assert.equal(result.aggregate.leaseId, leaseId);
  assert.equal(result.aggregate.fencingToken, fencingToken);
});

test("NodeRun valid transition: leased -> running", () => {
  const sm = new RuntimeStateMachine();
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();
  const nodeRun = createTestNodeRun({ status: "leased", leaseId, fencingToken });

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "test_operator",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "leased",
    toStatus: "running",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "running");
});

test("NodeRun invalid transition: created -> running (skip intermediate)", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "running",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("NodeRun execution transition requires lease and fencing", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "ready" });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "ready",
        toStatus: "leased",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        // leaseId and fencingToken intentionally omitted
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("NodeRun lease mismatch", () => {
  const sm = new RuntimeStateMachine();
  const oldLeaseId = createTestLeaseId();
  const nodeRun = createTestNodeRun({ status: "running", leaseId: oldLeaseId, fencingToken: createTestFencingToken() });
  const newLeaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId: newLeaseId, // different from existing
        fencingToken,
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: SideEffectRecord Transitions
// ---------------------------------------------------------------------------

test("SideEffectRecord valid transition: proposed -> approved", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "proposed" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "SideEffectRecord",
    entityId: sideEffect.sideEffectId,
    principal: "test_operator",
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    sideEffectSafety: {
      idempotencyKey: sideEffect.idempotencyKey,
      preCommitPolicyProofRef: "policy://proof",
    },
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord commit path requires preCommitPolicyProofRef", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "proposed" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "SideEffectRecord",
        entityId: sideEffect.sideEffectId,
        principal: "test_operator",
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        // sideEffectSafety intentionally omitted preCommitPolicyProofRef
        sideEffectSafety: {
          idempotencyKey: sideEffect.idempotencyKey,
        },
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord high risk requires human approval for commit", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "proposed", riskClass: "high" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "SideEffectRecord",
        entityId: sideEffect.sideEffectId,
        principal: "test_operator",
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        sideEffectSafety: {
          idempotencyKey: sideEffect.idempotencyKey,
          preCommitPolicyProofRef: "policy://proof",
          // humanApprovalRef intentionally omitted for high risk
        },
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord commit path with human approval succeeds", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "proposed", riskClass: "high" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "SideEffectRecord",
    entityId: sideEffect.sideEffectId,
    principal: "test_operator",
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    sideEffectSafety: {
      idempotencyKey: sideEffect.idempotencyKey,
      preCommitPolicyProofRef: "policy://proof",
      humanApprovalRef: "human://approval/123",
    },
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord valid transition: committed -> confirmed", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "committed" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "SideEffectRecord",
    entityId: sideEffect.sideEffectId,
    principal: "test_operator",
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committed",
    toStatus: "confirmed",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    sideEffectSafety: {
      idempotencyKey: sideEffect.idempotencyKey,
      preCommitPolicyProofRef: "policy://proof",
    },
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "confirmed");
});

// ---------------------------------------------------------------------------
// Tests: BudgetLedger Transitions
// ---------------------------------------------------------------------------

test("BudgetLedger valid transition: open -> soft_cap_reached", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createTestBudgetLedger({ status: "open" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: ledger.budgetLedgerId,
    principal: "test_operator",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    tenantId: ledger.tenantId,
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
  assert.equal(result.aggregate.version, 1);
});

test("BudgetLedger valid transition: soft_cap_reached -> hard_cap_reached", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createTestBudgetLedger({ status: "soft_cap_reached" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: ledger.budgetLedgerId,
    principal: "test_operator",
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "soft_cap_reached",
    toStatus: "hard_cap_reached",
    tenantId: ledger.tenantId,
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "hard_cap_reached");
});

test("BudgetLedger invalid transition: open -> hard_cap_reached (skip soft)", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createTestBudgetLedger({ status: "open" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        principal: "test_operator",
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "hard_cap_reached",
        tenantId: ledger.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("BudgetLedger budget-modifying transition requires lease and fencing", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createTestBudgetLedger({ status: "open" });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        principal: "test_operator",
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        tenantId: ledger.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        // leaseId and fencingToken intentionally omitted
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: BudgetReservation Transitions
// ---------------------------------------------------------------------------

test("BudgetReservation valid transition: reserved -> settled", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createTestBudgetReservation({ status: "reserved" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetReservation",
    entityId: reservation.budgetReservationId,
    principal: "test_operator",
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    budgetPrecondition: {
      reservationId: reservation.budgetReservationId,
      hardCapSatisfied: true,
    },
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "settled");
});

test("BudgetReservation valid transition: reserved -> released", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createTestBudgetReservation({ status: "reserved" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetReservation",
    entityId: reservation.budgetReservationId,
    principal: "test_operator",
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "released",
    tenantId: "test_tenant",
    traceId: newId("trace"),
    reasonCode: "test.released",
    emittedBy: "test",
    leaseId,
    fencingToken,
    auditRef: "audit://test",
  });

  assert.equal(result.aggregate.status, "released");
});

test("BudgetReservation invalid transition: reserved -> completed (no path)", () => {
  const sm = new RuntimeStateMachine();
  const reservation = createTestBudgetReservation({ status: "reserved" });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetReservation",
        entityId: reservation.budgetReservationId,
        principal: "test_operator",
        aggregateType: "BudgetReservation",
        aggregate: reservation,
        fromStatus: "reserved",
        toStatus: "settled",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        // budgetPrecondition.hardCapSatisfied = false should fail
        budgetPrecondition: {
          reservationId: reservation.budgetReservationId,
          hardCapSatisfied: false,
        },
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: Policy Guard
// ---------------------------------------------------------------------------

test("transition fails when policyGuard.allowed is false", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        policyGuard: {
          allowed: false,
          policyProofRef: "policy://denied",
        },
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("transition fails when policyGuard.policyProofRef is empty", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        policyGuard: {
          allowed: true,
          policyProofRef: "", // empty proof ref
        },
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: CAS (Compare-and-Swap)
// ---------------------------------------------------------------------------

test("transition fails when expectedSeq does not match", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created", currentSeq: 5 });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        expectedSeq: 3, // does not match currentSeq of 5
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

test("transition fails when expectedVersion does not match", () => {
  const sm = new RuntimeStateMachine();
  const ledger = createTestBudgetLedger({ status: "open", version: 10 });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        principal: "test_operator",
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        tenantId: ledger.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        expectedVersion: 5, // does not match version of 10
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: Audit Ref Requirement
// ---------------------------------------------------------------------------

test("HarnessRun transition requires auditRef", () => {
  const sm = new RuntimeStateMachine();
  const run = createTestHarnessRun({ status: "created" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "test_operator",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: run.tenantId,
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        runVersionLockId: newId("rvl"),
        leaseId,
        fencingToken,
        // auditRef intentionally omitted
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord transition requires auditRef", () => {
  const sm = new RuntimeStateMachine();
  const sideEffect = createTestSideEffectRecord({ status: "proposed" });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "SideEffectRecord",
        entityId: sideEffect.sideEffectId,
        principal: "test_operator",
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "proposed",
        toStatus: "approved",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        sideEffectSafety: {
          idempotencyKey: sideEffect.idempotencyKey,
          preCommitPolicyProofRef: "policy://proof",
        },
        // auditRef intentionally omitted
      }),
    WorkflowStateError,
  );
});

test("transition to succeeded status requires auditRef", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "running", leaseId: createTestLeaseId(), fencingToken: createTestFencingToken() });
  const leaseId = createTestLeaseId();
  const fencingToken = createTestFencingToken();

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "succeeded",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId,
        fencingToken,
        // auditRef intentionally omitted
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: No-op Transition
// ---------------------------------------------------------------------------

test("no-op transition (same from/to status) is denied", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "created" });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "created", // same as fromStatus
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Tests: Status Mismatch Detection
// ---------------------------------------------------------------------------

test("transition fails when aggregate status does not match fromStatus", () => {
  const sm = new RuntimeStateMachine();
  const nodeRun = createTestNodeRun({ status: "running" }); // actual status is "running"

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "test_operator",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created", // claims status is "created" but it's "running"
        toStatus: "ready",
        tenantId: "test_tenant",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        auditRef: "audit://test",
      }),
    WorkflowStateError,
  );
});
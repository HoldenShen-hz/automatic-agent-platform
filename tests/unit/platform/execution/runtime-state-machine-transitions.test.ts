import assert from "node:assert/strict";
import test from "node:test";

import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
  createSideEffectRecord,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

function createMachine() {
  return new RuntimeStateMachine({ persistEvent: () => {} });
}

test("RuntimeStateMachine allows HarnessRun admission with version lock, fencing, and audit [runtime-state-machine-transitions]", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-transition-admit",
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
    reasonCode: "test.admitted",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
    auditRef: "audit://runtime/admit",
  });

  assert.equal(result.aggregate.status, "admitted");
});

test("RuntimeStateMachine allows NodeRun execution transitions with lease, fencing, and audit [runtime-state-machine-transitions]", () => {
  const machine = createMachine();
  const readyNode = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 0,
  });

  const leased = machine.transition({
    aggregateType: "NodeRun",
    aggregate: readyNode,
    fromStatus: "ready",
    toStatus: "leased",
    expectedSeq: 0,
    traceId: "trace-2",
    tenantId: "tenant-1",
    reasonCode: "node.leased",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: readyNode.fencingToken,
    auditRef: "audit://runtime/leased",
  });
  const running = machine.transition({
    aggregateType: "NodeRun",
    aggregate: leased.aggregate,
    fromStatus: "leased",
    toStatus: "running",
    expectedSeq: 1,
    traceId: "trace-3",
    tenantId: "tenant-1",
    reasonCode: "node.running",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: readyNode.fencingToken,
    auditRef: "audit://runtime/running",
  });

  assert.equal(running.aggregate.status, "running");
});

test("RuntimeStateMachine allows SideEffectRecord commit path when current safety proofs are present [runtime-state-machine-transitions]", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "se-1",
    harnessRunId: "run-1",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "http_mutation",
    status: "approved",
    riskClass: "critical",
    idempotencyKey: "idem-se-1",
    preCommitPolicyProofRef: "policy://record",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    deadline: new Date(Date.now() + 60_000).toISOString(),
  });

  const result = machine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "approved",
    toStatus: "committing",
    traceId: "trace-4",
    tenantId: "tenant-1",
    reasonCode: "side_effect.commit",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit://runtime/side-effect",
    sideEffectSafety: {
      preCommitPolicyProofRef: "policy://proof",
      humanApprovalRef: "approval://human",
      idempotencyKey: sideEffect.idempotencyKey,
    },
  });

  assert.equal(result.aggregate.status, "committing");
});

test("RuntimeStateMachine allows BudgetLedger and BudgetReservation transitions with current guards [runtime-state-machine-transitions]", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 1,
  });
  const ledgerResult = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 1,
    traceId: "trace-5",
    tenantId: "tenant-1",
    reasonCode: "budget.soft_cap",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit://runtime/ledger",
  });
  const reservation = createBudgetReservation({
    budgetReservationId: "reservation-1",
    budgetLedgerId: ledger.budgetLedgerId,
    harnessRunId: "run-1",
    nodeRunId: "node-1",
    amount: 10,
    resourceKind: "token",
    status: "reserved",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const reservationResult = machine.transition({
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    traceId: "trace-6",
    tenantId: "tenant-1",
    reasonCode: "budget.settled",
    emittedBy: "test",
    auditRef: "audit://runtime/reservation",
    budgetPrecondition: {
      reservationId: reservation.budgetReservationId,
      hardCapSatisfied: true,
    },
  });

  assert.equal(ledgerResult.aggregate.status, "soft_cap_reached");
  assert.equal(reservationResult.aggregate.status, "settled");
});

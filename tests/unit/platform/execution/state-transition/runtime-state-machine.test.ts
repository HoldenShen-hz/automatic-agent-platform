import assert from "node:assert/strict";
import test from "node:test";

import {
  createBudgetLedger,
  createHarnessRun,
  createNodeRun,
  createSideEffectRecord,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../../src/platform/five-plane-execution/runtime-state-machine.js";

function createMachine() {
  return new RuntimeStateMachine({ persistEvent: () => {} });
}

test("RuntimeStateMachine validates a canonical HarnessRun transition", () => {
  const machine = createMachine();
  const run = createHarnessRun({
    harnessRunId: "run-state-transition",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "created",
    currentSeq: 0,
  });

  const result = machine.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    traceId: "trace-state-1",
    tenantId: "tenant-1",
    reasonCode: "harness.admitted",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    runVersionLockId: "rvlock-1",
    policyGuard: { allowed: true, policyProofRef: "policy-proof-1" },
    auditRef: "audit://state-transition/admitted",
  });

  assert.equal(result.aggregate.status, "admitted");
});

test("RuntimeStateMachine requires lease, fencing, and audit for NodeRun execution transitions", () => {
  const machine = createMachine();
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
    currentSeq: 0,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "ready",
        toStatus: "leased",
        expectedSeq: 0,
        traceId: "trace-state-2",
        tenantId: "tenant-1",
        reasonCode: "node.leased",
        emittedBy: "test",
        auditRef: "audit://state-transition/node",
      }),
    /active lease and fencing token\./,
  );
});

test("RuntimeStateMachine rejects budget transitions when hard-cap preconditions are not satisfied", () => {
  const machine = createMachine();
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-state",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "hard_cap_reached",
        expectedVersion: 0,
        traceId: "trace-state-3",
        tenantId: "tenant-1",
        reasonCode: "budget.hard_cap",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://state-transition/budget",
        budgetPrecondition: {
          reservationId: "reservation-1",
          hardCapSatisfied: false,
        },
      }),
    /Budget precondition failed for the transition\./,
  );
});

test("RuntimeStateMachine requires pre-commit policy proof refs for commit-affecting side effects", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "se-state-proof",
    harnessRunId: "run-1",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "http_mutation",
    status: "approved",
    riskClass: "medium",
    idempotencyKey: "idem-state-proof",
    preCommitPolicyProofRef: "policy://record",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    deadline: new Date(Date.now() + 60_000).toISOString(),
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "approved",
        toStatus: "committing",
        traceId: "trace-state-4",
        tenantId: "tenant-1",
        reasonCode: "side_effect.commit",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://state-transition/side-effect",
        sideEffectSafety: {
          idempotencyKey: sideEffect.idempotencyKey,
        },
      }),
    /pre-commit policy proof ref\./,
  );
});

test("RuntimeStateMachine requires human approval refs for high-risk side effects", () => {
  const machine = createMachine();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "se-state-human",
    harnessRunId: "run-1",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "http_mutation",
    status: "approved",
    riskClass: "critical",
    idempotencyKey: "idem-state-human",
    preCommitPolicyProofRef: "policy://record",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    deadline: new Date(Date.now() + 60_000).toISOString(),
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "approved",
        toStatus: "committing",
        traceId: "trace-state-5",
        tenantId: "tenant-1",
        reasonCode: "side_effect.commit",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://state-transition/critical-side-effect",
        sideEffectSafety: {
          preCommitPolicyProofRef: "policy://proof",
          idempotencyKey: sideEffect.idempotencyKey,
        },
      }),
    /human approval ref\./,
  );
});

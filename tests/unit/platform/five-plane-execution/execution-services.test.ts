import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetLedger, createHarnessRun, createNodeRun } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { BudgetAllocator, BudgetTier, type BudgetAllocatorContext } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import { RuntimeStateMachine, isTruthConsumerEvent } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

function createHarnessAggregate() {
  return createHarnessRun({
    harnessRunId: "harness-1",
    tenantId: "tenant-1",
    orgId: "org-1",
    traceId: "trace-1",
    riskLevel: "medium",
    riskProfile: { riskClass: "medium", reasons: ["unit-test"] },
    ownership: { ownerId: "tenant-1", ownerType: "tenant" },
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    domainId: "general-ops",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "general-ops:default",
    versionLockId: "vlock-1",
    budgetLedgerId: "ledger-1",
    budgetEnvelope: { budgetLedgerId: "ledger-1", currency: "USD", maxCost: 100 },
    currentSeq: 1,
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z",
    fencingToken: "fence-harness-1",
  });
}

function createNodeAggregate() {
  return createNodeRun({
    harnessRunId: "harness-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    nodeId: "node-1",
    nodeRunId: "node-run-1",
    status: "leased",
    attemptCount: 0,
    sideEffects: [],
    compensation: [],
    leaseId: "lease-1",
    fencingToken: "fence-node-1",
    currentSeq: 2,
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z",
  });
}

function createLedger() {
  return createBudgetLedger({
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "harness-1",
    currency: "USD",
    hardCap: 1_000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
  });
}

function createBudgetContext(overrides: Partial<BudgetAllocatorContext> = {}): BudgetAllocatorContext {
  return {
    tenantId: "tenant-1",
    traceId: newId("trace"),
    emittedBy: "test",
    principal: "tester",
    fencingToken: "fence-budget-1",
    tier: BudgetTier.STEP,
    tierLimit: 1_000,
    ...overrides,
  };
}

test("RuntimeStateMachine transitions a canonical HarnessRun aggregate and emits a fact event", () => {
  const stateMachine = new RuntimeStateMachine();
  const aggregate = createHarnessAggregate();

  const result = stateMachine.transition({
    commandId: "cmd-1",
    entityType: "HarnessRun",
    entityId: aggregate.harnessRunId,
    principal: "system",
    aggregateType: "HarnessRun",
    aggregate,
    fromStatus: "created",
    toStatus: "admitted",
    tenantId: aggregate.tenantId,
    traceId: aggregate.traceId,
    reasonCode: "test.admitted",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: aggregate.fencingToken,
    runVersionLockId: aggregate.versionLockId,
    auditRef: "audit://runtime/harness",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.aggregate.currentSeq, 2);
  assert.equal(isTruthConsumerEvent(result.event), true);
});

test("RuntimeStateMachine enforces lease and fencing for execution-bound NodeRun transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const aggregate = createNodeAggregate();

  assert.throws(
    () => stateMachine.transition({
      commandId: "cmd-node-1",
      entityType: "NodeRun",
      entityId: aggregate.nodeRunId,
      principal: "system",
      aggregateType: "NodeRun",
      aggregate,
      fromStatus: "leased",
      toStatus: "running",
      tenantId: "tenant-1",
      traceId: "trace-1",
      reasonCode: "test.running",
      emittedBy: "test",
      auditRef: "audit://runtime/node",
    }),
    /lease/i,
  );
});

test("BudgetAllocator reserves, settles, and releases budget through the current API", async () => {
  const allocator = new BudgetAllocator();
  const ledger = createLedger();

  const reserved = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createBudgetContext(),
  });

  assert.equal(reserved.reservation.status, "reserved");
  assert.equal(reserved.ledger.reservedAmount, 100);

  const settled = await Promise.resolve(allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 60,
    context: createBudgetContext(),
  }));

  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.settledAmount, 60);
  assert.equal(settled.ledger.releasedAmount, 40);

  const releasedReservation = allocator.reserve({
    ledger: settled.ledger,
    amount: 25,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: settled.ledger.version,
    context: createBudgetContext(),
  });
  const released = await Promise.resolve(allocator.release({
    ledger: releasedReservation.ledger,
    reservation: releasedReservation.reservation,
    context: createBudgetContext(),
  }));

  assert.equal(released.reservation.aggregate.status, "released");
  assert.equal(released.ledger.releasedAmount, 65);
});

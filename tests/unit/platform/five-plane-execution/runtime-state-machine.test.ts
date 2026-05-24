import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { RuntimeStateMachine, isTruthConsumerEvent } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

function createHarnessAggregate() {
  return createHarnessRun({
    harnessRunId: newId("hrun"),
    tenantId: "tenant-test",
    orgId: "org-test",
    traceId: newId("trace"),
    riskLevel: "medium",
    riskProfile: { riskClass: "medium", reasons: ["unit-test"] },
    ownership: { ownerId: "tenant-test", ownerType: "tenant" },
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    domainId: "general_ops",
    confirmedTaskSpecId: newId("ctspec"),
    requestEnvelopeId: newId("request"),
    requestHash: newId("reqhash"),
    constraintPackRef: "general_ops:default",
    versionLockId: newId("vlock"),
    budgetLedgerId: newId("bledger"),
    budgetEnvelope: { budgetLedgerId: newId("bledger"), currency: "USD", maxCost: 100 },
    status: "created",
    currentSeq: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fencingToken: newId("fence"),
  });
}

test("RuntimeStateMachine transitions HarnessRun admission with a runVersionLockId", () => {
  const machine = new RuntimeStateMachine({
    persistEvent: () => {},
  });
  const aggregate = createHarnessAggregate();

  const result = machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: aggregate.harnessRunId,
    principal: "tester",
    aggregateType: "HarnessRun",
    aggregate,
    fromStatus: "created",
    toStatus: "admitted",
    tenantId: aggregate.tenantId,
    traceId: aggregate.traceId,
    reasonCode: "test.admitted",
    emittedBy: "test",
    runVersionLockId: aggregate.versionLockId,
    leaseId: "lease-1",
    fencingToken: aggregate.fencingToken,
    auditRef: "audit://runtime/harness",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.aggregate.currentSeq, 1);
  assert.equal(isTruthConsumerEvent(result.event), true);
});

test("RuntimeStateMachine rejects invalid HarnessRun transitions", () => {
  const machine = new RuntimeStateMachine({
    persistEvent: () => {},
  });

  assert.throws(
    () => machine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: "hrun-invalid",
      principal: "tester",
      aggregateType: "HarnessRun",
      aggregate: createHarnessAggregate(),
      fromStatus: "created",
      toStatus: "completed",
      tenantId: "tenant-test",
      traceId: newId("trace"),
      reasonCode: "test.invalid",
      emittedBy: "test",
      leaseId: "lease-1",
      fencingToken: "fence-1",
      auditRef: "audit://runtime/invalid",
    }),
    WorkflowStateError,
  );
});

test("RuntimeStateMachine transitions NodeRun and BudgetReservation with canonical aggregates", () => {
  const machine = new RuntimeStateMachine({
    persistEvent: () => {},
  });
  const nodeRun = createNodeRun({
    harnessRunId: "harness-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    nodeId: "node-1",
    nodeRunId: "nrun-1",
    status: "created",
    attemptCount: 0,
    sideEffects: [],
    compensation: [],
    currentSeq: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fencingToken: "fence-node-1",
  });
  const readyNode = machine.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "tester",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-test",
    traceId: newId("trace"),
    reasonCode: "test.ready",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-node-1",
    auditRef: "audit://runtime/node",
  });
  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-1",
    tenantId: "tenant-test",
    harnessRunId: "harness-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
  });
  const reservation = createBudgetReservation({
    budgetReservationId: "bres-1",
    budgetLedgerId: ledger.budgetLedgerId,
    harnessRunId: "harness-1",
    nodeRunId: readyNode.aggregate.nodeRunId,
    amount: 10,
    resourceKind: "token",
    status: "reserved",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const settled = machine.transition({
    commandId: newId("cmd"),
    entityType: "BudgetReservation",
    entityId: reservation.budgetReservationId,
    principal: "tester",
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    tenantId: "tenant-test",
    traceId: newId("trace"),
    reasonCode: "test.settled",
    emittedBy: "test",
    auditRef: "audit://runtime/budget",
    budgetPrecondition: {
      reservationId: reservation.budgetReservationId,
      hardCapSatisfied: true,
    },
  });

  assert.equal(readyNode.aggregate.status, "ready");
  assert.equal(settled.aggregate.status, "settled");
});

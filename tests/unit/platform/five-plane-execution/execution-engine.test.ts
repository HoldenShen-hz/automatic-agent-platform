import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStateMachine, isTruthConsumerEvent } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeRun,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

test("RuntimeStateMachine produces truth consumer events for budget ledger transitions", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-exec",
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

  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 1,
    traceId: "trace-exec-1",
    tenantId: "tenant-1",
    reasonCode: "budget.soft_cap",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit://execution/ledger",
  });

  assert.equal(isTruthConsumerEvent(result.event), true);
  assert.equal(result.event.eventType, "platform.budget_ledger.status_changed");
});

test("RuntimeStateMachine rejects NodeRun running transitions without the active lease", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "leased",
    currentSeq: 1,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "leased",
        toStatus: "running",
        expectedSeq: 1,
        traceId: "trace-exec-2",
        tenantId: "tenant-1",
        reasonCode: "node.running",
        emittedBy: "test",
        auditRef: "audit://execution/node-running",
      }),
    /active lease and fencing token\./,
  );
});

test("RuntimeStateMachine increments BudgetLedger version on success", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-version",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 5,
  });

  const result = machine.transition({
    aggregateType: "BudgetLedger",
    aggregate: ledger,
    fromStatus: "open",
    toStatus: "hard_cap_reached",
    expectedVersion: 5,
    traceId: "trace-exec-3",
    tenantId: "tenant-1",
    reasonCode: "budget.hard_cap",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    auditRef: "audit://execution/ledger-version",
  });

  assert.equal(result.aggregate.version, 6);
});

test("RuntimeStateMachine settles BudgetReservations when hard-cap preconditions are satisfied", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const reservation = createBudgetReservation({
    budgetReservationId: "reservation-exec",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: "node-1",
    amount: 10,
    resourceKind: "token",
    status: "reserved",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const result = machine.transition({
    aggregateType: "BudgetReservation",
    aggregate: reservation,
    fromStatus: "reserved",
    toStatus: "settled",
    traceId: "trace-exec-4",
    tenantId: "tenant-1",
    reasonCode: "budget.settled",
    emittedBy: "test",
    auditRef: "audit://execution/reservation",
    budgetPrecondition: {
      reservationId: reservation.budgetReservationId,
      hardCapSatisfied: true,
    },
  });

  assert.equal(result.aggregate.status, "settled");
});

test("RuntimeStateMachine enforces CAS and run-version-lock guards in execution flows", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => {} });
  const ledger = createBudgetLedger({
    budgetLedgerId: "ledger-cas",
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    currency: "USD",
    hardCap: 100,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 2,
  });
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        expectedVersion: 1,
        traceId: "trace-exec-5",
        tenantId: "tenant-1",
        reasonCode: "budget.soft_cap",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://execution/cas",
      }),
    /Version CAS failed for BudgetLedger: expected version 1/,
  );

  const harnessRun = createHarnessRun({
    harnessRunId: "run-lock",
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
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        expectedSeq: 0,
        traceId: "trace-exec-6",
        tenantId: "tenant-1",
        reasonCode: "harness.admitted",
        emittedBy: "test",
        leaseId: "lease-1",
        fencingToken: "fence-1",
        auditRef: "audit://execution/run-lock",
      }),
    /HarnessRun admission requires a runVersionLockId\./,
  );
});

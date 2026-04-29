import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStateMachine, isTruthConsumerEvent } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { createBudgetLedger, createBudgetReservation } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

test("RuntimeStateMachine produces truth consumer event", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetLedger({
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    hardCap: 100,
    status: "open",
    version: 1,
  });

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: aggregate.budgetLedgerId,
    principal: "system",
    aggregateType: "BudgetLedger",
    aggregate,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "budget.soft_cap",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
  });

  assert.ok(isTruthConsumerEvent(result.event));
  assert.equal(result.event.eventType, "platform.budget_ledger.status_changed");
  assert.equal(result.event.aggregateType, "BudgetLedger");
});

test("RuntimeStateMachine harness run transitions are valid", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = {
    harnessRunId: newId("harness"),
    tenantId: "tenant_1",
    status: "created" as const,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Test created -> admitted
  const r1 = sm.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: aggregate.harnessRunId,
    principal: "system",
    aggregateType: "HarnessRun",
    aggregate,
    fromStatus: "created",
    toStatus: "admitted",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
    runVersionLockId: "lock_1",
    auditRef: "audit://test",
  });
  assert.equal(r1.aggregate.status, "admitted");

  // Test admitted -> planning
  const r2 = sm.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: aggregate.harnessRunId,
    principal: "system",
    aggregateType: "HarnessRun",
    aggregate: r1.aggregate,
    fromStatus: "admitted",
    toStatus: "planning",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
    auditRef: "audit://test",
  });
  assert.equal(r2.aggregate.status, "planning");
});

test("RuntimeStateMachine node run transitions enforce lease", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = {
    nodeRunId: newId("node"),
    tenantId: "tenant_1",
    status: "created" as const,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // created -> ready (no lease required)
  const r1 = sm.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: aggregate.nodeRunId,
    principal: "system",
    aggregateType: "NodeRun",
    aggregate,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
  });
  assert.equal(r1.aggregate.status, "ready");

  // ready -> leased (lease required)
  const r2 = sm.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun",
    entityId: aggregate.nodeRunId,
    principal: "system",
    aggregateType: "NodeRun",
    aggregate: r1.aggregate,
    fromStatus: "ready",
    toStatus: "leased",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
  });
  assert.equal(r2.aggregate.status, "leased");
});

test("RuntimeStateMachine node run fails without lease for running", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = {
    nodeRunId: newId("node"),
    tenantId: "tenant_1",
    status: "leased" as const,
    currentSeq: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    leaseId: "lease_1",
    fencingToken: "fence_1",
  };

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: aggregate.nodeRunId,
        principal: "system",
        aggregateType: "NodeRun",
        aggregate,
        fromStatus: "leased",
        toStatus: "running",
        tenantId: "tenant_1",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
      }),
    (error: any) => error.message.includes("lease"),
  );
});

test("RuntimeStateMachine budget ledger version increments on transition", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetLedger({
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    hardCap: 100,
    status: "open",
    version: 5,
  });

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: aggregate.budgetLedgerId,
    principal: "system",
    aggregateType: "BudgetLedger",
    aggregate,
    fromStatus: "open",
    toStatus: "hard_cap_reached",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "budget.hard_cap",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
  });

  assert.equal(result.aggregate.version, 6);
});

test("RuntimeStateMachine budget reservation valid transitions", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetReservation({
    budgetReservationId: newId("res"),
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    amount: 50,
    resourceKind: "compute",
    status: "reserved",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nodeRunId: null,
  });

  // reserved -> settled
  const r1 = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetReservation",
    entityId: aggregate.budgetReservationId,
    principal: "system",
    aggregateType: "BudgetReservation",
    aggregate,
    fromStatus: "reserved",
    toStatus: "settled",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "budget.settled",
    emittedBy: "test",
    budgetPrecondition: { reservationId: aggregate.budgetReservationId, hardCapSatisfied: true },
  });
  assert.equal(r1.aggregate.status, "settled");
});

test("RuntimeStateMachine budget reservation rejects invalid transition", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetReservation({
    budgetReservationId: newId("res"),
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    amount: 50,
    resourceKind: "compute",
    status: "reserved",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nodeRunId: null,
  });

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetReservation",
        entityId: aggregate.budgetReservationId,
        principal: "system",
        aggregateType: "BudgetReservation",
        aggregate,
        fromStatus: "reserved",
        toStatus: "completed" as any,
        tenantId: "tenant_1",
        traceId: newId("trace"),
        reasonCode: "budget.settled",
        emittedBy: "test",
      }),
    (error: any) => error.message.includes("Invalid"),
  );
});

test("RuntimeStateMachine CAS version check works", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetLedger({
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    hardCap: 100,
    status: "open",
    version: 5,
  });

  // Wrong version should fail
  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: aggregate.budgetLedgerId,
        principal: "system",
        aggregateType: "BudgetLedger",
        aggregate,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        tenantId: "tenant_1",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        expectedVersion: 3,
      }),
    (error: any) => error.message.includes("Version"),
  );

  // Correct version should succeed
  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: aggregate.budgetLedgerId,
    principal: "system",
    aggregateType: "BudgetLedger",
    aggregate,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    tenantId: "tenant_1",
    traceId: newId("trace"),
    reasonCode: "test",
    emittedBy: "test",
    expectedVersion: 5,
    leaseId: "lease_1",
    fencingToken: "fence_1",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
});

test("RuntimeStateMachine budget hard cap precondition check", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetReservation({
    budgetReservationId: newId("res"),
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    amount: 50,
    resourceKind: "compute",
    status: "reserved",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nodeRunId: null,
  });

  // hardCapSatisfied = false should fail
  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "BudgetReservation",
        entityId: aggregate.budgetReservationId,
        principal: "system",
        aggregateType: "BudgetReservation",
        aggregate,
        fromStatus: "reserved",
        toStatus: "settled",
        tenantId: "tenant_1",
        traceId: newId("trace"),
        reasonCode: "budget.settled",
        emittedBy: "test",
        budgetPrecondition: { reservationId: aggregate.budgetReservationId, hardCapSatisfied: false },
      }),
    (error: any) => error.message.includes("hard cap"),
  );
});

test("RuntimeStateMachine harness run requires run version lock for admission", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = {
    harnessRunId: newId("harness"),
    tenantId: "tenant_1",
    status: "created" as const,
    currentSeq: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.throws(
    () =>
      sm.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: aggregate.harnessRunId,
        principal: "system",
        aggregateType: "HarnessRun",
        aggregate,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant_1",
        traceId: newId("trace"),
        reasonCode: "test",
        emittedBy: "test",
        leaseId: "lease_1",
        fencingToken: "fence_1",
        auditRef: "audit://test",
        // Missing runVersionLockId
      }),
    (error: any) => error.message.includes("RunVersionLock"),
  );
});

test("RuntimeStateMachine produces event with correct structure", () => {
  const sm = new RuntimeStateMachine();
  const aggregate = createBudgetLedger({
    budgetLedgerId: newId("ledger"),
    tenantId: "tenant_1",
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    hardCap: 100,
    status: "open",
    version: 1,
  });

  const result = sm.transition({
    commandId: newId("cmd"),
    entityType: "BudgetLedger",
    entityId: aggregate.budgetLedgerId,
    principal: "system",
    aggregateType: "BudgetLedger",
    aggregate,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    tenantId: "tenant_1",
    traceId: "trace_abc123",
    reasonCode: "budget.soft_cap",
    emittedBy: "test",
    leaseId: "lease_1",
    fencingToken: "fence_1",
  });

  assert.equal(result.event.eventType, "platform.budget_ledger.status_changed");
  assert.equal(result.event.aggregateType, "BudgetLedger");
  assert.equal(result.event.aggregateId, aggregate.budgetLedgerId);
  assert.equal(result.event.tenantId, "tenant_1");
  assert.equal(result.event.traceId, "trace_abc123");
  assert.ok(result.event.payload);
  assert.ok(result.event.occurredAt);
});

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import { createBudgetLedger, type PlatformFactEvent } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";

test("BudgetAllocator reserves against hard cap and settles reservation with ledger accounting", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 60,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    nodeRunId: "node-run-1",
  });
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    expectedVersion: reserved.ledger.version,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "budget-allocator",
      principal: "budget-allocator",
    },
  });

  assert.equal(reserved.ledger.reservedAmount, 60);
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.settledAmount, 50);
  assert.equal(settled.ledger.releasedAmount, 10);
});

test("BudgetAllocator rejects settlement that exceeds the hard cap or reservation", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    settledAmount: 90,
    version: 0,
  });
  const reserved = allocator.reserve({
    ledger,
    amount: 10,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    nodeRunId: "node-run-1",
  });

  assert.throws(
    () =>
      allocator.settle({
        ledger: reserved.ledger,
        reservation: reserved.reservation,
        actualAmount: 11,
        expectedVersion: reserved.ledger.version,
        context: {
          tenantId: "tenant-1",
          traceId: "trace-1",
          emittedBy: "budget-allocator",
          principal: "budget-allocator",
        },
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "budget_settlement.actual_amount_exceeds_reservation",
  );
});

test("BudgetAllocator can release a reservation when execution never starts", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 25,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });
  const released = allocator.release({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    expectedVersion: reserved.ledger.version,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "budget-allocator",
      principal: "budget-allocator",
    },
  });

  assert.equal(released.reservation.aggregate.status, "released");
  assert.equal(released.ledger.reservedAmount, 0);
  assert.equal(released.ledger.releasedAmount, 25);
});

test("BudgetAllocator rejects tier limit currency mismatches before reserving budget", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 10,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
        context: {
          tenantId: "tenant-1",
          traceId: "trace-1",
          emittedBy: "budget-allocator",
          principal: "budget-allocator",
          tierLimit: 100,
          tierLimitCurrency: "EUR",
        },
      }),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.code === "budget_context.tier_limit_currency_mismatch",
  );
});

test("BudgetAllocator.settle emits fact events for both reservation and ledger via RSM", () => {
  const emittedEvents: PlatformFactEvent[] = [];
  const stateMachine = new RuntimeStateMachine({
    persistEvent: (event) => emittedEvents.push(event),
  });
  const allocator = new BudgetAllocator({ stateMachine });

  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    expectedVersion: reserved.ledger.version,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "budget-allocator",
      principal: "test-principal",
    },
  });

  // R11-07 FIX: settle() now emits fact events through RSM for both reservation and ledger
  const reservationEvents = emittedEvents.filter(
    (e) => e.aggregateType === "BudgetReservation" && e.aggregateId === reserved.reservation.budgetReservationId,
  );
  const ledgerEvents = emittedEvents.filter(
    (e) => e.aggregateType === "BudgetLedger" && e.aggregateId === ledger.budgetLedgerId,
  );

  assert.ok(reservationEvents.length >= 1, "Should emit at least one reservation fact event");
  assert.ok(ledgerEvents.length >= 1, "Should emit at least one ledger fact event");
  assert.equal(settled.reservation.event.eventType, "platform.budget_reservation.status_changed");
});

test("BudgetAllocator.settle defers CAS enforcement to persistence instead of local prechecks", () => {
  const stateMachine = new RuntimeStateMachine({
    persistEvent: () => {}, // intentionally no-op
  });
  const allocator = new BudgetAllocator({ stateMachine });

  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 5,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });

  const result = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 30,
    expectedVersion: 99,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "budget-allocator",
      principal: "test-principal",
    },
  });

  assert.equal(result.ledger.version, reserved.ledger.version + 1);
});

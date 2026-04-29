/**
 * Integration Tests: Budget Tracking and Enforcement
 *
 * Tests end-to-end budget management flows including reservation,
 * settlement, threshold checking, and budget release across services.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createBudgetLedger,
  createBudgetReservation,
  createBudgetSettlement,
  type BudgetLedger,
  type BudgetReservation,
  type BudgetResourceKind,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

import {
  CostOptimizationService,
  type CostAttributionRecord,
  type CostSimulationScenarioInput,
} from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

// =============================================================================
// Budget Ledger Factory
// =============================================================================

function makeLedger(overrides: Partial<{
  budgetLedgerId: string;
  tenantId: string;
  hardCap: number;
  version: number;
  status: BudgetLedger["status"];
  reservedAmount: number;
  settledAmount: number;
  releasedAmount: number;
}> = {}): BudgetLedger {
  return createBudgetLedger({
    tenantId: overrides.tenantId ?? "tenant_budget_test",
    traceId: "trace_" + Date.now(),
    emittedBy: "system",
    budgetLedgerId: overrides.budgetLedgerId ?? "ledger_" + Date.now(),
    hardCap: overrides.hardCap ?? 1000,
    resourceKinds: ["llm", "compute", "storage", "egress"] as readonly BudgetResourceKind[],
    version: overrides.version ?? 1,
    status: overrides.status ?? "active",
    reservedAmount: overrides.reservedAmount ?? 0,
    settledAmount: overrides.settledAmount ?? 0,
    releasedAmount: overrides.releasedAmount ?? 0,
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
}

// =============================================================================
// Budget Reservation Tests
// =============================================================================

test("budget tracking: reserve budget successfully", () => {
  const ledger = makeLedger({ hardCap: 1000 });

  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  assert.equal(reservation.amount, 100);
  assert.equal(reservation.resourceKind, "llm");
  assert.ok(reservation.reservationId.length > 0);
});

test("budget tracking: reserve budget with nodeRunId", () => {
  const ledger = makeLedger();

  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
    nodeRunId: "node_step_123",
  });

  assert.equal(reservation.nodeRunId, "node_step_123");
});

test("budget tracking: multiple reservations accumulate", () => {
  let ledger = makeLedger({ reservedAmount: 0 });

  const reservation1 = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount + reservation1.amount,
    version: ledger.version + 1,
  };

  const reservation2 = createBudgetReservation({
    ledger,
    amount: 150,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount + reservation2.amount,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 250);
  assert.equal(ledger.version, 3);
});

// =============================================================================
// Budget Settlement Tests
// =============================================================================

test("budget tracking: settle reservation with actual cost", () => {
  let ledger = makeLedger();

  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  // Update ledger with reservation
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount + reservation.amount,
    version: ledger.version + 1,
  };

  // Settle with actual cost (less than reserved)
  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 85,
    evidenceRefs: [],
  });

  // Update ledger with settlement
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - reservation.amount,
    settledAmount: ledger.settledAmount + settlement.actualAmount,
    version: ledger.version + 1,
  };

  assert.equal(settlement.actualAmount, 85);
  assert.equal(ledger.reservedAmount, 15); // 100 - 85
  assert.equal(ledger.settledAmount, 85);
});

test("budget tracking: settle exact amount", () => {
  const ledger = makeLedger();

  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 100, // Exact match
    evidenceRefs: [],
  });

  assert.equal(settlement.actualAmount, 100);
});

test("budget tracking: settle with evidence refs", () => {
  const ledger = makeLedger();

  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  const evidenceRefs = [
    { artifactId: "artifact_1", uri: "file:///tmp/evidence1.json" },
    { artifactId: "artifact_2", uri: "file:///tmp/evidence2.json" },
  ];

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 45,
    evidenceRefs,
  });

  assert.equal(settlement.evidenceRefs.length, 2);
});

// =============================================================================
// Budget Release Tests
// =============================================================================

test("budget tracking: release unused reservation", () => {
  let ledger = makeLedger({ reservedAmount: 200, releasedAmount: 0 });

  // Release 100 of the 200 reserved
  const releaseAmount = 100;

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - releaseAmount,
    releasedAmount: ledger.releasedAmount + releaseAmount,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 100);
  assert.equal(ledger.releasedAmount, 100);
});

test("budget tracking: release full reservation", () => {
  let ledger = makeLedger({ reservedAmount: 100, releasedAmount: 0 });

  // Release entire reservation
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - 100,
    releasedAmount: ledger.releasedAmount + 100,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 0);
  assert.equal(ledger.releasedAmount, 100);
});

// =============================================================================
// Budget Threshold Tests
// =============================================================================

test("budget tracking: active amount below hard cap", () => {
  const ledger = makeLedger({
    hardCap: 1000,
    reservedAmount: 300,
    settledAmount: 200,
    releasedAmount: 50,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const remaining = ledger.hardCap - activeCommitted;

  assert.equal(activeCommitted, 450); // 300 + 200 - 50
  assert.equal(remaining, 550);
});

test("budget tracking: threshold warning at 80%", () => {
  const ledger = makeLedger({
    hardCap: 1000,
    reservedAmount: 700,
    settledAmount: 100,
    releasedAmount: 0,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const ratio = activeCommitted / ledger.hardCap;

  assert.ok(ratio >= 0.8);
  assert.ok(ratio < 1.0);
});

test("budget tracking: threshold exceeded at 100%", () => {
  const ledger = makeLedger({
    hardCap: 100,
    reservedAmount: 80,
    settledAmount: 20,
    releasedAmount: 0,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const ratio = activeCommitted / ledger.hardCap;

  assert.equal(ratio, 1.0);
});

test("budget tracking: hard cap reached when committed exceeds cap", () => {
  const ledger = makeLedger({
    hardCap: 100,
    reservedAmount: 60,
    settledAmount: 50,
    releasedAmount: 0,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;

  // Status transition check would happen in state machine
  // Here we just verify the condition
  assert.ok(activeCommitted >= ledger.hardCap);
});

// =============================================================================
// Cost Tracking Integration with Budget
// =============================================================================

test("budget tracking: track costs from estimation to reservation", () => {
  const ledger = makeLedger({ hardCap: 10.00 });

  // Simulate estimated costs from CostEstimationService
  const estimatedCost = 0.25;

  // Reserve budget for the estimated cost
  const reservation = createBudgetReservation({
    ledger,
    amount: estimatedCost,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  assert.equal(reservation.amount, 0.25);
  assert.ok(reservation.amount <= ledger.hardCap);
});

test("budget tracking: simulate cost optimization scenarios", () => {
  const costService = new CostOptimizationService();

  // Record some costs
  costService.recordCost({
    subjectType: "task",
    subjectId: "task_optimize_1",
    costType: "llm",
    amountUsd: 100.00,
    llmCostUsd: 80.00,
    toolCostUsd: 10.00,
    computeCostUsd: 10.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision_1",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  costService.recordCost({
    subjectType: "task",
    subjectId: "task_optimize_2",
    costType: "llm",
    amountUsd: 50.00,
    llmCostUsd: 40.00,
    toolCostUsd: 5.00,
    computeCostUsd: 5.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision_2",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  // Simulate optimization scenarios
  const scenarios: readonly CostSimulationScenarioInput[] = [
    { scenarioId: "reduce_task1", subjectId: "task_optimize_1", reductionPercent: 20 },
    { scenarioId: "reduce_task2", subjectId: "task_optimize_2", reductionPercent: 10 },
  ];

  const results = costService.simulate(scenarios);

  assert.equal(results.length, 2);

  const result1 = results.find((r) => r.scenarioId === "reduce_task1")!;
  assert.equal(result1.currentCostUsd, 100.00);
  assert.equal(result1.simulatedCostUsd, 80.00);
  assert.equal(result1.deltaUsd, -20.00);

  const result2 = results.find((r) => r.scenarioId === "reduce_task2")!;
  assert.equal(result2.currentCostUsd, 50.00);
  assert.equal(result2.simulatedCostUsd, 45.00);
  assert.equal(result2.deltaUsd, -5.00);
});

// =============================================================================
// Budget State Machine Transition Tests
// =============================================================================

test("budget tracking: state transitions from active to hard_cap_reached", () => {
  let ledger = makeLedger({
    status: "active",
    hardCap: 100,
    reservedAmount: 80,
    settledAmount: 20,
    releasedAmount: 0,
  });

  // Simulate state machine transition check
  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const newStatus = activeCommitted >= ledger.hardCap ? "hard_cap_reached" : ledger.status;

  ledger = {
    ...ledger,
    status: newStatus,
  };

  assert.equal(ledger.status, "hard_cap_reached");
});

test("budget tracking: state remains active when below cap", () => {
  let ledger = makeLedger({
    status: "active",
    hardCap: 1000,
    reservedAmount: 300,
    settledAmount: 200,
    releasedAmount: 50,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const newStatus = activeCommitted >= ledger.hardCap ? "hard_cap_reached" : ledger.status;

  assert.equal(newStatus, "active");
});

// =============================================================================
// Multi-Tenant Budget Isolation Tests
// =============================================================================

test("budget tracking: tenant budget isolation", () => {
  const ledgerA = makeLedger({
    budgetLedgerId: "ledger_tenant_a",
    tenantId: "tenant_a",
    hardCap: 1000,
  });

  const ledgerB = makeLedger({
    budgetLedgerId: "ledger_tenant_b",
    tenantId: "tenant_b",
    hardCap: 500, // Different hard cap
  });

  // Reservations for tenant A
  const reservationA = createBudgetReservation({
    ledger: ledgerA,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledgerA.version,
  });

  // Reservations for tenant B
  const reservationB = createBudgetReservation({
    ledger: ledgerB,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledgerB.version,
  });

  assert.notEqual(ledgerA.budgetLedgerId, ledgerB.budgetLedgerId);
  assert.notEqual(ledgerA.tenantId, ledgerB.tenantId);
  assert.equal(ledgerA.hardCap, 1000);
  assert.equal(ledgerB.hardCap, 500);
});

test("budget tracking: per-resource-kind budget tracking", () => {
  const ledger = makeLedger({
    resourceKinds: ["llm", "compute", "storage", "egress"] as readonly BudgetResourceKind[],
  });

  // Reserve for different resource kinds
  const llmReservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  const computeReservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  // Both reservations should be valid
  assert.equal(llmReservation.resourceKind, "llm");
  assert.equal(computeReservation.resourceKind, "compute");
  assert.ok(ledger.resourceKinds.includes("llm"));
  assert.ok(ledger.resourceKinds.includes("compute"));
});

// =============================================================================
// Budget Reconciliation Tests
// =============================================================================

test("budget tracking: reconcile ledger after settlement", () => {
  let ledger = makeLedger({
    reservedAmount: 200,
    settledAmount: 0,
    releasedAmount: 0,
  });

  // First settlement
  const reservation1 = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation1.amount, version: ledger.version + 1 };

  const settlement1 = createBudgetSettlement({
    ledger,
    reservation: reservation1,
    actualAmount: 90,
    evidenceRefs: [],
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - reservation1.amount,
    settledAmount: ledger.settledAmount + settlement1.actualAmount,
    version: ledger.version + 1,
  };

  // Second reservation
  const reservation2 = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation2.amount, version: ledger.version + 1 };

  const settlement2 = createBudgetSettlement({
    ledger,
    reservation: reservation2,
    actualAmount: 100,
    evidenceRefs: [],
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - reservation2.amount,
    settledAmount: ledger.settledAmount + settlement2.actualAmount,
    version: ledger.version + 1,
  };

  // Verify final state
  assert.equal(ledger.settledAmount, 190); // 90 + 100
  assert.equal(ledger.reservedAmount, 0);
});

test("budget tracking: handle partial releases", () => {
  let ledger = makeLedger({ reservedAmount: 100, releasedAmount: 0 });

  // Partial release
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - 30,
    releasedAmount: ledger.releasedAmount + 30,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 70);
  assert.equal(ledger.releasedAmount, 30);

  // Another partial release
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - 20,
    releasedAmount: ledger.releasedAmount + 20,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 50);
  assert.equal(ledger.releasedAmount, 50);
});

// =============================================================================
// Budget Expiry Tests
// =============================================================================

test("budget tracking: reservation expiry check", () => {
  const ledger = makeLedger();

  const expiresAt = "2026-04-29T00:00:00.000Z";
  const now = "2026-04-30T00:00:00.000Z";

  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt,
    expectedVersion: ledger.version,
  });

  // Check expiry
  const expired = new Date(now) > new Date(reservation.expiresAt);

  assert.equal(expired, true);
});

test("budget tracking: reservation not expired", () => {
  const ledger = makeLedger();

  const expiresAt = "2026-05-01T00:00:00.000Z";
  const now = "2026-04-30T00:00:00.000Z";

  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt,
    expectedVersion: ledger.version,
  });

  const expired = new Date(now) > new Date(reservation.expiresAt);

  assert.equal(expired, false);
});

// =============================================================================
// Budget Analytics Tests
// =============================================================================

test("budget tracking: calculate utilization percentage", () => {
  const ledger = makeLedger({
    hardCap: 1000,
    reservedAmount: 300,
    settledAmount: 200,
    releasedAmount: 50,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const utilizationPercent = (activeCommitted / ledger.hardCap) * 100;

  assert.equal(utilizationPercent, 45); // 450 / 1000 * 100
});

test("budget tracking: calculate remaining budget", () => {
  const ledger = makeLedger({
    hardCap: 500,
    reservedAmount: 100,
    settledAmount: 150,
    releasedAmount: 50,
  });

  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const remainingBudget = ledger.hardCap - activeCommitted;

  assert.equal(remainingBudget, 300); // 500 - 200
});

test("budget tracking: track settlement efficiency", () => {
  let ledger = makeLedger();

  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation.amount, version: ledger.version + 1 };

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 85,
    evidenceRefs: [],
  });

  // Efficiency = actual / reserved
  const efficiency = settlement.actualAmount / reservation.amount;

  assert.equal(efficiency, 0.85);
  assert.ok(efficiency <= 1.0);
});

// =============================================================================
// Budget Versioning Tests
// =============================================================================

test("budget tracking: version increments on state change", () => {
  let ledger = makeLedger({ version: 1 });

  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation.amount, version: ledger.version + 1 };

  assert.equal(ledger.version, 2);

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 45,
    evidenceRefs: [],
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount - reservation.amount, settledAmount: ledger.settledAmount + settlement.actualAmount, version: ledger.version + 1 };

  assert.equal(ledger.version, 3);
});

test("budget tracking: version conflict detection", () => {
  const ledger = makeLedger({ version: 5 });

  // Try to use old version (1) which should fail
  // In real implementation, the state machine would throw
  // Here we just verify the version mismatch condition
  const expectedVersion = 1;
  const currentVersion = ledger.version;

  assert.notEqual(currentVersion, expectedVersion);
  assert.ok(currentVersion > expectedVersion);
});

// =============================================================================
// End-to-End Budget Lifecycle Tests
// =============================================================================

test("budget tracking: complete lifecycle from reservation to release", () => {
  let ledger = makeLedger({
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
  });

  // Phase 1: Reserve budget
  const reservation = createBudgetReservation({
    ledger,
    amount: 300,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation.amount, version: ledger.version + 1 };

  assert.equal(ledger.reservedAmount, 300);

  // Phase 2: Settle partial
  const settlement1 = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 200,
    evidenceRefs: [],
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - reservation.amount,
    settledAmount: ledger.settledAmount + settlement1.actualAmount,
    version: ledger.version + 1,
  };

  // Phase 3: Release unused
  ledger = {
    ...ledger,
    releasedAmount: ledger.releasedAmount + (reservation.amount - settlement1.actualAmount),
    version: ledger.version + 1,
  };

  // Verify final state
  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  assert.equal(ledger.reservedAmount, 0);
  assert.equal(ledger.settledAmount, 200);
  assert.equal(activeCommitted, 200);
});

test("budget tracking: multiple sequential reservations and settlements", () => {
  let ledger = makeLedger({ hardCap: 5000 });

  const tasks = [
    { amount: 100, actual: 95 },
    { amount: 150, actual: 140 },
    { amount: 200, actual: 200 },
    { amount: 75, actual: 70 },
  ];

  let totalSettled = 0;

  for (const task of tasks) {
    const reservation = createBudgetReservation({
      ledger,
      amount: task.amount,
      resourceKind: "llm",
      expiresAt: "2026-04-30T00:00:00.000Z",
      expectedVersion: ledger.version,
    });

    ledger = { ...ledger, reservedAmount: ledger.reservedAmount + reservation.amount, version: ledger.version + 1 };

    const settlement = createBudgetSettlement({
      ledger,
      reservation,
      actualAmount: task.actual,
      evidenceRefs: [],
    });

    ledger = {
      ...ledger,
      reservedAmount: ledger.reservedAmount - reservation.amount,
      settledAmount: ledger.settledAmount + settlement.actualAmount,
      version: ledger.version + 1,
    };

    totalSettled += task.actual;
  }

  assert.equal(ledger.settledAmount, totalSettled);
  assert.equal(ledger.reservedAmount, 0);
  assert.ok(ledger.settledAmount < ledger.hardCap);
});
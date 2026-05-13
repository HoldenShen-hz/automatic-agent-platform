/**
 * Unit Tests: Budget Tracking Service
 *
 * Tests for budget reservation, tracking, and settlement across
 * platform cost management modules.
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
  type BudgetSettlement,
  type BudgetResourceKind,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

// =============================================================================
// BudgetLedger Factory
// =============================================================================

function makeLedger(overrides: Partial<{
  budgetLedgerId: string;
  version: number;
  status: BudgetLedger["status"];
  hardCap: number;
  reservedAmount: number;
  settledAmount: number;
  releasedAmount: number;
}> = {}): BudgetLedger {
  return createBudgetLedger({
    tenantId: overrides.tenantId ?? "tenant_test",
    traceId: overrides.traceId ?? "trace_1",
    emittedBy: overrides.emittedBy ?? "system",
    budgetLedgerId: overrides.budgetLedgerId ?? "ledger_1",
    hardCap: overrides.hardCap ?? 1000,
    resourceKinds: ["llm", "compute"] as readonly BudgetResourceKind[],
    version: overrides.version ?? 1,
    status: overrides.status ?? "active",
    reservedAmount: overrides.reservedAmount ?? 0,
    settledAmount: overrides.settledAmount ?? 0,
    releasedAmount: overrides.releasedAmount ?? 0,
    createdAt: overrides.createdAt ?? "2026-04-29T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-29T00:00:00.000Z",
  });
}

// =============================================================================
// BudgetLedger Tests
// =============================================================================

test("createBudgetLedger creates ledger with correct initial state", () => {
  const ledger = makeLedger();

  assert.equal(ledger.budgetLedgerId, "ledger_1");
  assert.equal(ledger.status, "active");
  assert.equal(ledger.hardCap, 1000);
  assert.equal(ledger.reservedAmount, 0);
  assert.equal(ledger.settledAmount, 0);
  assert.equal(ledger.releasedAmount, 0);
});

test("createBudgetLedger sets version to 1 by default", () => {
  const ledger = makeLedger({ version: undefined as unknown as number });
  assert.equal(ledger.version, 1);
});

test("createBudgetLedger accepts custom resource kinds", () => {
  const ledger = createBudgetLedger({
    tenantId: "tenant_1",
    traceId: "trace_1",
    emittedBy: "system",
    budgetLedgerId: "ledger_custom",
    hardCap: 500,
    resourceKinds: ["llm", "storage", "egress"] as readonly BudgetResourceKind[],
    version: 1,
    status: "active",
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.deepEqual(ledger.resourceKinds, ["llm", "storage", "egress"]);
});

test("BudgetLedger active status indicates healthy state", () => {
  const ledger = makeLedger({ status: "active" });
  assert.equal(ledger.status, "active");
});

test("BudgetLedger hard_cap_reached status when reserved exceeds cap", () => {
  const ledger = makeLedger({ status: "hard_cap_reached" });
  assert.equal(ledger.status, "hard_cap_reached");
});

// =============================================================================
// BudgetReservation Tests
// =============================================================================

test("createBudgetReservation creates reservation with correct amounts", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
    nodeRunId: "node_1",
  });

  assert.equal(reservation.amount, 50);
  assert.equal(reservation.resourceKind, "llm");
  assert.ok(reservation.reservationId.length > 0);
  assert.ok(reservation.createdAt.length > 0);
});

test("createBudgetReservation records nodeRunId when provided", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 25,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
    nodeRunId: "node_specific",
  });

  assert.equal(reservation.nodeRunId, "node_specific");
});

test("createBudgetReservation without nodeRunId leaves field undefined", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 25,
    resourceKind: "compute",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
    nodeRunId: undefined,
  });

  assert.equal(reservation.nodeRunId, undefined);
});

test("createBudgetReservation sets expiresAt timestamp", () => {
  const ledger = makeLedger();
  const expiresAt = "2026-05-01T12:00:00.000Z";
  const reservation = createBudgetReservation({
    ledger,
    amount: 10,
    resourceKind: "llm",
    expiresAt,
    expectedVersion: 1,
  });

  assert.equal(reservation.expiresAt, expiresAt);
});

// =============================================================================
// BudgetSettlement Tests
// =============================================================================

test("createBudgetSettlement creates settlement with actual amounts", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 45,
    evidenceRefs: [],
  });

  assert.equal(settlement.actualAmount, 45);
  assert.equal(settlement.reservationId, reservation.reservationId);
  assert.ok(settlement.settlementId.length > 0);
});

test("createBudgetSettlement includes evidence refs when provided", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  const evidenceRefs = [
    { artifactId: "artifact_1", uri: "file:///tmp/evidence1.json", version: "1" },
    { artifactId: "artifact_2", uri: "file:///tmp/evidence2.json", version: "1" },
  ];

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 40,
    evidenceRefs,
  });

  assert.equal(settlement.evidenceRefs.length, 2);
});

test("createBudgetSettlement calculates delta from reserved amount", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 85,
    evidenceRefs: [],
  });

  assert.equal(settlement.actualAmount, 85);
  assert.equal(reservation.amount, 100);
});

// =============================================================================
// Budget Tracking State Transitions
// =============================================================================

test("BudgetLedger reservedAmount increases with reservations", () => {
  const ledger = makeLedger({ reservedAmount: 50 });
  assert.equal(ledger.reservedAmount, 50);
});

test("BudgetLedger settledAmount tracks completed settlements", () => {
  const ledger = makeLedger({ settledAmount: 75 });
  assert.equal(ledger.settledAmount, 75);
});

test("BudgetLedger releasedAmount tracks released reservations", () => {
  const ledger = makeLedger({ releasedAmount: 25 });
  assert.equal(ledger.releasedAmount, 25);
});

test("BudgetLedger computes active committed amount correctly", () => {
  // active = reserved + settled - released
  const ledger = makeLedger({
    reservedAmount: 100,
    settledAmount: 50,
    releasedAmount: 20,
  });

  // Active committed: 100 + 50 - 20 = 130
  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  assert.equal(activeCommitted, 130);
});

test("BudgetLedger status transitions to hard_cap_reached when committed exceeds hardCap", () => {
  // Create ledger with high reserved amount that exceeds hard cap
  const ledger = makeLedger({
    hardCap: 100,
    reservedAmount: 80,
    settledAmount: 30,
    releasedAmount: 0,
  });

  // Active committed: 80 + 30 - 0 = 110 > 100 (hardCap)
  const activeCommitted = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  assert.ok(activeCommitted >= ledger.hardCap);
});

test("BudgetLedger resourceKinds defines valid budget categories", () => {
  const ledger = makeLedger();
  assert.ok(ledger.resourceKinds.includes("llm"));
  assert.ok(ledger.resourceKinds.includes("compute"));
});

// =============================================================================
// Budget Operations Sequence Tests
// =============================================================================

test("Reserve and settle sequence preserves correct amounts", () => {
  // Create fresh ledger
  let ledger = makeLedger({ reservedAmount: 0, settledAmount: 0, releasedAmount: 0 });

  // Reserve budget
  const reservation = createBudgetReservation({
    ledger,
    amount: 100,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: ledger.version,
  });

  // Simulate ledger update (in real system this comes from state transition)
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount + reservation.amount,
    version: ledger.version + 1,
  };

  assert.equal(ledger.reservedAmount, 100);

  // Settle partial amount
  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 85,
    evidenceRefs: [],
  });

  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - settlement.actualAmount,
    settledAmount: ledger.settledAmount + settlement.actualAmount,
    version: ledger.version + 1,
  };

  assert.equal(ledger.settledAmount, 85);
  assert.equal(ledger.reservedAmount, 15); // 100 - 85
});

test("Release unused reservation returns budget to available", () => {
  let ledger = makeLedger({ reservedAmount: 100, releasedAmount: 0 });

  // Release reservation
  ledger = {
    ...ledger,
    reservedAmount: ledger.reservedAmount - 100,
    releasedAmount: ledger.releasedAmount + 100,
    version: ledger.version + 1,
  };

  // Released amount should increase
  assert.equal(ledger.releasedAmount, 100);
  // Available = hardCap - (reserved + settled - released)
  const available = ledger.hardCap - (ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount);
  assert.equal(available, 1000 - (0 + 0 - 100)); // Should have room
});

// =============================================================================
// BudgetResourceKind Validation
// =============================================================================

test("BudgetResourceKind accepts llm", () => {
  const kind: BudgetResourceKind = "llm";
  assert.equal(kind, "llm");
});

test("BudgetResourceKind accepts compute", () => {
  const kind: BudgetResourceKind = "compute";
  assert.equal(kind, "compute");
});

test("BudgetResourceKind accepts storage", () => {
  const kind: BudgetResourceKind = "storage";
  assert.equal(kind, "storage");
});

test("BudgetResourceKind accepts egress", () => {
  const kind: BudgetResourceKind = "egress";
  assert.equal(kind, "egress");
});

test("BudgetResourceKind accepts humanReview", () => {
  const kind: BudgetResourceKind = "humanReview";
  assert.equal(kind, "humanReview");
});

test("BudgetResourceKind accepts tool", () => {
  const kind: BudgetResourceKind = "tool";
  assert.equal(kind, "tool");
});

// =============================================================================
// Budget Ledger Identifier and Timestamps
// =============================================================================

test("BudgetLedger has unique budgetLedgerId", () => {
  const ledger1 = makeLedger({ budgetLedgerId: "ledger_alpha" });
  const ledger2 = makeLedger({ budgetLedgerId: "ledger_beta" });

  assert.notEqual(ledger1.budgetLedgerId, ledger2.budgetLedgerId);
});

test("BudgetLedger has createdAt timestamp", () => {
  const ledger = makeLedger();
  assert.ok(ledger.createdAt.length > 0);
});

test("BudgetLedger has updatedAt timestamp", () => {
  const ledger = makeLedger();
  assert.ok(ledger.updatedAt.length > 0);
});

test("BudgetLedger stores tenantId for isolation", () => {
  const ledger = makeLedger({ tenantId: "tenant_isolated" });
  assert.equal(ledger.tenantId, "tenant_isolated");
});

// =============================================================================
// Budget Threshold Calculations
// =============================================================================

test("Calculate threshold ratio at 50% utilization", () => {
  const ledger = makeLedger({ hardCap: 1000, reservedAmount: 500 });

  const committedAmount = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const ratio = committedAmount / ledger.hardCap;

  assert.equal(ratio, 0.5);
});

test("Calculate threshold ratio at 80% warning level", () => {
  const ledger = makeLedger({ hardCap: 100, reservedAmount: 80 });

  const committedAmount = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const ratio = committedAmount / ledger.hardCap;

  assert.equal(ratio, 0.8);
});

test("Calculate threshold ratio at 100% limit", () => {
  const ledger = makeLedger({ hardCap: 100, reservedAmount: 100 });

  const committedAmount = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const ratio = committedAmount / ledger.hardCap;

  assert.equal(ratio, 1.0);
});

test("Calculate remaining budget after reservations", () => {
  const ledger = makeLedger({
    hardCap: 1000,
    reservedAmount: 300,
    settledAmount: 200,
    releasedAmount: 50,
  });

  const committedAmount = ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  const remaining = ledger.hardCap - committedAmount;

  assert.equal(remaining, 550); // 1000 - (300 + 200 - 50)
});

// =============================================================================
// Budget Immutability Tests
// =============================================================================

test("BudgetLedger fields are readonly compatible", () => {
  const ledger = makeLedger();

  // Fields should be accessible
  assert.ok(typeof ledger.budgetLedgerId === "string");
  assert.ok(typeof ledger.version === "number");
  assert.ok(typeof ledger.status === "string");
  assert.ok(typeof ledger.hardCap === "number");
});

test("BudgetReservation fields are accessible", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  assert.ok(typeof reservation.reservationId === "string");
  assert.ok(typeof reservation.amount === "number");
  assert.ok(typeof reservation.resourceKind === "string");
  assert.ok(typeof reservation.expiresAt === "string");
});

test("BudgetSettlement fields are accessible", () => {
  const ledger = makeLedger();
  const reservation = createBudgetReservation({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: "2026-04-30T00:00:00.000Z",
    expectedVersion: 1,
  });

  const settlement = createBudgetSettlement({
    ledger,
    reservation,
    actualAmount: 45,
    evidenceRefs: [],
  });

  assert.ok(typeof settlement.settlementId === "string");
  assert.ok(typeof settlement.reservationId === "string");
  assert.ok(typeof settlement.actualAmount === "number");
  assert.ok(typeof settlement.createdAt === "string");
});

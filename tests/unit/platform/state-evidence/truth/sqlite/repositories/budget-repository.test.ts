import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { BudgetRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

function seedHarnessRunFixture(
  db: SqliteDatabase,
  input: {
    confirmedTaskSpecId: string;
    requestId: string;
    harnessRunId: string;
    budgetLedgerId: string;
    tenantId: string;
    traceId: string;
    now: string;
  },
): void {
  db.connection.prepare(
    `INSERT INTO confirmed_task_specs (
      confirmed_task_spec_id, task_draft_id, tenant_id, goal, inputs_json,
      constraint_pack_ref, risk_class, idempotency_key, trace_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.confirmedTaskSpecId,
    "task-draft-budget-test",
    input.tenantId,
    "Budget repository integration fixture",
    "{}",
    "constraint-pack-budget-test",
    "medium",
    `idem:${input.confirmedTaskSpecId}`,
    input.traceId,
    input.now,
  );

  db.connection.prepare(
    `INSERT INTO request_envelopes (
      request_id, confirmed_task_spec_id, tenant_id, trace_id,
      idempotency_key, request_hash, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.requestId,
    input.confirmedTaskSpecId,
    input.tenantId,
    input.traceId,
    `idem:${input.requestId}`,
    "hash-budget-test",
    input.now,
  );

  db.connection.prepare(
    `INSERT INTO harness_runs (
      harness_run_id, tenant_id, org_id, trace_id, goal, risk_level, domain_id,
      confirmed_task_spec_id, request_envelope_id, request_hash, status,
      constraint_pack_ref, version_lock_id, budget_ledger_id, current_seq,
      created_at, fencing_token, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.harnessRunId,
    input.tenantId,
    "org-budget-test",
    input.traceId,
    "Budget repository integration fixture",
    "medium",
    "platform",
    input.confirmedTaskSpecId,
    input.requestId,
    "hash-budget-test",
    "running",
    "constraint-pack-budget-test",
    "version-lock-budget-test",
    input.budgetLedgerId,
    0,
    input.now,
    "fence-budget-test",
    input.now,
  );
}

test("BudgetRepository can be instantiated with mock connection", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);
  assert.ok(repo);
  assert.equal(typeof repo.getLedger, "function");
  assert.equal(typeof repo.getReservation, "function");
  assert.equal(typeof repo.insertLedger, "function");
  assert.equal(typeof repo.insertReservation, "function");
});

test("BudgetRepository has all required CAS methods", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  assert.equal(typeof repo.updateLedgerWithSettle, "function");
  assert.equal(typeof repo.updateLedgerWithRelease, "function");
  assert.equal(typeof repo.updateLedgerWithReservation, "function");
  assert.equal(typeof repo.listSettlementsByReservation, "function");
});

test("BudgetRepository getLedger returns null for non-existent ledger", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);
  const result = repo.getLedger("non-existent-id");
  assert.equal(result, null);
});

test("BudgetRepository getReservation returns null for non-existent reservation", () => {
  const mockConn = {
    prepare: () => ({
      get: () => undefined,
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);
  const result = repo.getReservation("non-existent-id");
  assert.equal(result, null);
});

test("BudgetRepository updateLedgerWithSettle returns success=false on version mismatch", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 50,
    settledAmount: 10,
    releasedAmount: 5,
    status: "active" as const,
    version: 5,
  };

  const reservation = {
    budgetReservationId: "res-1",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  const settlement = {
    budgetSettlementId: "set-1",
    budgetReservationId: "res-1",
    actualAmount: 20,
    settlementKind: "settle",
    createdAt: "2026-04-27T10:00:00.000Z",
  };

  // Version 3 doesn't match ledger.version (5), so CAS should fail
  const result = repo.updateLedgerWithSettle(ledger, reservation, 20, 3, settlement);

  assert.equal(result.success, false);
  assert.equal(result.rowsAffected, 0);
  assert.equal(result.ledger, undefined);
});

test("BudgetRepository updateLedgerWithSettle returns success=true on version match", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 50,
    settledAmount: 10,
    releasedAmount: 5,
    status: "active" as const,
    version: 5,
  };

  const reservation = {
    budgetReservationId: "res-1",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  const settlement = {
    budgetSettlementId: "set-1",
    budgetReservationId: "res-1",
    actualAmount: 20,
    settlementKind: "settle",
    createdAt: "2026-04-27T10:00:00.000Z",
  };

  // Version 5 matches ledger.version, so CAS should succeed
  const result = repo.updateLedgerWithSettle(ledger, reservation, 20, 5, settlement);

  assert.equal(result.success, true);
  assert.equal(result.rowsAffected, 1);
  assert.ok(result.ledger);
  assert.equal(result.ledger.version, 6);
  assert.equal(result.ledger.reservedAmount, Math.max(0, 50 - 25)); // 25
  assert.equal(result.ledger.settledAmount, 10 + 20); // 30
});

test("BudgetRepository updateLedgerWithReservation returns success=true on version match", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 75,
    settledAmount: 10,
    releasedAmount: 5,
    status: "reserving" as const,
    version: 6,
  };

  const reservation = {
    budgetReservationId: "res-1",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  const result = repo.updateLedgerWithReservation(ledger, reservation, 5);

  assert.equal(result.success, true);
  assert.equal(result.rowsAffected, 1);
  assert.ok(result.ledger);
  assert.equal(result.ledger.version, 6);
  assert.equal(result.ledger.reservedAmount, 75);
  assert.equal(result.ledger.status, "reserving");
});

test("BudgetRepository updateLedgerWithRelease returns success=false on version mismatch", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 50,
    settledAmount: 10,
    releasedAmount: 5,
    status: "active" as const,
    version: 5,
  };

  const reservation = {
    budgetReservationId: "res-1",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  const settlement = {
    budgetSettlementId: "set-1",
    budgetReservationId: "res-1",
    actualAmount: 0,
    settlementKind: "release_unused",
    createdAt: "2026-04-27T10:00:00.000Z",
  };

  // Version 3 doesn't match ledger.version (5), so CAS should fail
  const result = repo.updateLedgerWithRelease(ledger, reservation, 3, settlement);

  assert.equal(result.success, false);
  assert.equal(result.rowsAffected, 0);
});

test("BudgetRepository updateLedgerWithRelease returns success=true on version match", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 50,
    settledAmount: 10,
    releasedAmount: 5,
    status: "active" as const,
    version: 5,
  };

  const reservation = {
    budgetReservationId: "res-1",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  const settlement = {
    budgetSettlementId: "set-1",
    budgetReservationId: "res-1",
    actualAmount: 0,
    settlementKind: "release_unused",
    createdAt: "2026-04-27T10:00:00.000Z",
  };

  // Version 5 matches ledger.version, so CAS should succeed
  const result = repo.updateLedgerWithRelease(ledger, reservation, 5, settlement);

  assert.equal(result.success, true);
  assert.equal(result.rowsAffected, 1);
  assert.ok(result.ledger);
  assert.equal(result.ledger.version, 6);
  assert.equal(result.ledger.reservedAmount, Math.max(0, 50 - 25)); // 25
  assert.equal(result.ledger.releasedAmount, 5 + 25); // 30
});

test("BudgetRepository insertLedger does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const ledger = {
    budgetLedgerId: "ledger-new",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "active" as const,
    version: 0,
  };

  assert.doesNotThrow(() => repo.insertLedger(ledger));
});

test("BudgetRepository insertReservation does not throw", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);

  const reservation = {
    budgetReservationId: "res-new",
    budgetLedgerId: "ledger-1",
    harnessRunId: "run-1",
    nodeRunId: null,
    amount: 25,
    resourceKind: "compute" as const,
    status: "active" as const,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-27T10:00:00.000Z",
    version: 0,
  };

  assert.doesNotThrow(() => repo.insertReservation(reservation));
});

test("BudgetRepository listSettlementsByReservation returns empty array", () => {
  const mockConn = {
    prepare: () => ({
      all: () => [],
    }),
  } as any;

  const repo = new BudgetRepository(mockConn);
  const result = repo.listSettlementsByReservation("res-1");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("BudgetRepository integration - full ledger lifecycle", () => {
  const workspace = createTempWorkspace("budget-repo-integration-");
  const dbPath = join(workspace, "budget-integration.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BudgetRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    seedHarnessRunFixture(db, {
      confirmedTaskSpecId: "ctspec-budget-integration",
      requestId: "req-budget-integration",
      harnessRunId: "run-integration",
      budgetLedgerId: "ledger-integration-1",
      tenantId: "tenant-integration",
      traceId: "trace-budget-integration",
      now,
    });

    // Insert a ledger
    const ledger: Parameters<typeof repo.insertLedger>[0] = {
      budgetLedgerId: "ledger-integration-1",
      tenantId: "tenant-integration",
      harnessRunId: "run-integration",
      currency: "USD",
      hardCap: 500,
      reservedAmount: 100,
      settledAmount: 20,
      releasedAmount: 10,
      status: "active",
      version: 0,
    };

    repo.insertLedger(ledger);

    // Retrieve the ledger
    const retrieved = repo.getLedger("ledger-integration-1");
    assert.ok(retrieved);
    assert.equal(retrieved.budgetLedgerId, "ledger-integration-1");
    assert.equal(retrieved.tenantId, "tenant-integration");
    assert.equal(retrieved.hardCap, 500);
    assert.equal(retrieved.reservedAmount, 100);
    assert.equal(retrieved.version, 0);

    // Insert a reservation
    const reservation: Parameters<typeof repo.insertReservation>[0] = {
      budgetReservationId: "res-integration-1",
      budgetLedgerId: "ledger-integration-1",
      harnessRunId: "run-integration",
      nodeRunId: null,
      amount: 50,
      resourceKind: "compute",
      status: "active",
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: now,
      version: 0,
    };

    repo.insertReservation(reservation);

    // Verify reservation was inserted
    const retrievedReservation = repo.getReservation("res-integration-1");
    assert.ok(retrievedReservation);
    assert.equal(retrievedReservation.budgetReservationId, "res-integration-1");
    assert.equal(retrievedReservation.amount, 50);

    // CAS settle - should succeed with version 0
    const settleResult = repo.updateLedgerWithSettle(
      ledger,
      reservation,
      40, // actual amount consumed
      0, // expected version
      {
        budgetSettlementId: "set-integration-1",
        budgetReservationId: "res-integration-1",
        actualAmount: 40,
        settlementKind: "settle",
        createdAt: now,
      },
    );

    assert.equal(settleResult.success, true);
    assert.ok(settleResult.ledger);
    assert.equal(settleResult.ledger.version, 1);
    assert.equal(settleResult.ledger.reservedAmount, 50); // 100 - 50
    assert.equal(settleResult.ledger.settledAmount, 60); // 20 + 40

    // List settlements
    const settlements = repo.listSettlementsByReservation("res-integration-1");
    assert.ok(Array.isArray(settlements));
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].budgetSettlementId, "set-integration-1");

  } finally {
    cleanupPath(workspace);
  }
});

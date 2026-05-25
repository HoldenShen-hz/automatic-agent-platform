/**
 * Unit tests for BudgetRepository with mocks.
 *
 * Tests the BudgetRepository CAS operations for atomic ledger updates.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";
import type { SqliteConnection } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";
import type { BudgetLedger, BudgetReservation, BudgetSettlement } from "../../../../../../src/platform/contracts/types/domain.js";

function createMockConnection(): { exec: () => void; prepare: (sql: string) => { run: (...params: unknown[]) => { changes: number }; all: () => unknown[]; get: () => unknown } } {
  return {
    exec: () => {},
    prepare: (sql: string) => ({
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    }),
  } as unknown as SqliteConnection;
}

function createTestLedger(overrides?: Partial<BudgetLedger>): BudgetLedger {
  return {
    budgetLedgerId: "ledger-001",
    tenantId: "tenant-1",
    harnessRunId: "harness-1",
    currency: "USD",
    hardCap: 100.0,
    reservedAmount: 20.0,
    settledAmount: 5.0,
    releasedAmount: 0.0,
    status: "active",
    version: 1,
    ...overrides,
  };
}

function createTestReservation(overrides?: Partial<BudgetReservation>): BudgetReservation {
  return {
    budgetReservationId: "res-001",
    budgetLedgerId: "ledger-001",
    harnessRunId: "harness-1",
    nodeRunId: null,
    amount: 10.0,
    resourceKind: "execution",
    status: "active",
    expiresAt: "2026-05-20T00:00:00.000Z",
    createdAt: "2026-05-18T00:00:00.000Z",
    version: 0,
    ...overrides,
  };
}

function createTestSettlement(overrides?: Partial<BudgetSettlement>): BudgetSettlement {
  return {
    budgetSettlementId: "settle-001",
    budgetReservationId: "res-001",
    actualAmount: 8.0,
    settlementKind: "settle",
    createdAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  };
}

test("BudgetRepository constructor works with connection", () => {
  const conn = createMockConnection();
  const repo = new BudgetRepository(conn);
  assert.ok(repo instanceof BudgetRepository, "Should create BudgetRepository instance");
});

test("BudgetRepository getLedger returns null for missing ledger", () => {
  const mockPrepare = () => ({
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.getLedger("nonexistent");
  assert.strictEqual(result, null, "Should return null for missing ledger");
});

test("BudgetRepository getLedger returns mapped ledger", () => {
  const mockLedgerRow = {
    budgetLedgerId: "ledger-001",
    tenantId: "tenant-1",
    harnessRunId: "harness-1",
    currency: "USD",
    hardCap: 100.0,
    reservedAmount: 20.0,
    settledAmount: 5.0,
    releasedAmount: 0.0,
    status: "active",
    version: 1,
  };

  const mockPrepare = () => ({
    get: () => mockLedgerRow,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.getLedger("ledger-001");

  assert.ok(result !== null, "Should return a ledger");
  assert.equal(result.budgetLedgerId, "ledger-001");
  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.currency, "USD");
  assert.equal(result.hardCap, 100.0);
  assert.equal(result.reservedAmount, 20.0);
  assert.equal(result.settledAmount, 5.0);
  assert.equal(result.version, 1);
});

test("BudgetRepository getReservation returns null for missing reservation", () => {
  const mockPrepare = () => ({
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.getReservation("nonexistent");
  assert.strictEqual(result, null, "Should return null for missing reservation");
});

test("BudgetRepository getReservation returns mapped reservation with optional nodeRunId", () => {
  const mockReservationRow = {
    budgetReservationId: "res-001",
    budgetLedgerId: "ledger-001",
    harnessRunId: "harness-1",
    nodeRunId: "node-001",
    amount: 10.0,
    resourceKind: "execution",
    status: "active",
    expiresAt: "2026-05-20T00:00:00.000Z",
    createdAt: "2026-05-18T00:00:00.000Z",
    version: 0,
  };

  const mockPrepare = () => ({
    get: () => mockReservationRow,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.getReservation("res-001");

  assert.ok(result !== null, "Should return a reservation");
  assert.equal(result.budgetReservationId, "res-001");
  assert.equal(result.budgetLedgerId, "ledger-001");
  assert.equal(result.amount, 10.0);
  assert.equal(result.resourceKind, "execution");
  assert.ok("nodeRunId" in result, "Should include nodeRunId when present");
});

test("BudgetRepository getReservation returns mapped reservation without nodeRunId", () => {
  const mockReservationRow = {
    budgetReservationId: "res-001",
    budgetLedgerId: "ledger-001",
    harnessRunId: "harness-1",
    nodeRunId: null,
    amount: 10.0,
    resourceKind: "execution",
    status: "active",
    expiresAt: "2026-05-20T00:00:00.000Z",
    createdAt: "2026-05-18T00:00:00.000Z",
    version: 0,
  };

  const mockPrepare = () => ({
    get: () => mockReservationRow,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.getReservation("res-001");

  assert.ok(result !== null, "Should return a reservation");
  assert.ok(!("nodeRunId" in result) || result.nodeRunId === undefined, "Should not have nodeRunId when null");
});

test("BudgetRepository insertLedger calls prepare with correct SQL", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 1 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger();
  repo.insertLedger(ledger);

  assert.ok(capturedSql.includes("INSERT INTO budget_ledgers"), "Should insert into budget_ledgers");
  assert.ok(capturedSql.includes("budget_ledger_id"), "Should include budget_ledger_id column");
  assert.ok(capturedSql.includes("version"), "Should include version column");
  assert.equal(capturedParams[0], "ledger-001", "First param should be budgetLedgerId");
});

test("BudgetRepository insertReservation calls prepare with correct SQL", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 1 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const reservation = createTestReservation();
  repo.insertReservation(reservation);

  assert.ok(capturedSql.includes("INSERT INTO budget_reservations"), "Should insert into budget_reservations");
  assert.ok(capturedSql.includes("budget_reservation_id"), "Should include budget_reservation_id column");
  assert.equal(capturedParams[0], "res-001", "First param should be budgetReservationId");
});

test("BudgetRepository updateLedgerWithSettle returns success on valid CAS", () => {
  const mockPrepare = (sql: string) => {
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger({ version: 1 });
  const reservation = createTestReservation({ amount: 10.0 });
  const settlement = createTestSettlement();

  const result = repo.updateLedgerWithSettle(ledger, reservation, 8.0, 1, settlement);

  assert.equal(result.success, true, "Should return success");
  assert.equal(result.rowsAffected, 1, "Should return 1 affected row");
  assert.ok(result.ledger, "Should return updated ledger");
  assert.equal(result.ledger.version, 2, "Should increment version");
  assert.equal(result.ledger.reservedAmount, 10.0, "Should reduce reserved amount");
  assert.equal(result.ledger.settledAmount, 13.0, "Should increase settled amount");
});

test("BudgetRepository updateLedgerWithReservation returns success on valid CAS", () => {
  const mockPrepare = (_sql: string) => {
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const result = repo.updateLedgerWithReservation(
    createTestLedger({ reservedAmount: 30.0, status: "reserving", version: 2 }),
    createTestReservation(),
    1,
  );

  assert.equal(result.success, true, "Should return success");
  assert.equal(result.rowsAffected, 1, "Should return 1 affected row");
  assert.ok(result.ledger, "Should return updated ledger");
  assert.equal(result.ledger.reservedAmount, 30.0, "Should persist reserved amount from allocator output");
  assert.equal(result.ledger.status, "reserving", "Should persist allocator status");
  assert.equal(result.ledger.version, 2, "Should keep allocator version");
});

test("BudgetRepository updateLedgerWithSettle returns failure on version mismatch", () => {
  const mockPrepare = (sql: string) => {
    return {
      run: () => ({ changes: 0 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger({ version: 2 });
  const reservation = createTestReservation({ amount: 10.0 });
  const settlement = createTestSettlement();

  const result = repo.updateLedgerWithSettle(ledger, reservation, 8.0, 1, settlement);

  assert.equal(result.success, false, "Should return failure");
  assert.equal(result.rowsAffected, 0, "Should return 0 affected rows");
  assert.strictEqual(result.ledger, undefined, "Should not return ledger on failure");
});

test("BudgetRepository updateLedgerWithRelease returns success on valid CAS", () => {
  const mockPrepare = (sql: string) => {
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger({ reservedAmount: 20.0, releasedAmount: 0.0, version: 1 });
  const reservation = createTestReservation({ amount: 10.0 });
  const settlement = createTestSettlement({ actualAmount: 0, settlementKind: "release_unused" });

  const result = repo.updateLedgerWithRelease(ledger, reservation, 1, settlement);

  assert.equal(result.success, true, "Should return success");
  assert.equal(result.rowsAffected, 1, "Should return 1 affected row");
  assert.ok(result.ledger, "Should return updated ledger");
  assert.equal(result.ledger.version, 2, "Should increment version");
  assert.equal(result.ledger.reservedAmount, 10.0, "Should reduce reserved amount");
  assert.equal(result.ledger.releasedAmount, 10.0, "Should increase released amount");
});

test("BudgetRepository updateLedgerWithRelease returns failure on version mismatch", () => {
  const mockPrepare = (sql: string) => {
    return {
      run: () => ({ changes: 0 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger({ version: 5 });
  const reservation = createTestReservation({ amount: 10.0 });
  const settlement = createTestSettlement({ actualAmount: 0, settlementKind: "release_unused" });

  const result = repo.updateLedgerWithRelease(ledger, reservation, 1, settlement);

  assert.equal(result.success, false, "Should return failure on version mismatch");
});

test("BudgetRepository listSettlementsByReservation returns mapped settlements", () => {
  const mockSettlements = [
    {
      budgetSettlementId: "settle-001",
      budgetReservationId: "res-001",
      actualAmount: 8.0,
      settlementKind: "settle",
      createdAt: "2026-05-18T12:00:00.000Z",
    },
    {
      budgetSettlementId: "settle-002",
      budgetReservationId: "res-001",
      actualAmount: 2.0,
      settlementKind: "release_unused",
      createdAt: "2026-05-18T13:00:00.000Z",
    },
  ];

  const mockPrepare = () => ({
    all: () => mockSettlements,
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const results = repo.listSettlementsByReservation("res-001");

  assert.equal(results.length, 2, "Should return 2 settlements");
  assert.equal(results[0].budgetSettlementId, "settle-001");
  assert.equal(results[0].actualAmount, 8.0);
  assert.equal(results[1].budgetSettlementId, "settle-002");
  assert.equal(results[1].settlementKind, "release_unused");
});

test("BudgetRepository updateLedgerWithSettle computes correct amounts", () => {
  let capturedLedgerParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    if (sql.includes("budget_ledgers")) {
      return {
        run: (...params: unknown[]) => {
          capturedLedgerParams = params;
          return { changes: 1 };
        },
        all: () => [],
        get: () => undefined,
      };
    }
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new BudgetRepository(conn);

  const ledger = createTestLedger({ reservedAmount: 50.0, settledAmount: 10.0, releasedAmount: 5.0, version: 1 });
  const reservation = createTestReservation({ amount: 30.0 });
  const settlement = createTestSettlement({ actualAmount: 25.0 });

  repo.updateLedgerWithSettle(ledger, reservation, 25.0, 1, settlement);

  // [newReservedAmount, newSettledAmount, newReleasedAmount, newVersion, ledgerId, expectedVersion]
  assert.equal(capturedLedgerParams[0], 20.0, "New reserved should be 50 - 30");
  assert.equal(capturedLedgerParams[1], 35.0, "New settled should be 10 + 25");
  assert.equal(capturedLedgerParams[2], 10.0, "New released should be 5 + (30 - 25)");
  assert.equal(capturedLedgerParams[3], 2, "New version should be 2");
});

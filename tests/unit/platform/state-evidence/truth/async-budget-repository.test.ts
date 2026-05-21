import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import type { AsyncSqlConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { AsyncBudgetRepository, type BudgetLedger, type BudgetReservation, type BudgetSettlement } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/budget-repository.js";

describe("AsyncBudgetRepository", () => {
  let mockConnection: AsyncSqlConnection;
  let repository: AsyncBudgetRepository;

  const sampleLedger: BudgetLedger = {
    budgetLedgerId: "ledger-001",
    tenantId: "tenant-1",
    harnessRunId: "harness-1",
    currency: "USD",
    hardCap: 10000,
    reservedAmount: 500,
    settledAmount: 200,
    releasedAmount: 100,
    status: "active",
    version: 1,
  };

  const sampleReservation: BudgetReservation = {
    budgetReservationId: "res-001",
    budgetLedgerId: "ledger-001",
    harnessRunId: "harness-1",
    nodeRunId: "node-1",
    amount: 100,
    resourceKind: "compute",
    status: "active",
    expiresAt: "2026-06-01T00:00:00Z",
    createdAt: "2026-05-01T00:00:00Z",
    version: 0,
  };

  const sampleSettlement: BudgetSettlement = {
    budgetSettlementId: "settle-001",
    budgetReservationId: "res-001",
    actualAmount: 80,
    settlementKind: "settle",
    createdAt: "2026-05-15T00:00:00Z",
  };

  beforeEach(() => {
    mockConnection = {
      execute: mock.fn(async () => 1),
      query: mock.fn(async () => []),
      queryOne: mock.fn(async () => null),
      transaction: mock.fn(async () => {}),
    } as unknown as AsyncSqlConnection;
    repository = new AsyncBudgetRepository(mockConnection);
  });

  describe("updateLedgerWithSettle", () => {
    it("should successfully settle and update ledger with CAS", async () => {
      mockConnection.execute = mock.fn(async () => 1);

      const result = await repository.updateLedgerWithSettle(
        sampleLedger,
        sampleReservation,
        80,
        1,
        sampleSettlement,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.rowsAffected, 1);
      assert.strictEqual(result.ledger?.reservedAmount, 400); // 500 - 100
      assert.strictEqual(result.ledger?.settledAmount, 280); // 200 + 80
      assert.strictEqual(result.ledger?.releasedAmount, 120); // 100 + (100 - 80)
      assert.strictEqual(result.ledger?.version, 2);
    });

    it("should return failure when version mismatch", async () => {
      mockConnection.execute = mock.fn(async () => 0);

      const result = await repository.updateLedgerWithSettle(
        sampleLedger,
        sampleReservation,
        80,
        99, // wrong version
        sampleSettlement,
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.rowsAffected, 0);
      assert.strictEqual(result.ledger, undefined);
    });

    it("should compute correct amounts for partial settlement", async () => {
      mockConnection.execute = mock.fn(async () => 1);

      const result = await repository.updateLedgerWithSettle(
        sampleLedger,
        sampleReservation,
        50, // actual amount less than reservation
        1,
        sampleSettlement,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.ledger?.reservedAmount, 400); // max(0, 500 - 100)
      assert.strictEqual(result.ledger?.settledAmount, 250); // 200 + 50
      assert.strictEqual(result.ledger?.releasedAmount, 150); // 100 + (100 - 50)
    });
  });

  describe("updateLedgerWithRelease", () => {
    it("should successfully release reservation and update ledger", async () => {
      mockConnection.execute = mock.fn(async () => 1);

      const releaseSettlement: BudgetSettlement = {
        budgetSettlementId: "release-001",
        budgetReservationId: "res-001",
        actualAmount: 0,
        settlementKind: "release_unused",
        createdAt: "2026-05-15T00:00:00Z",
      };

      const result = await repository.updateLedgerWithRelease(
        sampleLedger,
        sampleReservation,
        1,
        releaseSettlement,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.rowsAffected, 1);
      assert.strictEqual(result.ledger?.reservedAmount, 400); // 500 - 100
      assert.strictEqual(result.ledger?.releasedAmount, 200); // 100 + 100
      assert.strictEqual(result.ledger?.settledAmount, 200); // unchanged
      assert.strictEqual(result.ledger?.version, 2);
    });

    it("should return failure on version mismatch during release", async () => {
      mockConnection.execute = mock.fn(async () => 0);

      const releaseSettlement: BudgetSettlement = {
        budgetSettlementId: "release-001",
        budgetReservationId: "res-001",
        actualAmount: 0,
        settlementKind: "release_unused",
        createdAt: "2026-05-15T00:00:00Z",
      };

      const result = await repository.updateLedgerWithRelease(
        sampleLedger,
        sampleReservation,
        99, // wrong version
        releaseSettlement,
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.ledger, undefined);
    });
  });

  describe("getLedger", () => {
    it("should return null when ledger not found", async () => {
      mockConnection.queryOne = mock.fn(async () => null);

      const result = await repository.getLedger("non-existent");

      assert.strictEqual(result, null);
    });

    it("should return ledger when found", async () => {
      mockConnection.queryOne = mock.fn(async () => ({
        budgetLedgerId: "ledger-001",
        tenantId: "tenant-1",
        harnessRunId: "harness-1",
        currency: "USD",
        hardCap: 10000,
        reservedAmount: 500,
        settledAmount: 200,
        releasedAmount: 100,
        status: "active",
        version: 1,
      }));

      const result = await repository.getLedger("ledger-001");

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.budgetLedgerId, "ledger-001");
      assert.strictEqual(result?.currency, "USD");
    });
  });

  describe("getReservation", () => {
    it("should return null when reservation not found", async () => {
      mockConnection.queryOne = mock.fn(async () => null);

      const result = await repository.getReservation("non-existent");

      assert.strictEqual(result, null);
    });

    it("should return reservation with optional nodeRunId", async () => {
      mockConnection.queryOne = mock.fn(async () => ({
        budgetReservationId: "res-001",
        budgetLedgerId: "ledger-001",
        harnessRunId: "harness-1",
        nodeRunId: "node-1",
        amount: 100,
        resource_kind: "compute",
        status: "active",
        expires_at: "2026-06-01T00:00:00Z",
        created_at: "2026-05-01T00:00:00Z",
        version: 0,
      }));

      const result = await repository.getReservation("res-001");

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.budgetReservationId, "res-001");
      assert.strictEqual(result?.nodeRunId, "node-1");
    });
  });

  describe("insertLedger", () => {
    it("should insert ledger successfully", async () => {
      mockConnection.execute = mock.fn(async () => 1);

      await repository.insertLedger(sampleLedger);

      const executeCall = mockConnection.execute.mock.calls[0];
      assert.strictEqual(executeCall.arguments[0], expect.stringContaining("INSERT INTO budget_ledgers"));
    });
  });

  describe("insertReservation", () => {
    it("should insert reservation with nullable nodeRunId", async () => {
      mockConnection.execute = mock.fn(async () => 1);

      const reservationWithoutNodeRunId: BudgetReservation = {
        ...sampleReservation,
        nodeRunId: undefined as unknown as string,
      };

      await repository.insertReservation(reservationWithoutNodeRunId);

      const executeCall = mockConnection.execute.mock.calls[0];
      assert.strictEqual(executeCall.arguments[0], expect.stringContaining("INSERT INTO budget_reservations"));
    });
  });
});
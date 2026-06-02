import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  ensureBudgetLedger,
  reserveBudgetLedger,
} from "../../../../src/platform/five-plane-execution/budget-ledger-reservation.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { openAuthoritativeStorageContext } from "../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { BudgetRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";

process.env.AA_AUDIT_INTEGRITY_HMAC_KEY ??= "testing-audit-integrity-key-012345";

test("reserveBudgetLedger fail-closes when ledger is missing [budget-ledger-reservation]", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "budget-ledger-reserve-"));
  const dbPath = join(tempDir, "runtime.db");
  const storage = openAuthoritativeStorageContext({ dbPath });
  storage.migrate();

  try {
    assert.throws(
      () =>
        reserveBudgetLedger({
          connection: storage.sql.connection,
          budgetLedgerId: "bledger_missing",
          amount: 1,
          resourceKind: "api",
          allocatorContext: {
            tenantId: "tenant-1",
            traceId: "trace-1",
            emittedBy: "test",
            principal: "test",
          },
        }),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.code === "budget_ledger.not_found",
    );
  } finally {
    storage.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("ensureBudgetLedger inserts missing canonical ledger before reservation [budget-ledger-reservation]", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "budget-ledger-ensure-"));
  const dbPath = join(tempDir, "runtime.db");

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "seed harness run",
      request: "seed harness run",
      stepOutputOverride: { summary: "ok", result: "ok" },
    });
    const storage = openAuthoritativeStorageContext({ dbPath });
    const harnessRun = storage.sql.connection
      .prepare("SELECT harness_run_id AS harnessRunId FROM harness_runs ORDER BY created_at DESC LIMIT 1")
      .get() as { harnessRunId: string } | undefined;
    assert.ok(harnessRun?.harnessRunId);

    const created = ensureBudgetLedger({
      connection: storage.sql.connection,
      budgetLedgerId: "bledger_seeded",
      tenantId: "tenant-1",
      harnessRunId: harnessRun!.harnessRunId,
      currency: "USD",
      hardCap: 5,
    });

    const repository = new BudgetRepository(storage.sql.connection);
    const stored = repository.getLedger(created.budgetLedgerId);
    assert.ok(stored != null);
    assert.equal(stored?.hardCap, 5);
    assert.equal(stored?.tenantId, "tenant-1");
    storage.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("ensureBudgetLedger tolerates a concurrent first-writer without unique-key failure [budget-ledger-reservation]", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "budget-ledger-race-"));
  const dbPath = join(tempDir, "runtime.db");

  try {
    await runSingleTaskExecution({
      dbPath,
      title: "seed harness run race",
      request: "seed harness run race",
      stepOutputOverride: { summary: "ok", result: "ok" },
    });
    const storage = openAuthoritativeStorageContext({ dbPath });
    const harnessRun = storage.sql.connection
      .prepare("SELECT harness_run_id AS harnessRunId FROM harness_runs ORDER BY created_at DESC LIMIT 1")
      .get() as { harnessRunId: string } | undefined;
    assert.ok(harnessRun?.harnessRunId);

    let injected = false;
    const proxiedConnection = {
      exec: storage.sql.connection.exec.bind(storage.sql.connection),
      prepare: (sql: string) => {
        if (!injected && sql.includes("INSERT OR IGNORE INTO budget_ledgers")) {
          injected = true;
          storage.sql.connection.prepare(
            `INSERT INTO budget_ledgers (
              budget_ledger_id, tenant_id, harness_run_id, currency,
              hard_cap, reserved_amount, settled_amount, released_amount,
              status, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            "bledger_raced",
            "tenant-raced",
            harnessRun!.harnessRunId,
            "USD",
            9,
            0,
            0,
            0,
            "open",
            0,
          );
        }
        return storage.sql.connection.prepare(sql);
      },
    };

    const created = ensureBudgetLedger({
      connection: proxiedConnection,
      budgetLedgerId: "bledger_raced",
      tenantId: "tenant-1",
      harnessRunId: harnessRun!.harnessRunId,
      currency: "USD",
      hardCap: 5,
    });

    assert.equal(created.budgetLedgerId, "bledger_raced");
    assert.equal(created.tenantId, "tenant-raced");
    assert.equal(created.hardCap, 9);
    storage.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

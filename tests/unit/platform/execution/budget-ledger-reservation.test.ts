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

test("reserveBudgetLedger fail-closes when ledger is missing", async () => {
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

test("ensureBudgetLedger inserts missing canonical ledger before reservation", async () => {
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

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runSingleTaskExecution } from "../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { runMultiStepOrchestration } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { openAuthoritativeStorageContext } from "../../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { BudgetRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";

test("single-task execution seeds budget ledger before reserving budget", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "single-task-budget-ledger-"));
  const dbPath = join(tempDir, "runtime.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Budget ledger bootstrap",
      request: "Verify canonical budget ledger bootstrap",
      stepOutputOverride: { summary: "ok", result: "ok" },
    });
    const storage = openAuthoritativeStorageContext({ dbPath });
    try {
      const harnessRun = storage.sql.connection
        .prepare("SELECT budget_ledger_id AS budgetLedgerId FROM harness_runs ORDER BY created_at DESC LIMIT 1")
        .get() as { budgetLedgerId: string } | undefined;
      assert.ok(harnessRun?.budgetLedgerId);
      const repository = new BudgetRepository(storage.sql.connection);
      const ledger = repository.getLedger(harnessRun!.budgetLedgerId);
      assert.ok(ledger != null);
      assert.equal(ledger?.tenantId, snapshot.task?.tenantId ?? "tenant:local");
    } finally {
      storage.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("multi-step execution seeds budget ledger before reserving budget", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "multi-step-budget-ledger-"));
  const dbPath = join(tempDir, "runtime.db");

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Budget ledger bootstrap",
      request: "Verify orchestration budget ledger bootstrap",
    });
    const storage = openAuthoritativeStorageContext({ dbPath });
    try {
      const harnessRun = storage.sql.connection
        .prepare("SELECT budget_ledger_id AS budgetLedgerId FROM harness_runs ORDER BY created_at DESC LIMIT 1")
        .get() as { budgetLedgerId: string } | undefined;
      assert.ok(harnessRun?.budgetLedgerId);
      const repository = new BudgetRepository(storage.sql.connection);
      const ledger = repository.getLedger(harnessRun!.budgetLedgerId);
      assert.ok(ledger != null);
      assert.equal(ledger?.tenantId, result.snapshot.task?.tenantId ?? "tenant:local");
    } finally {
      storage.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

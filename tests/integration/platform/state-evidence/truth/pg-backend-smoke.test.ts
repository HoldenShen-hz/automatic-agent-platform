import assert from "node:assert/strict";
import test from "node:test";

import { createAsyncRepositoryRegistry } from "../../../../../src/platform/state-evidence/truth/async-repository-registry.js";
import { createTestPgDatabase, resetPgTables, shouldRunPgIntegration } from "../../../../helpers/pg-test-helper.js";

const pgSupport = shouldRunPgIntegration();

test("PostgreSQL async repository registry smoke", { skip: !pgSupport.enabled }, async () => {
  const db = await createTestPgDatabase();
  try {
    await resetPgTables(db, ["tasks"]);
    const repos = createAsyncRepositoryRegistry(db);
    await repos.task.insertTask({
      id: "pg_task_1",
      parentId: null,
      rootId: "pg_task_1",
      divisionId: null,
      tenantId: null,
      title: "PG smoke task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: "{}",
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
      completedAt: null,
    });
    const task = await repos.task.getTask("pg_task_1");
    assert.equal(task?.title, "PG smoke task");
    const listed = await repos.task.listTasks();
    assert.ok(listed.some((entry) => entry.id === "pg_task_1"));
  } finally {
    await db.close();
  }
});

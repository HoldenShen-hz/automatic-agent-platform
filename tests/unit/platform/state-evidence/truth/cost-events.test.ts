import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { CostEventRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMemoryStore(): { db: SqliteDatabase; store: AuthoritativeTaskStore } {
  const db = new SqliteDatabase(":memory:");
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { db, store };
}

function seedTask(store: AuthoritativeTaskStore, taskId: string): void {
  const now = nowIso();
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    title: "cost test task",
    status: "queued",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("insertCostEvent persists and listCostEventsByTask retrieves cost events", () => {
  const { db, store } = createMemoryStore();
  const taskId = newId("task");
  seedTask(store, taskId);

  const costEvent: CostEventRecord = {
    id: newId("cost"),
    taskId,
    sessionId: null,
    executionId: null,
    agentId: null,
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.012,
    budgetScope: "task_execution",
    providerRequestId: null,
    pricingVersion: "2025-01",
    createdAt: nowIso(),
  };

  store.insertCostEvent(costEvent);
  const events = store.listCostEventsByTask(taskId);
  assert.equal(events.length, 1);
  const first = events[0]!;
  assert.equal(first.provider, "anthropic");
  assert.equal(first.inputTokens, 1000);
  assert.equal(first.outputTokens, 500);
  assert.equal(first.costUsd, 0.012);
  assert.equal(first.budgetScope, "task_execution");
  assert.equal(first.pricingVersion, "2025-01");

  db.close();
});

test("sumCostByTask returns aggregated cost across multiple events", () => {
  const { db, store } = createMemoryStore();
  const taskId = newId("task");
  seedTask(store, taskId);
  const now = nowIso();

  const scopes: CostEventRecord["budgetScope"][] = [
    "task_execution",
    "compaction",
    "skill_execution",
    "recovery_retry",
    "approval_review",
  ];

  for (const [i, scope] of scopes.entries()) {
    store.insertCostEvent({
      id: newId("cost"),
      taskId,
      sessionId: null,
      executionId: null,
      agentId: null,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      inputTokens: 100 * (i + 1),
      outputTokens: 50 * (i + 1),
      costUsd: 0.01 * (i + 1),
      budgetScope: scope,
      providerRequestId: null,
      pricingVersion: null,
      createdAt: now,
    });
  }

  const total = store.sumCostByTask(taskId);
  // 0.01 + 0.02 + 0.03 + 0.04 + 0.05 = 0.15
  assert.ok(Math.abs(total - 0.15) < 0.0001);

  const events = store.listCostEventsByTask(taskId);
  assert.equal(events.length, 5);
  assert.deepEqual(
    events.map((e) => e.budgetScope),
    scopes,
  );

  db.close();
});

test("sumCostByTask returns zero when no cost events exist", () => {
  const { db, store } = createMemoryStore();
  const taskId = newId("task");
  seedTask(store, taskId);

  const total = store.sumCostByTask(taskId);
  assert.equal(total, 0);

  db.close();
});

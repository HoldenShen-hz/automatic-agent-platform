/**
 * Unit Tests: Cost Estimation Service
 *
 * Tests the cost estimation logic based on historical data.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { CostEstimationService } from "../../../../src/scale-ecosystem/marketplace/cost-estimation-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

/**
 * Creates an in-memory database with the necessary schema for cost estimation.
 */
function createTestDb(): AuthoritativeSqlDatabase {
  const db = new DatabaseSync(":memory:");

  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      division_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create cost_events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      session_id TEXT,
      execution_id TEXT,
      agent_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Create an AuthoritativeSqlDatabase-like object where connection === db itself
  // This is because DatabaseSync has prepare/exec directly, and AuthoritativeSqlDatabase
  // wraps it with a connection property
  return {
    filePath: ":memory:",
    connection: db as Pick<DatabaseSync, "exec" | "prepare">,
    migrate: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSchemaStatus: (): any => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertSchemaCurrent: (): any => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    integrityCheck: (): any => [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: ((work: () => unknown) => work()) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readTransaction: ((work: () => unknown) => work()) as any,
    backendType: "sqlite" as const,
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

test("CostEstimationService returns default estimate when no historical data exists", () => {
  const db = createTestDb();
  const service = new CostEstimationService(db);

  const result = service.estimate();

  assert.equal(result.confidence, "default");
  assert.equal(result.sampleCount, 0);
  assert.equal(result.basedOn, "default");
  assert.equal(result.divisionId, null);
  assert.ok(result.estimatedCostUsd > 0, "Should return default cost");
});

test("CostEstimationService uses global average when no division data exists", () => {
  const db = createTestDb();

  // Insert tasks with done status
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_b", "done", "2026-04-01T00:00:00.000Z");

  // Insert cost events
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "openai", "gpt-4", 0.20, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Estimate without division (should use global average)
  const result = service.estimate();

  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.sampleCount, 2);
  assert.equal(result.divisionId, null);
  // Average of 0.10 and 0.20 = 0.15
  assert.ok(Math.abs(result.estimatedCostUsd - 0.15) < 0.001);

});

test("CostEstimationService uses division average when division has sufficient data", () => {
  const db = createTestDb();

  // Insert tasks with done status for division_a
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_a", "failed", "2026-04-01T00:00:00.000Z"); // should be included
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_4", "division_b", "done", "2026-04-01T00:00:00.000Z");

  // Insert cost events
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "anthropic", "claude-3", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "openai", "gpt-4", 0.15, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_4", "task_4", "openai", "gpt-4", 0.50, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Estimate for division_a (should use division average)
  const result = service.estimate("division_a");

  assert.equal(result.basedOn, "division_avg");
  assert.equal(result.divisionId, "division_a");
  assert.equal(result.sampleCount, 3); // 3 done/failed tasks
  // Average of 0.10, 0.20, 0.15 = 0.15
  assert.ok(Math.abs(result.estimatedCostUsd - 0.15) < 0.001);

});

test("CostEstimationService falls back to global when division has no data", () => {
  const db = createTestDb();

  // Insert tasks for different division only
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_b", "done", "2026-04-01T00:00:00.000Z");

  // Insert cost event
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Estimate for division_a (has no data - should fall back to global)
  const result = service.estimate("division_a");

  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.sampleCount, 1);

});

test("CostEstimationService confidence is high with 20+ samples", () => {
  const db = createTestDb();

  // Insert 25 tasks
  for (let i = 0; i < 25; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.01 + i * 0.001, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "high");
  assert.equal(result.sampleCount, 25);

});

test("CostEstimationService confidence is medium with 5-19 samples", () => {
  const db = createTestDb();

  // Insert 10 tasks
  for (let i = 0; i < 10; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.01 + i * 0.001, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "medium");
  assert.equal(result.sampleCount, 10);

});

test("CostEstimationService confidence is low with 1-4 samples", () => {
  const db = createTestDb();

  // Insert 3 tasks
  for (let i = 0; i < 3; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.01 + i * 0.001, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "low");
  assert.equal(result.sampleCount, 3);

});

test("CostEstimationService respects custom config thresholds", () => {
  const db = createTestDb();

  // Insert 15 tasks (would be medium confidence with default config)
  for (let i = 0; i < 15; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.01, "2026-04-01T00:00:00.000Z");
  }

  // With highConfidenceThreshold=10, 15 samples would be high confidence
  const service = new CostEstimationService(db, { highConfidenceThreshold: 10 });

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "high");

});

test("CostEstimationService ignores zero-cost events", () => {
  const db = createTestDb();

  // Insert tasks
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_test", "done", "2026-04-01T00:00:00.000Z");

  // Insert cost events - one zero cost
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "openai", "gpt-4", 0, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  // Zero cost should be excluded, so only 1 sample
  assert.equal(result.sampleCount, 1);
  assert.equal(result.confidence, "low");
  assert.equal(result.estimatedCostUsd, 0.10);

});

test("CostEstimationService only includes done/failed tasks", () => {
  const db = createTestDb();

  // Insert tasks with different statuses
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_test", "failed", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_test", "in_progress", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_4", "division_test", "queued", "2026-04-01T00:00:00.000Z");

  // Insert cost events for all
  for (let i = 1; i <= 4; i++) {
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  // Only done and failed should be included
  assert.equal(result.sampleCount, 2);

});
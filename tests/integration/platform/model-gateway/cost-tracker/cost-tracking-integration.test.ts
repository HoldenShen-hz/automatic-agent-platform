/**
 * Integration Test: Cost Tracking Integration
 *
 * Verifies cost event storage and retrieval
 * using the actual database layer.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("cost tracking: cost events can be stored and retrieved", () => {
  const workspace = createTempWorkspace("aa-cost-");

  try {
    const dbPath = join(workspace, "cost.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const costEventId = newId("cost");
    const taskId = newId("task");
    const now = nowIso();

    // Create parent task first (cost_events has FK to tasks)
    db.connection
      .prepare(
        `INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general-ops",
        null,
        "Cost tracking test",
        "in_progress",
        "user",
        "normal",
        "{}",
        null,
        null,
        0,
        0,
        null,
        now,
        now,
        null,
      );

    // Insert cost event directly using correct schema columns
    db.connection
      .prepare(
        `INSERT INTO cost_events (id, task_id, session_id, execution_id, agent_id, provider, model, input_tokens, output_tokens, cost_usd, budget_scope, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        costEventId,
        taskId,
        null,
        null,
        null,
        "anthropic",
        "claude-3-5-sonnet",
        1000,
        500,
        0.025,
        "task_execution",
        now,
      );

    // Retrieve cost event
    const costEvent = db.connection
      .prepare("SELECT * FROM cost_events WHERE id = ?")
      .get(costEventId) as {
        id: string;
        task_id: string;
        provider: string;
        model: string;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
      } | undefined;

    assert.ok(costEvent, "Cost event should exist");
    assert.equal(costEvent!.task_id, taskId);
    assert.equal(costEvent!.provider, "anthropic");
    assert.equal(costEvent!.model, "claude-3-5-sonnet");
    assert.equal(costEvent!.input_tokens, 1000);
    assert.equal(costEvent!.output_tokens, 500);
    assert.equal(costEvent!.cost_usd, 0.025);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost tracking: multiple cost events for same task can be aggregated", () => {
  const workspace = createTempWorkspace("aa-cost-multi-");

  try {
    const dbPath = join(workspace, "cost-multi.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const taskId = newId("task");
    const now = nowIso();

    // Create parent task first (cost_events has FK to tasks)
    db.connection
      .prepare(
        `INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general-ops",
        null,
        "Cost aggregation test",
        "in_progress",
        "user",
        "normal",
        "{}",
        null,
        null,
        0,
        0,
        null,
        now,
        now,
        null,
      );

    // Insert multiple cost events
    const costs = [
      { tokens: 100, cost: 0.005 },
      { tokens: 200, cost: 0.010 },
      { tokens: 500, cost: 0.025 },
    ];

    for (const c of costs) {
      const costId = newId("cost");
      db.connection
        .prepare(
          `INSERT INTO cost_events (id, task_id, session_id, execution_id, agent_id, provider, model, input_tokens, output_tokens, cost_usd, budget_scope, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(costId, taskId, null, null, null, "openai", "gpt-4", c.tokens, c.tokens * 2, c.cost, "task_execution", now);
    }

    // Query all cost events for task
    const events = db.connection
      .prepare("SELECT * FROM cost_events WHERE task_id = ?")
      .all(taskId) as Array<{ cost_usd: number; input_tokens: number }>;

    assert.equal(events.length, 3, "Should have 3 cost events");

    // Calculate total
    const totalCost = events.reduce((sum, e) => sum + e.cost_usd, 0);
    const totalTokens = events.reduce((sum, e) => sum + e.input_tokens, 0);

    assert.ok(totalCost > 0, "Total cost should be positive");
    assert.equal(totalTokens, 800, "Total tokens should be 800");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost tracking: cost events with different providers", () => {
  const workspace = createTempWorkspace("aa-cost-providers-");

  try {
    const dbPath = join(workspace, "cost-providers.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const taskId = newId("task");
    const now = nowIso();

    // Create parent task first (cost_events has FK to tasks)
    db.connection
      .prepare(
        `INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general-ops",
        null,
        "Cost providers test",
        "in_progress",
        "user",
        "normal",
        "{}",
        null,
        null,
        0,
        0,
        null,
        now,
        now,
        null,
      );

    const providers = [
      { provider: "anthropic", model: "claude-3-5-sonnet", cost: 0.025 },
      { provider: "openai", model: "gpt-4-turbo", cost: 0.015 },
      { provider: "minimax", model: "minimax-text-01", cost: 0.010 },
    ];

    for (const p of providers) {
      const costId = newId("cost");
      db.connection
        .prepare(
          `INSERT INTO cost_events (id, task_id, session_id, execution_id, agent_id, provider, model, input_tokens, output_tokens, cost_usd, budget_scope, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(costId, taskId, null, null, null, p.provider, p.model, 1000, 1000, p.cost, "task_execution", now);
    }

    // Verify all providers were recorded
    const events = db.connection
      .prepare("SELECT provider, model, cost_usd FROM cost_events WHERE task_id = ?")
      .all(taskId) as Array<{ provider: string; model: string; cost_usd: number }>;

    assert.equal(events.length, 3, "Should have cost events for all 3 providers");

    const recordedProviders = events.map((e) => e.provider).sort();
    assert.deepEqual(recordedProviders, ["anthropic", "minimax", "openai"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

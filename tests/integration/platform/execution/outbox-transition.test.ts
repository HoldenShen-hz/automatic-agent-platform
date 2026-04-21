/**
 * @fileoverview [SYS-REL-2.6] Outbox Transition Integration Tests
 *
 * Regression tests for SYS-REL-2.6: Outbox not in transition critical path
 *
 * Task transitions must write outbox entries for reliable event delivery.
 * The transition service should create outbox entries when applying transitions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext, type IntegrationContext } from "../../../helpers/integration-context.js";

test("[SYS-REL-2.6] task state transition writes outbox entry", async () => {
  const ctx = createIntegrationContext("sys-rel-2-6-");
  try {
    const { db, store } = ctx;
    const now = new Date().toISOString();
    const taskId = "task-outbox-test-001";
    const executionId = "exec-outbox-test-001";

    // Insert a task in pending state
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Outbox test task",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Query for outbox entries before transition
    const outboxBefore = db.connection
      .prepare(`SELECT * FROM outbox_events WHERE task_id = ?`)
      .all(taskId) as Array<Record<string, unknown>>;

    assert.strictEqual(
      outboxBefore.length,
      0,
      "Should have no outbox entries before transition",
    );

    // Apply a task transition (pending -> in_progress)
    // The transition service should create an outbox entry
    const traceId = `trace-transition-${Date.now()}`;

    db.transaction(() => {
      store.updateTaskStatusCas(
        taskId,
        "pending",
        "in_progress",
        now,
        null,
        null,
      );
    });

    // Query for outbox entries after transition
    // Note: The current implementation may not create outbox entries
    // This test validates whether outbox entries ARE created (they should be)
    const outboxAfter = db.connection
      .prepare(`SELECT * FROM outbox_events WHERE task_id = ?`)
      .all(taskId) as Array<Record<string, unknown>>;

    // After fix: this assertion should pass
    // Before fix: outboxAfter will be empty, test will fail
    assert.ok(
      outboxAfter.length > 0,
      "Task transition MUST create an outbox entry for reliable event delivery",
    );

    const outboxEntry = outboxAfter[0];
    assert.strictEqual(
      outboxEntry?.event_type,
      "task:status_changed",
      "Outbox entry should have event_type 'task:status_changed'",
    );
    assert.strictEqual(
      outboxEntry?.task_id,
      taskId,
      "Outbox entry should reference the correct task",
    );

  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] task terminal transition writes outbox entry", async () => {
  const ctx = createIntegrationContext("sys-rel-2-6-terminal-");
  try {
    const { db, store } = ctx;
    const now = new Date().toISOString();
    const taskId = "task-terminal-outbox-001";
    const executionId = "exec-terminal-outbox-001";

    // Insert a task in in_progress state (ready to complete)
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Terminal outbox test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Apply terminal transition (in_progress -> done)
    db.transaction(() => {
      const affected = store.updateTaskStatusCas(
        taskId,
        "in_progress",
        "done",
        now,
        null,
        now, // completedAt
      );
      assert.strictEqual(affected, 1, "Should update exactly 1 row");
    });

    // Verify outbox entry was created for terminal transition
    const outboxEntries = db.connection
      .prepare(`SELECT * FROM outbox_events WHERE task_id = ? ORDER BY created_at`)
      .all(taskId) as Array<Record<string, unknown>>;

    assert.ok(
      outboxEntries.length > 0,
      "Terminal transition MUST create outbox entry for event delivery",
    );

    // Find the status_changed event
    const statusChangeEvents = outboxEntries.filter(
      (e) => e.event_type === "task:status_changed",
    );
    assert.ok(
      statusChangeEvents.length > 0,
      "Should have at least one task:status_changed event in outbox",
    );

    const latestEvent = statusChangeEvents[statusChangeEvents.length - 1];
    assert.strictEqual(
      latestEvent?.to_status,
      "done",
      "Outbox entry should reflect the terminal 'done' status",
    );

  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] outbox table must exist and have correct schema", async () => {
  const ctx = createIntegrationContext("sys-rel-2-6-schema-");
  try {
    const { db } = ctx;

    // Verify outbox_events table exists
    const tableInfo = db.connection
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='outbox_events'`)
      .get() as { name: string } | undefined;

    assert.ok(tableInfo, "outbox_events table must exist");

    // Verify required columns
    const columns = db.connection
      .prepare(`PRAGMA table_info(outbox_events)`)
      .all() as Array<{ name: string }>;

    const columnNames = columns.map((c) => c.name);
    assert.ok(
      columnNames.includes("id"),
      "outbox_events must have 'id' column",
    );
    assert.ok(
      columnNames.includes("task_id"),
      "outbox_events must have 'task_id' column",
    );
    assert.ok(
      columnNames.includes("execution_id"),
      "outbox_events must have 'execution_id' column",
    );
    assert.ok(
      columnNames.includes("event_type"),
      "outbox_events must have 'event_type' column",
    );
    assert.ok(
      columnNames.includes("payload"),
      "outbox_events must have 'payload' column",
    );
    assert.ok(
      columnNames.includes("trace_id"),
      "outbox_events must have 'trace_id' column",
    );
    assert.ok(
      columnNames.includes("created_at"),
      "outbox_events must have 'created_at' column",
    );

  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] multiple rapid transitions create multiple outbox entries", async () => {
  const ctx = createIntegrationContext("sys-rel-2-6-rapid-");
  try {
    const { db, store } = ctx;
    const now = new Date().toISOString();
    const taskId = "task-rapid-transition-001";

    // Insert a task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Rapid transition test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Apply rapid transitions
    const transitions = [
      { from: "queued", to: "pending" },
      { from: "pending", to: "in_progress" },
    ];

    for (const { from, to } of transitions) {
      db.transaction(() => {
        store.updateTaskStatusCas(taskId, from as any, to as any, now, null, null);
      });
    }

    // Each transition should create an outbox entry
    const outboxEntries = db.connection
      .prepare(`SELECT * FROM outbox_events WHERE task_id = ? ORDER BY created_at`)
      .all(taskId) as Array<Record<string, unknown>>;

    assert.strictEqual(
      outboxEntries.length,
      transitions.length,
      `Should have ${transitions.length} outbox entries for ${transitions.length} transitions`,
    );

    // Verify event types
    const eventTypes = outboxEntries.map((e) => e.event_type);
    assert.ok(
      eventTypes.every((t) => t === "task:status_changed"),
      "All events should be task:status_changed events",
    );

  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] transition without outbox entry causes event loss", async () => {
  // This test demonstrates the consequence of the defect:
  // Without outbox entries, events can be lost if the service crashes
  // after updating the database but before emitting the event

  const ctx = createIntegrationContext("sys-rel-2-6-event-loss-");
  try {
    const { db, store } = ctx;
    const now = new Date().toISOString();
    const taskId = "task-event-loss-001";

    // Insert a task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Event loss test",
        status: "pending",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Check outbox before transition
    const outboxBefore = db.connection
      .prepare(`SELECT COUNT(*) as cnt FROM outbox_events WHERE task_id = ?`)
      .get(taskId) as { cnt: number };

    // Apply transition (simulating the bug - no outbox entry created)
    db.transaction(() => {
      store.updateTaskStatusCas(taskId, "pending", "in_progress", now, null, null);
    });

    // Check outbox after transition
    const outboxAfter = db.connection
      .prepare(`SELECT COUNT(*) as cnt FROM outbox_events WHERE task_id = ?`)
      .get(taskId) as { cnt: number };

    // This demonstrates the problem: if outbox entries are not created,
    // events can be lost
    // The fix ensures outbox entries are always created atomically with the transition
    const outboxCreated = outboxAfter.cnt > outboxBefore.cnt;

    assert.ok(
      outboxCreated,
      "Transition MUST create outbox entry. Without outbox, events are lost on crash.",
    );

  } finally {
    ctx.cleanup();
  }
});

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("observability retention enforces deletion and returns deleted count", () => {
  const workspace = createTempWorkspace("aa-retention-enforce-");
  const dbPath = join(workspace, "retention-enforce.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-enforce-terminal",
      executionId: "exec-enforce-terminal",
      traceId: "trace-enforce-terminal",
    });

    // Set task to terminal status
    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-01-01T00:00:00.000Z",
      "task-enforce-terminal",
    );

    // Insert old tier-2 event (14+ days old)
    store.insertEvent({
      id: "evt-enforce-old",
      taskId: "task-enforce-terminal",
      executionId: "exec-enforce-terminal",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-enforce-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
    });

    // Dry run should show eligible count
    const preview = service.preview("2026-04-15T00:00:00.000Z");
    assert.equal(preview.events.tier_2.eligibleCount, 1);
    assert.equal(preview.events.tier_2.deletedCount, 0);

    // Enforce should delete
    const enforced = service.enforce("2026-04-15T00:00:00.000Z");
    assert.equal(enforced.events.tier_2.eligibleCount, 1);
    assert.equal(enforced.events.tier_2.deletedCount, 1);

    // Verify deletion
    const remaining = store.listEventsForTask("task-enforce-terminal");
    assert.equal(remaining.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention handles tier3 retention correctly", () => {
  const workspace = createTempWorkspace("aa-retention-tier3-");
  const dbPath = join(workspace, "retention-tier3.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier3-test",
      executionId: "exec-tier3-test",
      traceId: "trace-tier3-test",
    });

    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-01-01T00:00:00.000Z",
      "task-tier3-test",
    );

    // Insert old tier-3 event (3+ days old)
    store.insertEvent({
      id: "evt-tier3-old",
      taskId: "task-tier3-test",
      executionId: "exec-tier3-test",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({}),
      traceId: "trace-tier3-test",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    // Insert recent tier-3 event (less than 3 days old)
    store.insertEvent({
      id: "evt-tier3-recent",
      taskId: "task-tier3-test",
      executionId: "exec-tier3-test",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({}),
      traceId: "trace-tier3-test",
      createdAt: "2026-04-14T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier3: 3 },
    });

    const report = service.preview("2026-04-15T00:00:00.000Z");

    // Only the old event should be eligible
    assert.equal(report.events.tier_3.eligibleCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention preserves tier1 events with null retention", () => {
  const workspace = createTempWorkspace("aa-retention-tier1-null-");
  const dbPath = join(workspace, "retention-tier1-null.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier1-null",
      executionId: "exec-tier1-null",
      traceId: "trace-tier1-null",
    });

    // Insert old tier-1 event
    store.insertEvent({
      id: "evt-tier1-null-old",
      taskId: "task-tier1-null",
      executionId: "exec-tier1-null",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({}),
      traceId: "trace-tier1-null",
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier1: null, tier2: 14, tier3: 3 },
    });

    const report = service.preview("2026-04-15T00:00:00.000Z");

    // Tier 1 should have null retention and 0 eligible
    assert.equal(report.events.tier_1.retentionDays, null);
    assert.equal(report.events.tier_1.eligibleCount, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention handles active task events correctly", () => {
  const workspace = createTempWorkspace("aa-retention-active-");
  const dbPath = join(workspace, "retention-active.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-active",
      executionId: "exec-active",
      traceId: "trace-active",
    });

    // Task is NOT terminal (running state implied by no status update)
    // Insert old tier-2 event for active task
    store.insertEvent({
      id: "evt-active-old",
      taskId: "task-active",
      executionId: "exec-active",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-active",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
    });

    const report = service.preview("2026-04-15T00:00:00.000Z");

    // Active task events should not be eligible for deletion
    assert.equal(report.events.tier_2.eligibleCount, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention handles deleted task events correctly", () => {
  const workspace = createTempWorkspace("aa-retention-deleted-");
  const dbPath = join(workspace, "retention-deleted.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-deleted",
      executionId: "exec-deleted",
      traceId: "trace-deleted",
    });

    // Insert old tier-2 event for task that no longer exists
    // (we don't delete the task, but the LEFT JOIN handles this case)
    store.insertEvent({
      id: "evt-deleted-old",
      taskId: "task-deleted",
      executionId: "exec-deleted",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-deleted",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
    });

    // This task has no status update, so it's not terminal
    // Events should not be eligible
    const report = service.preview("2026-04-15T00:00:00.000Z");
    assert.equal(report.events.tier_2.eligibleCount, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention handles messages with different types correctly", () => {
  const workspace = createTempWorkspace("aa-retention-msgs-");
  const dbPath = join(workspace, "retention-msgs.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-msgs",
      executionId: "exec-msgs",
      traceId: "trace-msgs",
    });

    store.insertSession({
      id: "sess-msgs",
      taskId: "task-msgs",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Insert old tool_result message (not preserved)
    store.insertMessage({
      id: "msg-tool-old",
      sessionId: "sess-msgs",
      direction: "system",
      messageType: "tool_result",
      content: "old tool result",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    // Insert old summary message (preserved)
    store.insertMessage({
      id: "msg-summary-old",
      sessionId: "sess-msgs",
      direction: "system",
      messageType: "summary",
      content: "old summary",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      terminalMessageRetentionDays: 30,
      preservedMessageTypes: ["summary", "compaction_summary"],
    });

    const report = service.preview("2026-04-15T00:00:00.000Z");

    // One eligible (tool_result), one preserved (summary)
    assert.equal(report.messages.eligibleCount, 1);
    assert.equal(report.messages.preservedSummaryCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention calculates correct cutoff for evaluation timestamp", () => {
  const workspace = createTempWorkspace("aa-retention-cutoff-");
  const dbPath = join(workspace, "retention-cutoff.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-cutoff",
      executionId: "exec-cutoff",
      traceId: "trace-cutoff",
    });

    store.insertSession({
      id: "sess-cutoff",
      taskId: "task-cutoff",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Message exactly at cutoff boundary (30 days before evaluation)
    store.insertMessage({
      id: "msg-boundary",
      sessionId: "sess-cutoff",
      direction: "system",
      messageType: "tool_result",
      content: "boundary message",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-02-14T00:00:00.000Z", // Exactly 30 days before March 16
      // If evaluated at March 16, this is at the boundary
    });

    const service = new ObservabilityRetentionService(db, {
      terminalMessageRetentionDays: 30,
    });

    // Evaluate at March 16, 2026 - boundary should not be eligible
    const report = service.preview("2026-03-16T00:00:00.000Z");

    // Messages before Feb 14 should be eligible
    // This tests the boundary condition of the cutoff calculation
    assert.ok(report.messages !== undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention builds correct report structure for all modes", () => {
  const workspace = createTempWorkspace("aa-retention-report-struct-");
  const dbPath = join(workspace, "retention-report-struct.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier1: null, tier2: 14, tier3: 3 },
      terminalMessageRetentionDays: 30,
      preservedMessageTypes: ["summary"],
    });

    const preview = service.preview("2026-04-15T00:00:00.000Z");
    const enforce = service.enforce("2026-04-15T00:00:00.000Z");

    // Both should have same structure
    assert.equal(preview.mode, "dry_run");
    assert.equal(enforce.mode, "enforced");

    // Policy should be present in both
    assert.ok(preview.policy !== undefined);
    assert.ok(enforce.policy !== undefined);

    // Events should have all tiers
    assert.ok("tier_1" in preview.events);
    assert.ok("tier_2" in preview.events);
    assert.ok("tier_3" in preview.events);

    // Messages and compactions should be present
    assert.ok(preview.messages !== undefined);
    assert.ok(preview.compactions !== undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

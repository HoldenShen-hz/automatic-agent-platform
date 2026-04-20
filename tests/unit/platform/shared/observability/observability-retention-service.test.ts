import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ObservabilityRetentionService } from "../../../../../src/platform/shared/observability/observability-retention-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("observability retention preview reports eligible tiered events and preserves summaries", () => {
  const workspace = createTempWorkspace("aa-retention-unit-");
  const dbPath = join(workspace, "retention-unit.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-retention-terminal",
      executionId: "exec-retention-terminal",
      traceId: "trace-retention-terminal",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-retention-active",
      executionId: "exec-retention-active",
      traceId: "trace-retention-active",
    });

    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-01-01T00:00:00.000Z",
      "task-retention-terminal",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, finished_at = ? WHERE id = ?`).run(
      "succeeded",
      "2026-01-01T00:00:00.000Z",
      "exec-retention-terminal",
    );

    store.insertSession({
      id: "sess-retention-terminal",
      taskId: "task-retention-terminal",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertSession({
      id: "sess-retention-active",
      taskId: "task-retention-active",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    store.insertMessage({
      id: "msg-retention-terminal-tool",
      sessionId: "sess-retention-terminal",
      direction: "system",
      messageType: "tool_result",
      content: "old terminal tool output",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-retention-terminal-summary",
      sessionId: "sess-retention-terminal",
      direction: "system",
      messageType: "summary",
      content: "old terminal summary",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-retention-active-tool",
      sessionId: "sess-retention-active",
      direction: "system",
      messageType: "tool_result",
      content: "old active tool output",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertCompactionRecord({
      id: "cmp-retention-1",
      sessionId: "sess-retention-terminal",
      taskId: "task-retention-terminal",
      stage: "summarize",
      sourceMessageIdsJson: JSON.stringify(["msg-retention-terminal-tool"]),
      summaryText: "summary preserved",
      summaryRef: "msg-retention-terminal-summary",
      compactionReason: "retention.test",
      overflowTriggered: 1,
      autoTriggered: 1,
      tokenReductionEstimate: 42,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    store.insertEvent({
      id: "evt-retention-tier1",
      taskId: "task-retention-terminal",
      executionId: "exec-retention-terminal",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ status: "done" }),
      traceId: "trace-retention-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-retention-tier2-terminal",
      taskId: "task-retention-terminal",
      executionId: "exec-retention-terminal",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ status: "terminal" }),
      traceId: "trace-retention-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-retention-tier2-active",
      taskId: "task-retention-active",
      executionId: "exec-retention-active",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ status: "active" }),
      traceId: "trace-retention-active",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-retention-tier3-terminal",
      taskId: "task-retention-terminal",
      executionId: "exec-retention-terminal",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({ chunk: "..." }),
      traceId: "trace-retention-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
      terminalMessageRetentionDays: 30,
    });
    const report = service.preview("2026-04-06T00:00:00.000Z");

    assert.equal(report.events.tier_1.eligibleCount, 0);
    assert.equal(report.events.tier_2.eligibleCount, 1);
    assert.equal(report.events.tier_3.eligibleCount, 1);
    assert.equal(report.messages.eligibleCount, 1);
    assert.equal(report.messages.preservedSummaryCount, 1);
    assert.equal(report.messages.preservedActiveSessionCount, 1);
    assert.equal(report.compactions.preservedCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention reports tier1 events as never eligible for deletion", () => {
  const workspace = createTempWorkspace("aa-retention-tier1-");
  const dbPath = join(workspace, "retention-tier1.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier1",
      executionId: "exec-tier1",
      traceId: "trace-tier1",
    });

    // Insert tier_1 event from 100 days ago (would be eligible for tier2/tier3 but not tier1)
    store.insertEvent({
      id: "evt-tier1-old",
      taskId: "task-tier1",
      executionId: "exec-tier1",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ status: "done" }),
      traceId: "trace-tier1",
      createdAt: "2025-12-31T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
      terminalMessageRetentionDays: 30,
    });
    const report = service.preview("2026-04-06T00:00:00.000Z");

    // Tier 1 events should have null retention (never auto-delete)
    assert.equal(report.events.tier_1.retentionDays, null);
    // Even old tier1 events should not be eligible
    assert.equal(report.events.tier_1.eligibleCount, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("observability retention preserves messages with preserved message types", () => {
  const workspace = createTempWorkspace("aa-retention-preserved-");
  const dbPath = join(workspace, "retention-preserved.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-preserved",
      executionId: "exec-preserved",
      traceId: "trace-preserved",
    });

    store.insertSession({
      id: "sess-preserved",
      taskId: "task-preserved",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Insert messages with preserved message types
    store.insertMessage({
      id: "msg-summary-preserved",
      sessionId: "sess-preserved",
      direction: "system",
      messageType: "summary",
      content: "summary content",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db, {
      eventRetentionDays: { tier2: 14, tier3: 3 },
      terminalMessageRetentionDays: 30,
      preservedMessageTypes: ["summary", "error_recovery"],
    });
    const report = service.preview("2026-04-06T00:00:00.000Z");

    // Summary messages should be preserved
    assert.ok(report.messages.preservedMessageTypes.includes("summary"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

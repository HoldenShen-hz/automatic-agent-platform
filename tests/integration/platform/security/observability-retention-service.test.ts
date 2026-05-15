import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ObservabilityRetentionService } from "../../../../src/platform/shared/observability/observability-retention-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("observability retention enforcement preserves tier1 audit events and active-session messages", () => {
  const workspace = createTempWorkspace("aa-retention-security-");
  const dbPath = join(workspace, "retention-security.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-retention-sec-terminal",
      executionId: "exec-retention-sec-terminal",
      traceId: "trace-retention-sec-terminal",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-retention-sec-active",
      executionId: "exec-retention-sec-active",
      traceId: "trace-retention-sec-active",
    });

    db.connection.prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`).run(
      "done",
      "2026-01-01T00:00:00.000Z",
      "task-retention-sec-terminal",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, finished_at = ? WHERE id = ?`).run(
      "succeeded",
      "2026-01-01T00:00:00.000Z",
      "exec-retention-sec-terminal",
    );

    store.insertSession({
      id: "sess-retention-sec-terminal",
      taskId: "task-retention-sec-terminal",
      channel: "cli",
      status: "completed",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertSession({
      id: "sess-retention-sec-active",
      taskId: "task-retention-sec-active",
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    store.insertMessage({
      id: "msg-retention-sec-terminal-tool",
      sessionId: "sess-retention-sec-terminal",
      direction: "system",
      messageType: "tool_result",
      content: "old terminal tool output",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-retention-sec-terminal-summary",
      sessionId: "sess-retention-sec-terminal",
      direction: "system",
      messageType: "compaction_summary",
      content: "retained compaction summary",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertMessage({
      id: "msg-retention-sec-active-tool",
      sessionId: "sess-retention-sec-active",
      direction: "system",
      messageType: "tool_result",
      content: "active session tool output",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    store.insertEvent({
      id: "evt-retention-sec-tier1",
      taskId: "task-retention-sec-terminal",
      executionId: "exec-retention-sec-terminal",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ status: "done" }),
      traceId: "trace-retention-sec-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-retention-sec-tier2",
      taskId: "task-retention-sec-terminal",
      executionId: "exec-retention-sec-terminal",
      eventType: "dispatch:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ status: "done" }),
      traceId: "trace-retention-sec-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.insertEvent({
      id: "evt-retention-sec-tier3",
      taskId: "task-retention-sec-terminal",
      executionId: "exec-retention-sec-terminal",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({ chunk: "obsolete" }),
      traceId: "trace-retention-sec-terminal",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const service = new ObservabilityRetentionService(db);
    const report = service.enforce("2026-04-06T00:00:00.000Z");

    assert.equal(report.events.tier_1.deletedCount, 0);
    assert.equal(report.events.tier_2.deletedCount, 1);
    assert.equal(report.events.tier_3.deletedCount, 1);
    assert.equal(report.messages.deletedCount, 1);
    assert.equal(store.getEvent("evt-retention-sec-tier1")?.eventType, "task:status_changed");
    assert.equal(store.getEvent("evt-retention-sec-tier2"), null);
    assert.equal(store.getEvent("evt-retention-sec-tier3"), null);
    assert.deepEqual(
      store.listMessagesBySession("sess-retention-sec-terminal").map((message) => message.id),
      ["msg-retention-sec-terminal-summary"],
    );
    assert.deepEqual(
      store.listMessagesBySession("sess-retention-sec-active").map((message) => message.id),
      ["msg-retention-sec-active-tool"],
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

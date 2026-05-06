import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DlqService } from "../../../../../src/platform/state-evidence/events/dlq-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("integration: DlqService persists dead letters across database reopen", () => {
  const workspace = createTempWorkspace("aa-dlq-persistence-");
  const dbPath = join(workspace, "dlq-persistence.db");

  let db: SqliteDatabase | null = null;
  try {
    db = new SqliteDatabase(dbPath);
    db.migrate();
    const writer = new DlqService(undefined, db.connection);
    const record = writer.enqueue({
      sourceEventId: "evt-dlq-persist-001",
      eventType: "task:status_changed",
      consumerId: "consumer-persist",
      errorCode: "delivery.timeout",
      payloadJson: '{"taskId":"persist-1"}',
      originalTimestamp: "2026-05-06T10:00:00.000Z",
      failureCategory: "timeout",
      reason: "consumer timed out",
    });
    writer.linkIncident(record.deadLetterId, "incident-persist-001", "operator-persist");
    db.close();
    db = null;

    db = new SqliteDatabase(dbPath);
    db.migrate();
    const reader = new DlqService(undefined, db.connection);
    const reloaded = reader.get(record.deadLetterId);

    assert.ok(reloaded, "reopened database should still contain the dead-letter record");
    assert.equal(reloaded?.deadLetterId, record.deadLetterId);
    assert.equal(reloaded?.consumerId, "consumer-persist");
    assert.equal(reloaded?.firstFailedAt, "2026-05-06T10:00:00.000Z");
    assert.ok(reloaded?.lastFailedAt !== null);
    assert.equal(reloaded?.failureCategory, "timeout");
    assert.equal(reloaded?.reason, "consumer timed out");
    assert.equal(reloaded?.linkedIncidentId, "incident-persist-001");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

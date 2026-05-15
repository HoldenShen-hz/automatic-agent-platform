import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("tier1 audit integrity report detects tampered event payloads", () => {
  const workspace = createTempWorkspace("aa-audit-integrity-");
  const dbPath = join(workspace, "audit-integrity.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-audit-integrity",
      executionId: "exec-audit-integrity",
      traceId: "trace-audit-integrity",
    });

    store.insertEvent({
      id: "evt-audit-integrity",
      taskId: "task-audit-integrity",
      sessionId: null,
      executionId: "exec-audit-integrity",
      eventType: "task:status_changed",
      payloadJson: "{\"status\":\"executing\"}",
      traceId: "trace-audit-integrity",
      createdAt: "2026-04-07T00:00:00.000Z",
    });

    const cleanReport = store.getTier1AuditIntegrityReport();
    assert.equal(cleanReport.totalTrackedEvents, 1);
    assert.equal(cleanReport.compromisedEvents, 0);

    db.connection
      .prepare("UPDATE events SET payload_json = ? WHERE id = ?")
      .run("{\"status\":\"tampered\"}", "evt-audit-integrity");

    const tamperedReport = store.getTier1AuditIntegrityReport();
    assert.equal(tamperedReport.totalTrackedEvents, 1);
    assert.equal(tamperedReport.compromisedEvents, 1);
    assert.equal(tamperedReport.verifiedEvents, 0);
    assert.ok(tamperedReport.findings.includes("audit_event_checksum_mismatch:evt-audit-integrity"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { StalledExecutionDetector } from "../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("stalled execution detector distinguishes missing heartbeat from no-progress cases", () => {
  const workspace = createTempWorkspace("aa-stalled-");

  try {
    const db = new SqliteDatabase(join(workspace, "stalled.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-heartbeat",
      executionId: "exec-no-heartbeat",
      traceId: "trace-no-heartbeat",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-with-heartbeat",
      executionId: "exec-with-heartbeat",
      traceId: "trace-with-heartbeat",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-fresh",
      executionId: "exec-fresh",
      traceId: "trace-fresh",
    });

    db.transaction(() => {
      db.connection
        .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
        .run("2026-04-03T10:00:00.000Z", "exec-no-heartbeat");
      db.connection
        .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
        .run("2026-04-03T10:00:00.000Z", "exec-with-heartbeat");
      db.connection
        .prepare(`UPDATE executions SET updated_at = ? WHERE id = ?`)
        .run("2026-04-03T10:09:00.000Z", "exec-fresh");

      store.insertHeartbeatSnapshot({
        id: newId("hb"),
        executionId: "exec-with-heartbeat",
        agentId: "agent-1",
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        progressMessage: "still alive",
        cpuPct: 12,
        memoryMb: 64,
        sampledAt: "2026-04-03T10:09:30.000Z",
      });

      store.createTier1StatusEvent({
        taskId: "task-fresh",
        executionId: "exec-fresh",
        eventType: "task:status_changed",
        traceId: "trace-fresh",
        payload: { status: "in_progress" },
      });
      db.connection
        .prepare(`UPDATE events SET created_at = ? WHERE execution_id = ?`)
        .run("2026-04-03T10:09:15.000Z", "exec-fresh");
    });

    const detector = new StalledExecutionDetector(store);
    const findings = detector.detect({
      now: "2026-04-03T10:10:00.000Z",
      staleAfterMs: 5 * 60 * 1000,
      heartbeatGraceMs: 2 * 60 * 1000,
    });

    assert.equal(findings.length, 2);
    assert.ok(
      findings.some(
        (finding) =>
          finding.executionId === "exec-no-heartbeat" &&
          finding.staleKind === "missing_heartbeat" &&
          finding.recommendedAction === "lease_reclaim",
      ),
    );
    assert.ok(
      findings.some(
        (finding) =>
          finding.executionId === "exec-with-heartbeat" &&
          finding.staleKind === "no_progress" &&
          finding.recommendedAction === "restart_or_escalate",
      ),
    );
    assert.ok(findings.every((finding) => finding.executionId !== "exec-fresh"));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

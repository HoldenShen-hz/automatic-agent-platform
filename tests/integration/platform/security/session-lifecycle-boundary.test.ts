import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { RuntimeRepairService } from "../../../../src/platform/five-plane-execution/recovery/runtime-repair-service.js";
import { StartupConsistencyChecker } from "../../../../src/platform/five-plane-execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("runtime repair preserves terminal session history instead of reopening a terminated session", async () => {
  const workspace = createTempWorkspace("aa-security-session-boundary-");

  try {
    const db = new SqliteDatabase(join(workspace, "session-boundary.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const staleAt = "2026-04-04T09:00:00.000Z";
    const now = "2026-04-04T09:10:00.000Z";

    seedTaskAndExecution(db, store, {
      taskId: "task-security-session-boundary",
      executionId: "exec-security-session-boundary",
      traceId: "trace-security-session-boundary",
    });

    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-security-session-boundary",
        divisionId: "general-ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: staleAt,
        updatedAt: staleAt,
      });
      store.insertSession({
        id: "sess-security-terminal",
        taskId: "task-security-session-boundary",
        channel: "cli",
        status: "cancelled",
        externalSessionId: null,
        createdAt: staleAt,
        updatedAt: staleAt,
      });
      store.setTaskState({
        taskId: "task-security-session-boundary",
        status: "pending",
        updatedAt: staleAt,
        errorCode: null,
        completedAt: null,
      });
    });

    const checker = new StartupConsistencyChecker(db, store);
    const report = checker.run({ now });
    const repair = new RuntimeRepairService(db, store);
    const applied = await repair.apply(report);
    const snapshot = store.loadTaskSnapshot("task-security-session-boundary");
    const originalSession = store.getSession("sess-security-terminal");

    assert.ok(applied.some((result) => result.action === "replace_terminal_session" && result.applied));
    assert.equal(originalSession?.status, "cancelled");
    assert.equal(snapshot.session?.status, "open");
    assert.notEqual(snapshot.session?.id, "sess-security-terminal");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

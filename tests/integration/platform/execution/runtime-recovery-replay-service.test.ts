import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { RuntimeRecoveryDecisionService } from "../../../../src/platform/execution/recovery/runtime-recovery-decision-service-root.js";
import { RuntimeRecoveryReplayService } from "../../../../src/platform/execution/recovery/runtime-recovery-replay-service-root.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("runtime recovery replay service builds a deterministic dead-letter replay timeline", () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-replay-dead-letter-");

  try {
    const db = new SqliteDatabase(join(workspace, "runtime-recovery-replay-dead-letter.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-replay-dead-letter",
      executionId: "exec-replay-dead-letter",
      traceId: "trace-replay-dead-letter",
    });

    db.transaction(() => {
      db.connection
        .prepare(
          `UPDATE executions
           SET attempt = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          2,
          "unexpected_runtime_error",
          "tool crashed twice",
          "2026-04-04T10:05:00.000Z",
          "exec-replay-dead-letter",
        );
      store.insertExecutionPrecheck({
        id: "precheck-replay-dead-letter",
        executionId: "exec-replay-dead-letter",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T10:00:05.000Z",
      });
      store.insertEvent({
        id: newId("evt"),
        taskId: "task-replay-dead-letter",
        executionId: "exec-replay-dead-letter",
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: "requeue_execution",
          targetId: "exec-replay-dead-letter",
        }),
        traceId: "trace-replay-dead-letter",
        createdAt: "2026-04-04T10:06:00.000Z",
      });
    });

    const decisionService = new RuntimeRecoveryDecisionService(db, store);
    decisionService.apply("exec-replay-dead-letter", "test_operator");

    const replay = new RuntimeRecoveryReplayService(store);
    const report = replay.buildTaskReplayReport("task-replay-dead-letter", "2026-04-04T10:10:00.000Z");
    const executionReport = report.executions[0];

    assert.equal(report.generatedAt, "2026-04-04T10:10:00.000Z");
    assert.equal(report.outcome, "dead_lettered");
    assert.equal(report.candidateCount, 1);
    assert.equal(report.deadLetterCount, 1);
    assert.equal(report.recoveryEventCount, 3);
    assert.equal(executionReport?.finalOutcome, "dead_lettered");
    assert.equal(executionReport?.deadLetter?.finalReasonCode, "unexpected_runtime_error");
    assert.equal(executionReport?.repairs[0]?.repairAction, "requeue_execution");
    assert.equal(executionReport?.timeline.length, 3);
    assert.deepEqual(
      [...new Set(executionReport?.timeline.map((event) => event.eventType))].sort(),
      ["recovery:dead_lettered", "recovery:decision_recorded", "recovery:repair_applied"],
    );
    assert.equal(executionReport?.decisions[0]?.action, "move_dead_letter");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime recovery replay service marks precheck-denied execution as cancelled", () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-replay-cancel-");

  try {
    const db = new SqliteDatabase(join(workspace, "runtime-recovery-replay-cancel.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-replay-cancel",
      executionId: "exec-replay-cancel",
      traceId: "trace-replay-cancel",
    });

    db.transaction(() => {
      db.connection
        .prepare(
          `UPDATE executions
           SET status = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run("prechecking", "2026-04-04T10:15:00.000Z", "exec-replay-cancel");
      store.insertExecutionPrecheck({
        id: "precheck-replay-cancel",
        executionId: "exec-replay-cancel",
        allowed: 0,
        reasonCode: "permission_denied",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T10:15:05.000Z",
      });
    });

    const decisionService = new RuntimeRecoveryDecisionService(db, store);
    decisionService.apply("exec-replay-cancel", "test_operator");

    const replay = new RuntimeRecoveryReplayService(store);
    const report = replay.buildExecutionReplayReport("exec-replay-cancel", "2026-04-04T10:20:00.000Z");

    assert.equal(report.executionId, "exec-replay-cancel");
    assert.equal(report.latestPrecheck?.allowed, false);
    assert.equal(report.latestPrecheck?.reasonCode, "permission_denied");
    assert.equal(report.finalOutcome, "cancelled");
    assert.equal(report.deadLetter, null);
    assert.deepEqual(
      report.timeline.map((event) => event.eventType),
      ["recovery:decision_recorded", "recovery:cancelled"],
    );
    assert.equal(report.decisions[0]?.action, "cancel");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

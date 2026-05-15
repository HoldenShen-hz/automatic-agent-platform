import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { parseStructuredMemoryContent } from "../../../../src/platform/five-plane-state-evidence/memory/memory-schema.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { RuntimeRecoveryDecisionService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-decision-service-root.js";
import { RuntimeRecoveryService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service-root.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("runtime recovery decision service moves repeated execution failures into dead letter and records audit events", () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-decision-");

  try {
    const db = new SqliteDatabase(join(workspace, "runtime-recovery-decision.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-dead-letter",
      executionId: "exec-dead-letter",
      traceId: "trace-dead-letter",
    });

    db.transaction(() => {
      db.connection
        .prepare(
          `UPDATE executions
           SET status = ?, attempt = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          "executing",
          2,
          "unexpected_runtime_error",
          "tool crashed twice",
          "2026-04-04T10:05:00.000Z",
          "exec-dead-letter",
        );
      store.insertExecutionPrecheck({
        id: "precheck-dead-letter",
        executionId: "exec-dead-letter",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T10:00:05.000Z",
      });
    });

    const decisionService = new RuntimeRecoveryDecisionService(db, store);
    const recoveryService = new RuntimeRecoveryService(store);
    const inspectService = new InspectService(store);

    const decisionOnly = decisionService.decide("exec-dead-letter", "test_operator");
    assert.equal(decisionOnly.action, "move_dead_letter");

    const applied = decisionService.apply("exec-dead-letter", "test_operator");
    const deadLetter = store.getDeadLetterByExecutionId("exec-dead-letter");
    const view = recoveryService.buildRuntimeRecoveryView("task-dead-letter");
    const inspect = inspectService.getTaskInspectView("task-dead-letter");

    assert.equal(applied.applied, true);
    assert.equal(applied.decision.action, "move_dead_letter");
    assert.equal(deadLetter?.executionId, "exec-dead-letter");
    assert.equal(deadLetter?.finalReasonCode, "unexpected_runtime_error");
    assert.equal(deadLetter?.retryCount, 2);
    assert.equal(view.deadLetters.length, 1);
    assert.equal(view.deadLetters[0]?.executionId, "exec-dead-letter");
    const failureMemories = store.listMemories({
      executionId: "exec-dead-letter",
      scopes: ["project"],
      classifications: ["operational"],
      includeRevoked: true,
      includeExpired: true,
      evaluatedAt: "2026-04-04T10:05:00.000Z",
    });
    assert.equal(failureMemories.length, 1);
    const structuredFailureMemory = parseStructuredMemoryContent(failureMemories[0]?.contentJson ?? "{}");
    assert.equal(
      structuredFailureMemory.facts.some((fact) => fact.category === "reason_code" && fact.content === "unexpected_runtime_error"),
      true,
    );
    assert.ok(view.recentRecoveryEvents.some((event) => event.eventType === "recovery:decision_recorded"));
    assert.ok(
      view.recentRecoveryEvents.some(
        (event) => event.eventType === "recovery:dead_lettered" && event.deadLetterId === deadLetter?.id,
      ),
    );
    assert.equal(inspect.runtimeRecovery.deadLetters.length, 1);
    assert.equal(store.getExecution("exec-dead-letter")?.status, "failed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime recovery decision service cancels precheck-denied executions without creating dead letters", () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-cancel-");

  try {
    const db = new SqliteDatabase(join(workspace, "runtime-recovery-cancel.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-precheck-denied",
      executionId: "exec-precheck-denied",
      traceId: "trace-precheck-denied",
    });

    db.transaction(() => {
      db.connection
        .prepare(
          `UPDATE executions
           SET status = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run("prechecking", "2026-04-04T10:15:00.000Z", "exec-precheck-denied");
      store.insertExecutionPrecheck({
        id: "precheck-denied",
        executionId: "exec-precheck-denied",
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
    const recoveryService = new RuntimeRecoveryService(store);

    const applied = decisionService.apply("exec-precheck-denied", "test_operator");
    const view = recoveryService.buildRuntimeRecoveryView("task-precheck-denied");

    assert.equal(applied.applied, true);
    assert.equal(applied.decision.action, "cancel");
    assert.equal(applied.deadLetter, null);
    assert.equal(store.getExecution("exec-precheck-denied")?.status, "cancelled");
    assert.equal(store.getDeadLetterByExecutionId("exec-precheck-denied"), null);
    assert.equal(view.deadLetters.length, 0);
    assert.ok(view.recentRecoveryEvents.some((event) => event.eventType === "recovery:cancelled"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

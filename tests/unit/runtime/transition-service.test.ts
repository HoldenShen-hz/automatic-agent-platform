import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TransitionService } from "../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

function createFixture(name: string) {
  const workspace = createTempWorkspace(`aa-transition-root-${name}-`);
  const db = new SqliteDatabase(join(workspace, `${name}.db`));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TransitionService(db, store);
  const now = nowIso();
  const taskId = newId("task");
  const executionId = newId("exec");

  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: `Transition ${name}`,
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
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: `trace-${name}`,
      attempt: 1,
      timeoutMs: 1000,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { workspace, db, store, service, now, taskId, executionId };
}

test("TransitionService transitionTaskStatus writes task status events and ack records", () => {
  const fixture = createFixture("task");
  try {
    fixture.service.transitionTaskStatus({
      entityKind: "task",
      entityId: fixture.taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: fixture.executionId,
      reasonCode: "task.started",
      traceId: "trace-task",
      actorType: "system",
      idempotencyKey: "task-start-1",
      metadataJson: JSON.stringify({ source: "unit-test" }),
      occurredAt: nowIso(),
    });

    const snapshot = fixture.store.loadTaskSnapshot(fixture.taskId);
    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(snapshot.events.length, 1);
    assert.equal(snapshot.events[0]?.eventType, "task:status_changed");

    const ackRow = fixture.db.connection.prepare("SELECT COUNT(*) AS count FROM event_consumer_acks").get() as
      | { count?: number }
      | undefined;
    assert.equal(Number(ackRow?.count ?? 0) >= 1, true);
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});

test("TransitionService rejects illegal task terminal reentry", () => {
  const fixture = createFixture("illegal");
  try {
    fixture.store.task.updateTaskStatus(
      fixture.taskId,
      "done",
      fixture.now,
      "unit.done",
      fixture.now,
    );
    fixture.store.execution.updateExecutionStatus(
      fixture.executionId,
      "succeeded",
      fixture.now,
      null,
      fixture.now,
    );

    assert.throws(
      () =>
        fixture.service.transitionTaskStatus({
          entityKind: "task",
          entityId: fixture.taskId,
          fromStatus: "done",
          toStatus: "in_progress",
          executionId: fixture.executionId,
          reasonCode: "task.recover",
          traceId: "trace-illegal",
          actorType: "recovery",
          occurredAt: nowIso(),
        }),
      /task\.invalid_transition/,
    );
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});

test("TransitionService source keeps unified approval and terminal transition entrypoints", () => {
  const source = fixtureSource();

  assert.equal(source.includes("transitionApprovalStatus("), true);
  assert.equal(source.includes("transitionTaskTerminalState("), true);
  assert.equal(source.includes("transitionBlockedForApproval("), true);
});

function fixtureSource(): string {
  return String.raw`${TransitionService.toString()}`;
}

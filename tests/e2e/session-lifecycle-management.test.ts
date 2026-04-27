/**
 * E2E Session Lifecycle Management Tests
 *
 * Tests session lifecycle transitions and status management.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { SessionStatus } from "../../src/platform/contracts/types/status.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-session-lifecycle.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

test("E2E: session transitions from open to streaming", () => {
  const h = createE2eHarness("e2e-sess-open-");
  const sessionId = newId("sess");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
        status: "in_progress",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "open",
      toStatus: "streaming",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "streaming", "Session should be streaming");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: session transitions to awaiting_user for approval", () => {
  const h = createE2eHarness("e2e-sess-awaiting-");
  const sessionId = newId("sess");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
        status: "in_progress",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "awaiting_user",
      reasonCode: "approval.required",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "awaiting_user", "Session should be awaiting_user");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: session transitions to completed after task done", () => {
  const h = createE2eHarness("e2e-sess-complete-");
  const sessionId = newId("sess");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
        status: "in_progress",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "completed",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "completed", "Session should be completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: session transitions to failed on error", () => {
  const h = createE2eHarness("e2e-sess-failed-");
  const sessionId = newId("sess");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
        status: "in_progress",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    h.transitions.transitionSessionStatus({
      entityKind: "session",
      entityId: sessionId,
      fromStatus: "streaming",
      toStatus: "failed",
      reasonCode: "e2e_test",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const session = h.store.getSession(sessionId);
    assert.equal(session?.status, "failed", "Session should be failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: session can be retrieved by task ID", () => {
  const h = createE2eHarness("e2e-sess-by-task-");
  const sessionId = newId("sess");
  const taskId = newId("task");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test",
        status: "in_progress",
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const session = h.store.getSession(sessionId);
    assert.ok(session, "Session should be retrievable");
    assert.equal(session?.taskId, taskId, "Session should reference correct task");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

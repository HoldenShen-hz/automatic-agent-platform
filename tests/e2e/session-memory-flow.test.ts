/**
 * E2E Session Memory Flow Tests
 *
 * Tests session lifecycle and memory flows.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-session-memory.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return { workspace, db, store };
}

test("E2E: session lifecycle - creates session and can be retrieved", () => {
  const h = createE2eHarness("e2e-session-lifecycle-");

  try {
    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    // Create a task
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session test task",
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
    });

    // Create a session
    h.db.transaction(() => {
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

    // Verify session exists and is retrievable
    const session = h.store.getSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.equal(session!.id, sessionId, "Session ID should match");
    assert.equal(session!.taskId, taskId, "Session taskId should match");
    assert.equal(session!.status, "streaming", "Session status should be streaming");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multiple sessions can exist for different tasks independently", () => {
  const h = createE2eHarness("e2e-multi-session-");

  try {
    const sessionId1 = newId("sess");
    const sessionId2 = newId("sess");
    const taskId1 = newId("task");
    const taskId2 = newId("task");
    const now = nowIso();

    // Create two tasks and sessions
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId1,
        parentId: null,
        rootId: taskId1,
        divisionId: "general_ops",
        title: "Task 1",
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

      h.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        title: "Task 2",
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
        id: sessionId1,
        taskId: taskId1,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId2,
        taskId: taskId2,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify sessions are independent
    const session1 = h.store.getSession(sessionId1);
    const session2 = h.store.getSession(sessionId2);
    assert.ok(session1, "Session 1 should exist");
    assert.ok(session2, "Session 2 should exist");
    assert.equal(session1!.taskId, taskId1, "Session 1 should belong to task 1");
    assert.equal(session2!.taskId, taskId2, "Session 2 should belong to task 2");

    // Sessions should be isolated - no cross-contamination
    assert.notEqual(session1!.taskId, taskId2, "Session 1 should not belong to task 2");
    assert.notEqual(session2!.taskId, taskId1, "Session 2 should not belong to task 1");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: session summary can be created and retrieved", () => {
  const h = createE2eHarness("e2e-session-summary-");

  try {
    const sessionId = newId("sess");
    const taskId = newId("task");
    const summaryId = newId("summ");
    const now = nowIso();

    // Create task and session
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session summary test",
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

    // Create a session summary
    h.db.transaction(() => {
      h.store.insertSessionSummary({
        id: summaryId,
        sessionId,
        taskId: taskId,
        agentId: null,
        summaryText: "This is a summary of the conversation",
        keyDecisions: null,
        keyOutcomes: null,
        memoryIdsReferenced: null,
        tokenCount: 1000,
        createdAt: now,
      });
    });

    // Verify summary is retrievable
    const summary = h.store.getLatestSessionSummary(sessionId);
    assert.ok(summary, "Summary should exist");
    assert.equal(summary!.sessionId, sessionId, "Summary sessionId should match");
    assert.ok(summary!.summaryText.includes("summary"), "Summary text should be preserved");
    assert.equal(summary!.tokenCount, 1000, "Token count should be preserved");
  } finally {
    cleanupPath(h.workspace);
  }
});

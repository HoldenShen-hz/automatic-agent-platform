/**
 * Integration Test: Session Lifecycle
 *
 * Verifies session lifecycle: creation, message accumulation,
 * status transitions, and session summary generation.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SessionSummaryService } from "../../../../../src/platform/five-plane-state-evidence/memory/session-summary-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("session lifecycle: session can be created and messages added", () => {
  const workspace = createTempWorkspace("aa-session-lifecycle-");

  try {
    const dbPath = join(workspace, "session-lifecycle.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session lifecycle test",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify session exists
    const session = store.getSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.equal(session!.id, sessionId);
    assert.equal(session!.taskId, taskId);
    assert.equal(session!.status, "open");

    // Add messages to session
    db.transaction(() => {
      store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "inbound",
        messageType: "text",
        content: "Hello",
        partsJson: JSON.stringify([{ type: "text", text: "Hello" }]),
        attachmentsJson: null,
        createdAt: nowIso(),
      });

      store.insertMessage({
        id: newId("msg"),
        sessionId,
        direction: "outbound",
        messageType: "text",
        content: "Hi there!",
        partsJson: JSON.stringify([{ type: "text", text: "Hi there!" }]),
        attachmentsJson: null,
        createdAt: nowIso(),
      });
    });

    // Verify messages are stored
    const messages = store.listMessagesBySession(sessionId);
    assert.equal(messages.length, 2, "Should have 2 messages");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("session lifecycle: session status transitions work correctly", () => {
  const workspace = createTempWorkspace("aa-session-status-");

  try {
    const dbPath = join(workspace, "session-status.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create session in open status
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Session status test",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Transition to streaming
    db.transaction(() => {
      store.updateSessionStatus(sessionId, "streaming", nowIso());
    });

    const streamingSession = store.getSession(sessionId);
    assert.equal(streamingSession!.status, "streaming", "Session should be in streaming status");

    // Transition to awaiting_user
    db.transaction(() => {
      store.updateSessionStatus(sessionId, "awaiting_user", nowIso());
    });

    const awaitingSession = store.getSession(sessionId);
    assert.equal(awaitingSession!.status, "awaiting_user", "Session should be in awaiting_user status");

    // Transition to completed
    db.transaction(() => {
      store.updateSessionStatus(sessionId, "completed", nowIso());
    });

    const completedSession = store.getSession(sessionId);
    assert.equal(completedSession!.status, "completed", "Session should be in completed status");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("session lifecycle: session summary is generated correctly", () => {
  const workspace = createTempWorkspace("aa-session-summary-");

  try {
    const dbPath = join(workspace, "session-summary.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const summaryService = new SessionSummaryService(store);

    const taskId = newId("task");
    const sessionId = newId("sess");

    // Create summary
    const summary = summaryService.createSummary({
      sessionId,
      taskId,
      agentId: "agent-1",
      summaryText: "Completed user request successfully.",
      keyDecisions: ["Used file edit tool for existing file modification"],
      keyOutcomes: ["Task completed with output verified"],
    });

    // Verify summary structure
    assert.ok(summary.id.startsWith("summ_"), "Summary ID should have correct prefix");
    assert.equal(summary.sessionId, sessionId);
    assert.equal(summary.taskId, taskId);
    assert.ok(summary.summaryText.length > 0, "Summary text should not be empty");

    // Verify JSON fields
    const decisions = JSON.parse(summary.keyDecisions!);
    assert.ok(Array.isArray(decisions), "Key decisions should be an array");

    const outcomes = JSON.parse(summary.keyOutcomes!);
    assert.ok(Array.isArray(outcomes), "Key outcomes should be an array");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("session lifecycle: selectLatestSessionByTask returns correct session", () => {
  const workspace = createTempWorkspace("aa-session-latest-");

  try {
    const dbPath = join(workspace, "session-latest.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const sessionId1 = newId("sess");
    const sessionId2 = newId("sess");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Latest session test",
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

    // Create first session
    db.transaction(() => {
      store.insertSession({
        id: sessionId1,
        taskId,
        channel: "cli",
        status: "completed",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create second session (should be latest by updatedAt)
    const later = nowIso();
    db.transaction(() => {
      store.insertSession({
        id: sessionId2,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: later,
        updatedAt: later,
      });
    });

    // selectLatestSessionByTask should return the most recently updated session
    const latestSession = store.selectLatestSessionByTask(taskId);
    assert.ok(latestSession, "Should return a session");
    assert.equal(latestSession!.id, sessionId2, "Should return the second session (most recent)");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

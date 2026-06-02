/**
 * Integration Tests: Session Repository Operations
 *
 * Tests for session CRUD operations using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("session repository persists and retrieves session", () => {
  const ctx = createIntegrationContext("aa-session-repo-");
  try {
    const taskId = "task-session-001";
    const sessionId = "session-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-session",
        title: "Session Test Task",
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

      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "console",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const session = ctx.store.getSession(sessionId);

    assert.ok(session, "Session should be retrieved");
    assert.equal(session!.id, sessionId);
    assert.equal(session!.taskId, taskId);
    assert.equal(session!.channel, "console");
    assert.equal(session!.status, "open");
  } finally {
    ctx.cleanup();
  }
});

test("session repository returns null for non-existent session", () => {
  const ctx = createIntegrationContext("aa-session-notfound-");
  try {
    const result = ctx.store.getSession("non-existent-session");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("session repository updates session status", () => {
  const ctx = createIntegrationContext("aa-session-update-");
  try {
    const taskId = "task-session-update";
    const sessionId = "session-update-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-session-update",
        title: "Session Update Test",
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

      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "console",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const closeTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateSessionStatus(sessionId, "completed", closeTime);
    });

    const updated = ctx.store.getSession(sessionId);
    assert.equal(updated!.status, "completed");
    assert.equal(updated!.updatedAt, closeTime);
  } finally {
    ctx.cleanup();
  }
});

test("session repository lists sessions by task", () => {
  const ctx = createIntegrationContext("aa-session-list-");
  try {
    const taskId = "task-session-list";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-session-list",
        title: "Session List Test",
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

      // Create multiple sessions
      ctx.store.insertSession({
        id: "session-list-1",
        taskId,
        channel: "console",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      ctx.store.insertSession({
        id: "session-list-2",
        taskId,
        channel: "api",
        status: "completed",
        externalSessionId: "ext-session-123",
        createdAt: now,
        updatedAt: now,
      });
    });

    const sessions = ctx.store.listSessionsByTask(taskId);
    assert.equal(sessions.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("session repository tracks latest session by task", () => {
  const ctx = createIntegrationContext("aa-session-latest-");
  try {
    const taskId = "task-session-latest";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        tenantId: "tenant-session-latest",
        title: "Latest Session Test",
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

      ctx.store.insertSession({
        id: "session-old",
        taskId,
        channel: "console",
        status: "completed",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Wait a bit and create newer session
    const newerTime = new Date(Date.now() + 1000).toISOString();
    ctx.db.transaction(() => {
      ctx.store.insertSession({
        id: "session-new",
        taskId,
        channel: "console",
        status: "open",
        externalSessionId: null,
        createdAt: newerTime,
        updatedAt: newerTime,
      });
    });

    const latest = ctx.store.selectLatestSessionByTask(taskId);
    assert.ok(latest, "Should have a latest session");
    assert.equal(latest!.id, "session-new");
  } finally {
    ctx.cleanup();
  }
});

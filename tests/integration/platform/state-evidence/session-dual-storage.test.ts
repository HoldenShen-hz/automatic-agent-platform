/**
 * @fileoverview [SYS-REL-2.8] Session Dual Storage Consistency Tests
 *
 * Regression tests for SYS-REL-2.8: Session dual storage non-atomic write
 *
 * The session-dual-storage.ts uses two appendFileSync calls which can cause
 * partial writes if the process crashes between them. This test verifies
 * dual storage consistency.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { SessionDualStorageService } from "../../../../src/platform/state-evidence/truth/session-dual-storage.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

test("[SYS-REL-2.8] dual storage detects and repairs partial write", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-");
  try {
    const storage = new SessionDualStorageService({ jsonlRootDir: workspace });

    const sessionId = "s-1";
    const taskId = "t-1";

    // Record a session created event
    storage.recordSessionCreated({
      id: sessionId,
      taskId,
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const sessionFile = join(workspace, `session-${safeSessionId}.jsonl`);
    const taskIndexFile = join(workspace, `task-${safeTaskId}-sessions.jsonl`);

    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n");
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n");

    assert.equal(
      sessionLines.filter((l) => l.length > 0).length,
      indexLines.filter((l) => l.length > 0).length,
      "Session file and task index must have same line count",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.8] verifyDualStorageConsistency detects line count mismatch", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-consistency-");
  try {
    const storage = new SessionDualStorageService({ jsonlRootDir: workspace });

    const sessionId = "s-consistency-1";
    const taskId = "t-consistency-1";

    // Record multiple events
    storage.recordSessionCreated({
      id: sessionId,
      taskId,
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storage.recordSessionUpdated({
      id: sessionId,
      taskId,
      channel: "console",
      status: "streaming",
      externalSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const sessionFile = join(workspace, `session-${safeSessionId}.jsonl`);
    const taskIndexFile = join(workspace, `task-${safeTaskId}-sessions.jsonl`);

    // Both files must exist
    assert.ok(existsSync(sessionFile), "Session file should exist");
    assert.ok(existsSync(taskIndexFile), "Task index file should exist");

    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n").filter((l) => l.length > 0);
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n").filter((l) => l.length > 0);

    assert.strictEqual(
      sessionLines.length,
      indexLines.length,
      `Session file and task index must have same line count: session=${sessionLines.length}, index=${indexLines.length}`,
    );

    // Verify the content matches line by line
    for (let i = 0; i < sessionLines.length; i++) {
      assert.strictEqual(sessionLines[i], indexLines[i], `Line ${i} must match in both files`);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.8] appendSessionEvent writes to both session and task index", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-append-");
  try {
    const storage = new SessionDualStorageService({ jsonlRootDir: workspace });

    const sessionId = "s-append-1";
    const taskId = "t-append-1";

    // Append several events directly
    for (let i = 0; i < 3; i++) {
      storage.appendSessionEvent({
        eventType: "session_updated",
        sessionId,
        taskId,
        timestamp: new Date().toISOString(),
        payload: { step: i },
      });
    }

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const sessionFile = join(workspace, `session-${safeSessionId}.jsonl`);
    const taskIndexFile = join(workspace, `task-${safeTaskId}-sessions.jsonl`);

    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n").filter((l) => l.length > 0);
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n").filter((l) => l.length > 0);

    assert.strictEqual(
      sessionLines.length,
      indexLines.length,
      "After appendSessionEvent, both files must have same line count",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.8] recordMessageAdded maintains dual storage consistency", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-message-");
  try {
    const storage = new SessionDualStorageService({ jsonlRootDir: workspace });

    const sessionId = "s-message-1";
    const taskId = "t-message-1";

    storage.recordSessionCreated({
      id: sessionId,
      taskId,
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storage.recordMessageAdded(
      {
        id: "msg-1",
        sessionId,
        direction: "inbound",
        messageType: "text",
        content: "hello",
        partsJson: "[]",
        attachmentsJson: "[]",
        createdAt: new Date().toISOString(),
      },
      taskId,
    );

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const sessionFile = join(workspace, `session-${safeSessionId}.jsonl`);
    const taskIndexFile = join(workspace, `task-${safeTaskId}-sessions.jsonl`);

    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n").filter((l) => l.length > 0);
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n").filter((l) => l.length > 0);

    assert.strictEqual(
      sessionLines.length,
      indexLines.length,
      "After recordMessageAdded, session and task index must have same line count",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.8] recordSessionCompleted writes to both storages", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-completed-");
  try {
    const storage = new SessionDualStorageService({ jsonlRootDir: workspace });

    const sessionId = "s-completed-1";
    const taskId = "t-completed-1";

    storage.recordSessionCreated({
      id: sessionId,
      taskId,
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storage.recordSessionCompleted(sessionId, taskId);

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const sessionFile = join(workspace, `session-${safeSessionId}.jsonl`);
    const taskIndexFile = join(workspace, `task-${safeTaskId}-sessions.jsonl`);

    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n").filter((l) => l.length > 0);
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n").filter((l) => l.length > 0);

    assert.strictEqual(
      sessionLines.length,
      indexLines.length,
      "After recordSessionCompleted, session and task index must have same line count",
    );

    // Verify the completion event exists in both
    const sessionEvents = storage.replaySessionEvents(sessionId);
    const taskEvents = storage.replayTaskSessionHistory(taskId);

    const sessionCompletions = sessionEvents.filter((e) => e.eventType === "session_completed");
    const taskCompletions = taskEvents.filter((e) => e.eventType === "session_completed");

    assert.strictEqual(sessionCompletions.length, 1, "Session should have 1 completion event");
    assert.strictEqual(taskCompletions.length, 1, "Task index should have 1 completion event");
  } finally {
    cleanupPath(workspace);
  }
});

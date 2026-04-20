import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SessionDualStorageService, type SessionEvent } from "../../../../../src/platform/state-evidence/truth/session-dual-storage.js";
import type { MessageRecord, SessionRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestStorage(): { storage: SessionDualStorageService; rootDir: string } {
  const rootDir = join("/tmp", `session-dual-storage-test-${Date.now()}`);
  const storage = new SessionDualStorageService({ jsonlRootDir: rootDir });
  return { storage, rootDir };
}

function cleanup(rootDir: string): void {
  try {
    rmSync(rootDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test("SessionDualStorageService records session_created event", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-123",
      taskId: "task-456",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordSessionCreated(session);

    const events = storage.replaySessionEvents("session-123");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "session_created");
    assert.equal(events[0]?.sessionId, "session-123");
    assert.equal(events[0]?.taskId, "task-456");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService records multiple session events", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-multi",
      taskId: "task-multi",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordSessionCreated(session);

    const updatedSession: SessionRecord = {
      ...session,
      status: "completed",
      updatedAt: "2026-04-08T00:01:00.000Z",
    };
    storage.recordSessionUpdated(updatedSession);

    storage.recordSessionCompleted("session-multi", "task-multi");

    const events = storage.replaySessionEvents("session-multi");
    assert.equal(events.length, 3);
    assert.equal(events[0]?.eventType, "session_created");
    assert.equal(events[1]?.eventType, "session_updated");
    assert.equal(events[2]?.eventType, "session_completed");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService records message_added events", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const message: MessageRecord = {
      id: "msg-1",
      sessionId: "session-msg",
      direction: "inbound",
      messageType: "user",
      content: "Hello",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordMessageAdded(message, "task-msg");

    const events = storage.replaySessionEvents("session-msg");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "message_added");
    assert.equal(events[0]?.payload.content, "Hello");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService records session_failed event with error code", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    storage.recordSessionFailed("session-fail", "task-fail", "session_timeout");

    const events = storage.replaySessionEvents("session-fail");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "session_failed");
    assert.equal(events[0]?.payload.errorCode, "session_timeout");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService records session_cancelled event", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    storage.recordSessionCancelled("session-cancel", "task-cancel");

    const events = storage.replaySessionEvents("session-cancel");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "session_cancelled");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService records compaction events", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    storage.recordCompaction("session-compact", "task-compact", {
      messageCount: 100,
      tokenCount: 5000,
      compactedMessages: 50,
    });

    const events = storage.replaySessionEvents("session-compact");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "compaction_recorded");
    assert.equal(events[0]?.payload.messageCount, 100);
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService replayTaskSessionHistory returns all session events for task", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session1: SessionRecord = {
      id: "session-task-1",
      taskId: "task-share",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    const session2: SessionRecord = {
      id: "session-task-2",
      taskId: "task-share",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:02:00.000Z",
      updatedAt: "2026-04-08T00:02:00.000Z",
    };

    storage.recordSessionCreated(session1);
    storage.recordSessionCreated(session2);

    const events = storage.replayTaskSessionHistory("task-share");
    assert.equal(events.length, 2);
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService getSessionReplaySummary returns correct summary", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-summary",
      taskId: "task-summary",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordSessionCreated(session);
    storage.recordSessionUpdated(session);

    const message: MessageRecord = {
      id: "msg-summary",
      sessionId: "session-summary",
      direction: "inbound",
      messageType: "user",
      content: "Test",
      partsJson: null,
      attachmentsJson: null,
      createdAt: "2026-04-08T00:01:00.000Z",
    };
    storage.recordMessageAdded(message, "task-msg");

    const summary = storage.getSessionReplaySummary("session-summary");
    assert.equal(summary.eventCount, 3);
    assert.ok(summary.firstEvent != null);
    assert.ok(summary.lastEvent != null);
    assert.ok(summary.eventTypes.includes("session_created"));
    assert.ok(summary.eventTypes.includes("session_updated"));
    assert.ok(summary.eventTypes.includes("message_added"));
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService replaySessionEvents returns empty array for non-existent session", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const events = storage.replaySessionEvents("non-existent");
    assert.equal(events.length, 0);
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService replayTaskSessionHistory and summary are empty for unknown ids", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    assert.deepEqual(storage.replayTaskSessionHistory("task-missing"), []);

    const summary = storage.getSessionReplaySummary("session-missing");
    assert.equal(summary.eventCount, 0);
    assert.equal(summary.firstEvent, null);
    assert.equal(summary.lastEvent, null);
    assert.deepEqual(summary.eventTypes, []);
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService verifyDualStorageConsistency passes when events exist", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-verify",
      taskId: "task-verify",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordSessionCreated(session);

    const result = storage.verifyDualStorageConsistency(session, "open");
    assert.equal(result.consistent, true);
    assert.equal(result.issues.length, 0);
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService verifyDualStorageConsistency detects missing events", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-verify-missing",
      taskId: "task-verify-missing",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    const result = storage.verifyDualStorageConsistency(session, "open");
    assert.equal(result.consistent, false);
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.some((i) => i.includes("No events found")));
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService verifyDualStorageConsistency detects status mismatches and missing created events", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    storage.appendSessionEvent({
      eventType: "session_updated",
      sessionId: "session-mismatch",
      taskId: "task-mismatch",
      timestamp: "2026-04-08T00:05:00.000Z",
      payload: { status: "failed" },
    });

    const session: SessionRecord = {
      id: "session-mismatch",
      taskId: "task-mismatch",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:05:00.000Z",
    };

    const result = storage.verifyDualStorageConsistency(session, "completed");
    assert.equal(result.consistent, false);
    assert.ok(result.issues.some((issue) => issue.includes("Missing session_created event")));
    assert.ok(result.issues.some((issue) => issue.includes("Status mismatch: JSONL=failed, SQLite=completed")));
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService appendSessionEvent appends raw event", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    storage.appendSessionEvent({
      eventType: "session_created",
      sessionId: "session-raw",
      taskId: "task-raw",
      timestamp: "2026-04-08T00:00:00.000Z",
      payload: { customField: "test" },
    });

    const events = storage.replaySessionEvents("session-raw");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.payload.customField, "test");
  } finally {
    cleanup(rootDir);
  }
});

test("SessionDualStorageService handles special characters in session IDs", () => {
  const { storage, rootDir } = createTestStorage();
  try {
    const session: SessionRecord = {
      id: "session-with-dashes_and_underscores",
      taskId: "task-special",
      channel: "test",
      status: "open",
      externalSessionId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    };

    storage.recordSessionCreated(session);

    const events = storage.replaySessionEvents("session-with-dashes_and_underscores");
    assert.equal(events.length, 1);
    assert.equal(events[0]?.sessionId, "session-with-dashes_and_underscores");
  } finally {
    cleanup(rootDir);
  }
});

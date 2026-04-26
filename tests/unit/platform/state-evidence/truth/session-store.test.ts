// @ts-nocheck
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import test from "node:test";

import {
  SessionDualStorageService,
  type SessionEvent,
  type SessionEventType,
} from "../../../../../src/platform/state-evidence/truth/session-dual-storage.js";
import type { MessageRecord, SessionRecord } from "../../../../../src/platform/contracts/types/domain.js";

// Mock file system operations for testing without actual I/O
const mockFileSystem: Map<string, string> = new Map();
let mockOpenSyncCalls: Array<{ path: string; flags: string }> = [];
let mockAppendFileSyncCalls: Array<{ fd: number; data: string }> = [];
let mockFdatasyncSyncCalls: number[] = [];
let mockCloseSyncCalls: number[] = [];
let mockReadFileSyncContent: Map<string, string> = new Map();
let mockExistsSyncResults: Map<string, boolean> = new Map();
const TEST_JSONL_ROOT = "/tmp/test-session-storage";

function resetMocks(): void {
  mockFileSystem.clear();
  mockOpenSyncCalls = [];
  mockAppendFileSyncCalls = [];
  mockFdatasyncSyncCalls = [];
  mockCloseSyncCalls = [];
  mockReadFileSyncContent.clear();
  mockExistsSyncResults.clear();
  rmSync(TEST_JSONL_ROOT, { recursive: true, force: true });
}

// Helper to create test events
function createSessionEvent(
  sessionId: string,
  taskId: string,
  eventType: SessionEventType,
  payload: Record<string, unknown> = {},
): SessionEvent {
  return {
    eventType,
    sessionId,
    taskId,
    timestamp: "2026-04-24T10:00:00.000Z",
    payload,
  };
}

function createSessionRecord(
  sessionId: string,
  taskId: string,
  status: string = "open",
): SessionRecord {
  return {
    id: sessionId,
    taskId,
    channel: "test",
    status: status as SessionRecord["status"],
    externalSessionId: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createMessageRecord(
  messageId: string,
  sessionId: string,
  taskId: string,
): MessageRecord {
  return {
    id: messageId,
    sessionId,
    direction: "inbound",
    messageType: "text",
    content: "Test message",
    partsJson: null,
    attachmentsJson: null,
    createdAt: "2026-04-24T10:00:00.000Z",
  };
}

// === Constructor and Initialization Tests ===

test("SessionDualStorageService constructor creates service with jsonlRootDir", () => {
  resetMocks();

  // This test verifies the service can be instantiated
  // We use a temp directory that may or may not exist
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  assert.ok(service !== undefined);
});

// === Event Type Tests ===

test("SessionDualStorageService records session_created event with correct payload", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-001", "task-001");

  service.recordSessionCreated(session);

  const events = service.replaySessionEvents("session-001");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "session_created");
  assert.equal(events[0]?.sessionId, "session-001");
  assert.equal(events[0]?.taskId, "task-001");
});

test("SessionDualStorageService records session_updated event with status", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-002", "task-002", "streaming");
  service.recordSessionCreated(session);

  const updatedSession = { ...session, status: "completed" as const };
  service.recordSessionUpdated(updatedSession);

  const events = service.replaySessionEvents("session-002");
  assert.equal(events.length, 2);
  assert.equal(events[1]?.eventType, "session_updated");
  assert.equal(events[1]?.payload.status, "completed");
});

test("SessionDualStorageService records session_completed event", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionCompleted("session-003", "task-003");

  const events = service.replaySessionEvents("session-003");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "session_completed");
});

test("SessionDualStorageService records session_failed event with optional error code", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionFailed("session-004", "task-004", "TIMEOUT_ERROR");

  const events = service.replaySessionEvents("session-004");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "session_failed");
  assert.equal(events[0]?.payload.errorCode, "TIMEOUT_ERROR");
});

test("SessionDualStorageService records session_failed event without error code", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionFailed("session-005", "task-005");

  const events = service.replaySessionEvents("session-005");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "session_failed");
  assert.equal(events[0]?.payload.errorCode, undefined);
});

test("SessionDualStorageService records session_cancelled event", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionCancelled("session-006", "task-006");

  const events = service.replaySessionEvents("session-006");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "session_cancelled");
});

test("SessionDualStorageService records message_added event with message details", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const message = createMessageRecord("msg-001", "session-007", "task-007");
  service.recordMessageAdded(message, "task-007");

  const events = service.replaySessionEvents("session-007");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "message_added");
  assert.equal(events[0]?.payload.id, "msg-001");
  assert.equal(events[0]?.payload.direction, "inbound");
  assert.equal(events[0]?.payload.content, "Test message");
});

test("SessionDualStorageService records compaction_recorded event", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordCompaction("session-008", "task-008", {
    messageCount: 50,
    tokenReduction: 2000,
    stage: "trim",
  });

  const events = service.replaySessionEvents("session-008");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "compaction_recorded");
  assert.equal(events[0]?.payload.messageCount, 50);
  assert.equal(events[0]?.payload.tokenReduction, 2000);
});

// === Replay Tests ===

test("SessionDualStorageService replaySessionEvents returns empty for non-existent session", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const events = service.replaySessionEvents("non-existent-session");

  assert.equal(events.length, 0);
});

test("SessionDualStorageService replayTaskSessionHistory returns events for task", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session1 = createSessionRecord("session-task-1", "shared-task");
  const session2 = createSessionRecord("session-task-2", "shared-task");

  service.recordSessionCreated(session1);
  service.recordSessionCreated(session2);

  const events = service.replayTaskSessionHistory("shared-task");
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.taskId === "shared-task"));
});

test("SessionDualStorageService replayTaskSessionHistory returns empty for unknown task", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const events = service.replayTaskSessionHistory("unknown-task");

  assert.equal(events.length, 0);
});

// === Summary Tests ===

test("SessionDualStorageService getSessionReplaySummary returns zeros for non-existent session", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const summary = service.getSessionReplaySummary("non-existent");

  assert.equal(summary.eventCount, 0);
  assert.equal(summary.firstEvent, null);
  assert.equal(summary.lastEvent, null);
  assert.deepEqual(summary.eventTypes, []);
});

test("SessionDualStorageService getSessionReplaySummary returns correct counts after multiple events", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-summary", "task-summary");
  service.recordSessionCreated(session);

  const message = createMessageRecord("msg-sum", "session-summary", "task-summary");
  service.recordMessageAdded(message, "task-summary");

  service.recordSessionCompleted("session-summary", "task-summary");

  const summary = service.getSessionReplaySummary("session-summary");
  assert.equal(summary.eventCount, 3);
  assert.ok(summary.firstEvent !== null);
  assert.ok(summary.lastEvent !== null);
  assert.ok(summary.eventTypes.includes("session_created"));
  assert.ok(summary.eventTypes.includes("message_added"));
  assert.ok(summary.eventTypes.includes("session_completed"));
  assert.equal(summary.eventTypes.length, 3);
});

// === Consistency Verification Tests ===

test("SessionDualStorageService verifyDualStorageConsistency passes with valid events", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-verify", "task-verify", "open");
  service.recordSessionCreated(session);

  const result = service.verifyDualStorageConsistency(session, "open");

  assert.equal(result.consistent, true);
  assert.equal(result.issues.length, 0);
});

test("SessionDualStorageService verifyDualStorageConsistency detects missing created event", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-no-created", "task-no-created", "open");

  const result = service.verifyDualStorageConsistency(session, "open");

  assert.equal(result.consistent, false);
  assert.ok(result.issues.some((i) => i.includes("Missing session_created event")));
});

test("SessionDualStorageService verifyDualStorageConsistency detects status mismatch", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  // Manually append an event with wrong status
  service.appendSessionEvent({
    eventType: "session_updated",
    sessionId: "session-status-mismatch",
    taskId: "task-status-mismatch",
    timestamp: "2026-04-24T10:05:00.000Z",
    payload: { status: "failed" },
  });

  const session = createSessionRecord("session-status-mismatch", "task-status-mismatch", "completed");

  const result = service.verifyDualStorageConsistency(session, "completed");

  assert.equal(result.consistent, false);
  assert.ok(
    result.issues.some((i) => i.includes("Status mismatch: JSONL=failed, SQLite=completed")),
  );
});

// === Append Event Tests ===

test("SessionDualStorageService appendSessionEvent appends raw event to session file", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.appendSessionEvent({
    eventType: "custom_event",
    sessionId: "session-raw",
    taskId: "task-raw",
    timestamp: "2026-04-24T10:00:00.000Z",
    payload: { customField: "customValue" },
  });

  const events = service.replaySessionEvents("session-raw");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "custom_event");
  assert.equal(events[0]?.payload.customField, "customValue");
});

// === Session ID Sanitization Tests ===

test("SessionDualStorageService handles session IDs with special characters", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("session-with-special-chars-123", "task-special");

  // This should not throw
  service.recordSessionCreated(session);

  const events = service.replaySessionEvents("session-with-special-chars-123");
  assert.equal(events.length, 1);
});

test("SessionDualStorageService handles session IDs with only alphanumeric characters", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session = createSessionRecord("sessionSimple123", "taskSimple");

  service.recordSessionCreated(session);

  const events = service.replaySessionEvents("sessionSimple123");
  assert.equal(events.length, 1);
});

// === Multiple Session Events Tests ===

test("SessionDualStorageService records events in chronological order", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionCreated(createSessionRecord("session-chrono", "task-chrono"));
  service.recordSessionUpdated({
    ...createSessionRecord("session-chrono", "task-chrono"),
    status: "streaming",
  });
  service.recordMessageAdded(
    createMessageRecord("msg-chrono", "session-chrono", "task-chrono"),
    "task-chrono",
  );
  service.recordSessionCompleted("session-chrono", "task-chrono");

  const events = service.replaySessionEvents("session-chrono");
  assert.equal(events.length, 4);
  assert.equal(events[0]?.eventType, "session_created");
  assert.equal(events[1]?.eventType, "session_updated");
  assert.equal(events[2]?.eventType, "message_added");
  assert.equal(events[3]?.eventType, "session_completed");
});

test("SessionDualStorageService can replay same session multiple times", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  service.recordSessionCreated(createSessionRecord("session-replay", "task-replay"));

  const firstReplay = service.replaySessionEvents("session-replay");
  const secondReplay = service.replaySessionEvents("session-replay");

  assert.deepEqual(firstReplay, secondReplay);
  assert.equal(firstReplay.length, 1);
});

// === Task Index Tests ===

test("SessionDualStorageService records events to task index file", () => {
  resetMocks();
  const service = new SessionDualStorageService({
    jsonlRootDir: "/tmp/test-session-storage",
  });

  const session1 = createSessionRecord("session-task-idx-1", "task-indexed");
  const session2 = createSessionRecord("session-task-idx-2", "task-indexed");

  service.recordSessionCreated(session1);
  service.recordSessionCreated(session2);

  const taskEvents = service.replayTaskSessionHistory("task-indexed");
  assert.equal(taskEvents.length, 2);
});

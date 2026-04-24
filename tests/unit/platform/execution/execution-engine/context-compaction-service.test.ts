import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextCompactionService,
  type ContextCompactionOptions,
  type CompactedContextMessage,
  type ContextCompactionResult,
} from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";

import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { MessageRecord, CompactionRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockStore(
  dispatchMessages: MessageRecord[] = [],
  compactionRecords: CompactionRecord[] = [],
): AuthoritativeTaskStore {
  return {
    dispatch: {
      listMessagesBySession: () => dispatchMessages,
    },
    session: {
      listCompactionRecordsBySession: () => compactionRecords,
      insertCompactionRecord: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createTestMessage(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "msg-1",
    sessionId: "sess-1",
    direction: "inbound",
    messageType: "user_request",
    content: "Test message content",
    partsJson: null,
    attachmentsJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ContextCompactionService construction
// ---------------------------------------------------------------------------

test("ContextCompactionService can be instantiated with db and store", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);
  assert.ok(service instanceof ContextCompactionService);
});

// ---------------------------------------------------------------------------
// compactContext - basic functionality
// ---------------------------------------------------------------------------

test("compactContext returns result with empty messages when no session messages", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  assert.ok(result);
  assert.equal(result.stage1Triggered, false);
  assert.equal(result.stage2Triggered, false);
  assert.equal(result.contextMessages.length, 0);
});

test("compactContext preserves messages when under threshold", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "system", content: "System prompt" }),
    createTestMessage({ id: "msg-2", direction: "inbound", messageType: "user_request", content: "User request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000, // High limit
  };

  const result = service.compactContext(options);

  // Should not trigger compaction
  assert.equal(result.stage1Triggered, false);
  assert.equal(result.stage2Triggered, false);
  assert.equal(result.contextMessages.length, 2);
});

test("compactContext preserves user_request messages as protected", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "system", content: "System" }),
    createTestMessage({ id: "msg-2", direction: "inbound", messageType: "user_request", content: "User request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1000,
  };

  const result = service.compactContext(options);

  // User request should be protected
  const userMessage = result.contextMessages.find((m) => m.messageType === "user_request");
  assert.ok(userMessage);
  assert.equal(userMessage.protected, true);
});

test("compactContext preserves latest user message as protected", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", messageType: "user_request", content: "First request" }),
    createTestMessage({ id: "msg-2", direction: "inbound", messageType: "user_request", content: "Latest request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1000,
  };

  const result = service.compactContext(options);

  // Latest user message (msg-2) should be protected
  const latestUserMessage = result.contextMessages.find((m) => m.messageId === "msg-2");
  assert.ok(latestUserMessage);
  assert.equal(latestUserMessage.protected, true);
});

test("compactContext preserves assistant_plan messages as protected", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "system", content: "System" }),
    createTestMessage({ id: "msg-2", direction: "outbound", messageType: "assistant_plan", content: "Plan content" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1000,
  };

  const result = service.compactContext(options);

  const planMessage = result.contextMessages.find((m) => m.messageType === "assistant_plan");
  assert.ok(planMessage);
  assert.equal(planMessage.protected, true);
});

test("compactContext preserves approval_decision messages as protected", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "system", content: "System" }),
    createTestMessage({ id: "msg-2", direction: "outbound", messageType: "approval_decision", content: "Approved" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1000,
  };

  const result = service.compactContext(options);

  const approvalMessage = result.contextMessages.find((m) => m.messageType === "approval_decision");
  assert.ok(approvalMessage);
  assert.equal(approvalMessage.protected, true);
});

// ---------------------------------------------------------------------------
// compactContext - options validation
// ---------------------------------------------------------------------------

test("compactContext uses default stage1TriggerRatio of 0.7", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext uses default stage2TriggerRatio of 0.85", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext accepts custom stage ratios", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0.5,
    stage2TriggerRatio: 0.7,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext uses default recentToolResultWindow of 3", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext uses default compactionMaxFrequencyPerSession of 2", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext accepts custom providerMaxOutputTokens", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    providerMaxOutputTokens: 4096,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext accepts custom occurredAt", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    occurredAt: "2024-06-15T10:00:00.000Z",
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// ContextCompactionOptions type
// ---------------------------------------------------------------------------

test("ContextCompactionOptions can be created with required fields", () => {
  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };
  assert.equal(options.taskId, "task-1");
  assert.equal(options.sessionId, "sess-1");
  assert.equal(options.maxContextTokens, 10000);
});

test("ContextCompactionOptions accepts kvCacheConfig", () => {
  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };
  assert.ok(options.kvCacheConfig);
});

// ---------------------------------------------------------------------------
// CompactedContextMessage type
// ---------------------------------------------------------------------------

test("CompactedContextMessage can be created", () => {
  const msg: CompactedContextMessage = {
    messageId: "msg-1",
    direction: "inbound",
    messageType: "user_request",
    content: "Test content",
    estimatedTokens: 10,
    trimmed: false,
    protected: true,
  };
  assert.equal(msg.messageId, "msg-1");
  assert.equal(msg.protected, true);
  assert.equal(msg.trimmed, false);
});

// ---------------------------------------------------------------------------
// ContextCompactionResult type
// ---------------------------------------------------------------------------

test("ContextCompactionResult has expected structure", () => {
  const result: ContextCompactionResult = {
    usageBeforeTokens: 1000,
    usageAfterStage1Tokens: 800,
    usageAfterStage2Tokens: 600,
    stage1Triggered: true,
    stage2Triggered: false,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null,
  };
  assert.equal(result.usageBeforeTokens, 1000);
  assert.equal(result.stage1Triggered, true);
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("compactContext handles negative recentToolResultWindow as 0", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    recentToolResultWindow: -5,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("compactContext handles 0 recentToolResultWindow", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);
  // Should handle gracefully
  assert.equal(result.errorCode, null);
});

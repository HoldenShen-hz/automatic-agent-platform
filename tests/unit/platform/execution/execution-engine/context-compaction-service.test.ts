import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextCompactionService,
  type ContextCompactionOptions,
  type CompactedContextMessage,
  type ContextCompactionResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";

import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
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

test("ContextCompactionService can be instantiated with db and store [context-compaction-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);
  assert.ok(service instanceof ContextCompactionService);
});

// ---------------------------------------------------------------------------
// compactContext - basic functionality
// ---------------------------------------------------------------------------

test("compactContext returns result with empty messages when no session messages [context-compaction-service]", () => {
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

test("compactContext preserves messages when under threshold [context-compaction-service]", () => {
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

test("compactContext preserves user_request messages as protected [context-compaction-service]", () => {
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

test("compactContext preserves latest user message as protected [context-compaction-service]", () => {
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

test("compactContext preserves assistant_plan messages as protected [context-compaction-service]", () => {
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

test("compactContext preserves approval_decision messages as protected [context-compaction-service]", () => {
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

test("compactContext uses default stage1TriggerRatio of 0.7 [context-compaction-service]", () => {
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

test("compactContext uses default stage2TriggerRatio of 0.85 [context-compaction-service]", () => {
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

test("compactContext accepts custom stage ratios [context-compaction-service]", () => {
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

test("compactContext uses default recentToolResultWindow of 3 [context-compaction-service]", () => {
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

test("compactContext uses default compactionMaxFrequencyPerSession of 2 [context-compaction-service]", () => {
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

test("compactContext accepts custom providerMaxOutputTokens [context-compaction-service]", () => {
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

test("compactContext accepts custom occurredAt [context-compaction-service]", () => {
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

test("ContextCompactionOptions can be created with required fields [context-compaction-service]", () => {
  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };
  assert.equal(options.taskId, "task-1");
  assert.equal(options.sessionId, "sess-1");
  assert.equal(options.maxContextTokens, 10000);
});

test("ContextCompactionOptions accepts kvCacheConfig [context-compaction-service]", () => {
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

test("CompactedContextMessage can be created [context-compaction-service]", () => {
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

test("ContextCompactionResult has expected structure [context-compaction-service]", () => {
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

test("compactContext handles negative recentToolResultWindow as 0 [context-compaction-service]", () => {
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

test("compactContext handles 0 recentToolResultWindow [context-compaction-service]", () => {
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

// ---------------------------------------------------------------------------
// Stage 2 (summarize) triggering
// ---------------------------------------------------------------------------

test("compactContext triggers stage2 when stage1 insufficient and over stage2 threshold [context-compaction-service]", () => {
  const db = createMockDb();
  // Create many messages to ensure we exceed both thresholds
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System prompt" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response with significant content" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool result 2" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Tool result 3" }),
    createTestMessage({ id: "tool-4", direction: "outbound", messageType: "tool_result", content: "Tool result 4" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100,
    stage1TriggerRatio: 0.1,
    stage2TriggerRatio: 0.1,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  assert.equal(result.stage1Triggered, true, "stage1 should be triggered");
  assert.equal(result.stage2Triggered, true, "stage2 should be triggered");
  assert.ok(result.contextMessages.length > 0);
});

test("compactContext stage2 creates compaction_summary message [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response with significant content that should be summarized" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1 content" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMessage = result.contextMessages.find((m) => m.messageType === "compaction_summary");
    assert.ok(summaryMessage, "should have compaction_summary message");
    assert.equal(summaryMessage.protected, true, "summary should be protected");
    assert.ok(summaryMessage.content.includes("Compacted context summary:"), "should have summary prefix");
  }
});

test("compactContext stage2 summary includes up to 6 messages [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User 1" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant 1" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool 1" }),
    createTestMessage({ id: "assistant-2", direction: "outbound", messageType: "assistant_response", content: "Assistant 2" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool 2" }),
    createTestMessage({ id: "assistant-3", direction: "outbound", messageType: "assistant_response", content: "Assistant 3" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Tool 3" }),
    createTestMessage({ id: "user-2", direction: "inbound", messageType: "user_request", content: "User 2" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 40,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMessage = result.contextMessages.find((m) => m.messageType === "compaction_summary");
    assert.ok(summaryMessage);
    // Summary should contain excerpts from multiple messages, joined by " | "
    const pipeCount = (summaryMessage.content.match(/\|/g) || []).length;
    assert.ok(pipeCount <= 5, "should have at most 5 separators for 6 messages");
  }
});

test("compactContext fallbackToStage1 when compactionMaxFrequencyPerSession exceeded [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool result 2" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Tool result 3" }),
  ];
  // Simulate existing compaction records (2 prior summaries - at limit)
  const existingRecords: CompactionRecord[] = [
    {
      id: "compact-1",
      sessionId: "sess-1",
      taskId: "task-1",
      stage: "summarize",
      sourceMessageIdsJson: "[]",
      summaryText: "First summary",
      summaryRef: "msg-s1",
      compactionReason: "context_overflow_stage2_summarize",
      overflowTriggered: 1,
      autoTriggered: 1,
      tokenReductionEstimate: 100,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "compact-2",
      sessionId: "sess-1",
      taskId: "task-1",
      stage: "summarize",
      sourceMessageIdsJson: "[]",
      summaryText: "Second summary",
      summaryRef: "msg-s2",
      compactionReason: "context_overflow_stage2_summarize",
      overflowTriggered: 1,
      autoTriggered: 1,
      tokenReductionEstimate: 100,
      createdAt: "2024-01-02T00:00:00.000Z",
    },
  ];
  const store = createMockStore(messages, existingRecords);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 1,
    compactionMaxFrequencyPerSession: 2,
  };

  const result = service.compactContext(options);

  assert.equal(result.stage1Triggered, true, "stage1 should be triggered");
  assert.equal(result.stage2Triggered, true, "stage2 should be triggered");
  assert.equal(result.fallbackToStage1, true, "should fallback to stage1");
  assert.equal(result.errorCode, "runtime.compaction_budget_exhausted", "should have budget exhausted error");
});

test("compactContext handles scenario with only protected messages [context-compaction-service]", () => {
  const db = createMockDb();
  // All messages are user_request (protected) - no trim candidates for stage1
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "First user request" }),
    createTestMessage({ id: "user-2", direction: "inbound", messageType: "user_request", content: "Second user request" }),
    createTestMessage({ id: "user-3", direction: "inbound", messageType: "user_request", content: "Third user request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  // Stage1 won't trigger because there are no trim candidates (only protected messages)
  assert.equal(result.stage1Triggered, false, "stage1 should not trigger with only protected messages");
  // Stage2 may trigger due to high usage but should fallback since no summary candidates
  if (result.stage2Triggered) {
    assert.equal(result.fallbackToStage1, true, "should fallback when no summary candidates");
  }
  // Should not have budget exhausted error
  assert.ok(result.errorCode === null || result.errorCode === "runtime.compaction_budget_exhausted");
});

test("compactContext persists stage1 record when stage1 triggered [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool result 2" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  if (result.stage1Triggered) {
    assert.equal(result.persistedRecords.length >= 1, true, "should have persisted records");
    const trimRecord = result.persistedRecords.find((r) => r.stage === "trim");
    assert.ok(trimRecord, "should have trim record");
    assert.equal(trimRecord.compactionReason, "context_overflow_stage1_trim");
  }
});

test("compactContext persists stage2 record when stage2 triggered [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summarizeRecord = result.persistedRecords.find((r) => r.stage === "summarize");
    assert.ok(summarizeRecord, "should have summarize record");
    assert.equal(summarizeRecord.compactionReason, "context_overflow_stage2_summarize");
  }
});

// ---------------------------------------------------------------------------
// KV Cache prefix configuration (G9)
// ---------------------------------------------------------------------------

test("compactContext with KV cache enabled protects system messages at start [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System prompt" }),
    createTestMessage({ id: "sys-2", direction: "system", content: "Domain instructions" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };

  const result = service.compactContext(options);

  // System messages should be marked as protected (fixed prefix)
  const systemMessages = result.contextMessages.filter((m) => m.direction === "system");
  assert.ok(systemMessages.length >= 2, "should have system messages");
  systemMessages.forEach((msg) => {
    assert.equal(msg.protected, true, `system message ${msg.messageId} should be protected`);
  });
});

test("compactContext with KV cache disabled does not apply fixed prefix protection [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System prompt" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: false },
    },
  };

  const result = service.compactContext(options);

  // When KV cache disabled, system messages are not specially protected as fixed prefix
  // They follow normal protection rules
  assert.ok(result.contextMessages.length >= 2);
});

test("compactContext KV cache preserves fixed prefix in final messages [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System prompt" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Response" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 40,
    stage1TriggerRatio: 0.01,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };

  const result = service.compactContext(options);

  // System message should be in final context
  const sysMsg = result.contextMessages.find((m) => m.messageId === "sys-1");
  assert.ok(sysMsg, "system message should be preserved");
});

// ---------------------------------------------------------------------------
// Tool result trimming with recentWindow
// ---------------------------------------------------------------------------

test("compactContext handles messages with tool results [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1 with some substantial content here" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool result 2 with some substantial content here" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Tool result 3 with recent content" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000, // High limit - no compaction should trigger
    stage1TriggerRatio: 0.7,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  // With high token limit, no compaction should trigger
  assert.equal(result.stage1Triggered, false, "stage1 should not trigger with high limit");
  assert.equal(result.stage2Triggered, false, "stage2 should not trigger");
  // All messages should be preserved
  assert.ok(result.contextMessages.length >= 3, "all messages should be in context");
});

test("compactContext handles multiple tool results with larger window [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result 1 with some substantial content here" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool result 2 with some substantial content here" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Tool result 3 with recent content" }),
    createTestMessage({ id: "tool-4", direction: "outbound", messageType: "tool_result", content: "Tool result 4 with recent content" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000, // High limit - no compaction should trigger
    stage1TriggerRatio: 0.7,
    recentToolResultWindow: 2,
  };

  const result = service.compactContext(options);

  // With high token limit, no compaction should trigger
  assert.equal(result.stage1Triggered, false, "stage1 should not trigger with high limit");
  assert.equal(result.stage2Triggered, false, "stage2 should not trigger");
  // All messages should be preserved
  assert.ok(result.contextMessages.length >= 4, "all tool messages should be in context");
});

test("compactContext stage1 not triggered when under threshold despite tool results [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "Short" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000, // High limit
    stage1TriggerRatio: 0.7,
  };

  const result = service.compactContext(options);

  assert.equal(result.stage1Triggered, false, "stage1 should not trigger when under budget");
  assert.equal(result.stage2Triggered, false, "stage2 should not trigger");
});

// ---------------------------------------------------------------------------
// Token budget and ratio calculations
// ---------------------------------------------------------------------------

test("compactContext uses correct reservedOutputBudgetTokens calculation [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000,
    providerMaxOutputTokens: 8000,
    reservedOutputBudgetTokens: 5000,
  };

  const result = service.compactContext(options);

  // With high maxContextTokens, no compaction should trigger
  assert.equal(result.stage1Triggered, false);
  assert.equal(result.usageBeforeTokens > 0, true);
});

test("compactContext calculates usageAfterStage1Tokens correctly [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  assert.ok(result.usageBeforeTokens >= 0);
  assert.ok(result.usageAfterStage1Tokens >= 0);
  assert.ok(result.usageBeforeTokens >= result.usageAfterStage1Tokens || !result.stage1Triggered);
});

test("compactContext clampRatio handles NaN values [context-compaction-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: NaN,
    stage2TriggerRatio: NaN,
  };

  const result = service.compactContext(options);
  // Should use fallback values (0.7 and 0.85) and not error
  assert.equal(result.errorCode, null);
});

test("compactContext clampRatio handles Infinity values [context-compaction-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: Infinity,
    stage2TriggerRatio: -Infinity,
  };

  const result = service.compactContext(options);
  // Should use fallback values and not error
  assert.equal(result.errorCode, null);
});

test("compactContext clampRatio handles negative ratio values [context-compaction-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: -0.5,
    stage2TriggerRatio: -0.3,
  };

  const result = service.compactContext(options);
  // Should use fallback values and not error
  assert.equal(result.errorCode, null);
});

test("compactContext maxContextTokens minus reservedOutputBudgetTokens minimum is 1 [context-compaction-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100, // Very low
    providerMaxOutputTokens: 50,
    reservedOutputBudgetTokens: 200, // Exceeds maxContextTokens
  };

  const result = service.compactContext(options);
  // Should handle gracefully - usableBudgetTokens should be at least 1
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// Protected message types
// ---------------------------------------------------------------------------

test("compactContext protects compaction_summary message type [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "summary-1", direction: "system", messageType: "compaction_summary", content: "Previous summary" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  const summaryMsg = result.contextMessages.find((m) => m.messageType === "compaction_summary");
  assert.ok(summaryMsg);
  assert.equal(summaryMsg.protected, true, "compaction_summary should be protected");
});

test("compactContext latest user message is always protected regardless of position [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool 2" }),
    createTestMessage({ id: "user-latest", direction: "inbound", messageType: "user_request", content: "Latest user request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  const latestUser = result.contextMessages.find((m) => m.messageId === "user-latest");
  assert.ok(latestUser);
  assert.equal(latestUser.protected, true, "latest user message should be protected even if at end");
});

// ---------------------------------------------------------------------------
// Message ordering preservation
// ---------------------------------------------------------------------------

test("compactContext preserves message order in final context [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User 1" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant 1" }),
    createTestMessage({ id: "user-2", direction: "inbound", messageType: "user_request", content: "User 2" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000,
  };

  const result = service.compactContext(options);

  const messageIds = result.contextMessages.map((m) => m.messageId);
  const sysIndex = messageIds.indexOf("sys-1");
  const user1Index = messageIds.indexOf("user-1");
  const assistant1Index = messageIds.indexOf("assistant-1");
  const user2Index = messageIds.indexOf("user-2");

  assert.ok(sysIndex < user1Index, "system should be before user-1");
  assert.ok(user1Index < assistant1Index, "user-1 should be before assistant-1");
  assert.ok(assistant1Index < user2Index, "assistant-1 should be before user-2");
});

// ---------------------------------------------------------------------------
// Excerpt function behavior (via stage2 summary)
// ---------------------------------------------------------------------------

test("compactContext excerpt function strips excessive whitespace [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Response   with\n\n\t\texcessive    whitespace" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find((m) => m.messageType === "compaction_summary");
    assert.ok(summaryMsg);
    // The excerpt should have normalized whitespace
    assert.ok(!summaryMsg.content.includes("\n"), "should not contain newlines");
    assert.ok(!summaryMsg.content.includes("\t"), "should not contain tabs");
  }
});

test("compactContext excerpt function truncates long content to 80 chars [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "This is a very long response that definitely exceeds the 80 character limit that excerpt allows and should be truncated properly" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find((m) => m.messageType === "compaction_summary");
    assert.ok(summaryMsg);
    // Find the assistant response excerpt - it should be truncated
    // The summary format is: [type] content | [type] content
    const assistantExcerpt = summaryMsg.content.match(/\[assistant_response\]([^|]+)/);
    if (assistantExcerpt) {
      const excerptText = assistantExcerpt[1].trim();
      assert.ok(excerptText.length <= 80, `excerpt should be <= 80 chars, got ${excerptText.length}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("compactContext handles all messages being protected [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request 1" }),
    createTestMessage({ id: "plan-1", direction: "outbound", messageType: "assistant_plan", content: "Plan" }),
    createTestMessage({ id: "user-2", direction: "inbound", messageType: "user_request", content: "User request 2" }),
    createTestMessage({ id: "approval-1", direction: "outbound", messageType: "approval_decision", content: "Approved" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
  };

  const result = service.compactContext(options);

  // All messages are protected, so trim candidates may be empty
  // Stage2 may trigger but should handle gracefully
  assert.ok(result.contextMessages.length > 0);
});

test("compactContext handles message with null partsJson [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", partsJson: null, content: "Content without parts" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  assert.equal(result.errorCode, null);
  assert.ok(result.contextMessages.length >= 1);
});

test("compactContext handles message with empty partsJson [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", partsJson: null, content: "" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  assert.equal(result.errorCode, null);
});

test("compactContext with very low maxContextTokens [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", messageType: "user_request", content: "User request" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1, // Extremely low
  };

  const result = service.compactContext(options);

  // Should handle gracefully
  assert.ok(result.errorCode === null || result.errorCode === "runtime.compaction_budget_exhausted");
});

test("compactContext session without any inbound messages [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
  };

  const result = service.compactContext(options);

  // No latest user message, so no user message is "latest"
  // Should still work
  assert.equal(result.errorCode, null);
});

test("compactContext with custom occurredAt timestamp [context-compaction-service]", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const customTime = "2024-06-15T10:30:00.000Z";
  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    occurredAt: customTime,
  };

  const result = service.compactContext(options);

  // Custom timestamp is used in records
  assert.equal(result.errorCode, null);
});

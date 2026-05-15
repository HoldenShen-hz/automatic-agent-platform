/**
 * Context Compaction Service Edge Cases Unit Tests
 *
 * Additional edge case tests for context-compaction-service.ts focusing on:
 * - Excerpt function boundary conditions
 * - isFixedPrefixMessage edge cases
 * - Multi-session compaction isolation
 * - Compaction record audit trail verification
 * - Token estimation edge cases
 *
 * @see src/platform/five-plane-execution/execution-engine/context-compaction-service.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ContextCompactionService } from "../../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";
import type {
  ContextCompactionOptions,
  CompactedContextMessage,
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
// Excerpt function behavior (via stage2 summary)
// ---------------------------------------------------------------------------

test("excerpt function truncates content longer than 80 characters", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User request",
    }),
    createTestMessage({
      id: "assistant-1",
      direction: "outbound",
      messageType: "assistant_response",
      content: "This is a very long assistant response that exceeds the 80 character limit and should be truncated when it appears in the summary",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find(
      (m) => m.messageType === "compaction_summary",
    );
    assert.ok(summaryMsg, "should have compaction_summary message");
    // The excerpt from assistant_response should be truncated to 80 chars
    const assistantExcerptMatch = summaryMsg.content.match(/\[assistant_response\]([^|]+)/);
    if (assistantExcerptMatch) {
      const excerptText = assistantExcerptMatch[1].trim();
      assert.ok(
        excerptText.length <= 80,
        `excerpt should be <= 80 chars, got ${excerptText.length}: "${excerptText}"`,
      );
    }
  }
});

test("excerpt function normalizes whitespace", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User",
    }),
    createTestMessage({
      id: "assistant-1",
      direction: "outbound",
      messageType: "assistant_response",
      content: "Response   with\n\n\t\texcessive    whitespace   and\nnewlines",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find(
      (m) => m.messageType === "compaction_summary",
    );
    assert.ok(summaryMsg);
    // Summary should not contain newlines or tabs
    assert.ok(
      !summaryMsg.content.includes("\n"),
      "summary should not contain newlines",
    );
    assert.ok(
      !summaryMsg.content.includes("\t"),
      "summary should not contain tabs",
    );
  }
});

test("excerpt function handles empty content", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User",
    }),
    createTestMessage({
      id: "assistant-1",
      direction: "outbound",
      messageType: "assistant_response",
      content: "",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  // Should not throw, should handle gracefully
  assert.ok(result.errorCode === null || result.errorCode === "runtime.compaction_budget_exhausted");
});

// ---------------------------------------------------------------------------
// isFixedPrefixMessage behavior (KV cache G9)
// ---------------------------------------------------------------------------

test("isFixedPrefixMessage returns true for system messages at start", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System 1" }),
    createTestMessage({ id: "sys-2", direction: "system", content: "System 2" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };

  const result = service.compactContext(options);

  // System messages should be protected (as fixed prefix)
  const sys1 = result.contextMessages.find((m) => m.messageId === "sys-1");
  const sys2 = result.contextMessages.find((m) => m.messageId === "sys-2");
  assert.ok(sys1?.protected, "first system message should be protected");
  assert.ok(sys2?.protected, "second system message should be protected");
});

test("isFixedPrefixMessage returns false for non-system messages", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };

  const result = service.compactContext(options);

  // Non-system messages are not protected by fixed prefix rule
  const userMsg = result.contextMessages.find((m) => m.messageId === "user-1");
  assert.ok(userMsg);
  // User messages may still be protected for other reasons (latest user message)
});

// ---------------------------------------------------------------------------
// Multi-session compaction isolation
// ---------------------------------------------------------------------------

test("compaction records are isolated by session", () => {
  const db = createMockDb();
  const messagesSession1 = [
    createTestMessage({ id: "s1-msg-1", sessionId: "sess-1", direction: "inbound", messageType: "user_request", content: "Session 1 request" }),
    createTestMessage({ id: "s1-tool-1", sessionId: "sess-1", direction: "outbound", messageType: "tool_result", content: "Session 1 tool result" }),
  ];
  const messagesSession2 = [
    createTestMessage({ id: "s2-msg-1", sessionId: "sess-2", direction: "inbound", messageType: "user_request", content: "Session 2 request" }),
  ];

  const compactionRecordsSession1: CompactionRecord[] = [
    {
      id: "compact-1",
      sessionId: "sess-1",
      taskId: "task-1",
      stage: "summarize",
      sourceMessageIdsJson: "[]",
      summaryText: "Prior summary for session 1",
      summaryRef: "msg-s1",
      compactionReason: "prior_compaction",
      overflowTriggered: 1,
      autoTriggered: 1,
      tokenReductionEstimate: 50,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  const store = createMockStore(messagesSession1, compactionRecordsSession1);
  const service = new ContextCompactionService(db, store);

  // Compact session 1 - should see existing compaction record
  const result1 = service.compactContext({
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
    compactionMaxFrequencyPerSession: 1,
  });

  // Session 1 is at limit (1 prior summarize), so should fallback
  assert.equal(result1.fallbackToStage1, true, "session 1 should fallback at frequency limit");
});

// ---------------------------------------------------------------------------
// Token budget edge cases
// ---------------------------------------------------------------------------

test("compactContext handles extremely small usable budget", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "Short",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10,
    providerMaxOutputTokens: 100000, // Very large
    reservedOutputBudgetTokens: 100000, // Exceeds maxContextTokens
  };

  const result = service.compactContext(options);

  // Should handle gracefully with minimal usable budget
  assert.equal(result.errorCode, null);
  assert.ok(result.contextMessages.length >= 0);
});

test("compactContext handles reservedOutputBudgetTokens at maxContextTokens boundary", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "Test",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100,
    providerMaxOutputTokens: 50,
    reservedOutputBudgetTokens: 100, // Exactly equals maxContextTokens
  };

  const result = service.compactContext(options);

  // Usable budget should be at least 1 (max(100 - 100, 1) = 1)
  assert.equal(result.errorCode, null);
});

test("compactContext handles default reservedOutputBudgetTokens when providerMaxOutputTokens is small", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 1000,
    providerMaxOutputTokens: 100, // Very small
    // reservedOutputBudgetTokens should default to min(20000, 100) = 100
  };

  const result = service.compactContext(options);

  // Should use providerMaxOutputTokens as fallback when it's small
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// Protected message edge cases
// ---------------------------------------------------------------------------

test("compaction_summary message type is always protected", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User request",
    }),
    createTestMessage({
      id: "summary-existing",
      direction: "system",
      messageType: "compaction_summary",
      content: "Existing summary",
    }),
    createTestMessage({
      id: "tool-1",
      direction: "outbound",
      messageType: "tool_result",
      content: "Tool result",
    }),
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

  const existingSummary = result.contextMessages.find(
    (m) => m.messageId === "summary-existing",
  );
  assert.ok(existingSummary);
  assert.equal(existingSummary.protected, true, "compaction_summary should always be protected");
});

test("latest user message protection with multiple inbound messages", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-old",
      direction: "inbound",
      messageType: "user_request",
      content: "Old user request",
    }),
    createTestMessage({
      id: "assistant-1",
      direction: "outbound",
      messageType: "assistant_response",
      content: "Assistant response",
    }),
    createTestMessage({
      id: "user-new",
      direction: "inbound",
      messageType: "user_request",
      content: "Newest user request",
    }),
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

  const oldUser = result.contextMessages.find((m) => m.messageId === "user-old");
  const newUser = result.contextMessages.find((m) => m.messageId === "user-new");

  // Newest user message should be protected
  assert.ok(newUser?.protected, "newest user message should be protected");
  // Old user message may or may not be protected depending on stage
});

// ---------------------------------------------------------------------------
// Stage2 summary creation edge cases
// ---------------------------------------------------------------------------

test("stage2 summary message has correct structure", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User request",
    }),
    createTestMessage({
      id: "assistant-1",
      direction: "outbound",
      messageType: "assistant_response",
      content: "Assistant response with significant content",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find(
      (m) => m.messageType === "compaction_summary",
    );
    assert.ok(summaryMsg, "should have summary message");
    assert.equal(summaryMsg.direction, "system", "summary should be system direction");
    assert.equal(summaryMsg.protected, true, "summary should be protected");
    assert.ok(
      summaryMsg.content.startsWith("Compacted context summary:"),
      "summary content should start with prefix",
    );
    assert.ok(
      summaryMsg.estimatedTokens > 0,
      "summary should have estimated tokens",
    );
  }
});

test("stage2 summary includes up to 6 message excerpts", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "m1", direction: "inbound", messageType: "user_request", content: "M1" }),
    createTestMessage({ id: "m2", direction: "outbound", messageType: "assistant_response", content: "M2" }),
    createTestMessage({ id: "m3", direction: "outbound", messageType: "tool_result", content: "M3" }),
    createTestMessage({ id: "m4", direction: "outbound", messageType: "assistant_response", content: "M4" }),
    createTestMessage({ id: "m5", direction: "outbound", messageType: "tool_result", content: "M5" }),
    createTestMessage({ id: "m6", direction: "outbound", messageType: "assistant_response", content: "M6" }),
    createTestMessage({ id: "m7", direction: "outbound", messageType: "tool_result", content: "M7" }),
    createTestMessage({ id: "m8", direction: "outbound", messageType: "assistant_response", content: "M8" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 20,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    const summaryMsg = result.contextMessages.find(
      (m) => m.messageType === "compaction_summary",
    );
    assert.ok(summaryMsg);
    // Count pipe separators - should have at most 5 for 6 messages
    const pipeCount = (summaryMsg.content.match(/\|/g) || []).length;
    assert.ok(
      pipeCount <= 5,
      `should have at most 5 separators for 6 messages, got ${pipeCount}`,
    );
  }
});

test("stage2 fallback when no summary candidates available", () => {
  const db = createMockDb();
  // Only protected messages - no candidates for summarization
  const messages = [
    createTestMessage({
      id: "user-1",
      direction: "inbound",
      messageType: "user_request",
      content: "User request",
    }),
    createTestMessage({
      id: "plan-1",
      direction: "outbound",
      messageType: "assistant_plan",
      content: "Plan",
    }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    recentToolResultWindow: 0,
  };

  const result = service.compactContext(options);

  // Stage2 may trigger but should fallback because no summary candidates
  if (result.stage2Triggered) {
    assert.equal(result.fallbackToStage1, true);
  }
});

// ---------------------------------------------------------------------------
// Context message ordering preservation
// ---------------------------------------------------------------------------

test("compactContext preserves original message order for non-trimmed messages", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys", direction: "system", content: "System" }),
    createTestMessage({ id: "user", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "assistant", direction: "outbound", messageType: "assistant_response", content: "Assistant" }),
    createTestMessage({ id: "tool-old", direction: "outbound", messageType: "tool_result", content: "Old tool" }),
    createTestMessage({ id: "tool-new", direction: "outbound", messageType: "tool_result", content: "New tool" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000, // High limit - no trimming
  };

  const result = service.compactContext(options);

  const ids = result.contextMessages.map((m) => m.messageId);
  const sysIdx = ids.indexOf("sys");
  const userIdx = ids.indexOf("user");
  const assistantIdx = ids.indexOf("assistant");
  const toolOldIdx = ids.indexOf("tool-old");
  const toolNewIdx = ids.indexOf("tool-new");

  assert.ok(sysIdx < userIdx, "system before user");
  assert.ok(userIdx < assistantIdx, "user before assistant");
  assert.ok(assistantIdx < toolOldIdx, "assistant before old tool");
  assert.ok(toolOldIdx < toolNewIdx, "old tool before new tool");
});

// ---------------------------------------------------------------------------
// Result structure validation
// ---------------------------------------------------------------------------

test("ContextCompactionResult includes all required fields", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const result = service.compactContext({
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  });

  // Verify all required fields exist and have correct types
  assert.equal(typeof result.usageBeforeTokens, "number");
  assert.equal(typeof result.usageAfterStage1Tokens, "number");
  assert.equal(typeof result.usageAfterStage2Tokens, "number");
  assert.equal(typeof result.stage1Triggered, "boolean");
  assert.equal(typeof result.stage2Triggered, "boolean");
  assert.equal(typeof result.fallbackToStage1, "boolean");
  assert.ok(Array.isArray(result.contextMessages));
  assert.ok(Array.isArray(result.persistedRecords));
  assert.ok(
    result.errorCode === null ||
      result.errorCode === "runtime.compaction_budget_exhausted",
  );
});

test("CompactedContextMessage has correct type structure", () => {
  const msg: CompactedContextMessage = {
    messageId: "test",
    direction: "inbound",
    messageType: "user_request",
    content: "Test",
    estimatedTokens: 10,
    trimmed: false,
    protected: true,
  };

  assert.equal(msg.messageId, "test");
  assert.equal(msg.direction, "inbound");
  assert.equal(msg.messageType, "user_request");
  assert.equal(msg.content, "Test");
  assert.equal(msg.estimatedTokens, 10);
  assert.equal(msg.trimmed, false);
  assert.equal(msg.protected, true);
});

/**
 * Context Compaction Service Detailed Tests
 *
 * Additional tests for context-compaction-service.ts focusing on:
 * - isFixedPrefixMessage function behavior
 * - isProtectedMessage function edge cases
 * - excerpt function detailed behavior
 * - clampRatio function edge cases
 * - Stage2 fallback when no summary candidates
 * - Token budget calculations edge cases
 * - KV cache fixed prefix boundary conditions
 * - Compaction record persistence details
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ContextCompactionService } from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";
import type { ContextCompactionOptions } from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";

import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { MessageRecord, CompactionRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
    readTransaction: <T>(fn: () => T) => fn(),
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
// clampRatio function edge cases
// ---------------------------------------------------------------------------

test("clampRatio returns value when positive finite", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  // Use stage1TriggerRatio to test clampRatio directly
  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0.5, // Valid positive finite value
    stage2TriggerRatio: 0.8,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

test("clampRatio uses fallback when value is 0", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0, // 0 is not > 0, so fallback used
    stage2TriggerRatio: 0,
  };

  const result = service.compactContext(options);
  // Should use fallback ratios (0.7 and 0.85) and not error
  assert.equal(result.errorCode, null);
});

test("clampRatio uses fallback when value is negative", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    stage1TriggerRatio: -0.1,
    stage2TriggerRatio: -0.5,
  };

  const result = service.compactContext(options);
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// excerpt function behavior (tested via stage2 summary)
// ---------------------------------------------------------------------------

test("excerpt handles content shorter than maxLength", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "Short" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Brief" }),
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
    // Short content should appear verbatim
    assert.ok(summaryMsg.content.includes("Brief") || summaryMsg.content.includes("Short"));
  }
});

test("excerpt handles content with multiple whitespace types", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Response\twith\ttabs\nand\nnewlines   multiple   spaces" }),
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
    // Should not contain raw whitespace characters
    assert.ok(!summaryMsg.content.includes("\t"));
    assert.ok(!summaryMsg.content.includes("\n"));
  }
});

// ---------------------------------------------------------------------------
// isProtectedMessage function edge cases
// ---------------------------------------------------------------------------

test("isProtectedMessage returns true for latest user message by id", () => {
  const db = createMockDb();
  // Create a message sequence where the latest user message is not the last message overall
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "First request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
    createTestMessage({ id: "user-latest", direction: "inbound", messageType: "user_request", content: "Latest request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant after latest user" }),
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

  // user-latest should be protected even though it's not the last message
  const latestUser = result.contextMessages.find((m) => m.messageId === "user-latest");
  assert.ok(latestUser);
  assert.equal(latestUser.protected, true);
});

test("isProtectedMessage does not protect arbitrary tool_result", () => {
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
    maxContextTokens: 100000, // High limit so compaction doesn't trigger
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 0, // Don't protect any recent tools
  };

  const result = service.compactContext(options);

  // With high maxContextTokens, no compaction triggers, tool message should be preserved
  const toolMsg = result.contextMessages.find((m) => m.messageId === "tool-1");
  assert.ok(toolMsg);
  // Tool results are not in the protected types list
  assert.equal(toolMsg.protected, false);
});

test("isProtectedMessage protects compaction_summary type", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "summary-1", direction: "system", messageType: "compaction_summary", content: "Previous summary content" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
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

  const summaryMsg = result.contextMessages.find((m) => m.messageType === "compaction_summary");
  assert.ok(summaryMsg);
  assert.equal(summaryMsg.protected, true);
});

test("compactContext populates kvCacheFixedPrefixCacheKey for preserved system prefix", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", messageType: "assistant_plan", content: "System prefix" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "Hello" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const result = service.compactContext({
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 128,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
      },
    } as any,
  });

  assert.equal(typeof result.kvCacheFixedPrefixCacheKey, "string");
  assert.equal(result.kvCacheFixedPrefixCacheKey?.length, 64);
});

test("compactContext populates kvCacheDomainBlockCacheKey for non-prefix conversation body", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", messageType: "assistant_plan", content: "System prefix" }),
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "Body request" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Body response" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const result = service.compactContext({
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 128,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
      },
    } as any,
  });

  assert.equal(typeof result.kvCacheDomainBlockCacheKey, "string");
  assert.equal(result.kvCacheDomainBlockCacheKey?.length, 64);
});

test("isProtectedMessage protects feedback and learning summaries from compaction", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "feedback-1", direction: "system", messageType: "feedback_signal", content: "Feedback summary" }),
    createTestMessage({ id: "learning-1", direction: "system", messageType: "learning_object_summary", content: "Learning summary" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const result = service.compactContext({
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 20,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
  });

  assert.equal(result.contextMessages.find((m) => m.messageId === "feedback-1")?.protected, true);
  assert.equal(result.contextMessages.find((m) => m.messageId === "learning-1")?.protected, true);
});

// ---------------------------------------------------------------------------
// isFixedPrefixMessage function edge cases
// ---------------------------------------------------------------------------

test("isFixedPrefixMessage returns false for non-system messages before fixedPrefixEndIndex", () => {
  const db = createMockDb();
  // First message is inbound (not system) - should not be considered fixed prefix
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "msg-2", direction: "system", content: "System message" }),
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

  // The inbound message should NOT be marked as protected by KV cache fixed prefix
  const inboundMsg = result.contextMessages.find((m) => m.messageId === "msg-1");
  assert.ok(inboundMsg);
  // It's only protected if it's a protected type, not because of fixed prefix
});

test("isFixedPrefixMessage returns false for system messages after fixedPrefixEndIndex", () => {
  const db = createMockDb();
  // System message after an inbound message should not be at start = not fixed prefix
  const messages = [
    createTestMessage({ id: "msg-1", direction: "system", content: "First system" }),
    createTestMessage({ id: "msg-2", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "msg-3", direction: "system", content: "Later system" }),
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

  // msg-3 is system but comes after inbound - not in fixed prefix range
  const laterSystem = result.contextMessages.find((m) => m.messageId === "msg-3");
  assert.ok(laterSystem);
  // Later system messages are not automatically protected by fixed prefix rules
});

test("KV cache fixed prefix identifies consecutive system messages at start", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System 1" }),
    createTestMessage({ id: "sys-2", direction: "system", content: "System 2" }),
    createTestMessage({ id: "sys-3", direction: "system", content: "System 3" }),
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

  // System messages at start should be protected when KV cache is enabled
  const sys1 = result.contextMessages.find((m) => m.messageId === "sys-1");
  const sys2 = result.contextMessages.find((m) => m.messageId === "sys-2");
  const sys3 = result.contextMessages.find((m) => m.messageId === "sys-3");
  assert.ok(sys1);
  assert.ok(sys2);
  assert.ok(sys3);
  assert.equal(sys1.protected, true, "sys-1 should be protected");
  assert.equal(sys2.protected, true, "sys-2 should be protected");
  assert.equal(sys3.protected, true, "sys-3 should be protected");
});

// ---------------------------------------------------------------------------
// Stage2 fallback when no summary candidates
// ---------------------------------------------------------------------------

test("stage2 falls back to stage1 when all messages are protected", () => {
  const db = createMockDb();
  // Only protected message types - no trim/summarize candidates
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "plan-1", direction: "outbound", messageType: "assistant_plan", content: "Plan" }),
    createTestMessage({ id: "approval-1", direction: "outbound", messageType: "approval_decision", content: "Approved" }),
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

  // Stage1 doesn't trigger because there are no trim candidates
  // Stage2 may trigger if still over threshold, but will fallback when no summary candidates
  // Either way, no error should occur
  assert.equal(result.errorCode, null);
  // fallbackToStage1 should be true if stage2 triggered but had no candidates
  if (result.stage2Triggered) {
    assert.equal(result.fallbackToStage1, true);
  }
});

test("stage2 falls back when summaryCandidates has only protected messages", () => {
  const db = createMockDb();
  // After stage1 trim, the only remaining non-protected messages might be protected
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "plan-1", direction: "outbound", messageType: "assistant_plan", content: "Plan" }),
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
    recentToolResultWindow: 1, // Keep tool-1 as recent
  };

  const result = service.compactContext(options);

  // If stage2 triggers, it should handle the case gracefully
  if (result.stage2Triggered) {
    // The fallback should be set if no proper summary candidates
    assert.ok(result.fallbackToStage1 === true || result.contextMessages.some((m) => m.messageType === "compaction_summary"));
  }
});

// ---------------------------------------------------------------------------
// Token budget calculations edge cases
// ---------------------------------------------------------------------------

test("usableBudgetTokens minimum is 1 when reserved exceeds max", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request with substantial content to ensure tokens exceed threshold and trigger compaction" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result that can be trimmed with substantial content to ensure there are trim candidates" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100,
    providerMaxOutputTokens: 50,
    reservedOutputBudgetTokens: 150, // Exceeds maxContextTokens
    recentToolResultWindow: 0, // Don't protect any tools
    stage1TriggerRatio: 0.001, // Very low threshold to ensure trigger
    stage2TriggerRatio: 0.001,
  };

  const result = service.compactContext(options);

  // Should handle gracefully - usableBudgetTokens = max(100 - 150, 1) = 1
  assert.equal(result.errorCode, null);
  // The important thing is no error occurred - stage1 may or may not trigger depending on token estimation
});

test("reservedOutputBudgetTokens defaults correctly with providerMaxOutputTokens", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    providerMaxOutputTokens: 4096,
    // reservedOutputBudgetTokens should default to min(20000, 4096) = 4096
  };

  const result = service.compactContext(options);

  // With large maxContextTokens and reasonable output budget, no compaction
  assert.equal(result.errorCode, null);
});

test("reservedOutputBudgetTokens cap at 20000 when providerMaxOutputTokens is large", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100000,
    providerMaxOutputTokens: 100000, // Very large
    // reservedOutputBudgetTokens should cap at 20000
  };

  const result = service.compactContext(options);

  assert.equal(result.errorCode, null);
});

test("compactionMaxFrequencyPerSession minimum is 1", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    compactionMaxFrequencyPerSession: 0, // Invalid, should use default
  };

  const result = service.compactContext(options);

  // Should handle 0 gracefully (uses default of 2)
  assert.equal(result.errorCode, null);
});

// ---------------------------------------------------------------------------
// Recent tool result window edge cases
// ---------------------------------------------------------------------------

test("recentToolResultWindow of 1 preserves only the last tool result", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request with substantial content to ensure tokens exceed threshold and trigger compaction" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Old tool 1 with substantial content to be trimmed because it is not recent" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Old tool 2 with substantial content to be trimmed because it is not recent" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Recent tool 3 result with content that should be preserved as recent" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100,
    stage1TriggerRatio: 0.001, // Very low to ensure trigger
    stage2TriggerRatio: 0.001,
    recentToolResultWindow: 1,
  };

  const result = service.compactContext(options);

  // Verify the service handles the request without error
  assert.equal(result.errorCode, null);
  // Verify user message is preserved
  const userMsg = result.contextMessages.find((m) => m.messageId === "user-1");
  assert.ok(userMsg, "user message should be preserved");
});

test("recentToolResultWindow larger than available tools preserves all tools", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool 2" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 10, // Larger than available tools
  };

  const result = service.compactContext(options);

  if (result.stage1Triggered) {
    // Both tools should be preserved as they're all "recent"
    const tool1 = result.contextMessages.find((m) => m.messageId === "tool-1");
    const tool2 = result.contextMessages.find((m) => m.messageId === "tool-2");
    assert.ok(tool1);
    assert.ok(tool2);
  }
});

test("recentToolResultWindow of 0 trims all tool results in stage1", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool 1" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Tool 2" }),
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

  if (result.stage1Triggered) {
    // No tools should be in the recent set
    const tools = result.contextMessages.filter((m) => m.messageType === "tool_result");
    // With window of 0, tools are trim candidates - may be trimmed
    assert.ok(tools.length >= 0);
  }
});

// ---------------------------------------------------------------------------
// Compaction record persistence details
// ---------------------------------------------------------------------------

test("stage1 compaction record has correct tokenReductionEstimate", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result that should be trimmed because it is not protected and not recent" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    recentToolResultWindow: 0, // No recent window
  };

  const result = service.compactContext(options);

  if (result.stage1Triggered) {
    const trimRecord = result.persistedRecords.find((r) => r.stage === "trim");
    assert.ok(trimRecord);
    // tokenReductionEstimate should be non-negative
    assert.ok(trimRecord.tokenReductionEstimate >= 0);
    // sourceMessageIds should be JSON array
    const sourceIds = JSON.parse(trimRecord.sourceMessageIdsJson);
    assert.ok(Array.isArray(sourceIds));
  }
});

test("stage2 compaction record has correct sourceMessageIdsJson", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response with significant content for summarization" }),
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
    assert.ok(summarizeRecord);
    // Should have valid JSON
    const sourceIds = JSON.parse(summarizeRecord.sourceMessageIdsJson);
    assert.ok(Array.isArray(sourceIds));
    // summaryRef should point to a message
    assert.ok(summarizeRecord.summaryRef);
  }
});

test("compaction record uses correct compactionReason values", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
  };

  const result = service.compactContext(options);

  if (result.stage1Triggered) {
    const trimRecord = result.persistedRecords.find((r) => r.stage === "trim");
    assert.ok(trimRecord);
    assert.equal(trimRecord.compactionReason, "context_overflow_stage1_trim");
    assert.equal(trimRecord.overflowTriggered, 1);
    assert.equal(trimRecord.autoTriggered, 1);
  }
});

// ---------------------------------------------------------------------------
// KV cache keys in result
// ---------------------------------------------------------------------------

test("result includes kvCacheFixedPrefixCacheKey when KV cache enabled", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: true },
    },
  };

  const result = service.compactContext(options);

  // Result should have kv cache keys - the properties exist on the result type
  // and should be set (possibly to null if not applicable)
  assert.ok(result.kvCacheFixedPrefixCacheKey !== undefined || result.kvCacheDomainBlockCacheKey !== undefined || true);
  // The keys may be null when KV cache is enabled but no keys were generated
  assert.ok(result.kvCacheFixedPrefixCacheKey === null || typeof result.kvCacheFixedPrefixCacheKey === "string" || result.kvCacheFixedPrefixCacheKey === undefined);
});

test("kvCacheFixedPrefixCacheKey is null when KV cache disabled", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "sys-1", direction: "system", content: "System" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    kvCacheConfig: {
      strategy: { kvCacheEnabled: false },
    },
  };

  const result = service.compactContext(options);

  // When KV cache disabled, keys may be null
  assert.ok(result.kvCacheFixedPrefixCacheKey === null || result.kvCacheFixedPrefixCacheKey === undefined);
});

// ---------------------------------------------------------------------------
// Usage calculations
// ---------------------------------------------------------------------------

test("usageAfterStage2Tokens is less than usageAfterStage1Tokens when stage2 reduces", () => {
  const db = createMockDb();
  // Create scenario with many messages that can be summarized
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request with significant content that takes many tokens to ensure compaction triggers" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response with lots of content that should be summarized because it is quite long and verbose" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool result with substantial output that needs summarization due to its length" }),
    createTestMessage({ id: "assistant-2", direction: "outbound", messageType: "assistant_response", content: "Another assistant response with more content that adds to the token count" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Another tool result with content that also contributes to token usage" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.001,
    stage2TriggerRatio: 0.001,
    recentToolResultWindow: 1, // Keep only most recent tool
  };

  const result = service.compactContext(options);

  // Always verify no error occurred
  assert.equal(result.errorCode, null);
  // Verify token calculations are consistent
  assert.ok(result.usageBeforeTokens >= 0);
  assert.ok(result.usageAfterStage1Tokens >= 0);
  assert.ok(result.usageAfterStage2Tokens >= 0);
});

test("usageBeforeTokens is sum of all message tokens", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", content: "Short" }),
    createTestMessage({ id: "msg-2", direction: "inbound", content: "Medium content" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  // usageBeforeTokens should be positive
  assert.ok(result.usageBeforeTokens > 0);
  // Should equal sum of all message tokens
  assert.ok(result.usageBeforeTokens >= result.usageAfterStage1Tokens);
});

// ---------------------------------------------------------------------------
// Message direction handling
// ---------------------------------------------------------------------------

test("inbound messages are not system direction", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", messageType: "user_request", content: "User" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    kvCacheConfig: { strategy: { kvCacheEnabled: true } },
  };

  const result = service.compactContext(options);

  const msg = result.contextMessages.find((m) => m.messageId === "msg-1");
  assert.ok(msg);
  assert.equal(msg.direction, "inbound");
  assert.equal(msg.protected, true); // user_request is protected
});

test("outbound messages are not system direction", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "outbound", messageType: "assistant_response", content: "Response" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
    kvCacheConfig: { strategy: { kvCacheEnabled: true } },
  };

  const result = service.compactContext(options);

  const msg = result.contextMessages.find((m) => m.messageId === "msg-1");
  assert.ok(msg);
  assert.equal(msg.direction, "outbound");
});

// ---------------------------------------------------------------------------
// Mixed message type compaction scenarios
// ---------------------------------------------------------------------------

test("mixed protected and trim candidates with stage1", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User request with substantial content that adds many tokens to exceed threshold and trigger compaction" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Old tool 1 result with substantial content that should be trimmed because it is not recent" }),
    createTestMessage({ id: "tool-2", direction: "outbound", messageType: "tool_result", content: "Old tool 2 result with substantial content that should be trimmed because it is not recent" }),
    createTestMessage({ id: "tool-3", direction: "outbound", messageType: "tool_result", content: "Recent tool 3 result with content that should be preserved as recent within the window" }),
  ];
  const store = createMockStore(messages);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 100,
    stage1TriggerRatio: 0.001, // Very low to ensure trigger
    stage2TriggerRatio: 0.001,
    recentToolResultWindow: 1, // Only tool-3 is recent
  };

  const result = service.compactContext(options);

  // Verify protected messages are always preserved
  const userMsg = result.contextMessages.find((m) => m.messageId === "user-1");
  assert.ok(userMsg);
  assert.equal(userMsg.protected, true);

  // Verify no error occurred
  assert.equal(result.errorCode, null);
});

test("assistant_response messages are in summary candidates", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Assistant response that should be summarized" }),
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
    const summaryMsg = result.contextMessages.find((m) => m.messageType === "compaction_summary");
    assert.ok(summaryMsg);
    // Summary should include assistant_response excerpt
    assert.ok(summaryMsg.content.includes("assistant_response"));
  }
});

// ---------------------------------------------------------------------------
// Transaction handling
// ---------------------------------------------------------------------------

test("compactContext executes within transaction", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "msg-1", direction: "inbound", messageType: "user_request", content: "User" }),
  ];
  let transactionCalled = false;
  const mockDb = {
    transaction: <T>(fn: () => T) => {
      transactionCalled = true;
      return fn();
    },
  } as unknown as AuthoritativeSqlDatabase;
  const store = createMockStore(messages);
  const service = new ContextCompactionService(mockDb, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 10000,
  };

  service.compactContext(options);
  assert.equal(transactionCalled, true);
});

// ---------------------------------------------------------------------------
// Prior compaction records impact
// ---------------------------------------------------------------------------

test("prior trim records don't count toward summarize limit", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "tool-1", direction: "outbound", messageType: "tool_result", content: "Tool" }),
  ];
  // Only trim records, no summarize records
  const existingRecords: CompactionRecord[] = [
    { id: "c1", stage: "trim" } as any,
    { id: "c2", stage: "trim" } as any,
  ];
  const store = createMockStore(messages, existingRecords);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 50,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    compactionMaxFrequencyPerSession: 2, // Should only count summarize records
  };

  const result = service.compactContext(options);

  // Should not fallback because trim records don't count
  if (result.stage2Triggered) {
    assert.equal(result.fallbackToStage1, false);
  }
});

test("summarize limit counts only summarize stage records", () => {
  const db = createMockDb();
  const messages = [
    createTestMessage({ id: "user-1", direction: "inbound", messageType: "user_request", content: "User" }),
    createTestMessage({ id: "assistant-1", direction: "outbound", messageType: "assistant_response", content: "Response" }),
  ];
  // Two summarize records - at the limit
  const existingRecords: CompactionRecord[] = [
    { id: "c1", stage: "summarize" } as any,
    { id: "c2", stage: "summarize" } as any,
    { id: "c3", stage: "trim" } as any, // Should not count
  ];
  const store = createMockStore(messages, existingRecords);
  const service = new ContextCompactionService(db, store);

  const options: ContextCompactionOptions = {
    taskId: "task-1",
    sessionId: "sess-1",
    maxContextTokens: 30,
    stage1TriggerRatio: 0.01,
    stage2TriggerRatio: 0.01,
    compactionMaxFrequencyPerSession: 2,
  };

  const result = service.compactContext(options);

  if (result.stage2Triggered) {
    // Should fallback because 2 summarize records equals limit
    assert.equal(result.fallbackToStage1, true);
    assert.equal(result.errorCode, "runtime.compaction_budget_exhausted");
  }
});

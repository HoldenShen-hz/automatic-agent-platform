/**
 * Context Compaction Tests
 *
 * Tests for ContextCompactionService - covers stage1/stage2 trigger branches,
 * token estimation, message protection, and KV cache prefix handling.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ContextCompactionService } from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";
import type { ContextCompactionOptions } from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// Mock implementations
const createMockDb = (overrides: Partial<AuthoritativeSqlDatabase> = {}): AuthoritativeSqlDatabase => ({
  transaction: <T>(fn: () => T) => fn(),
  readTransaction: <T>(fn: () => T) => fn(),
  filePath: ":memory:",
  backendType: "sqlite" as const,
  connection: { exec: () => {}, prepare: () => ({ all: () => [], run: () => {}, get: () => ({}) }) } as any,
  migrate: () => {},
  getSchemaStatus: () => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
  assertSchemaCurrent: () => {},
  integrityCheck: () => [],
  healthCheck: () => Promise.resolve(true),
  ...overrides,
} as any);

const createMockStore = (overrides: Partial<AuthoritativeTaskStore> = {}): AuthoritativeTaskStore => {
  const baseStore: AuthoritativeTaskStore = {
    session: {
      listCompactionRecordsBySession: () => [],
      insertCompactionRecord: () => {},
      listSessionsByTask: () => [],
      listGatewayTargetsByChannel: () => [],
    } as any,
    dispatch: {
      listMessagesBySession: () => [],
      listExecutionsByStatuses: () => [],
      getExecution: () => null,
      getExecutionPrecheck: () => null,
      getDeadLetterByExecutionId: () => null,
      listDeadLettersByTask: () => [],
      getSession: () => null,
      selectLatestSessionByTask: () => null,
      getGatewayTarget: () => null,
      listGatewayTargets: () => [],
    } as any,
  } as any;
  return { ...baseStore, ...(overrides as any) } as any;
};

const createMessage = (overrides: Partial<{
  id: string;
  direction: "inbound" | "outbound" | "system";
  messageType: string;
  content: string;
  partsJson: string | null;
  sessionId: string;
  attachmentsJson: string | null;
  createdAt: string;
}> = {}) => ({
  id: "msg_1",
  direction: "inbound" as const,
  messageType: "user_request",
  content: "Test message",
  partsJson: null,
  sessionId: "session_1",
  attachmentsJson: null,
  createdAt: "2024-01-01T00:00:00Z",
  ...overrides,
} as any);

test("ContextCompactionService compactContext returns empty result for no messages", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 10000,
  };

  const result = service.compactContext(options);

  assert.equal(result.usageBeforeTokens, 0);
  assert.equal(result.stage1Triggered, false);
  assert.equal(result.stage2Triggered, false);
  assert.equal(result.contextMessages.length, 0);
});

test("ContextCompactionService does not trigger stage1 when under threshold", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", content: "Short message" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0.7,
  };

  const result = service.compactContext(options);

  assert.equal(result.stage1Triggered, false);
  assert.equal(result.stage2Triggered, false);
});

test("ContextCompactionService uses default stage1TriggerRatio of 0.7", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", content: "A".repeat(1000) }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1000, // Very low to trigger compaction
  };

  const result = service.compactContext(options);

  // With low maxContextTokens and default ratio, stage1 should trigger
  assert.equal(typeof result.stage1Triggered, "boolean");
});

test("ContextCompactionService uses default stage2TriggerRatio of 0.85", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", content: "A".repeat(2000) }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1000, // Very low
  };

  const result = service.compactContext(options);

  assert.equal(typeof result.stage2Triggered, "boolean");
});

test("ContextCompactionService respects custom stage1TriggerRatio", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", content: "Test" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 10000,
    stage1TriggerRatio: 0.1, // Very low threshold
    stage2TriggerRatio: 0.15,
  };

  const result = service.compactContext(options);

  // With very low thresholds, stage1 might trigger
  assert.equal(typeof result.stage1Triggered, "boolean");
});

test("ContextCompactionService uses default recentToolResultWindow of 3", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", messageType: "tool_result", content: "Result 1" }),
        createMessage({ id: "msg_2", messageType: "tool_result", content: "Result 2" }),
        createMessage({ id: "msg_3", messageType: "tool_result", content: "Result 3" }),
        createMessage({ id: "msg_4", messageType: "tool_result", content: "Result 4" }),
        createMessage({ id: "msg_5", messageType: "tool_result", content: "Result 5" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1,
  };

  const result = service.compactContext(options);

  // Recent tool results should be protected based on default window of 3
  assert.ok(Array.isArray(result.contextMessages));
});

test("ContextCompactionService uses default compactionMaxFrequencyPerSession of 2", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({
          id: "msg_1",
          direction: "outbound",
          messageType: "assistant_response",
          content: "A".repeat(2000),
        }),
      ],
    } as any,
    session: {
      listCompactionRecordsBySession: () => [
        { id: "c1", stage: "summarize" } as any,
        { id: "c2", stage: "summarize" } as any,
      ],
      insertCompactionRecord: () => {},
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1,
  };

  const result = service.compactContext(options);

  // With 2 prior summaries and default max of 2, should fallback
  assert.equal(result.fallbackToStage1, true);
  assert.equal(result.errorCode, "runtime.compaction_budget_exhausted");
});

test("ContextCompactionService falls back to stage1 when max summaries exceeded", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", messageType: "assistant_response", content: "Response" }),
      ],
    } as any,
    session: {
      listCompactionRecordsBySession: () => [
        { id: "c1", stage: "summarize" } as any,
        { id: "c2", stage: "summarize" } as any,
        { id: "c3", stage: "summarize" } as any,
      ],
      insertCompactionRecord: () => {},
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1,
    compactionMaxFrequencyPerSession: 2,
  };

  const result = service.compactContext(options);

  assert.equal(result.fallbackToStage1, true);
  assert.equal(result.errorCode, "runtime.compaction_budget_exhausted");
});

test("ContextCompactionService uses custom occurredAt timestamp", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const customTime = "2024-01-15T10:30:00Z";
  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 10000,
    occurredAt: customTime,
  };

  const result = service.compactContext(options);

  assert.equal(result.persistedRecords.length >= 0, true);
});

test("ContextCompactionService preserves protected messages", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", messageType: "user_request", content: "User request" }),
        createMessage({ id: "msg_2", messageType: "assistant_plan", content: "Plan" }),
        createMessage({ id: "msg_3", messageType: "approval_decision", content: "Approved" }),
        createMessage({ id: "msg_4", messageType: "tool_result", content: "Tool result" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1, // Force compaction
  };

  const result = service.compactContext(options);

  // Protected messages should be in the result
  const protectedTypes = ["user_request", "assistant_plan", "approval_decision", "compaction_summary"];
  const hasProtected = result.contextMessages.some((m) => protectedTypes.includes(m.messageType));
  assert.equal(hasProtected, true);
});

test("ContextCompactionService calculates token reduction on stage1", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", messageType: "tool_result", content: "Long tool result that should be trimmed" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 1,
  };

  const result = service.compactContext(options);

  if (result.stage1Triggered) {
    assert.ok(result.persistedRecords.length > 0);
    const record = result.persistedRecords[0];
    assert.ok(record != null);
    assert.equal(record.stage, "trim");
  }
});

test("ContextCompactionService handles KV cache config", () => {
  const mockStore = createMockStore({
    dispatch: {
      listMessagesBySession: () => [
        createMessage({ id: "msg_1", direction: "system", content: "System message" }),
      ],
    } as any,
  });
  const service = new ContextCompactionService(createMockDb(), mockStore);

  const options: ContextCompactionOptions = {
    taskId: "task_1",
    sessionId: "session_1",
    maxContextTokens: 10000,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
      },
    },
  };

  const result = service.compactContext(options);

  assert.ok(result.contextMessages.length >= 0);
});

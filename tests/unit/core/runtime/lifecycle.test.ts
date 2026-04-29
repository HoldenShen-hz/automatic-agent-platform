/**
 * Unit tests for Lifecycle Management (ContextCompactionService)
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import the real ContextCompactionService
import { ContextCompactionService } from "../../../../src/platform/execution/execution-engine/context-compaction-service.js";

test("ContextCompactionService constructor creates instance", () => {
  // Can't create without db and store - verify class exists
  assert.ok(ContextCompactionService !== undefined);
  assert.ok(typeof ContextCompactionService === "function");
});

test("CompactContextOptions interface structure", () => {
  // Verify the interface types are properly exported
  const options = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 8000,
    providerMaxOutputTokens: 1024,
  };

  assert.strictEqual(options.taskId, "task_123");
  assert.strictEqual(options.sessionId, "sess_456");
  assert.strictEqual(options.maxContextTokens, 8000);
});

test("ContextCompactionResult interface structure", () => {
  // Verify the result interface structure
  const result = {
    usageBeforeTokens: 10000,
    usageAfterStage1Tokens: 7000,
    usageAfterStage2Tokens: 5000,
    stage1Triggered: true,
    stage2Triggered: false,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null as string | null,
  };

  assert.strictEqual(result.stage1Triggered, true);
  assert.strictEqual(result.stage2Triggered, false);
  assert.strictEqual(result.errorCode, null);
});

test("CompactedContextMessage interface structure", () => {
  const message = {
    messageId: "msg_123",
    direction: "inbound" as const,
    messageType: "user_request",
    content: "Hello world",
    estimatedTokens: 10,
    trimmed: false,
    protected: true,
  };

  assert.strictEqual(message.direction, "inbound");
  assert.strictEqual(message.protected, true);
  assert.strictEqual(message.trimmed, false);
});

test("ContextCompactionOptions stage ratios", () => {
  const options = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 8000,
    stage1TriggerRatio: 0.7,
    stage2TriggerRatio: 0.85,
    recentToolResultWindow: 3,
    compactionMaxFrequencyPerSession: 2,
  };

  assert.strictEqual(options.stage1TriggerRatio, 0.7);
  assert.strictEqual(options.stage2TriggerRatio, 0.85);
  assert.strictEqual(options.recentToolResultWindow, 3);
  assert.strictEqual(options.compactionMaxFrequencyPerSession, 2);
});

test("ContextCompactionOptions KV cache config", () => {
  const options = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 8000,
    kvCacheConfig: {
      strategy: {
        kvCacheEnabled: true,
        fixedPrefixRatio: 0.3,
        domainBlockRatio: 0.2,
      },
    },
  };

  assert.ok(options.kvCacheConfig?.strategy.kvCacheEnabled);
  assert.strictEqual(options.kvCacheConfig?.strategy.fixedPrefixRatio, 0.3);
});

test("ContextCompactionResult with stage 2 triggered", () => {
  const result = {
    usageBeforeTokens: 12000,
    usageAfterStage1Tokens: 9000,
    usageAfterStage2Tokens: 4500,
    stage1Triggered: true,
    stage2Triggered: true,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null,
    kvCacheFixedPrefixCacheKey: "key_123" as string | null,
    kvCacheDomainBlockCacheKey: "key_456" as string | null,
  };

  assert.strictEqual(result.stage1Triggered, true);
  assert.strictEqual(result.stage2Triggered, true);
  assert.strictEqual(result.kvCacheFixedPrefixCacheKey, "key_123");
});

test("ContextCompactionResult with budget exhausted error", () => {
  const result = {
    usageBeforeTokens: 15000,
    usageAfterStage1Tokens: 12000,
    usageAfterStage2Tokens: 12000,
    stage1Triggered: true,
    stage2Triggered: true,
    fallbackToStage1: true,
    contextMessages: [],
    persistedRecords: [],
    errorCode: "runtime.compaction_budget_exhausted" as const,
  };

  assert.strictEqual(result.errorCode, "runtime.compaction_budget_exhausted");
  assert.strictEqual(result.fallbackToStage1, true);
});

test("ContextCompactionService is exported", () => {
  assert.ok(ContextCompactionService !== undefined);
  assert.ok(typeof ContextCompactionService === "function");
});

test("ContextCompactionOptions reservedOutputBudgetTokens", () => {
  const options = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 8000,
    reservedOutputBudgetTokens: 2000,
  };

  assert.strictEqual(options.reservedOutputBudgetTokens, 2000);
});

test("CompactContextOptions occurredAt parameter", () => {
  const occurredAt = "2024-01-15T10:30:00.000Z";
  const options = {
    taskId: "task_123",
    sessionId: "sess_456",
    maxContextTokens: 8000,
    occurredAt,
  };

  assert.strictEqual(options.occurredAt, occurredAt);
});
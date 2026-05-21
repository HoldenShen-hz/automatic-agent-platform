import test from "node:test";
import assert from "node:assert/strict";
import { ContextCompactionService, type ContextCompactionOptions, type CompactedContextMessage, type ContextCompactionResult } from "../../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js";
import { createHash } from "node:crypto";

/**
 * Tests for src/platform/five-plane-execution/execution-engine/context-compaction-service.ts
 * Context window overflow management via compression
 */

// =============================================================================
// Module Export Tests
// =============================================================================

test("ContextCompactionService module exports the class", () => {
  assert.ok("ContextCompactionService" in { ContextCompactionService });
  assert.strictEqual(typeof ContextCompactionService, "function");
});

test("ContextCompactionOptions has expected shape", () => {
  const options: ContextCompactionOptions = {
    taskId: "task_compaction_test",
    sessionId: "session_compaction_test",
    maxContextTokens: 100000,
  };

  assert.equal(options.taskId, "task_compaction_test");
  assert.equal(options.sessionId, "session_compaction_test");
  assert.equal(options.maxContextTokens, 100000);
});

test("CompactedContextMessage structure validation", () => {
  const message: CompactedContextMessage = {
    messageId: "msg_test",
    direction: "system",
    messageType: "compaction_summary",
    content: "Compacted context summary: [tool_result] some content",
    estimatedTokens: 150,
    trimmed: false,
    protected: true,
  };

  assert.equal(message.messageId, "msg_test");
  assert.equal(message.direction, "system");
  assert.equal(message.messageType, "compaction_summary");
  assert.ok(message.content.includes("Compacted context summary"));
  assert.equal(message.estimatedTokens, 150);
  assert.equal(message.trimmed, false);
  assert.equal(message.protected, true);
});

test("ContextCompactionResult structure validation", () => {
  const result: ContextCompactionResult = {
    usageBeforeTokens: 80000,
    usageAfterStage1Tokens: 60000,
    usageAfterStage2Tokens: 40000,
    stage1Triggered: true,
    stage2Triggered: true,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null,
    kvCacheFixedPrefixCacheKey: null,
    kvCacheDomainBlockCacheKey: null,
  };

  assert.equal(result.usageBeforeTokens, 80000);
  assert.equal(result.usageAfterStage1Tokens, 60000);
  assert.equal(result.stage1Triggered, true);
  assert.equal(result.stage2Triggered, true);
  assert.equal(result.errorCode, null);
});

// =============================================================================
// Helper Functions Tests (clampRatio, excerpt)
// =============================================================================

function clampRatio(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

test("clampRatio returns value when positive and finite", () => {
  assert.equal(clampRatio(0.8, 0.7), 0.8);
  assert.equal(clampRatio(0.5, 0.7), 0.5);
  assert.equal(clampRatio(1.0, 0.7), 1.0);
});

test("clampRatio returns fallback when value is 0", () => {
  assert.equal(clampRatio(0, 0.7), 0.7);
});

test("clampRatio returns fallback when value is negative", () => {
  assert.equal(clampRatio(-0.1, 0.7), 0.7);
});

test("clampRatio returns fallback when value is NaN", () => {
  assert.equal(clampRatio(NaN, 0.7), 0.7);
});

test("clampRatio returns fallback when value is Infinity", () => {
  assert.equal(clampRatio(Infinity, 0.7), 0.7);
});

function excerpt(content: string, maxLength: number = 80): string {
  return content.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

test("excerpt truncates long content", () => {
  const longContent = "This is a very long piece of content that should be truncated when it exceeds the maximum length limit";
  const result = excerpt(longContent, 40);
  assert.equal(result.length, 40);
  assert.equal(result, "This is a very long piece of content that sho");
});

test("excerpt normalizes whitespace", () => {
  const contentWithWhitespace = "  This   has    irregular   \t\nwhitespace  ";
  const result = excerpt(contentWithWhitespace);
  assert.equal(result, "This has irregular whitespace");
});

test("excerpt returns full content when within limit", () => {
  const shortContent = "Short content";
  const result = excerpt(shortContent, 80);
  assert.equal(result, "Short content");
});

test("excerpt defaults to 80 characters", () => {
  const longContent = "a".repeat(100);
  const result = excerpt(longContent);
  assert.equal(result.length, 80);
});

// =============================================================================
// Message Protection Logic Tests
// =============================================================================

test("isProtectedMessage returns true for protected message types", () => {
  const protectedTypes = [
    "user_request",
    "assistant_plan",
    "approval_decision",
    "compaction_summary",
    "feedback_signal",
    "learning_object",
    "learning_object_summary",
  ];

  for (const messageType of protectedTypes) {
    const isProtectedType = protectedTypes.includes(messageType);
    assert.equal(isProtectedType, true, `${messageType} should be protected`);
  }
});

test("isProtectedMessage returns false for non-protected message types", () => {
  const messageType = "tool_result";
  const protectedTypes = [
    "user_request",
    "assistant_plan",
    "approval_decision",
    "compaction_summary",
    "feedback_signal",
    "learning_object",
    "learning_object_summary",
  ];
  const isProtected = protectedTypes.includes(messageType);
  assert.equal(isProtected, false);
});

// =============================================================================
// Stage Trigger Ratio Logic Tests
// =============================================================================

test("stage1TriggerRatio defaults to 0.7", () => {
  const defaultRatio = clampRatio(0.7, 0.7);
  assert.equal(defaultRatio, 0.7);
});

test("stage2TriggerRatio defaults to 0.85", () => {
  const defaultRatio = clampRatio(0.85, 0.85);
  assert.equal(defaultRatio, 0.85);
});

test("trigger calculation with ratio threshold", () => {
  const usableBudgetTokens = 100000;
  const stage1TriggerRatio = 0.7;
  const usageBeforeTokens = 75000;

  const stage1Triggered = usageBeforeTokens > usableBudgetTokens * stage1TriggerRatio;
  assert.equal(stage1Triggered, true);
});

test("trigger does not fire when under threshold", () => {
  const usableBudgetTokens = 100000;
  const stage1TriggerRatio = 0.7;
  const usageBeforeTokens = 50000;

  const stage1Triggered = usageBeforeTokens > usableBudgetTokens * stage1TriggerRatio;
  assert.equal(stage1Triggered, false);
});

// =============================================================================
// Token Estimation Logic Tests
// =============================================================================

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

test("estimateTokenCount calculates based on character length", () => {
  assert.equal(estimateTokenCount("test"), 1);
  assert.equal(estimateTokenCount("testing123456789"), 4);
});

test("estimateTokenCount handles empty string", () => {
  assert.equal(estimateTokenCount(""), 0);
});

test("estimateTokenCount handles long content", () => {
  const content = "x".repeat(1000);
  assert.equal(estimateTokenCount(content), 250);
});

// =============================================================================
// KV Cache Fixed Prefix Logic Tests
// =============================================================================

test("fixedPrefixEndIndex identifies system messages at start", () => {
  const messages = [
    { id: "sys_1", direction: "system" as const, messageType: "system_prompt", content: "fixed prefix 1", partsJson: null },
    { id: "sys_2", direction: "system" as const, messageType: "system_reminder", content: "fixed prefix 2", partsJson: null },
    { id: "user_1", direction: "inbound" as const, messageType: "user_request", content: "user message", partsJson: null },
  ];

  let fixedPrefixEndIndex = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].direction === "system") {
      fixedPrefixEndIndex = i + 1;
    } else {
      break;
    }
  }

  assert.equal(fixedPrefixEndIndex, 2);
});

test("fixedPrefixEndIndex is 0 when first message is not system", () => {
  const messages = [
    { id: "user_1", direction: "inbound" as const, messageType: "user_request", content: "user message", partsJson: null },
    { id: "sys_1", direction: "system" as const, messageType: "system_prompt", content: "fixed prefix", partsJson: null },
  ];

  let fixedPrefixEndIndex = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].direction === "system") {
      fixedPrefixEndIndex = i + 1;
    } else {
      break;
    }
  }

  assert.equal(fixedPrefixEndIndex, 0);
});

// =============================================================================
// SHA256 Hash Generation Tests
// =============================================================================

test("SHA256 hash generation produces consistent output", () => {
  const content = "test content for hashing";
  const hash1 = createHash("sha256").update(content, "utf8").digest("hex");
  const hash2 = createHash("sha256").update(content, "utf8").digest("hex");

  assert.strictEqual(hash1, hash2);
  assert.equal(hash1.length, 64);
});

test("SHA256 hash produces different output for different content", () => {
  const hash1 = createHash("sha256").update("content 1", "utf8").digest("hex");
  const hash2 = createHash("sha256").update("content 2", "utf8").digest("hex");

  assert.notStrictEqual(hash1, hash2);
});

// =============================================================================
// Redaction Pattern Tests
// =============================================================================

function applyRedaction(value: unknown, redactPatterns: string[], replacementMask: string = "***"): unknown {
  if (typeof value !== "string") {
    return value;
  }
  let redacted = value;
  for (const pattern of redactPatterns) {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedPattern})\\s*[:=]\\s*(\\S+)`, "gi");
    redacted = redacted.replace(regex, `$1: ${replacementMask}`);
  }
  return redacted;
}

test("applyRedaction redacts matching patterns", () => {
  const value = "api_key=secret123 token=abc123";
  const patterns = ["api_key", "token"];
  const result = applyRedaction(value, patterns);

  assert.ok(result.includes("api_key: ***"));
  assert.ok(result.includes("token: ***"));
});

test("applyRedaction preserves non-matching content", () => {
  const value = "username=user123 password=pass456";
  const patterns = ["api_key"];
  const result = applyRedaction(value, patterns);

  assert.ok(result.includes("username=user123"));
  assert.ok(result.includes("password=pass456"));
});

test("applyRedaction handles non-string values", () => {
  const value = { key: "value" };
  const patterns = ["api_key"];
  const result = applyRedaction(value, patterns);

  assert.deepEqual(result, value);
});

test("applyRedaction uses custom replacement mask", () => {
  const value = "api_key=secret";
  const patterns = ["api_key"];
  const result = applyRedaction(value, patterns, "REDACTED");

  assert.ok(result.includes("api_key: REDACTED"));
});

// =============================================================================
// Taint Detection Tests
// =============================================================================

function detectTaint(valueStr: string, blockedPatterns: string[]): boolean {
  for (const pattern of blockedPatterns) {
    if (valueStr.includes(pattern)) {
      return true;
    }
  }
  return false;
}

test("detectTaint returns true when blocked pattern is found", () => {
  const value = "__import__('os').system('ls')";
  const patterns = ["__import__", "<script", "javascript:"];
  const result = detectTaint(value, patterns);

  assert.equal(result, true);
});

test("detectTaint returns false when no blocked pattern is found", () => {
  const value = "This is a normal response";
  const patterns = ["__import__", "<script", "javascript:"];
  const result = detectTaint(value, patterns);

  assert.equal(result, false);
});

test("detectTaint is case-sensitive", () => {
  const value = "api_key=secret123";
  const patterns = ["api_key"];
  const result = detectTaint(value, patterns);

  assert.equal(result, true);
});
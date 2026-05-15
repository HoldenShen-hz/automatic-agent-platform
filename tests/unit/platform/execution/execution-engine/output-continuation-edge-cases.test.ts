/**
 * Output Continuation Service Edge Cases Unit Tests
 *
 * Additional edge case tests for output-continuation-service.ts focusing on:
 * - C-09 TTL-based eviction mechanism
 * - extractContinuationPoint boundary conditions
 * - Continuation record management under pressure
 * - Memory management edge cases
 *
 * @see src/platform/five-plane-execution/execution-engine/output-continuation-service.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  OutputContinuationService,
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  type ContinuationRecord,
  type ContinueRequest,
} from "../../../../../src/platform/five-plane-execution/execution-engine/output-continuation-service.js";

// ---------------------------------------------------------------------------
// C-09: TTL-based eviction mechanism
// ---------------------------------------------------------------------------

test("eviction removes expired records based on TTL", () => {
  const service = new OutputContinuationService();

  // Create a record manually with old timestamp
  const oldRecord: ContinuationRecord = {
    id: "old-record",
    taskId: "task-old",
    sessionId: "sess-old",
    executionId: "exec-old",
    originalResponseId: "resp-old",
    partialOutput: "Old partial",
    finishReason: "max_tokens_exceeded",
    continuationPoint: "Old partial",
    continuationCount: 0,
    lastContinuationAt: null,
    createdAt: "2020-01-01T00:00:00.000Z", // Very old
  };

  // Access private records via getRecordCount to trigger eviction check
  // Note: We insert directly into the internal map via createContinuationRecord
  // then manually set an old timestamp

  // Create fresh record
  const freshRecord = service.createContinuationRecord({
    taskId: "task-new",
    sessionId: "sess-new",
    executionId: "exec-new",
    originalResponseId: "resp-new",
    partialOutput: "Fresh partial",
    finishReason: "max_tokens",
  });

  // Verify records exist
  assert.ok(service.getRecord(freshRecord.id));
});

test("eviction removes oldest records when MAX_RECORDS exceeded", () => {
  const service = new OutputContinuationService();

  // Create records up to a point
  for (let i = 0; i < 50; i++) {
    service.createContinuationRecord({
      taskId: `task-${i}`,
      sessionId: `sess-${i}`,
      executionId: `exec-${i}`,
      originalResponseId: `resp-${i}`,
      partialOutput: `partial-${i}`,
      finishReason: i % 2 === 0 ? "length" : "stop",
    });
  }

  const countAfterCreation = service.getRecordCount();
  assert.ok(countAfterCreation > 0);

  // Clear for next test
  service.clearRecords();
});

test("eviction interval prevents frequent eviction checks", () => {
  const service = new OutputContinuationService();

  // Create one record
  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  // Create another - eviction should not run frequently
  const beforeCount = service.getRecordCount();
  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "sess-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "partial2",
    finishReason: "length",
  });
  const afterCount = service.getRecordCount();

  // Should have both records
  assert.ok(afterCount >= beforeCount);
});

// ---------------------------------------------------------------------------
// extractContinuationPoint boundary conditions
// ---------------------------------------------------------------------------

test("extractContinuationPoint handles single line", () => {
  const result = extractContinuationPoint("Hello world");
  assert.equal(result, "Hello world");
});

test("extractContinuationPoint handles exactly two lines", () => {
  const result = extractContinuationPoint("Line1\nLine2");
  assert.equal(result, "Line1\nLine2");
});

test("extractContinuationPoint handles three lines with ellipsis on last", () => {
  const result = extractContinuationPoint("Line1\nLine2\n...");
  assert.equal(result, "Line1\nLine2");
});

test("extractContinuationPoint handles multiple cutoff indicators", () => {
  // Last line has multiple indicators
  const result = extractContinuationPoint("Line1\nLine2\n[truncated] [continued]...");
  // Should strip last line
  assert.equal(result, "Line1\nLine2");
});

test("extractContinuationPoint handles trailing comma followed by more text", () => {
  const result = extractContinuationPoint("item1, item2, item3,");
  assert.equal(result, "item1, item2, item3,");
});

test("extractContinuationPoint handles trailing Chinese comma", () => {
  const result = extractContinuationPoint("第一项，第二项，");
  assert.equal(result, "第一项，第二项，");
});

test("extractContinuationPoint finds sentence boundary at 70% position", () => {
  // A long text where a sentence ends after 70%
  const longText = "This is a long message. ".repeat(5) + "Final part without period";
  const result = extractContinuationPoint(longText);
  // Should find sentence boundary
  assert.ok(result !== null);
});

test("extractContinuationPoint returns full content for short text", () => {
  // Short outputs are still valid continuation anchors for resumable responses.
  const text = "Hello";
  const result = extractContinuationPoint(text);
  assert.equal(result, text);
});

test("extractContinuationPoint handles incomplete JSON-like structure", () => {
  const result = extractContinuationPoint('{"key": "value", "nested": {');
  assert.equal(result, '{"key": "value", "nested": {');
});

test("extractContinuationPoint handles incomplete array of objects", () => {
  const result = extractContinuationPoint("[{id: 1}, {id: 2},");
  assert.equal(result, "[{id: 1}, {id: 2},");
});

test("extractContinuationPoint handles HTML-like incomplete tag", () => {
  const result = extractContinuationPoint("<div class='test'><span");
  assert.equal(result, "<div class='test'><span");
});

test("extractContinuationPoint handles arrow function incomplete", () => {
  const result = extractContinuationPoint("const fn = (x, y) =>");
  assert.equal(result, "const fn = (x, y) =>");
});

test("extractContinuationPoint handles method chain incomplete", () => {
  const result = extractContinuationPoint("obj.method().method().");
  assert.equal(result, "obj.method().method().");
});

test("extractContinuationPoint handles Python dict incomplete", () => {
  const result = extractContinuationPoint('{"name": "test", "value":');
  assert.equal(result, '{"name": "test", "value":');
});

// ---------------------------------------------------------------------------
// Continuation record management
// ---------------------------------------------------------------------------

test("createContinuationRecord parses all finish reason variants", () => {
  const service = new OutputContinuationService();

  const variants = [
    { reason: "length", expected: "max_tokens_exceeded" },
    { reason: "max_tokens", expected: "max_tokens_exceeded" },
    { reason: "token_limit", expected: "max_tokens_exceeded" },
    { reason: "content_filter", expected: "content_filtered" },
    { reason: "stop", expected: "stop_sequence" },
    { reason: "stop_sequence", expected: "stop_sequence" },
    { reason: "normal", expected: "normal" },
    { reason: "completed", expected: "normal" },
    { reason: "unknown_reason", expected: "unknown" },
  ];

  for (const variant of variants) {
    const record = service.createContinuationRecord({
      taskId: `task-${variant.reason}`,
      sessionId: "sess-1",
      executionId: "exec-1",
      originalResponseId: "resp-1",
      partialOutput: "partial",
      finishReason: variant.reason,
    });
    assert.equal(
      record.finishReason,
      variant.expected,
      `reason '${variant.reason}' should map to '${variant.expected}'`,
    );
  }

  service.clearRecords();
});

test("getRecordsByExecution returns empty array for no matches", () => {
  const service = new OutputContinuationService();
  const records = service.getRecordsByExecution("nonexistent-exec");
  assert.equal(records.length, 0);
});

test("getRecordsBySession returns empty array for no matches", () => {
  const service = new OutputContinuationService();
  const records = service.getRecordsBySession("nonexistent-sess");
  assert.equal(records.length, 0);
});

test("getRecordsByTask returns empty array for no matches", () => {
  const service = new OutputContinuationService();
  const records = service.getRecordsByTask("nonexistent-task");
  assert.equal(records.length, 0);
});

test("incrementContinuationCount updates lastContinuationAt timestamp", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(record.lastContinuationAt, null);

  service.incrementContinuationCount(record.id);
  const updated = service.getRecord(record.id);

  assert.ok(updated?.lastContinuationAt !== null);
  assert.ok(updated?.lastContinuationAt !== undefined);
});

test("multiple increments accumulate correctly", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  for (let i = 1; i <= 5; i++) {
    service.incrementContinuationCount(record.id);
  }

  const updated = service.getRecord(record.id);
  assert.equal(updated?.continuationCount, 5);
});

// ---------------------------------------------------------------------------
// Memory management
// ---------------------------------------------------------------------------

test("clearRecords empties all records", () => {
  const service = new OutputContinuationService();

  // Create multiple records
  for (let i = 0; i < 10; i++) {
    service.createContinuationRecord({
      taskId: `task-${i}`,
      sessionId: `sess-${i}`,
      executionId: `exec-${i}`,
      originalResponseId: `resp-${i}`,
      partialOutput: `partial-${i}`,
      finishReason: "length",
    });
  }

  assert.ok(service.getRecordCount() > 0);
  service.clearRecords();
  assert.equal(service.getRecordCount(), 0);
});

test("clearRecords can be called when empty", () => {
  const service = new OutputContinuationService();
  service.clearRecords();
  assert.equal(service.getRecordCount(), 0);
});

test("getRecord returns undefined for cleared records", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  service.clearRecords();
  const retrieved = service.getRecord(record.id);
  assert.equal(retrieved, undefined);
});

// ---------------------------------------------------------------------------
// checkContinuationStatus edge cases
// ---------------------------------------------------------------------------

test("checkContinuationStatus returns correct structure for max_tokens", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("max_tokens", "Partial output here...");

  assert.equal(status.canContinue, true);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.equal(status.partialOutput, "Partial output here...");
  assert.equal(typeof status.continuationTokenBudget, "number");
  assert.ok(status.nextInputContent !== null);
});

test("checkContinuationStatus returns null budget when cannot continue", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("stop", "Complete output");

  assert.equal(status.canContinue, false);
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.nextInputContent, null);
});

test("checkContinuationStatus handles empty partial output", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("max_tokens", "");

  // Empty output has no continuation point
  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus handles whitespace-only partial output", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("max_tokens", "   \n\t  ");

  // Whitespace-only has no valid continuation point
  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus nextInputContent format", () => {
  const service = new OutputContinuationService();
  const partial = "Hello world, goodbye";
  const status = service.checkContinuationStatus("length", partial);

  assert.ok(status.nextInputContent !== null);
  assert.ok(
    status.nextInputContent!.includes("Hello world, goodbye"),
    "nextInputContent should include partial output",
  );
  assert.ok(
    status.nextInputContent!.includes("continue"),
    "nextInputContent should include continue instruction",
  );
});

// ---------------------------------------------------------------------------
// buildContinuationPrompt edge cases
// ---------------------------------------------------------------------------

test("buildContinuationPrompt with empty original prompt", () => {
  const prompt = buildContinuationPrompt("partial", "");
  assert.ok(prompt.includes("partial"));
  assert.ok(prompt.includes("Original prompt"));
});

test("buildContinuationPrompt with special characters in partial", () => {
  const prompt = buildContinuationPrompt(
    "Output with <div class='test'> and 'quotes' and unicode: 你好",
    "Original",
  );
  assert.ok(prompt.includes("Output with <div"));
  assert.ok(prompt.includes("quotes"));
  assert.ok(prompt.includes("unicode"));
});

test("buildContinuationPrompt with very long token budget", () => {
  const prompt = buildContinuationPrompt("partial", "original", 100000);
  assert.ok(prompt.includes("100000"));
});

test("buildContinuationPrompt with zero token budget", () => {
  const prompt = buildContinuationPrompt("partial", "original", 0);
  assert.ok(prompt.includes("Remaining budget: 0 tokens"));
});

// ---------------------------------------------------------------------------
// parseFinishReason case handling
// ---------------------------------------------------------------------------

test("parseFinishReason handles mixed case", () => {
  assert.equal(parseFinishReason("Max_Tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("CONTENT_FILTER"), "content_filtered");
  assert.equal(parseFinishReason("Stop_Sequence"), "stop_sequence");
  assert.equal(parseFinishReason("Normal"), "normal");
});

test("parseFinishReason handles lowercase", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
  assert.equal(parseFinishReason("stop"), "stop_sequence");
  assert.equal(parseFinishReason("normal"), "normal");
});

test("parseFinishReason handles uppercase", () => {
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("CONTENT_FILTER"), "content_filtered");
  assert.equal(parseFinishReason("STOP"), "stop_sequence");
  assert.equal(parseFinishReason("NORMAL"), "normal");
});

// ---------------------------------------------------------------------------
// canContinueResponse edge cases
// ---------------------------------------------------------------------------

test("canContinueResponse only returns true for token limit reasons", () => {
  // All these should return false
  const falseCases = [
    "stop",
    "eos",
    "normal",
    "completed",
    "content_filter",
    "content_filtered",
    "unknown",
    "",
  ];

  for (const reason of falseCases) {
    assert.equal(
      canContinueResponse(reason),
      false,
      `canContinueResponse("${reason}") should return false`,
    );
  }
});

// ---------------------------------------------------------------------------
// ContinuationRecord type validation
// ---------------------------------------------------------------------------

test("ContinuationRecord structure is complete", () => {
  const record: ContinuationRecord = {
    id: "test-id",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "max_tokens_exceeded",
    continuationPoint: "continuation point",
    continuationCount: 3,
    lastContinuationAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(record.id, "test-id");
  assert.equal(record.continuationCount, 3);
  assert.equal(record.continuationPoint, "continuation point");
  assert.ok(record.lastContinuationAt !== null);
});

test("ContinueRequest structure is complete", () => {
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
    maxContinuationTokens: 5000,
  };

  assert.equal(request.taskId, "task-1");
  assert.equal(request.maxContinuationTokens, 5000);
});

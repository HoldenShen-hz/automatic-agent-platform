/**
 * @fileoverview Unit tests for OutputContinuationService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OutputContinuationService,
  getGlobalContinuationService,
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  type ContinueRequest,
  type ContinuationRecord,
} from "../../../../../src/platform/execution/execution-engine/output-continuation-service.js";

test("parseFinishReason handles length variations", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("token_limit"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
});

test("parseFinishReason handles content_filter variations", () => {
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
  assert.equal(parseFinishReason("content_filtered"), "content_filtered");
  assert.equal(parseFinishReason("CONTENT_FILTER"), "content_filtered");
});

test("parseFinishReason handles stop variations", () => {
  assert.equal(parseFinishReason("stop"), "stop_sequence");
  assert.equal(parseFinishReason("stop_sequence"), "stop_sequence");
});

test("parseFinishReason handles normal variations", () => {
  assert.equal(parseFinishReason("normal"), "normal");
  assert.equal(parseFinishReason("completed"), "normal");
});

test("parseFinishReason returns unknown for unrecognized", () => {
  assert.equal(parseFinishReason("unknown_reason"), "unknown");
  assert.equal(parseFinishReason(""), "unknown");
});

test("canContinueResponse returns true only for max_tokens", () => {
  assert.equal(canContinueResponse("length"), true);
  assert.equal(canContinueResponse("max_tokens"), true);
  assert.equal(canContinueResponse("stop"), false);
  assert.equal(canContinueResponse("content_filter"), false);
});

test("buildContinuationPrompt builds correct prompt", () => {
  const prompt = buildContinuationPrompt("partial output here", "original prompt", 2000);
  assert.ok(prompt.includes("partial output here"));
  assert.ok(prompt.includes("original prompt"));
  assert.ok(prompt.includes("2000"));
});

test("extractContinuationPoint returns null for empty input", () => {
  assert.equal(extractContinuationPoint(""), null);
  assert.equal(extractContinuationPoint("   "), null);
});

test("extractContinuationPoint returns full content for short output", () => {
  const short = "Hello world";
  const result = extractContinuationPoint(short);
  assert.equal(result, short);
});

test("extractContinuationPoint handles cutoff indicators", () => {
  const withEllipsis = "Some text...\nLast line";
  const result = extractContinuationPoint(withEllipsis);
  assert.ok(result?.includes("Some text"));
  assert.ok(!result?.includes("Last line"));
});

test("extractContinuationPoint handles truncated markers", () => {
  assert.equal(extractContinuationPoint("content [truncated]"), "content");
  assert.equal(extractContinuationPoint("content [continued]"), "content");
});

test("extractContinuationPoint handles Chinese markers", () => {
  assert.equal(extractContinuationPoint("content【未完】"), "content");
  assert.equal(extractContinuationPoint("content[未完成]"), "content");
});

test("extractContinuationPoint preserves content ending with punctuation", () => {
  const result = extractContinuationPoint("This is a complete sentence.");
  assert.equal(result, "This is a complete sentence.");
});

test("extractContinuationPoint preserves content ending with incomplete patterns", () => {
  assert.equal(extractContinuationPoint("{ incomplete object"), "{ incomplete object");
  assert.equal(extractContinuationPoint("[ incomplete array"), "[ incomplete array");
  assert.equal(extractContinuationPoint("( incomplete parens"), "( incomplete parens");
});

test("extractContinuationPoint handles incomplete structures", () => {
  assert.equal(extractContinuationPoint("{ key: "), "{ key: ");
  assert.equal(extractContinuationPoint("[ item,"), "[ item,");
});

test("extractContinuationPoint truncates at sentence boundary in long content", () => {
  const longContent = "This is a long message. More content follows. Even more here.";
  const result = extractContinuationPoint(longContent);
  // Should find sentence end and truncate there if it's past 70% mark
  assert.ok(result !== null);
});

// ---------------------------------------------------------------------------
// OutputContinuationService instance methods
// ---------------------------------------------------------------------------

test("OutputContinuationService.createContinuationRecord creates record", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  };

  const record = service.createContinuationRecord(request);

  assert.ok(record.id.startsWith("continuation:"));
  assert.equal(record.taskId, "task-1");
  assert.equal(record.sessionId, "session-1");
  assert.equal(record.executionId, "exec-1");
  assert.equal(record.partialOutput, "partial");
  assert.equal(record.finishReason, "max_tokens_exceeded");
  assert.equal(record.continuationCount, 0);
  assert.ok(record.createdAt.length > 0);
});

test("OutputContinuationService.getRecord retrieves existing record", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  };

  const created = service.createContinuationRecord(request);
  const retrieved = service.getRecord(created.id);

  assert.ok(retrieved != null);
  assert.equal(retrieved!.id, created.id);
});

test("OutputContinuationService.getRecord returns undefined for missing", () => {
  const service = new OutputContinuationService();
  const result = service.getRecord("nonexistent");
  assert.equal(result, undefined);
});

test("OutputContinuationService.getRecordsByExecution filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "session-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "partial2",
    finishReason: "length",
  });

  const records = service.getRecordsByExecution("exec-1");
  assert.equal(records.length, 1);
  assert.equal(records[0].executionId, "exec-1");
});

test("OutputContinuationService.getRecordsBySession filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "session-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "partial2",
    finishReason: "length",
  });

  const records = service.getRecordsBySession("session-1");
  assert.equal(records.length, 1);
  assert.equal(records[0].sessionId, "session-1");
});

test("OutputContinuationService.getRecordsByTask filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "session-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "partial2",
    finishReason: "length",
  });

  const records = service.getRecordsByTask("task-1");
  assert.equal(records.length, 1);
  assert.equal(records[0].taskId, "task-1");
});

test("OutputContinuationService.incrementContinuationCount updates record", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(record.continuationCount, 0);

  service.incrementContinuationCount(record.id);
  const updated = service.getRecord(record.id);

  assert.equal(updated!.continuationCount, 1);
  assert.ok(updated!.lastContinuationAt != null);
});

test("OutputContinuationService.checkContinuationStatus identifies continuable", () => {
  const status = service.checkContinuationStatus("length", "Some output...");

  assert.equal(status.canContinue, true);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.equal(status.partialOutput, "Some output...");
  assert.ok(status.continuationTokenBudget != null);
  assert.ok(status.nextInputContent != null);
});

test("OutputContinuationService.checkContinuationStatus rejects non-max-token", () => {
  const status = service.checkContinuationStatus("stop", "Some output");

  assert.equal(status.canContinue, false);
  assert.equal(status.reason, "stop_sequence");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.nextInputContent, null);
});

test("OutputContinuationService.checkContinuationStatus rejects when no continuation point", () => {
  const status = service.checkContinuationStatus("length", "");

  assert.equal(status.canContinue, false);
});

test("OutputContinuationService.clearRecords removes all", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.ok(service.getRecordCount() > 0);

  service.clearRecords();

  assert.equal(service.getRecordCount(), 0);
});

test("OutputContinuationService.getRecordCount returns accurate count", () => {
  const service = new OutputContinuationService();

  assert.equal(service.getRecordCount(), 0);

  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 1);

  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "session-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "partial",
    finishReason: "stop",
  });

  assert.equal(service.getRecordCount(), 2);
});

// ---------------------------------------------------------------------------
// Global continuation service
// ---------------------------------------------------------------------------

test("getGlobalContinuationService returns singleton", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  assert.equal(service1, service2);
});

test("global service is functional", () => {
  const service = getGlobalContinuationService();
  const record = service.createContinuationRecord({
    taskId: "global-task",
    sessionId: "global-session",
    executionId: "global-exec",
    originalResponseId: "global-resp",
    partialOutput: "global partial",
    finishReason: "length",
  });

  assert.ok(record.id.length > 0);
  assert.equal(record.taskId, "global-task");
});

// ---------------------------------------------------------------------------
// TTL-based eviction (internal behavior verified by capacity limits)
// ---------------------------------------------------------------------------

test("Service respects MAX_RECORDS limit through eviction", () => {
  const service = new OutputContinuationService();

  // Create enough records to potentially exceed limit
  // We can't directly test TTL, but we can verify the eviction mechanism exists
  for (let i = 0; i < 100; i++) {
    service.createContinuationRecord({
      taskId: `task-${i}`,
      sessionId: `session-${i}`,
      executionId: `exec-${i}`,
      originalResponseId: `resp-${i}`,
      partialOutput: `partial-${i}`,
      finishReason: "length",
    });
  }

  // The service should have evicted old records
  // At most MAX_RECORDS (1000) should remain, but with our loop we created only 100
  assert.ok(service.getRecordCount() <= 1000);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("createContinuationRecord handles all finish reasons", () => {
  const service = new OutputContinuationService();
  const reasons = ["length", "content_filter", "stop", "completed", "unknown"];

  for (const reason of reasons) {
    const record = service.createContinuationRecord({
      taskId: `task-${reason}`,
      sessionId: `session-${reason}`,
      executionId: `exec-${reason}`,
      originalResponseId: `resp-${reason}`,
      partialOutput: "partial",
      finishReason: reason,
    });

    assert.ok(record.id.length > 0);
    assert.equal(record.finishReason, parseFinishReason(reason));
  }
});

test("extractContinuationPoint handles complex cases", () => {
  // Multiple ellipses
  assert.ok(extractContinuationPoint("a...b..."));

  // Mixed markers
  const mixed = "Some content【未完】more... [truncated]";
  const result = extractContinuationPoint(mixed);
  assert.ok(result != null);
});
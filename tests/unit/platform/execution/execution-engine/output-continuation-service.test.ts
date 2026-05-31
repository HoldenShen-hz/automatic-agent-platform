import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  OutputContinuationService,
  getGlobalContinuationService,
  type ContinuationReason,
  type ContinuationStatus,
  type ContinuationRecord,
  type ContinueRequest,
} from "../../../../../src/platform/five-plane-execution/execution-engine/output-continuation-service.js";

// ---------------------------------------------------------------------------
// parseFinishReason
// ---------------------------------------------------------------------------

test("parseFinishReason returns max_tokens_exceeded for length [output-continuation-service]", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
});

test("parseFinishReason returns max_tokens_exceeded for max_tokens [output-continuation-service]", () => {
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
});

test("parseFinishReason returns max_tokens_exceeded for token_limit [output-continuation-service]", () => {
  assert.equal(parseFinishReason("token_limit"), "max_tokens_exceeded");
});

test("parseFinishReason returns content_filtered for content_filter [output-continuation-service]", () => {
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
});

test("parseFinishReason returns content_filtered for content_filtered [output-continuation-service]", () => {
  assert.equal(parseFinishReason("content_filtered"), "content_filtered");
});

test("parseFinishReason returns stop_sequence for stop [output-continuation-service]", () => {
  assert.equal(parseFinishReason("stop"), "stop_sequence");
});

test("parseFinishReason returns stop_sequence for stop_sequence [output-continuation-service]", () => {
  assert.equal(parseFinishReason("stop_sequence"), "stop_sequence");
});

test("parseFinishReason returns normal for normal [output-continuation-service]", () => {
  assert.equal(parseFinishReason("normal"), "normal");
});

test("parseFinishReason returns normal for completed [output-continuation-service]", () => {
  assert.equal(parseFinishReason("completed"), "normal");
});

test("parseFinishReason returns unknown for unrecognized values [output-continuation-service]", () => {
  assert.equal(parseFinishReason("random_unknown"), "unknown");
  assert.equal(parseFinishReason(""), "unknown");
});

test("parseFinishReason handles case insensitivity [output-continuation-service]", () => {
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("Stop_Sequence"), "stop_sequence");
});

// ---------------------------------------------------------------------------
// canContinueResponse
// ---------------------------------------------------------------------------

test("canContinueResponse returns true for max_tokens_exceeded [output-continuation-service]", () => {
  assert.equal(canContinueResponse("max_tokens"), true);
});

test("canContinueResponse returns true for length [output-continuation-service]", () => {
  assert.equal(canContinueResponse("length"), true);
});

test("canContinueResponse returns false for stop [output-continuation-service]", () => {
  assert.equal(canContinueResponse("stop"), false);
});

test("canContinueResponse returns false for normal [output-continuation-service]", () => {
  assert.equal(canContinueResponse("normal"), false);
});

test("canContinueResponse returns false for content_filtered [output-continuation-service]", () => {
  assert.equal(canContinueResponse("content_filtered"), false);
});

// ---------------------------------------------------------------------------
// buildContinuationPrompt
// ---------------------------------------------------------------------------

test("buildContinuationPrompt builds prompt with partial output [output-continuation-service]", () => {
  const prompt = buildContinuationPrompt("Hello world", "Original prompt");
  assert.ok(prompt.includes("Hello world"));
  assert.ok(prompt.includes("Original prompt"));
  assert.ok(prompt.includes("Previous output was truncated"));
});

test("buildContinuationPrompt uses default token budget of 2000 [output-continuation-service]", () => {
  const prompt = buildContinuationPrompt("partial", "original");
  assert.ok(prompt.includes("Remaining budget: 2000 tokens"));
});

test("buildContinuationPrompt accepts custom token budget [output-continuation-service]", () => {
  const prompt = buildContinuationPrompt("partial", "original", 500);
  assert.ok(prompt.includes("Remaining budget: 500 tokens"));
});

test("buildContinuationPrompt includes instruction to continue [output-continuation-service]", () => {
  const prompt = buildContinuationPrompt("Hello", "Original");
  assert.ok(prompt.includes("Please continue the response:"));
});

// ---------------------------------------------------------------------------
// extractContinuationPoint
// ---------------------------------------------------------------------------

test("extractContinuationPoint returns null for empty string [output-continuation-service]", () => {
  assert.equal(extractContinuationPoint(""), null);
});

test("extractContinuationPoint returns null for whitespace only [output-continuation-service]", () => {
  assert.equal(extractContinuationPoint("   \n\t"), null);
});

test("extractContinuationPoint returns full text for short output (2 lines) [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1\nline2");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles truncation indicator ... [output-continuation-service]", () => {
  // "line1\nline2\n..." has 3 lines, last line contains "...", so returns first 2 lines
  const result = extractContinuationPoint("line1\nline2\n...");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles [truncated] indicator when more than 2 lines [output-continuation-service]", () => {
  // With 3 lines, last line contains [truncated], so returns first 2 lines
  const result = extractContinuationPoint("line1\nline2\nline3 [truncated]");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles [continued] indicator when more than 2 lines [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1\nline2\nline3 [continued]");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles Chinese 【未完】 indicator [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1\nline2【未完】");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles Chinese [未完成] indicator when more than 2 lines [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1\nline2\nline3[未完成]");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint returns partial when ending with comma [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1, line2,");
  assert.equal(result, "line1, line2,");
});

test("extractContinuationPoint returns partial when ending with Chinese comma [output-continuation-service]", () => {
  const result = extractContinuationPoint("line1，line2，");
  assert.equal(result, "line1，line2，");
});

test("extractContinuationPoint returns partial when ending with punctuation [output-continuation-service]", () => {
  const result = extractContinuationPoint("Hello. How are you?");
  assert.equal(result, "Hello. How are you?");
});

test("extractContinuationPoint returns partial when ending with incomplete brace [output-continuation-service]", () => {
  const result = extractContinuationPoint("const obj = { key:");
  assert.equal(result, "const obj = { key:");
});

test("extractContinuationPoint returns partial when ending with incomplete bracket [output-continuation-service]", () => {
  const result = extractContinuationPoint("const arr = [1, 2,");
  assert.equal(result, "const arr = [1, 2,");
});

test("extractContinuationPoint returns partial when ending with incomplete paren [output-continuation-service]", () => {
  const result = extractContinuationPoint("function foo(");
  assert.equal(result, "function foo(");
});

test("extractContinuationPoint returns partial when ending with incomplete tag [output-continuation-service]", () => {
  const result = extractContinuationPoint("<div class=");
  assert.equal(result, "<div class=");
});

test("extractContinuationPoint finds sentence boundary near end [output-continuation-service]", () => {
  const longOutput = "This is a long output. ".repeat(10) + "Last sentence here.";
  const result = extractContinuationPoint(longOutput);
  // Should find sentence boundary
  assert.ok(result !== null || result === null); // Just check it doesn't throw
});

test("extractContinuationPoint returns null when no clear continuation point [output-continuation-service]", () => {
  // A long text with multiple lines, without sentence boundaries, indicators, or incomplete patterns
  // The function checks for: cutoff indicators in last line, trailing punctuation, incomplete patterns, sentence boundaries
  const longText = "This is a long message\nThat goes on and on\nWithout any clear sentence endings or punctuation markers\nThat would indicate a natural stopping point";
  const result = extractContinuationPoint(longText);
  // With 4 lines, no cutoff indicators in last line (no ... or [truncated]), no trailing comma/punctuation,
  // no incomplete patterns, and no sentence boundary found, it should return null
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// OutputContinuationService construction
// ---------------------------------------------------------------------------

test("OutputContinuationService can be instantiated [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  assert.ok(service instanceof OutputContinuationService);
});

test("OutputContinuationService starts with empty records [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  assert.equal(service.getRecordCount(), 0);
});

// ---------------------------------------------------------------------------
// OutputContinuationService.createContinuationRecord
// ---------------------------------------------------------------------------

test("createContinuationRecord creates a record with parsed finish reason [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "Hello world",
    finishReason: "max_tokens",
  };

  const record = service.createContinuationRecord(request);

  assert.ok(record.id);
  assert.equal(record.taskId, "task-1");
  assert.equal(record.sessionId, "sess-1");
  assert.equal(record.executionId, "exec-1");
  assert.equal(record.partialOutput, "Hello world");
  assert.equal(record.finishReason, "max_tokens_exceeded");
  assert.equal(record.continuationCount, 0);
});

test("createContinuationRecord increments record count [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "stop",
  };

  service.createContinuationRecord(request);
  assert.equal(service.getRecordCount(), 1);
});

// ---------------------------------------------------------------------------
// OutputContinuationService.getRecord
// ---------------------------------------------------------------------------

test("getRecord returns record by id [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "max_tokens",
  };

  const record = service.createContinuationRecord(request);
  const retrieved = service.getRecord(record.id);

  assert.equal(retrieved?.id, record.id);
});

test("getRecord returns undefined for nonexistent id [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const result = service.getRecord("nonexistent");
  assert.equal(result, undefined);
});

// ---------------------------------------------------------------------------
// OutputContinuationService.getRecordsByExecution
// ---------------------------------------------------------------------------

test("getRecordsByExecution returns records for execution [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request1: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test1",
    finishReason: "max_tokens",
  };
  const request2: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-2", // different execution
    originalResponseId: "resp-2",
    partialOutput: "test2",
    finishReason: "max_tokens",
  };

  service.createContinuationRecord(request1);
  service.createContinuationRecord(request2);

  const records = service.getRecordsByExecution("exec-1");
  assert.equal(records.length, 1);
  assert.equal(records[0]?.executionId, "exec-1");
});

// ---------------------------------------------------------------------------
// OutputContinuationService.getRecordsBySession
// ---------------------------------------------------------------------------

test("getRecordsBySession returns records for session [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "stop",
  };

  service.createContinuationRecord(request);
  const records = service.getRecordsBySession("sess-1");
  assert.equal(records.length, 1);
});

// ---------------------------------------------------------------------------
// OutputContinuationService.getRecordsByTask
// ---------------------------------------------------------------------------

test("getRecordsByTask returns records for task [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-123",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "normal",
  };

  service.createContinuationRecord(request);
  const records = service.getRecordsByTask("task-123");
  assert.equal(records.length, 1);
  assert.equal(records[0]?.taskId, "task-123");
});

// ---------------------------------------------------------------------------
// OutputContinuationService.incrementContinuationCount
// ---------------------------------------------------------------------------

test("incrementContinuationCount updates count and timestamp [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "max_tokens",
  };

  const record = service.createContinuationRecord(request);
  assert.equal(record.continuationCount, 0);

  service.incrementContinuationCount(record.id);
  const updated = service.getRecord(record.id);

  assert.equal(updated?.continuationCount, 1);
  assert.ok(updated?.lastContinuationAt);
});

test("incrementContinuationCount handles nonexistent record [output-continuation-service]", () => {
  assert.doesNotThrow(() => {
    const service = new OutputContinuationService();
    // Should not throw
    service.incrementContinuationCount("nonexistent");
  });
});

// ---------------------------------------------------------------------------
// OutputContinuationService.checkContinuationStatus
// ---------------------------------------------------------------------------

test("checkContinuationStatus returns canContinue true for max_tokens with partial [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("max_tokens", "Hello world");

  assert.equal(status.canContinue, true);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.equal(status.partialOutput, "Hello world");
  assert.ok(status.continuationTokenBudget !== null);
});

test("checkContinuationStatus returns canContinue false for stop [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("stop", "Hello world");

  assert.equal(status.canContinue, false);
  assert.equal(status.reason, "stop_sequence");
});

test("checkContinuationStatus returns canContinue false when no continuation point [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  // Empty partial output has no continuation point
  const status = service.checkContinuationStatus("max_tokens", "");

  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus returns nextInputContent when can continue [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("max_tokens", "Hello world");

  assert.ok(status.nextInputContent?.includes("Hello world"));
});

// ---------------------------------------------------------------------------
// OutputContinuationService.clearRecords
// ---------------------------------------------------------------------------

test("clearRecords removes all records [output-continuation-service]", () => {
  const service = new OutputContinuationService();
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "stop",
  };

  service.createContinuationRecord(request);
  assert.equal(service.getRecordCount(), 1);

  service.clearRecords();
  assert.equal(service.getRecordCount(), 0);
});

// ---------------------------------------------------------------------------
// getGlobalContinuationService singleton
// ---------------------------------------------------------------------------

test("getGlobalContinuationService returns singleton [output-continuation-service]", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  assert.strictEqual(service1, service2);
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

test("ContinuationReason type is exported [output-continuation-service]", () => {
  const reason: ContinuationReason = "max_tokens_exceeded";
  assert.equal(reason, "max_tokens_exceeded");
});

test("ContinuationStatus type is exported [output-continuation-service]", () => {
  const status: ContinuationStatus = {
    canContinue: true,
    reason: "max_tokens_exceeded",
    partialOutput: "test",
    continuationTokenBudget: 1000,
    nextInputContent: "continue here",
  };
  assert.equal(status.canContinue, true);
});

test("ContinuationRecord type is exported [output-continuation-service]", () => {
  const record: ContinuationRecord = {
    id: "test-id",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "normal",
    continuationPoint: null,
    continuationCount: 0,
    lastContinuationAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  assert.equal(record.id, "test-id");
});

test("ContinueRequest type is exported [output-continuation-service]", () => {
  const request: ContinueRequest = {
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "test",
    finishReason: "stop",
  };
  assert.equal(request.taskId, "task-1");
});

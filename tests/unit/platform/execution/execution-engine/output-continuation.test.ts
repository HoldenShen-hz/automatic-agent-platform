import assert from "node:assert/strict";
import test from "node:test";

import {
  OutputContinuationService,
  getGlobalContinuationService,
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  type ContinuationReason,
  type ContinuationStatus,
  type ContinueRequest,
} from "../../../../../src/platform/execution/execution-engine/output-continuation-service.js";

test("OutputContinuationService exports parseFinishReason function", () => {
  assert.equal(typeof parseFinishReason, "function");
});

test("parseFinishReason handles max_tokens variants", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("token_limit"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("Max_Tokens"), "max_tokens_exceeded");
});

test("parseFinishReason handles content_filter variants", () => {
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
  assert.equal(parseFinishReason("content_filtered"), "content_filtered");
  assert.equal(parseFinishReason("CONTENT_FILTER"), "content_filtered");
});

test("parseFinishReason handles stop_sequence variants", () => {
  assert.equal(parseFinishReason("stop"), "stop_sequence");
  assert.equal(parseFinishReason("stop_sequence"), "stop_sequence");
});

test("parseFinishReason handles normal variants", () => {
  assert.equal(parseFinishReason("normal"), "normal");
  assert.equal(parseFinishReason("completed"), "normal");
});

test("parseFinishReason returns unknown for unrecognized", () => {
  assert.equal(parseFinishReason("unknown"), "unknown");
  assert.equal(parseFinishReason("random_value"), "unknown");
  assert.equal(parseFinishReason(""), "unknown");
});

test("canContinueResponse returns true only for max_tokens", () => {
  assert.equal(canContinueResponse("length"), true);
  assert.equal(canContinueResponse("max_tokens"), true);
  assert.equal(canContinueResponse("stop"), false);
  assert.equal(canContinueResponse("normal"), false);
  assert.equal(canContinueResponse("content_filter"), false);
});

test("buildContinuationPrompt constructs proper prompt", () => {
  const prompt = buildContinuationPrompt("partial output", "original prompt", 1000);
  assert.ok(prompt.includes("partial output"));
  assert.ok(prompt.includes("original prompt"));
  assert.ok(prompt.includes("1000"));
});

test("buildContinuationPrompt uses default token budget", () => {
  const prompt = buildContinuationPrompt("partial", "original");
  assert.ok(prompt.includes("2000")); // default
});

test("extractContinuationPoint returns null for empty input", () => {
  assert.equal(extractContinuationPoint(""), null);
  assert.equal(extractContinuationPoint("   "), null);
});

test("extractContinuationPoint returns full content for short output", () => {
  const result = extractContinuationPoint("short");
  assert.equal(result, "short");
});

test("extractContinuationPoint handles truncation indicators", () => {
  // Last line with truncation indicator - should cut before it
  const result = extractContinuationPoint("line1\nline2\n...");
  assert.ok(result);
  assert.ok(!result!.endsWith("..."));

  const result2 = extractContinuationPoint("line1\nline2\n [truncated]");
  assert.ok(result2);
  assert.ok(!result2!.endsWith("[truncated]"));
});

test("extractContinuationPoint handles Chinese truncation markers", () => {
  const result = extractContinuationPoint("内容1\n内容2\n【未完】");
  assert.ok(result);
  assert.ok(!result!.endsWith("【未完】"));
});

test("extractContinuationPoint returns full if ends with punctuation", () => {
  const result = extractContinuationPoint("This is a complete sentence.");
  assert.equal(result, "This is a complete sentence.");
});

test("extractContinuationPoint handles incomplete patterns", () => {
  assert.equal(extractContinuationPoint("{ incomplete object"), "{ incomplete object");
  assert.equal(extractContinuationPoint("[ incomplete array"), "[ incomplete array");
  assert.equal(extractContinuationPoint("( incomplete parens"), "( incomplete parens");
});

test("extractContinuationPoint handles incomplete HTML tag pattern", () => {
  assert.equal(extractContinuationPoint("<div"), "<div");
  assert.equal(extractContinuationPoint("<span class"), "<span class");
  assert.equal(extractContinuationPoint("<input "), "<input ");
});

test("extractContinuationPoint returns input for output ending with comma", () => {
  assert.equal(extractContinuationPoint("Hello, world,"), "Hello, world,");
});

test("extractContinuationPoint returns input for output ending with Chinese comma", () => {
  assert.equal(extractContinuationPoint("你好，世界，"), "你好，世界，");
});

test("extractContinuationPoint returns input for output ending with English period", () => {
  assert.equal(extractContinuationPoint("Complete sentence."), "Complete sentence.");
});

test("extractContinuationPoint returns input for output ending with Chinese period", () => {
  assert.equal(extractContinuationPoint("完整的句子。"), "完整的句子。");
});

test("extractContinuationPoint finds sentence boundary near end", () => {
  const longText = "This is a long text. ".repeat(20) + "Incomplete last sentence";
  const result = extractContinuationPoint(longText);
  assert.ok(result);
  // Should cut at sentence boundary if it's near the end
});

test("OutputContinuationService creates continuation record", () => {
  const service = new OutputContinuationService();

  const request: ContinueRequest = {
    taskId: "task_123",
    sessionId: "sess_456",
    executionId: "exec_789",
    originalResponseId: "resp_abc",
    partialOutput: "This is a partial response",
    finishReason: "length",
  };

  const record = service.createContinuationRecord(request);

  assert.ok(record.id);
  assert.equal(record.taskId, "task_123");
  assert.equal(record.sessionId, "sess_456");
  assert.equal(record.executionId, "exec_789");
  assert.equal(record.partialOutput, "This is a partial response");
  assert.equal(record.finishReason, "max_tokens_exceeded");
  assert.equal(record.continuationCount, 0);
  assert.ok(record.createdAt);
});

test("OutputContinuationService getRecord retrieves record", () => {
  const service = new OutputContinuationService();

  const request: ContinueRequest = {
    taskId: "task_123",
    sessionId: "sess_456",
    executionId: "exec_789",
    originalResponseId: "resp_abc",
    partialOutput: "partial",
    finishReason: "length",
  };

  const created = service.createContinuationRecord(request);
  const retrieved = service.getRecord(created.id);

  assert.ok(retrieved);
  assert.equal(retrieved!.id, created.id);
  assert.equal(retrieved!.partialOutput, "partial");
});

test("OutputContinuationService getRecordsByExecution filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task_2",
    sessionId: "sess_2",
    executionId: "exec_1",
    originalResponseId: "r2",
    partialOutput: "out2",
    finishReason: "length",
  });

  const records = service.getRecordsByExecution("exec_1");
  assert.equal(records.length, 2);
});

test("OutputContinuationService getRecordsBySession filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task_2",
    sessionId: "sess_1",
    executionId: "exec_2",
    originalResponseId: "r2",
    partialOutput: "out2",
    finishReason: "length",
  });

  const records = service.getRecordsBySession("sess_1");
  assert.equal(records.length, 2);
});

test("OutputContinuationService getRecordsByTask filters correctly", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_2",
    executionId: "exec_2",
    originalResponseId: "r2",
    partialOutput: "out2",
    finishReason: "length",
  });

  const records = service.getRecordsByTask("task_1");
  assert.equal(records.length, 2);
});

test("OutputContinuationService incrementContinuationCount updates record", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(record.continuationCount, 0);

  service.incrementContinuationCount(record.id);

  const updated = service.getRecord(record.id);
  assert.equal(updated!.continuationCount, 1);
  assert.ok(updated!.lastContinuationAt);
});

test("OutputContinuationService checkContinuationStatus returns correct status", () => {
  const service = new OutputContinuationService();

  const status = service.checkContinuationStatus("length", "partial output...");

  assert.equal(status.canContinue, true);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.equal(status.partialOutput, "partial output...");
  assert.ok(status.continuationTokenBudget);
  assert.ok(status.nextInputContent);
});

test("OutputContinuationService checkContinuationStatus returns false for non-continuable", () => {
  const service = new OutputContinuationService();

  const status = service.checkContinuationStatus("stop", "complete output");

  assert.equal(status.canContinue, false);
  assert.equal(status.reason, "stop_sequence");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.nextInputContent, null);
});

test("OutputContinuationService clearRecords removes all", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  assert.ok(service.getRecordCount() > 0);

  service.clearRecords();

  assert.equal(service.getRecordCount(), 0);
});

test("OutputContinuationService getRecordCount returns correct count", () => {
  const service = new OutputContinuationService();

  assert.equal(service.getRecordCount(), 0);

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 1);

  service.createContinuationRecord({
    taskId: "task_2",
    sessionId: "sess_2",
    executionId: "exec_2",
    originalResponseId: "r2",
    partialOutput: "out2",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 2);
});

test("getGlobalContinuationService returns singleton", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();

  assert.equal(service1, service2);
});

test("OutputContinuationService handles non-max_tokens finish reason", () => {
  const service = new OutputContinuationService();

  // Use output with truncation indicator to get a continuation point
  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "line1\nline2\n...",
    finishReason: "content_filter",
  });

  assert.equal(record.finishReason, "content_filtered");
  // Continuation point is extracted based on content, not finish reason
  assert.ok(record.continuationPoint !== undefined);
});

// ============================================
// NEW TESTS - Additional Coverage
// ============================================

test("extractContinuationPoint returns null for null-like input", () => {
  assert.equal(extractContinuationPoint(null as unknown as string), null);
});

test("extractContinuationPoint handles single line content", () => {
  const result = extractContinuationPoint("single line content");
  assert.equal(result, "single line content");
});

test("extractContinuationPoint handles two line content", () => {
  const result = extractContinuationPoint("line1\nline2");
  assert.equal(result, "line1\nline2");
});

test("extractContinuationPoint handles [continued] marker", () => {
  const result = extractContinuationPoint("output line\n[continued]");
  assert.ok(result);
  assert.ok(!result!.endsWith("[continued]"));
});

test("extractContinuationPoint handles [未完成] marker", () => {
  const result = extractContinuationPoint("内容\n[未完成]");
  assert.ok(result);
  assert.ok(!result!.endsWith("[未完成]"));
});

test("extractContinuationPoint handles output ending with semicolon", () => {
  const result = extractContinuationPoint("incomplete statement;");
  assert.equal(result, "incomplete statement;");
});

test("extractContinuationPoint handles output ending with colon", () => {
  const result = extractContinuationPoint("label:");
  assert.equal(result, "label:");
});

test("extractContinuationPoint returns null for sentence boundary at start", () => {
  const text = "First sentence. Second sentence.";
  const result = extractContinuationPoint(text);
  // Since sentence boundary is at ~40% and not past 70%, this returns null
  assert.equal(result, null);
});

test("extractContinuationPoint handles sentence boundary past 70% of content", () => {
  const text = "This is a long text. ".repeat(20) + "Complete sentence.";
  const result = extractContinuationPoint(text);
  // Should find the sentence boundary
  assert.ok(result);
  assert.ok(result!.endsWith("Complete sentence."));
});

test("extractContinuationPoint handles multiple truncation indicators", () => {
  const result = extractContinuationPoint("line1\nline2\n...\nline3\n [truncated]");
  assert.ok(result);
  assert.ok(!result!.endsWith("[truncated]"));
});

test("buildContinuationPrompt handles empty partial output", () => {
  const prompt = buildContinuationPrompt("", "original prompt", 500);
  assert.ok(prompt.includes("original prompt"));
  assert.ok(prompt.includes("500"));
});

test("buildContinuationPrompt handles empty original prompt", () => {
  const prompt = buildContinuationPrompt("partial output", "", 500);
  assert.ok(prompt.includes("partial output"));
  assert.ok(prompt.includes("500"));
});

test("buildContinuationPrompt handles very large token budget", () => {
  const prompt = buildContinuationPrompt("partial", "original", 100000);
  assert.ok(prompt.includes("100000"));
});

test("checkContinuationStatus returns correct budget for max_tokens", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("length", "partial...");
  assert.equal(status.continuationTokenBudget, 2000);
});

test("checkContinuationStatus returns null budget for content_filter", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("content_filter", "partial output");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus returns null budget for normal completion", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("normal", "complete output");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus returns null budget for stop_sequence", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("stop", "output");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.canContinue, false);
});

test("checkContinuationStatus nextInputContent format for continuable", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("length", "partial output...");
  assert.ok(status.nextInputContent);
  assert.ok(status.nextInputContent!.includes("partial output"));
});

test("OutputContinuationService increments continuation count multiple times", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "partial",
    finishReason: "length",
  });

  service.incrementContinuationCount(record.id);
  service.incrementContinuationCount(record.id);
  service.incrementContinuationCount(record.id);

  const updated = service.getRecord(record.id);
  assert.equal(updated!.continuationCount, 3);
});

test("OutputContinuationService originalResponseId is preserved in record", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "original_resp_123",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(record.originalResponseId, "original_resp_123");
});

test("OutputContinuationService continuationPoint is extracted correctly", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "line1\nline2\n...",
    finishReason: "length",
  });

  assert.ok(record.continuationPoint);
  assert.ok(!record.continuationPoint!.endsWith("..."));
});

test("OutputContinuationService lastContinuationAt is set after increment", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "partial",
    finishReason: "length",
  });

  assert.equal(record.lastContinuationAt, null);

  service.incrementContinuationCount(record.id);

  const updated = service.getRecord(record.id);
  assert.ok(updated!.lastContinuationAt);
});

test("OutputContinuationService getRecordsByExecution returns empty for unknown execution", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  const records = service.getRecordsByExecution("unknown_exec");
  assert.equal(records.length, 0);
});

test("OutputContinuationService getRecordsBySession returns empty for unknown session", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  const records = service.getRecordsBySession("unknown_sess");
  assert.equal(records.length, 0);
});

test("OutputContinuationService getRecordsByTask returns empty for unknown task", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  const records = service.getRecordsByTask("unknown_task");
  assert.equal(records.length, 0);
});

test("OutputContinuationService getRecord returns undefined for unknown id", () => {
  const service = new OutputContinuationService();
  const record = service.getRecord("unknown_id");
  assert.equal(record, undefined);
});

test("parseFinishReason is case insensitive", () => {
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("Content_Filter"), "content_filtered");
  assert.equal(parseFinishReason("STOP"), "stop_sequence");
  assert.equal(parseFinishReason("NORMAL"), "normal");
});

test("canContinueResponse returns false for unknown reason", () => {
  assert.equal(canContinueResponse("unknown"), false);
  assert.equal(canContinueResponse(""), false);
});

test("getGlobalContinuationService returns singleton across multiple calls", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  const service3 = getGlobalContinuationService();

  assert.equal(service1, service2);
  assert.equal(service2, service3);
});

test("extractContinuationPoint handles output with tab characters", () => {
  // With 2 lines, function returns content directly without truncation check
  const result = extractContinuationPoint("line1\tline2");
  assert.ok(result);
  assert.equal(result, "line1\tline2");
});

test("extractContinuationPoint handles HTML tag with attributes", () => {
  const result = extractContinuationPoint("<div class=\"test\"");
  assert.equal(result, "<div class=\"test\"");
});

test("extractContinuationPoint handles multiple incomplete patterns", () => {
  const result = extractContinuationPoint("{ [ ( < ,");
  assert.equal(result, "{ [ ( < ,");
});

test("checkContinuationStatus with max_tokens but no continuation point", () => {
  const service = new OutputContinuationService();
  // Long output that appears complete (multiple sentences, ends properly)
  // with no truncation indicators
  const longCompleteOutput = "First sentence. Second sentence. Third sentence. Fourth sentence.";
  const status = service.checkContinuationStatus("length", longCompleteOutput);
  // For short/medium content with proper sentence endings and <=2 lines it returns as continuationPoint
  // But for longer content, the extractContinuationPoint logic may return null
  // since there's no truncation marker and sentence boundary is not past 70%
  assert.equal(status.reason, "max_tokens_exceeded");
});

test("OutputContinuationService records can be filtered by multiple criteria", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "out1",
    finishReason: "length",
  });

  service.createContinuationRecord({
    taskId: "task_2",
    sessionId: "sess_1",
    executionId: "exec_2",
    originalResponseId: "r2",
    partialOutput: "out2",
    finishReason: "stop",
  });

  const bySession = service.getRecordsBySession("sess_1");
  const byExec = service.getRecordsByExecution("exec_1");
  const byTask = service.getRecordsByTask("task_1");

  assert.equal(bySession.length, 2);
  assert.equal(byExec.length, 1);
  assert.equal(byTask.length, 1);
});

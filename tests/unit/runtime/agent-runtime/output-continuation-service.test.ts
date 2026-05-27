import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  OutputContinuationService,
  getGlobalContinuationService,
} from "../../../../src/platform/five-plane-execution/execution-engine/output-continuation-service.js";

test("parseFinishReason maps length variants to max_tokens_exceeded [output-continuation-service]", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("token_limit"), "max_tokens_exceeded");
});

test("parseFinishReason maps content_filter variants [output-continuation-service]", () => {
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
  assert.equal(parseFinishReason("content_filtered"), "content_filtered");
});

test("parseFinishReason maps stop variants to stop_sequence [output-continuation-service]", () => {
  assert.equal(parseFinishReason("stop"), "stop_sequence");
  assert.equal(parseFinishReason("stop_sequence"), "stop_sequence");
});

test("parseFinishReason maps normal/completed to normal [output-continuation-service]", () => {
  assert.equal(parseFinishReason("normal"), "normal");
  assert.equal(parseFinishReason("completed"), "normal");
});

test("parseFinishReason returns unknown for unrecognized [output-continuation-service]", () => {
  assert.equal(parseFinishReason("random_reason"), "unknown");
  assert.equal(parseFinishReason(""), "unknown");
});

test("canContinueResponse returns true only for max_tokens_exceeded [output-continuation-service]", () => {
  assert.equal(canContinueResponse("length"), true);
  assert.equal(canContinueResponse("max_tokens"), true);
  assert.equal(canContinueResponse("stop"), false);
  assert.equal(canContinueResponse("normal"), false);
});

test("buildContinuationPrompt includes partial output and budget [output-continuation-service]", () => {
  const prompt = buildContinuationPrompt("Partial output here", "Original prompt", 1500);
  assert.ok(prompt.includes("Partial output here"));
  assert.ok(prompt.includes("Original prompt"));
  assert.ok(prompt.includes("1500"));
  assert.ok(prompt.includes("[Previous output was truncated."));
  assert.ok(prompt.includes("Remaining budget: 1500 tokens."));
});

test("extractContinuationPoint returns null for empty input [output-continuation-service]", () => {
  assert.equal(extractContinuationPoint(""), null);
  assert.equal(extractContinuationPoint("   "), null);
});

test("extractContinuationPoint returns full content for short output [output-continuation-service]", () => {
  const short = "Short content";
  const result = extractContinuationPoint(short);
  assert.equal(result, short);
});

test("extractContinuationPoint handles truncation indicators [output-continuation-service]", () => {
  const withEllipsis = "Line 1\nLine 2\n...";
  const result = extractContinuationPoint(withEllipsis);
  assert.equal(result, "Line 1\nLine 2");
});

test("extractContinuationPoint handles Chinese truncation indicators [output-continuation-service]", () => {
  const withChinese = "Line 1\nLine 2\n【未完】";
  const result = extractContinuationPoint(withChinese);
  assert.equal(result, "Line 1\nLine 2");
});

test("OutputContinuationService creates continuation records [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_123",
    sessionId: "sess_456",
    executionId: "exec_789",
    originalResponseId: "resp_abc",
    partialOutput: "Partial response...",
    finishReason: "length",
  });

  assert.ok(record.id.startsWith("continuation:"));
  assert.equal(record.taskId, "task_123");
  assert.equal(record.finishReason, "max_tokens_exceeded");
  assert.equal(record.continuationCount, 0);
});

test("OutputContinuationService getRecord retrieves stored record [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "resp_1",
    partialOutput: "test",
    finishReason: "length",
  });

  const retrieved = service.getRecord(record.id);
  assert.ok(retrieved);
  assert.equal(retrieved?.taskId, "task_1");
});

test("OutputContinuationService getRecordsByExecution filters correctly [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_a",
    originalResponseId: "r1",
    partialOutput: "test",
    finishReason: "length",
  });
  service.createContinuationRecord({
    taskId: "task_2",
    sessionId: "sess_2",
    executionId: "exec_b",
    originalResponseId: "r2",
    partialOutput: "test",
    finishReason: "length",
  });

  const execARecords = service.getRecordsByExecution("exec_a");
  assert.equal(execARecords.length, 1);
  assert.equal(execARecords[0]?.executionId, "exec_a");
});

test("OutputContinuationService incrementContinuationCount updates record [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  const record = service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "test",
    finishReason: "length",
  });

  assert.equal(record.continuationCount, 0);

  service.incrementContinuationCount(record.id);
  const updated = service.getRecord(record.id);

  assert.equal(updated?.continuationCount, 1);
  assert.ok(updated?.lastContinuationAt != null);
});

test("OutputContinuationService checkContinuationStatus returns correct status for max_tokens [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  const status = service.checkContinuationStatus("length", "Partial output...\nLine that might be cut");

  assert.equal(status.canContinue, true);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.ok(status.continuationTokenBudget != null);
  assert.ok(status.nextInputContent != null);
});

test("OutputContinuationService checkContinuationStatus returns cannot continue for stop [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  const status = service.checkContinuationStatus("stop", "Completed output");

  assert.equal(status.canContinue, false);
  assert.equal(status.reason, "stop_sequence");
  assert.equal(status.continuationTokenBudget, null);
  assert.equal(status.nextInputContent, null);
});

test("OutputContinuationService clearRecords empties storage [output-continuation-service]", () => {
  const service = new OutputContinuationService();

  service.createContinuationRecord({
    taskId: "task_1",
    sessionId: "sess_1",
    executionId: "exec_1",
    originalResponseId: "r1",
    partialOutput: "test",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 1);

  service.clearRecords();

  assert.equal(service.getRecordCount(), 0);
});

test("getGlobalContinuationService returns singleton [output-continuation-service]", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  assert.strictEqual(service1, service2);
});

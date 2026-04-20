import test from "node:test";
import assert from "node:assert/strict";
import {
  OutputContinuationService,
  getGlobalContinuationService,
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
} from "../../../../src/platform/execution/execution-engine/output-continuation-service.js";

test("OutputContinuationService sandbox: creates record for max_tokens", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "sandbox-task-1",
    sessionId: "sandbox-sess-1",
    executionId: "sandbox-exec-1",
    originalResponseId: "sandbox-resp-1",
    partialOutput: "Partial output that was truncated",
    finishReason: "length",
  });

  assert.ok(record.id.startsWith("continuation_"));
  assert.equal(record.finishReason, "max_tokens_exceeded");
  const status = service.checkContinuationStatus("length", record.partialOutput);
  assert.ok(status.canContinue);
});

test("OutputContinuationService sandbox: records are retrievable", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "sandbox-task-2",
    sessionId: "sandbox-sess-2",
    executionId: "sandbox-exec-2",
    originalResponseId: "sandbox-resp-2",
    partialOutput: "Hello world",
    finishReason: "length",
  });

  const retrieved = service.getRecord(record.id);
  assert.ok(retrieved);
  assert.equal(retrieved!.partialOutput, "Hello world");
});

test("OutputContinuationService sandbox: query by session", () => {
  const service = new OutputContinuationService();
  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "same-sess",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "First",
    finishReason: "length",
  });
  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "same-sess",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "stop",
  });
  service.createContinuationRecord({
    taskId: "task-3",
    sessionId: "other-sess",
    executionId: "exec-3",
    originalResponseId: "resp-3",
    partialOutput: "Third",
    finishReason: "length",
  });

  const sameSessRecords = service.getRecordsBySession("same-sess");
  assert.equal(sameSessRecords.length, 2);
});

test("OutputContinuationService sandbox: query by execution", () => {
  const service = new OutputContinuationService();
  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "same-exec",
    originalResponseId: "resp-1",
    partialOutput: "First",
    finishReason: "length",
  });
  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "sess-2",
    executionId: "same-exec",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "stop",
  });

  const sameExecRecords = service.getRecordsByExecution("same-exec");
  assert.equal(sameExecRecords.length, 2);
});

test("OutputContinuationService sandbox: increment continuation count", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "Hello",
    finishReason: "length",
  });

  assert.equal(record.continuationCount, 0);

  service.incrementContinuationCount(record.id);
  service.incrementContinuationCount(record.id);
  service.incrementContinuationCount(record.id);

  const updated = service.getRecord(record.id);
  assert.equal(updated!.continuationCount, 3);
});

test("OutputContinuationService sandbox: global service is singleton", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  assert.strictEqual(service1, service2);
});

test("parseFinishReason sandbox: handles various max_tokens variants", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("MAX_TOKENS"), "max_tokens_exceeded");
});

test("canContinueResponse sandbox: only max_tokens allows continuation", () => {
  assert.ok(canContinueResponse("length"));
  assert.ok(canContinueResponse("max_tokens"));
  assert.ok(!canContinueResponse("stop"));
  assert.ok(!canContinueResponse("content_filter"));
  assert.ok(!canContinueResponse("normal"));
});

test("buildContinuationPrompt sandbox: includes original and partial", () => {
  const prompt = buildContinuationPrompt("partial content", "original prompt");
  assert.ok(prompt.includes("original prompt"));
  assert.ok(prompt.includes("partial content"));
  assert.ok(prompt.includes("continue"));
});

test("OutputContinuationService sandbox: checkContinuationStatus for max_tokens", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("length", "Partial output...");

  assert.ok(status.canContinue);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.ok(status.nextInputContent);
  assert.equal(status.continuationTokenBudget, 2000);
});

test("OutputContinuationService sandbox: checkContinuationStatus for stop", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("stop", "Complete output");

  assert.ok(!status.canContinue);
  assert.equal(status.reason, "stop_sequence");
  assert.ok(!status.nextInputContent);
});

test("OutputContinuationService sandbox: checkContinuationStatus for content_filter", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("content_filter", "Filtered...");

  assert.ok(!status.canContinue);
  assert.equal(status.reason, "content_filtered");
});

test("OutputContinuationService sandbox: clear removes all records", () => {
  const service = new OutputContinuationService();
  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "First",
    finishReason: "length",
  });
  service.createContinuationRecord({
    taskId: "task-2",
    sessionId: "sess-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 2);
  service.clearRecords();
  assert.equal(service.getRecordCount(), 0);
});

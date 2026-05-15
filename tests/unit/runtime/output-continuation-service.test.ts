import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFinishReason,
  canContinueResponse,
  buildContinuationPrompt,
  extractContinuationPoint,
  OutputContinuationService,
  getGlobalContinuationService,
  type ContinuationReason,
} from "../../../src/platform/five-plane-execution/execution-engine/output-continuation-service.js";

test("parseFinishReason returns max_tokens_exceeded for length-related reasons", () => {
  assert.equal(parseFinishReason("length"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("max_tokens"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("token_limit"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("LENGTH"), "max_tokens_exceeded");
  assert.equal(parseFinishReason("Max_Tokens"), "max_tokens_exceeded");
});

test("parseFinishReason returns content_filtered for filter reasons", () => {
  assert.equal(parseFinishReason("content_filter"), "content_filtered");
  assert.equal(parseFinishReason("content_filtered"), "content_filtered");
});

test("parseFinishReason returns stop_sequence for stop reasons", () => {
  assert.equal(parseFinishReason("stop"), "stop_sequence");
  assert.equal(parseFinishReason("stop_sequence"), "stop_sequence");
});

test("parseFinishReason returns normal for normal completion", () => {
  assert.equal(parseFinishReason("normal"), "normal");
  assert.equal(parseFinishReason("completed"), "normal");
});

test("parseFinishReason returns unknown for unrecognized reasons", () => {
  assert.equal(parseFinishReason("error"), "unknown");
  assert.equal(parseFinishReason(""), "unknown");
});

test("canContinueResponse returns true only for max_tokens exceeded", () => {
  assert.ok(canContinueResponse("length"));
  assert.ok(canContinueResponse("max_tokens"));
  assert.ok(!canContinueResponse("stop"));
  assert.ok(!canContinueResponse("content_filter"));
  assert.ok(!canContinueResponse("normal"));
});

test("buildContinuationPrompt creates proper continuation prompt", () => {
  const prompt = buildContinuationPrompt("Hello world", "Original prompt", 1000);
  assert.ok(prompt.includes("Original prompt"));
  assert.ok(prompt.includes("Hello world"));
  assert.ok(prompt.includes("truncated"));
  assert.ok(prompt.includes("1000"));
});

test("buildContinuationPrompt uses default token budget", () => {
  const prompt = buildContinuationPrompt("Hello", "Original");
  assert.ok(prompt.includes("2000"));
});

test("extractContinuationPoint returns null for empty input", () => {
  assert.ok(!extractContinuationPoint(""));
  assert.ok(!extractContinuationPoint("   "));
  assert.ok(!extractContinuationPoint(null as unknown as string));
});

test("extractContinuationPoint handles short outputs", () => {
  const short = "Hello world";
  const result = extractContinuationPoint(short);
  assert.equal(result, short);
});

test("extractContinuationPoint handles truncated indicators", () => {
  const withEllipsis = "Hello world\n...\n[truncated]";
  const result = extractContinuationPoint(withEllipsis);
  assert.ok(result === null || result === "Hello world\n...");
});

test("extractContinuationPoint handles Chinese truncation markers", () => {
  const withChinese = "Some text\nLine two\n【未完】";
  const result = extractContinuationPoint(withChinese);
  assert.ok(result === null || result.startsWith("Some text"));
});

test("extractContinuationPoint handles incomplete brackets", () => {
  const withBrackets = "Some text with { open bracket";
  const result = extractContinuationPoint(withBrackets);
  assert.equal(result, withBrackets);
});

test("extractContinuationPoint handles incomplete parentheses", () => {
  const withParens = "Some text (still open";
  const result = extractContinuationPoint(withParens);
  assert.equal(result, withParens);
});

test("extractContinuationPoint returns partial for complete sentences", () => {
  const complete = "This is a complete sentence. And another one.";
  const result = extractContinuationPoint(complete);
  assert.ok(result !== null);
});

test("extractContinuationPoint handles sentence boundary cutoff", () => {
  const text = "This is the first sentence. This is the second.";
  const result = extractContinuationPoint(text);
  assert.ok(result !== null);
});

test("OutputContinuationService creates continuation records", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "Hello world",
    finishReason: "length",
    maxContinuationTokens: 2000,
  });

  assert.ok(record.id.startsWith("continuation:"));
  assert.equal(record.taskId, "task-1");
  assert.equal(record.partialOutput, "Hello world");
  assert.equal(record.finishReason, "max_tokens_exceeded");
  assert.equal(record.continuationCount, 0);
});

test("OutputContinuationService retrieves records by ID", () => {
  const service = new OutputContinuationService();
  const record = service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "Hello",
    finishReason: "length",
  });

  const retrieved = service.getRecord(record.id);
  assert.ok(retrieved);
  assert.equal(retrieved!.partialOutput, "Hello");
});

test("OutputContinuationService retrieves records by execution", () => {
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
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "length",
  });
  service.createContinuationRecord({
    taskId: "task-3",
    sessionId: "sess-2",
    executionId: "exec-2",
    originalResponseId: "resp-3",
    partialOutput: "Third",
    finishReason: "length",
  });

  const exec1Records = service.getRecordsByExecution("exec-1");
  assert.equal(exec1Records.length, 2);
});

test("OutputContinuationService retrieves records by session", () => {
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
    sessionId: "sess-1",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "stop",
  });

  const sess1Records = service.getRecordsBySession("sess-1");
  assert.equal(sess1Records.length, 2);
});

test("OutputContinuationService retrieves records by task", () => {
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
    taskId: "task-1",
    sessionId: "sess-2",
    executionId: "exec-2",
    originalResponseId: "resp-2",
    partialOutput: "Second",
    finishReason: "stop",
  });

  const task1Records = service.getRecordsByTask("task-1");
  assert.equal(task1Records.length, 2);
});

test("OutputContinuationService increments continuation count", () => {
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
  const updated = service.getRecord(record.id);
  assert.equal(updated!.continuationCount, 1);
  assert.ok(updated!.lastContinuationAt);

  service.incrementContinuationCount(record.id);
  assert.equal(service.getRecord(record.id)!.continuationCount, 2);
});

test("OutputContinuationService checkContinuationStatus for max_tokens", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("length", "Hello world");

  assert.ok(status.canContinue);
  assert.equal(status.reason, "max_tokens_exceeded");
  assert.equal(status.partialOutput, "Hello world");
  assert.equal(status.continuationTokenBudget, 2000);
  assert.ok(status.nextInputContent);
});

test("OutputContinuationService checkContinuationStatus for stop", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("stop", "Complete response");

  assert.ok(!status.canContinue);
  assert.equal(status.reason, "stop_sequence");
  assert.ok(!status.nextInputContent);
});

test("OutputContinuationService checkContinuationStatus for content_filter", () => {
  const service = new OutputContinuationService();
  const status = service.checkContinuationStatus("content_filter", "Partial...");

  assert.ok(!status.canContinue);
  assert.equal(status.reason, "content_filtered");
});

test("OutputContinuationService clears records", () => {
  const service = new OutputContinuationService();
  service.createContinuationRecord({
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    originalResponseId: "resp-1",
    partialOutput: "Hello",
    finishReason: "length",
  });

  assert.equal(service.getRecordCount(), 1);
  service.clearRecords();
  assert.equal(service.getRecordCount(), 0);
});

test("getGlobalContinuationService returns singleton", () => {
  const service1 = getGlobalContinuationService();
  const service2 = getGlobalContinuationService();
  assert.strictEqual(service1, service2);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  LoopDetectionState,
  normalizeToolInputForHash,
  hashToolCall,
  SequenceLoopDetector,
  createLoopDetectionMiddleware,
  type LoopDetectionConfig,
} from "../../../src/platform/execution/execution-engine/loop-detection.js";

test("normalizeToolInputForHash normalizes strings", () => {
  assert.equal(normalizeToolInputForHash("Hello World"), "hello world");
  assert.equal(normalizeToolInputForHash("  HELLO  "), "hello");
  assert.equal(normalizeToolInputForHash(null), "null");
  assert.equal(normalizeToolInputForHash(undefined), "null");
});

test("normalizeToolInputForHash normalizes objects", () => {
  const input1 = { b: 2, a: 1 };
  const input2 = { a: 1, b: 2 };
  const hash1 = normalizeToolInputForHash(input1);
  const hash2 = normalizeToolInputForHash(input2);
  assert.equal(hash1, hash2);
});

test("hashToolCall creates consistent hashes", () => {
  const hash1 = hashToolCall("read", { path: "/foo" });
  const hash2 = hashToolCall("read", { path: "/foo" });
  const hash3 = hashToolCall("read", { path: "/bar" });
  const hash4 = hashToolCall("write", { path: "/foo" });

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
  assert.notEqual(hash1, hash4);
});

test("LoopDetectionState records tool calls and detects repeats", () => {
  const state = new LoopDetectionState();

  const result1 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result1.pattern.count, 1);
  assert.equal(result1.action, "continue");

  const result2 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result2.pattern.count, 2);
  assert.equal(result2.action, "continue");

  const result3 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result3.pattern.count, 3);
  assert.equal(result3.action, "warn");

  const result4 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result4.pattern.count, 4);
  assert.equal(result4.action, "warn");

  const result5 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result5.pattern.count, 5);
  assert.equal(result5.action, "escalate");

  const result6 = state.recordToolCall("read", { path: "/foo" });
  assert.equal(result6.pattern.count, 6);
  assert.equal(result6.action, "escalate");
});

test("LoopDetectionState differentiates between tool calls", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/bar" });
  state.recordToolCall("write", { path: "/foo" });

  const patterns = state.getPatterns();
  assert.equal(patterns.length, 3);
});

test("LoopDetectionState does not false-positive on different paths to same tool", () => {
  const state = new LoopDetectionState();

  // Record many calls to the same tool with different paths
  // This should NOT trigger escalation because each path is unique
  for (let i = 0; i < 10; i++) {
    const result = state.recordToolCall("read", { path: `/file_${i}.txt` });
    assert.notEqual(result.action, "escalate");
    assert.notEqual(result.action, "warn");
  }
});

test("LoopDetectionState does not false-positive on different arguments", () => {
  const state = new LoopDetectionState({ escalateThreshold: 3 });

  // Same tool with varying arguments should each be tracked separately
  state.recordToolCall("grep", { pattern: "foo", path: "/a" });
  state.recordToolCall("grep", { pattern: "bar", path: "/a" });
  state.recordToolCall("grep", { pattern: "baz", path: "/a" });

  // No pattern should have count > 1 since each is unique
  const patterns = state.getPatterns();
  for (const p of patterns) {
    assert.equal(p.count, 1);
  }
});

test("LoopDetectionState getRepeatCount returns correct count", () => {
  const state = new LoopDetectionState();

  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 0);

  state.recordToolCall("read", { path: "/foo" });
  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 1);

  state.recordToolCall("read", { path: "/foo" });
  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 2);
});

test("LoopDetectionState wouldEscalate checks threshold", () => {
  const state = new LoopDetectionState();

  assert.equal(state.wouldEscalate("read", { path: "/foo" }), false);

  for (let i = 0; i < 4; i++) {
    state.recordToolCall("read", { path: "/foo" });
  }
  assert.equal(state.wouldEscalate("read", { path: "/foo" }), false);

  state.recordToolCall("read", { path: "/foo" });
  assert.equal(state.wouldEscalate("read", { path: "/foo" }), true);
});

test("LoopDetectionState reset clears patterns", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });

  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 2);

  state.reset();

  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 0);
});

test("LoopDetectionState removePattern removes specific pattern", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/bar" });

  assert.equal(state.getPatterns().length, 2);

  state.removePattern("read", { path: "/foo" });

  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 0);
  assert.equal(state.getRepeatCount("read", { path: "/bar" }), 1);
});

test("LoopDetectionState with custom config", () => {
  const config: LoopDetectionConfig = {
    warnThreshold: 2,
    escalateThreshold: 4,
    askAtWarn: false,
    terminateAtEscalate: false,
  };
  const state = new LoopDetectionState(config);

  state.recordToolCall("read", { path: "/foo" });
  assert.equal(state.getRepeatCount("read", { path: "/foo" }), 1);

  state.recordToolCall("read", { path: "/foo" });
  const patterns = state.getPatterns();
  assert.equal(patterns[0]!.count, 2);
});

test("LoopDetectionState getEscalatedPatterns", () => {
  const state = new LoopDetectionState({ escalateThreshold: 3 });

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/bar" });

  assert.equal(state.getEscalatedPatterns().length, 0);

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });

  assert.equal(state.getEscalatedPatterns().length, 1);
  assert.equal(state.getEscalatedPatterns()[0]!.toolName, "read");
});

test("SequenceLoopDetector records actions and detects loops", () => {
  const detector = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });

  detector.recordAction("read /foo");
  detector.recordAction("read /foo");
  detector.recordAction("read /foo");

  const result4 = detector.recordAction("read /foo");
  assert.equal(result4.isLoop, true);
  assert.equal(result4.count, 2);
});

test("SequenceLoopDetector respects window size", () => {
  const detector = new SequenceLoopDetector({ windowSize: 2, repeatThreshold: 2 });

  detector.recordAction("action1");
  detector.recordAction("action2");
  detector.recordAction("action1");
  detector.recordAction("action2");

  const history = detector.getHistory();
  assert.ok(history.length <= 4);
});

test("SequenceLoopDetector reset clears state", () => {
  const detector = new SequenceLoopDetector();

  detector.recordAction("read /foo");
  detector.recordAction("read /foo");

  assert.equal(detector.getHistory().length, 2);

  detector.reset();

  assert.equal(detector.getHistory().length, 0);
});

test("hashToolCall handles complex inputs", () => {
  const complexInput = {
    files: [
      { path: "/a/b.txt", content: "hello" },
      { path: "/c/d.txt", content: "world" },
    ],
    options: { recursive: true, verbose: false },
  };

  const hash1 = hashToolCall("batch_write", complexInput);
  const hash2 = hashToolCall("batch_write", complexInput);

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 16);
});

test("createLoopDetectionMiddleware returns middleware and state", () => {
  const { middleware, state } = createLoopDetectionMiddleware();

  assert.equal(middleware.name, "loop_detection");
  assert.equal(middleware.priority, 10);
  assert.ok(state instanceof LoopDetectionState);
});

test("createLoopDetectionMiddleware succeeds with no patterns", async () => {
  const { middleware } = createLoopDetectionMiddleware();

  const ctx = {
    runtime: { traceId: "test", taskId: "test-task" },
    chainStartedAt: "",
    agentRound: 0,
    stepId: null,
    executionId: null,
    taskId: "test-task",
  };
  const result = await middleware.run(ctx, { request: "test", history: [] });

  assert.equal(result.success, true);
});

test("createLoopDetectionMiddleware warns on warning threshold", async () => {
  const config: LoopDetectionConfig = { warnThreshold: 2, escalateThreshold: 4 };
  const { middleware, state } = createLoopDetectionMiddleware(config);

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });

  const ctx = {
    runtime: { traceId: "test", taskId: "test-task" },
    chainStartedAt: "",
    agentRound: 0,
    stepId: null,
    executionId: null,
    taskId: "test-task",
  };
  const result = await middleware.run(ctx, { request: "test", history: [] });

  assert.equal(result.success, true);
  assert.ok(result.error);
  assert.equal(result.error?.code, "loop_detection.warning");
  assert.equal(result.error?.warning, true);
});

test("createLoopDetectionMiddleware fails on escalated pattern", async () => {
  const config: LoopDetectionConfig = { warnThreshold: 1, escalateThreshold: 3 };
  const { middleware, state } = createLoopDetectionMiddleware(config);

  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });
  state.recordToolCall("read", { path: "/foo" });

  const ctx = {
    runtime: { traceId: "test", taskId: "test-task" },
    chainStartedAt: "",
    agentRound: 0,
    stepId: null,
    executionId: null,
    taskId: "test-task",
  };
  const result = await middleware.run(ctx, { request: "test", history: [] });

  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(result.error?.code, "loop_detection.escalated");
  assert.equal(result.error?.warning, false);
});

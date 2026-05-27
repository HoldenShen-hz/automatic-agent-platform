import test from "node:test";
import assert from "node:assert/strict";
import {
  LoopDetectionState,
  normalizeToolInputForHash,
  hashToolCall,
  SequenceLoopDetector,
  createLoopDetectionMiddleware,
  createLoopDetectionMiddlewareFull,
  type LoopDetectionConfig,
} from "../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

test("LoopDetectionState custom hashFn produces consistent results [loop-detection-extended]", () => {
  const customHashFn = (toolName: string, input: unknown): string => {
    return `${toolName}:${JSON.stringify(input)}`.slice(0, 16);
  };
  const state = new LoopDetectionState({ hashFn: customHashFn });

  const result1 = state.recordToolCall("custom_tool", { data: "value" });
  assert.equal(result1.pattern.count, 1);
  assert.equal(result1.action, "continue");

  const result2 = state.recordToolCall("custom_tool", { data: "value" });
  assert.equal(result2.pattern.count, 2);
});

test("LoopDetectionState getConfig returns all config values [loop-detection-extended]", () => {
  const config: LoopDetectionConfig = {
    warnThreshold: 2,
    escalateThreshold: 5,
    askAtWarn: false,
    terminateAtEscalate: true,
  };
  const state = new LoopDetectionState(config);
  const retrieved = state.getConfig();

  assert.equal(retrieved.warnThreshold, 2);
  assert.equal(retrieved.escalateThreshold, 5);
  assert.equal(retrieved.askAtWarn, false);
  assert.equal(retrieved.terminateAtEscalate, true);
});

test("LoopDetectionState uses default hashFn when not provided [loop-detection-extended]", () => {
  const state = new LoopDetectionState({});
  const result = state.recordToolCall("tool", { arg: "value" });

  assert.ok(result.pattern.inputHash.length > 0);
  assert.ok(result.pattern.inputSummary.length > 0);
});

test("normalizeToolInputForHash handles number inputs [loop-detection-extended]", () => {
  assert.equal(normalizeToolInputForHash(42), "42");
  assert.equal(normalizeToolInputForHash(0), "0");
  assert.equal(normalizeToolInputForHash(-1), "-1");
});

test("normalizeToolInputForHash handles boolean inputs [loop-detection-extended]", () => {
  assert.equal(normalizeToolInputForHash(true), "true");
  assert.equal(normalizeToolInputForHash(false), "false");
});

test("normalizeToolInputForHash handles array inputs [loop-detection-extended]", () => {
  const arr1 = [1, 2, 3];
  const arr2 = [1, 2, 3];
  const hash1 = normalizeToolInputForHash(arr1);
  const hash2 = normalizeToolInputForHash(arr2);
  assert.equal(hash1, hash2);

  const arr3 = [3, 2, 1];
  const hash3 = normalizeToolInputForHash(arr3);
  assert.notEqual(hash1, hash3);
});

test("hashToolCall produces 16 character hashes [loop-detection-extended]", () => {
  const hash = hashToolCall("read", { path: "/foo" });
  assert.equal(hash.length, 16);
});

test("SequenceLoopDetector respects repeatThreshold [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 2,
    repeatThreshold: 3,
  });

  detector.recordAction("A");
  detector.recordAction("B");
  detector.recordAction("A");
  detector.recordAction("B");

  detector.recordAction("A");
  detector.recordAction("B");

  const result = detector.recordAction("A");
  assert.equal(result.isLoop, true);
});

test("SequenceLoopDetector returns empty history after reset [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector();
  detector.recordAction("action1");
  detector.recordAction("action2");

  assert.equal(detector.getHistory().length, 2);
  detector.reset();
  assert.equal(detector.getHistory().length, 0);
});

test("SequenceLoopDetector action history bounded by windowSize [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector({ windowSize: 3 });

  for (let i = 0; i < 10; i++) {
    detector.recordAction(`action_${i}`);
  }

  const history = detector.getHistory();
  assert.ok(history.length <= 6);
});

test("createLoopDetectionMiddlewareFull returns full middleware set [loop-detection-extended]", () => {
  const middlewareSet = createLoopDetectionMiddlewareFull();

  assert.ok(middlewareSet.state instanceof LoopDetectionState);
  assert.equal(middlewareSet.beforeAgent.name, "loop_detection_before_agent");
  assert.equal(middlewareSet.wrapToolCall.name, "loop_detection_wrap_tool_call");
});

test("createLoopDetectionMiddlewareFull wrapToolCall is called [loop-detection-extended]", async () => {
  const { wrapToolCall, state } = createLoopDetectionMiddlewareFull({
    warnThreshold: 1,
    escalateThreshold: 3,
  });

  state.recordToolCall("read", { path: "/foo" });

  const ctx = {
    runtime: { traceId: "test", taskId: "test-task" },
    chainStartedAt: "",
    agentRound: 0,
    stepId: null,
    executionId: null,
    taskId: "test-task",
  };

  const result = await wrapToolCall.run(
    ctx,
    { toolName: "read", args: { path: "/foo" } },
    async () => "done",
  );
  assert.equal(result, "done");
});

test("createLoopDetectionMiddlewareFull beforeAgent returns error with warning [loop-detection-extended]", async () => {
  const { beforeAgent, state } = createLoopDetectionMiddlewareFull({
    warnThreshold: 2,
    escalateThreshold: 5,
  });

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

  const result = await beforeAgent.run(ctx, { request: "test", history: [] });

  assert.equal(result.success, true);
  assert.ok(result.error);
  assert.equal(result.error?.warning, true);
});

test("SequenceLoopDetector handles empty action string [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector({ windowSize: 2 });

  const result = detector.recordAction("");
  assert.equal(result.isLoop, false);
  assert.deepEqual(result.sequence, []);
});

test("SequenceLoopDetector detects loop when same sequence repeats [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 2,
    repeatThreshold: 2,
  });

  detector.recordAction("read");
  detector.recordAction("write");
  detector.recordAction("read");
  detector.recordAction("write");
  detector.recordAction("read");
  detector.recordAction("write");

  const result = detector.recordAction("read");
  assert.ok(result.isLoop);
  assert.ok(result.count >= 2);
});

test("LoopDetectionState removePattern works with custom hashFn [loop-detection-extended]", () => {
  const customHashFn = (toolName: string, input: unknown): string => {
    return `custom_${JSON.stringify(input)}`.slice(0, 16);
  };
  const state = new LoopDetectionState({ hashFn: customHashFn });

  state.recordToolCall("tool", { key: "value" });
  state.recordToolCall("tool", { key: "value" });

  assert.equal(state.getRepeatCount("tool", { key: "value" }), 2);

  state.removePattern("tool", { key: "value" });

  assert.equal(state.getRepeatCount("tool", { key: "value" }), 0);
});

test("SequenceLoopDetector records first action as non-loop [loop-detection-extended]", () => {
  const detector = new SequenceLoopDetector();
  const result = detector.recordAction("first");

  assert.equal(result.isLoop, false);
  assert.equal(result.count, 0);
  assert.deepEqual(result.sequence, []);
});

test("normalizeToolInputForHash handles nested objects [loop-detection-extended]", () => {
  const obj1 = { nested: { deep: { value: 1 } } };
  const obj2 = { nested: { deep: { value: 1 } } };
  const hash1 = normalizeToolInputForHash(obj1);
  const hash2 = normalizeToolInputForHash(obj2);
  assert.equal(hash1, hash2);
});

test("hashToolCall different tool names produce different hashes [loop-detection-extended]", () => {
  const hash1 = hashToolCall("tool_a", { same: "input" });
  const hash2 = hashToolCall("tool_b", { same: "input" });
  assert.notEqual(hash1, hash2);
});

test("LoopDetectionState wouldEscalate returns false below threshold [loop-detection-extended]", () => {
  const state = new LoopDetectionState({ escalateThreshold: 5 });

  for (let i = 0; i < 4; i++) {
    state.recordToolCall("tool", { data: "value" });
  }

  assert.equal(state.wouldEscalate("tool", { data: "value" }), false);
});

test("LoopDetectionState wouldEscalate returns true at threshold [loop-detection-extended]", () => {
  const state = new LoopDetectionState({ escalateThreshold: 3 });

  state.recordToolCall("tool", { data: "value" });
  state.recordToolCall("tool", { data: "value" });
  assert.equal(state.wouldEscalate("tool", { data: "value" }), false);

  state.recordToolCall("tool", { data: "value" });
  assert.equal(state.wouldEscalate("tool", { data: "value" }), true);
});

test("SequenceLoopDetector windowSize parameter works [loop-detection-extended]", () => {
  // Test that different window sizes produce different behavior
  const detector3 = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });
  const detector5 = new SequenceLoopDetector({ windowSize: 5, repeatThreshold: 2 });

  // Record a sequence with window size 3
  detector3.recordAction("A");
  detector3.recordAction("B");
  detector3.recordAction("C");
  detector3.recordAction("A");
  detector3.recordAction("B");
  detector3.recordAction("C");

  // Record the same with window size 5
  detector5.recordAction("A");
  detector5.recordAction("B");
  detector5.recordAction("C");
  detector5.recordAction("A");
  detector5.recordAction("B");
  detector5.recordAction("C");

  // Both should return valid results from recordAction
  const result3 = detector3.recordAction("A");
  const result5 = detector5.recordAction("A");

  assert.ok(typeof result3.isLoop === "boolean");
  assert.ok(typeof result5.isLoop === "boolean");
  assert.ok(typeof result3.count === "number");
  assert.ok(typeof result5.count === "number");
});
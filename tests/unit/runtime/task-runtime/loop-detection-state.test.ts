import test from "node:test";
import assert from "node:assert/strict";
import {
  LoopDetectionState,
  normalizeToolInputForHash,
  hashToolCall,
} from "../../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

test("LoopDetectionState records tool calls and returns correct action [loop-detection-state]", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });

  // First call - continue
  const r1 = state.recordToolCall("test_tool", { key: "value" });
  assert.equal(r1.action, "continue");
  assert.equal(r1.pattern.count, 1);

  // Second call - warn (reaches warnThreshold of 2)
  const r2 = state.recordToolCall("test_tool", { key: "value" });
  assert.equal(r2.action, "warn");
  assert.equal(r2.pattern.count, 2);

  // Third call - escalate (reaches escalateThreshold of 3)
  const r3 = state.recordToolCall("test_tool", { key: "value" });
  assert.equal(r3.action, "escalate");
  assert.equal(r3.pattern.count, 3);
  assert.equal(r3.pattern.escalated, true);

  // Fourth call - stays escalated
  const r4 = state.recordToolCall("test_tool", { key: "value" });
  assert.equal(r4.action, "escalate");
  assert.equal(r4.pattern.count, 4);
  assert.equal(r4.pattern.escalated, true);
});

test("LoopDetectionState getRepeatCount returns correct count [loop-detection-state]", () => {
  const state = new LoopDetectionState({ warnThreshold: 3, escalateThreshold: 5 });

  state.recordToolCall("tool_a", { x: 1 });
  state.recordToolCall("tool_a", { x: 1 });
  state.recordToolCall("tool_b", { x: 1 });

  assert.equal(state.getRepeatCount("tool_a", { x: 1 }), 2);
  assert.equal(state.getRepeatCount("tool_b", { x: 1 }), 1);
  assert.equal(state.getRepeatCount("tool_c", { x: 1 }), 0);
});

test("LoopDetectionState wouldEscalate checks threshold correctly [loop-detection-state]", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });

  state.recordToolCall("tool", { data: "a" });
  state.recordToolCall("tool", { data: "a" });
  assert.equal(state.wouldEscalate("tool", { data: "a" }), false);

  state.recordToolCall("tool", { data: "a" });
  assert.equal(state.wouldEscalate("tool", { data: "a" }), true);
});

test("LoopDetectionState getPatterns returns all recorded patterns [loop-detection-state]", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("tool_one", { a: 1 });
  state.recordToolCall("tool_one", { a: 1 });
  state.recordToolCall("tool_two", { b: 2 });

  const patterns = state.getPatterns();
  assert.equal(patterns.length, 2);

  const toolOne = patterns.find((p) => p.toolName === "tool_one");
  assert.ok(toolOne);
  assert.equal(toolOne.count, 2);

  const toolTwo = patterns.find((p) => p.toolName === "tool_two");
  assert.ok(toolTwo);
  assert.equal(toolTwo.count, 1);
});

test("LoopDetectionState reset clears all patterns [loop-detection-state]", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("tool", { data: "x" });
  state.recordToolCall("tool", { data: "x" });

  assert.equal(state.getRepeatCount("tool", { data: "x" }), 2);

  state.reset();

  assert.equal(state.getRepeatCount("tool", { data: "x" }), 0);
});

test("LoopDetectionState removePattern deletes specific pattern [loop-detection-state]", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("tool_a", { x: 1 });
  state.recordToolCall("tool_a", { x: 1 });
  state.recordToolCall("tool_b", { y: 2 });

  state.removePattern("tool_a", { x: 1 });

  assert.equal(state.getRepeatCount("tool_a", { x: 1 }), 0);
  assert.equal(state.getRepeatCount("tool_b", { y: 2 }), 1);
});

test("LoopDetectionState getConfig returns configuration [loop-detection-state]", () => {
  const state = new LoopDetectionState({
    warnThreshold: 5,
    escalateThreshold: 10,
    askAtWarn: false,
    terminateAtEscalate: false,
  });

  const config = state.getConfig();
  assert.equal(config.warnThreshold, 5);
  assert.equal(config.escalateThreshold, 10);
  assert.equal(config.askAtWarn, false);
  assert.equal(config.terminateAtEscalate, false);
});

test("normalizeToolInputForHash handles null/undefined [loop-detection-state]", () => {
  assert.equal(normalizeToolInputForHash(null), "null");
  assert.equal(normalizeToolInputForHash(undefined), "null");
});

test("normalizeToolInputForHash handles strings [loop-detection-state]", () => {
  assert.equal(normalizeToolInputForHash("Hello World"), "hello world");
  assert.equal(normalizeToolInputForHash("  Spaces  "), "spaces");
});

test("normalizeToolInputForHash handles objects with sorted keys [loop-detection-state]", () => {
  const obj1 = { b: 2, a: 1 };
  const obj2 = { a: 1, b: 2 };
  assert.equal(normalizeToolInputForHash(obj1), normalizeToolInputForHash(obj2));
});

test("hashToolCall produces consistent hashes [loop-detection-state]", () => {
  const hash1 = hashToolCall("my_tool", { arg: "value" });
  const hash2 = hashToolCall("my_tool", { arg: "value" });
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 16); // sha256 slice to 16 chars
});

test("hashToolCall different tool names produce different hashes [loop-detection-state]", () => {
  const hash1 = hashToolCall("tool_a", { x: 1 });
  const hash2 = hashToolCall("tool_b", { x: 1 });
  assert.notEqual(hash1, hash2);
});

test("hashToolCall different inputs produce different hashes [loop-detection-state]", () => {
  const hash1 = hashToolCall("tool", { x: 1 });
  const hash2 = hashToolCall("tool", { x: 2 });
  assert.notEqual(hash1, hash2);
});

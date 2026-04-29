import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeToolInputForHash,
  hashToolCall,
  LoopDetectionState,
  SequenceLoopDetector,
} from "../../../src/platform/execution/execution-engine/loop-detection.js";

test("normalizeToolInputForHash handles null and undefined", () => {
  assert.equal(normalizeToolInputForHash(null), "null");
  assert.equal(normalizeToolInputForHash(undefined), "null");
});

test("normalizeToolInputForHash handles strings", () => {
  assert.equal(normalizeToolInputForHash("Hello World"), "hello world");
  assert.equal(normalizeToolInputForHash("  TEST  "), "test");
});

test("normalizeToolInputForHash handles objects", () => {
  const obj1 = { b: 2, a: 1 };
  const obj2 = { a: 1, b: 2 };
  const result1 = normalizeToolInputForHash(obj1);
  const result2 = normalizeToolInputForHash(obj2);
  assert.equal(result1, result2, "Same content different key order should produce same hash input");
});

test("normalizeToolInputForHash handles primitives", () => {
  assert.equal(normalizeToolInputForHash(42), "42");
  assert.equal(normalizeToolInputForHash(true), "true");
});

test("hashToolCall produces consistent hashes", () => {
  const hash1 = hashToolCall("read_file", { path: "/tmp/test.txt" });
  const hash2 = hashToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(hash1, hash2, "Same tool and input should produce same hash");
});

test("hashToolCall produces different hashes for different inputs", () => {
  const hash1 = hashToolCall("read_file", { path: "/tmp/test.txt" });
  const hash2 = hashToolCall("read_file", { path: "/tmp/other.txt" });
  assert.notEqual(hash1, hash2, "Different inputs should produce different hashes");
});

test("hashToolCall produces 16-character hex string", () => {
  const hash = hashToolCall("test_tool", { arg: "value" });
  assert.equal(hash.length, 16, "Hash should be 16 characters");
  assert.match(hash, /^[0-9a-f]+$/, "Hash should be hex string");
});

test("LoopDetectionState records tool calls and detects patterns", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 4 });

  // First call - should continue
  const result1 = state.recordToolCall("test_tool", { id: 1 });
  assert.equal(result1.action, "continue");
  assert.equal(result1.pattern.count, 1);

  // Second call - should warn
  const result2 = state.recordToolCall("test_tool", { id: 1 });
  assert.equal(result2.action, "warn");
  assert.equal(result2.pattern.count, 2);
});

test("LoopDetectionState escalates at threshold", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 4 });

  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });

  const result = state.recordToolCall("test_tool", { id: 1 });
  assert.equal(result.action, "escalate");
  assert.equal(result.pattern.escalated, true);
});

test("LoopDetectionState getRepeatCount returns correct count", () => {
  const state = new LoopDetectionState();

  assert.equal(state.getRepeatCount("test_tool", { id: 1 }), 0);

  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });

  assert.equal(state.getRepeatCount("test_tool", { id: 1 }), 3);
  assert.equal(state.getRepeatCount("other_tool", { id: 1 }), 0);
});

test("LoopDetectionState wouldEscalate checks threshold", () => {
  const state = new LoopDetectionState({ escalateThreshold: 3 });

  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });

  assert.equal(state.wouldEscalate("test_tool", { id: 1 }), false);

  state.recordToolCall("test_tool", { id: 1 });

  assert.equal(state.wouldEscalate("test_tool", { id: 1 }), true);
});

test("LoopDetectionState removePattern removes specific pattern", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("test_tool", { id: 1 });
  state.recordToolCall("test_tool", { id: 1 });
  assert.equal(state.getRepeatCount("test_tool", { id: 1 }), 2);

  state.removePattern("test_tool", { id: 1 });
  assert.equal(state.getRepeatCount("test_tool", { id: 1 }), 0);
});

test("LoopDetectionState reset clears all patterns", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("tool_a", { id: 1 });
  state.recordToolCall("tool_b", { id: 2 });
  assert.equal(state.getPatterns().length, 2);

  state.reset();
  assert.equal(state.getPatterns().length, 0);
});

test("LoopDetectionState getPatterns returns all patterns", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("tool_a", { id: 1 });
  state.recordToolCall("tool_b", { id: 2 });

  const patterns = state.getPatterns();
  assert.equal(patterns.length, 2);
});

test("LoopDetectionState getEscalatedPatterns filters correctly", () => {
  const state = new LoopDetectionState({ warnThreshold: 1, escalateThreshold: 2 });

  state.recordToolCall("tool_a", { id: 1 });
  state.recordToolCall("tool_a", { id: 1 }); // escalates

  state.recordToolCall("tool_b", { id: 1 }); // doesn't escalate

  const escalated = state.getEscalatedPatterns();
  assert.equal(escalated.length, 1);
  assert.equal(escalated[0]!.toolName, "tool_a");
});

test("LoopDetectionState with default config", () => {
  const state = new LoopDetectionState();
  const config = state.getConfig();

  assert.equal(config.warnThreshold, 3);
  assert.equal(config.escalateThreshold, 5);
  assert.equal(config.askAtWarn, true);
  assert.equal(config.terminateAtEscalate, true);
});

test("LoopDetectionState with custom config", () => {
  const state = new LoopDetectionState({
    warnThreshold: 1,
    escalateThreshold: 2,
    askAtWarn: false,
    terminateAtEscalate: false,
  });
  const config = state.getConfig();

  assert.equal(config.warnThreshold, 1);
  assert.equal(config.escalateThreshold, 2);
  assert.equal(config.askAtWarn, false);
  assert.equal(config.terminateAtEscalate, false);
});

test("SequenceLoopDetector records actions and detects loops", () => {
  const detector = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });

  detector.recordAction("action_a");
  detector.recordAction("action_b");
  detector.recordAction("action_c");

  // Repeat the same sequence
  const result1 = detector.recordAction("action_a");
  const result2 = detector.recordAction("action_b");
  const result3 = detector.recordAction("action_c");

  assert.equal(result1.isLoop || result2.isLoop || result3.isLoop, true);
});

test("SequenceLoopDetector getHistory returns action sequence", () => {
  const detector = new SequenceLoopDetector();

  detector.recordAction("action_a");
  detector.recordAction("action_b");

  const history = detector.getHistory();
  assert.deepStrictEqual(history, ["action_a", "action_b"]);
});

test("SequenceLoopDetector reset clears state", () => {
  const detector = new SequenceLoopDetector();

  detector.recordAction("action_a");
  detector.recordAction("action_b");
  detector.reset();

  assert.deepStrictEqual(detector.getHistory(), []);
});

test("SequenceLoopDetector with default config", () => {
  const detector = new SequenceLoopDetector();
  assert.equal(detector.getHistory().length, 0); // Just ensure it initializes
});
/**
 * E2E Loop Detection Tests
 *
 * End-to-end tests for loop detection functionality.
 * Tests cover:
 * 1. Loop detection state management
 * 2. Tool call loop detection with hash-based normalization
 * 3. Sequence loop detection for repeated action patterns
 * 4. Escalation and warning thresholds
 * 5. TTL-based eviction
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  LoopDetectionState,
  SequenceLoopDetector,
  normalizeToolInputForHash,
  hashToolCall,
  createLoopDetectionMiddleware,
  createLoopDetectionMiddlewareFull,
} from "../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

// ============================================================================
// Test Suite 1: Loop Detection State - Basic Operations
// ============================================================================

test("E2E LoopDetection: records first tool call with count 1", () => {
  const state = new LoopDetectionState();

  const result = state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "continue");
  assert.equal(result.pattern.count, 1);
  assert.equal(result.pattern.toolName, "read_file");
  assert.equal(result.pattern.escalated, false);
});

test("E2E LoopDetection: warns at threshold (default 3)", () => {
  const state = new LoopDetectionState({ warnThreshold: 3, escalateThreshold: 5 });

  // First two calls - continue
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  // Third call - warn
  const result = state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "warn");
  assert.equal(result.pattern.count, 3);
});

test("E2E LoopDetection: escalates at threshold (default 5)", () => {
  const state = new LoopDetectionState({ warnThreshold: 3, escalateThreshold: 5 });

  // Call 5 times
  for (let i = 0; i < 5; i++) {
    state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  }

  const result = state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "escalate");
  assert.equal(result.pattern.count, 6);
  assert.equal(result.pattern.escalated, true);
});

test("E2E LoopDetection: treats different tool names separately", () => {
  const state = new LoopDetectionState({ warnThreshold: 3, escalateThreshold: 5 });

  // Call read_file 3 times
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  // Call write_file once - should not trigger warn for write_file
  const writeResult = state.recordToolCall("write_file", { path: "/tmp/out.txt" });

  assert.equal(writeResult.action, "continue");
  assert.equal(writeResult.pattern.count, 1);
});

test("E2E LoopDetection: treats different inputs separately", () => {
  const state = new LoopDetectionState({ warnThreshold: 3, escalateThreshold: 5 });

  // Call with different paths
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });

  // Different path should have separate count
  const bResult = state.recordToolCall("read_file", { path: "/tmp/b.txt" });

  assert.equal(bResult.action, "continue");
  assert.equal(bResult.pattern.count, 1);
});

// ============================================================================
// Test Suite 2: Input Normalization and Hashing
// ============================================================================

test("E2E LoopDetection: normalizes string input for hashing", () => {
  const hash1 = hashToolCall("read_file", "hello");
  const hash2 = hashToolCall("read_file", "HELLO");
  const hash3 = hashToolCall("read_file", "hello ");

  // Case and whitespace should be normalized
  assert.equal(hash1, hash2);
  assert.equal(hash1, hash3);
});

test("E2E LoopDetection: normalizes object input for hashing", () => {
  const hash1 = hashToolCall("read_file", { a: 1, b: 2 });
  const hash2 = hashToolCall("read_file", { b: 2, a: 1 });

  // Key order should not matter
  assert.equal(hash1, hash2);
});

test("E2E LoopDetection: handles null and undefined inputs", () => {
  const hash1 = hashToolCall("tool", null);
  const hash2 = hashToolCall("tool", undefined);

  assert.equal(hash1, hash2);
});

// ============================================================================
// Test Suite 3: Sequence Loop Detector
// ============================================================================

test("E2E SequenceDetector: detects repeated action sequences", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 3,
    repeatThreshold: 2,
  });

  // Record action sequence: a, b, c
  detector.recordAction("action_a");
  detector.recordAction("action_b");
  detector.recordAction("action_c");

  // Repeat: a, b, c again - should detect loop
  const result1 = detector.recordAction("action_a");
  const result2 = detector.recordAction("action_b");
  const result3 = detector.recordAction("action_c");

  assert.equal(result3.isLoop, true);
  assert.equal(result3.count, 2);
});

test("E2E SequenceDetector: different sequences are tracked separately", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 2,
    repeatThreshold: 2,
  });

  // Sequence 1: x, y
  detector.recordAction("x");
  detector.recordAction("y");

  // Sequence 2: a, b (y, a is a new sequence)
  const result = detector.recordAction("a");

  // The new sequence [y, a] is seen for the first time
  // so isLoop is false but count is 1 (first occurrence)
  assert.equal(result.isLoop, false);
  assert.equal(result.count, 1);
});

test("E2E SequenceDetector: window size limits sequence analysis", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 2,
    repeatThreshold: 2,
  });

  // Record longer sequence
  detector.recordAction("a");
  detector.recordAction("b");
  detector.recordAction("c");
  detector.recordAction("d");
  detector.recordAction("e");

  // Last window is c, d - no loop
  const result = detector.recordAction("c");
  assert.equal(result.isLoop, false);
});

test("E2E SequenceDetector: resets state correctly", () => {
  const detector = new SequenceLoopDetector({
    windowSize: 2,
    repeatThreshold: 2,
  });

  detector.recordAction("x");
  detector.recordAction("y");
  detector.recordAction("x");
  detector.recordAction("y");

  assert.equal(detector.getHistory().length, 4);

  detector.reset();

  assert.equal(detector.getHistory().length, 0);
});

// ============================================================================
// Test Suite 4: Middleware Integration
// ============================================================================

test("E2E LoopDetection: middleware set returns correct hooks", () => {
  const { beforeAgent, wrapToolCall, state } = createLoopDetectionMiddlewareFull({
    warnThreshold: 3,
    escalateThreshold: 5,
  });

  assert.equal(beforeAgent.name, "loop_detection_before_agent");
  assert.equal(wrapToolCall.name, "loop_detection_wrap_tool_call");
  assert.ok(state instanceof LoopDetectionState);
});

test("E2E LoopDetection: createLoopDetectionMiddleware returns middleware and state", () => {
  const { middleware, state } = createLoopDetectionMiddleware({
    warnThreshold: 2,
    escalateThreshold: 4,
  });

  assert.equal(middleware.name, "loop_detection");
  assert.ok(state instanceof LoopDetectionState);
});

// ============================================================================
// Test Suite 5: State Management Operations
// ============================================================================

test("E2E LoopDetection: getRepeatCount returns correct count", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(state.getRepeatCount("read_file", { path: "/tmp/test.txt" }), 2);
  assert.equal(state.getRepeatCount("read_file", { path: "/tmp/other.txt" }), 0);
});

test("E2E LoopDetection: removePattern removes specific pattern", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(state.getRepeatCount("read_file", { path: "/tmp/test.txt" }), 3);

  state.removePattern("read_file", { path: "/tmp/test.txt" });

  assert.equal(state.getRepeatCount("read_file", { path: "/tmp/test.txt" }), 0);
});

test("E2E LoopDetection: getEscalatedPatterns returns only escalated patterns", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });

  // read_file - escalate
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });
  state.recordToolCall("read_file", { path: "/tmp/a.txt" });

  // write_file - only warn
  state.recordToolCall("write_file", { path: "/tmp/b.txt" });
  state.recordToolCall("write_file", { path: "/tmp/b.txt" });

  const escalated = state.getEscalatedPatterns();

  assert.equal(escalated.length, 1);
  assert.equal(escalated[0]?.toolName, "read_file");
});

test("E2E LoopDetection: wouldEscalate returns correct boolean", () => {
  const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });

  assert.equal(state.wouldEscalate("read_file", { path: "/tmp/test.txt" }), false);

  // At warn threshold but not escalate
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(state.wouldEscalate("read_file", { path: "/tmp/test.txt" }), false);

  // At escalate threshold
  state.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(state.wouldEscalate("read_file", { path: "/tmp/test.txt" }), true);
});

test("E2E LoopDetection: reset clears all patterns", () => {
  const state = new LoopDetectionState();

  state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  state.recordToolCall("write_file", { path: "/tmp/out.txt" });

  assert.equal(state.getPatterns().length, 2);

  state.reset();

  assert.equal(state.getPatterns().length, 0);
});

// ============================================================================
// Test Suite 6: Configuration Options
// ============================================================================

test("E2E LoopDetection: custom thresholds work correctly", () => {
  const state = new LoopDetectionState({
    warnThreshold: 1,
    escalateThreshold: 2,
    askAtWarn: false,
    terminateAtEscalate: false,
  });

  // First call should warn
  const warnResult = state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(warnResult.action, "warn");

  // Second call should escalate
  const escalateResult = state.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(escalateResult.action, "escalate");
});

test("E2E LoopDetection: getConfig returns correct config", () => {
  const state = new LoopDetectionState({
    warnThreshold: 2,
    escalateThreshold: 4,
    askAtWarn: false,
    terminateAtEscalate: true,
  });

  const config = state.getConfig();

  assert.equal(config.warnThreshold, 2);
  assert.equal(config.escalateThreshold, 4);
  assert.equal(config.askAtWarn, false);
  assert.equal(config.terminateAtEscalate, true);
});

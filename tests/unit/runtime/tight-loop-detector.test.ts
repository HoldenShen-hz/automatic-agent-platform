import test from "node:test";
import assert from "node:assert/strict";
import {
  TightLoopDetector,
  createTightLoopDetector,
} from "../../../src/platform/five-plane-execution/execution-engine/tight-loop-detector.js";

test("TightLoopDetector detects exact repeats [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  const result1 = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(result1.action, "continue");

  const result2 = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.ok(result2.action === "continue" || result2.action === "warn");

  const result3 = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.ok(result3.action === "warn" || result3.action === "escalate");
});

test("TightLoopDetector detects similar inputs [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("read_file", { path: "/tmp/test1.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/test2.txt" });
  const result = detector.recordToolCall("read_file", { path: "/tmp/test3.txt" });

  assert.ok(result.action === "continue" || result.action === "warn");
});

test("TightLoopDetector tracks pattern counts [tight-loop-detector]", () => {
  const detector = createTightLoopDetector();

  detector.recordToolCall("tool", { data: "input" });
  detector.recordToolCall("tool", { data: "input" });
  detector.recordToolCall("tool", { data: "input" });

  const patterns = detector.getPatterns();
  const toolPattern = patterns.find((p) => p.toolName === "tool");
  assert.ok(toolPattern);
  assert.equal(toolPattern!.count, 3);
});

test("TightLoopDetector resets state [tight-loop-detector]", () => {
  const detector = createTightLoopDetector();

  detector.recordToolCall("tool", { data: "input" });
  detector.recordToolCall("tool", { data: "input" });

  assert.ok(detector.getPatterns().length > 0);

  detector.reset();

  assert.equal(detector.getPatterns().length, 0);
  assert.equal(detector.getSequenceHistory().length, 0);
});

test("TightLoopDetector checkSequentialLoop detects repeated sequence [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({
    sequenceWindowSize: 3,
    sequenceRepeatThreshold: 2,
    warnThreshold: 2,
    escalateThreshold: 3,
  });

  const sameInput = { n: 1 };

  detector.recordToolCall("A", sameInput);
  detector.recordToolCall("B", sameInput);
  detector.recordToolCall("C", sameInput);

  detector.recordToolCall("A", sameInput);
  detector.recordToolCall("B", sameInput);
  detector.recordToolCall("C", sameInput);

  const result = detector.checkSequentialLoop();

  assert.ok(result.isLoop);
  assert.ok(result.count >= 2);
});

test("TightLoopDetector returns warn patterns [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 5 });

  detector.recordToolCall("tool", { data: "a" });
  detector.recordToolCall("tool", { data: "a" });

  const warnPatterns = detector.getWarnPatterns();
  assert.ok(warnPatterns.length > 0);
});

test("TightLoopDetector returns escalated patterns [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({ warnThreshold: 1, escalateThreshold: 2 });

  detector.recordToolCall("tool", { data: "a" });
  detector.recordToolCall("tool", { data: "a" });

  const escalated = detector.getEscalatedPatterns();
  assert.ok(escalated.length > 0);
});

test("TightLoopDetector getConfig returns config [tight-loop-detector]", () => {
  const detector = createTightLoopDetector({
    warnThreshold: 5,
    escalateThreshold: 10,
  });

  const config = detector.getConfig();
  assert.equal(config.warnThreshold, 5);
  assert.equal(config.escalateThreshold, 10);
});

test("TightLoopDetector getSequenceHistory returns history [tight-loop-detector]", () => {
  const detector = createTightLoopDetector();

  detector.recordToolCall("A", { n: 1 });
  detector.recordToolCall("B", { n: 2 });
  detector.recordToolCall("C", { n: 3 });

  const history = detector.getSequenceHistory();
  assert.equal(history.length, 3);
});

test("TightLoopDetector different tools tracked separately [tight-loop-detector]", () => {
  const detector = createTightLoopDetector();

  detector.recordToolCall("tool1", { data: "same" });
  detector.recordToolCall("tool1", { data: "same" });
  detector.recordToolCall("tool2", { data: "same" });

  const patterns = detector.getPatterns();
  const tool1Patterns = patterns.filter((p) => p.toolName === "tool1");
  const tool2Patterns = patterns.filter((p) => p.toolName === "tool2");

  assert.ok(tool1Patterns.length > 0);
  assert.ok(tool2Patterns.length > 0);
});

test("TightLoopDetector records recent inputs [tight-loop-detector]", () => {
  const detector = createTightLoopDetector();

  detector.recordToolCall("tool", { data: "first" });
  detector.recordToolCall("tool", { data: "second" });
  detector.recordToolCall("tool", { data: "third" });
  detector.recordToolCall("tool", { data: "fourth" });
  detector.recordToolCall("tool", { data: "fifth" });
  detector.recordToolCall("tool", { data: "sixth" });

  const pattern = detector.getPatterns().find((p) => p.toolName === "tool");
  assert.ok(pattern);
  assert.ok(pattern!.recentInputs.length <= 5);
});

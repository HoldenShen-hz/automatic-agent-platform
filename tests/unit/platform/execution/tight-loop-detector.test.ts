import assert from "node:assert/strict";
import test from "node:test";

import { TightLoopDetector, createTightLoopDetector } from "../../../../src/platform/five-plane-execution/execution-engine/tight-loop-detector.js";

test("TightLoopDetector returns continue on first call", () => {
  const detector = new TightLoopDetector();

  const result = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "continue");
  assert.equal(result.pattern, null);
  assert.equal(result.patternType, null);
});

test("TightLoopDetector returns warn when warnThreshold is reached", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  const result = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "warn");
  assert.ok(result.pattern != null);
  assert.equal(result.pattern!.count, 3);
  assert.equal(result.patternType, "exact");
});

test("TightLoopDetector returns escalate when escalateThreshold is reached", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  for (let i = 0; i < 5; i++) {
    detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  }

  const result = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.equal(result.action, "escalate");
  assert.ok(result.pattern != null);
  assert.equal(result.pattern!.count, 6);
  assert.equal(result.pattern!.escalated, true);
});

test("TightLoopDetector uses default thresholds (warn=3, escalate=5)", () => {
  const detector = new TightLoopDetector();

  for (let i = 0; i < 3; i++) {
    const result = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
    if (i < 2) assert.equal(result.action, "continue");
    else assert.equal(result.action, "warn");
  }

  for (let i = 0; i < 2; i++) {
    detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  }

  const escalateResult = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(escalateResult.action, "escalate");
});

test("TightLoopDetector tracks different tool names separately", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  // Call read_file 2 times
  detector.recordToolCall("read_file", { path: "/tmp/read.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/read.txt" });

  // Call write_file 4 times - should warn but not escalate
  for (let i = 0; i < 4; i++) {
    detector.recordToolCall("write_file", { path: "/tmp/write.txt" });
  }

  // read_file should be at count 3 and warn
  const readResult = detector.recordToolCall("read_file", { path: "/tmp/read.txt" });
  assert.equal(readResult.action, "warn");
  assert.equal(readResult.pattern!.count, 3);

  // write_file should be at count 5 and escalate
  const writeResult = detector.recordToolCall("write_file", { path: "/tmp/write.txt" });
  assert.equal(writeResult.action, "escalate");
  assert.equal(writeResult.pattern!.count, 5);
});

test("TightLoopDetector normalizes string inputs", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("search", "  hello world  ");
  const result = detector.recordToolCall("search", "HELLO WORLD");

  assert.equal(result.action, "warn");
  assert.equal(result.patternType, "exact");
});

test("TightLoopDetector normalizes object inputs by key order", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("search", { a: 1, b: 2 });
  const result = detector.recordToolCall("search", { b: 2, a: 1 });

  assert.equal(result.action, "warn");
  assert.equal(result.patternType, "exact");
});

test("TightLoopDetector detects similar patterns separately from exact", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  // Exact same call 3 times - exact pattern
  detector.recordToolCall("search", { query: "hello world" });
  detector.recordToolCall("search", { query: "hello world" });
  const exactResult = detector.recordToolCall("search", { query: "hello world" });
  assert.equal(exactResult.patternType, "exact");
  assert.equal(exactResult.action, "warn");

  // The similar pattern is detected when the same tool+similar input is called multiple times
  // Different word order but same words triggers similarity
  detector.recordToolCall("search", { query: "world hello" }); // Same words, different order
  detector.recordToolCall("search", { query: "hello world" }); // Same as first
  const similarResult = detector.recordToolCall("search", { query: "world hello" }); // Similar to above

  // This should return a similar pattern since we called with same tool and similar inputs
  assert.ok(similarResult.pattern != null);
});

test("TightLoopDetector getPatterns returns all tracked patterns", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  detector.recordToolCall("read_file", { path: "/tmp/a.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/b.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/c.txt" });

  const patterns = detector.getPatterns();
  assert.ok(patterns.length >= 3);
});

test("TightLoopDetector getEscalatedPatterns returns only escalated", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  // Create an exact pattern that escalates
  for (let i = 0; i < 3; i++) {
    detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  }
  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  // Create a warn pattern that doesn't escalate
  detector.recordToolCall("write_file", { path: "/tmp/test.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/test.txt" });

  const escalated = detector.getEscalatedPatterns();
  assert.equal(escalated.length, 1);
  assert.equal(escalated[0]!.toolName, "read_file");
});

test("TightLoopDetector getWarnPatterns returns non-escalated patterns at warn threshold", () => {
  const detector = new TightLoopDetector({ warnThreshold: 3, escalateThreshold: 5 });

  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  const warnPatterns = detector.getWarnPatterns();
  assert.equal(warnPatterns.length, 1);
});

test("TightLoopDetector reset clears all patterns", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  detector.recordToolCall("read_file", { path: "/tmp/test.txt" });

  assert.ok(detector.getPatterns().length > 0);

  detector.reset();

  assert.equal(detector.getPatterns().length, 0);
  const result = detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
  assert.equal(result.action, "continue");
  assert.equal(result.pattern, null);
});

test("TightLoopDetector getConfig returns configuration", () => {
  const detector = new TightLoopDetector({
    warnThreshold: 4,
    escalateThreshold: 8,
    similarInputThreshold: 0.9,
    sequenceWindowSize: 10,
    sequenceRepeatThreshold: 4,
  });

  const config = detector.getConfig();
  assert.equal(config.warnThreshold, 4);
  assert.equal(config.escalateThreshold, 8);
  assert.equal(config.similarInputThreshold, 0.9);
  assert.equal(config.sequenceWindowSize, 10);
  assert.equal(config.sequenceRepeatThreshold, 4);
});

test("TightLoopDetector checkSequentialLoop returns continue when window not filled", () => {
  const detector = new TightLoopDetector({ sequenceWindowSize: 5, sequenceRepeatThreshold: 3 });

  detector.recordToolCall("read_file", { path: "/tmp/a.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/b.txt" });

  const result = detector.checkSequentialLoop();
  assert.equal(result.isLoop, false);
  assert.equal(result.action, "continue");
});

test("TightLoopDetector checkSequentialLoop detects repeated sequence", () => {
  const detector = new TightLoopDetector({ sequenceWindowSize: 3, sequenceRepeatThreshold: 2, warnThreshold: 100, escalateThreshold: 200 });

  // First sequence: read, write, delete (with same inputs)
  detector.recordToolCall("read_file", { path: "/tmp/a.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/b.txt" });
  detector.recordToolCall("delete_file", { path: "/tmp/c.txt" });

  // Second sequence: read, write, delete (repeat with same inputs)
  detector.recordToolCall("read_file", { path: "/tmp/a.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/b.txt" });
  detector.recordToolCall("delete_file", { path: "/tmp/c.txt" });

  const result = detector.checkSequentialLoop();
  assert.equal(result.isLoop, true);
  assert.equal(result.count, 2);
  // Sequence includes the tool name and hash
  assert.equal(result.sequence.length, 3);
});

test("TightLoopDetector checkSequentialLoop escalates at threshold", () => {
  const detector = new TightLoopDetector({ sequenceWindowSize: 2, sequenceRepeatThreshold: 2, warnThreshold: 100, escalateThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    detector.recordToolCall("read_file", { path: "/tmp/test.txt" });
    detector.recordToolCall("write_file", { path: "/tmp/test.txt" });
  }

  const result = detector.checkSequentialLoop();
  assert.equal(result.isLoop, true);
  assert.equal(result.count, 3);
  assert.equal(result.action, "escalate");
});

test("TightLoopDetector getSequenceHistory returns copy of sequence", () => {
  const detector = new TightLoopDetector();

  detector.recordToolCall("read_file", { path: "/tmp/a.txt" });
  detector.recordToolCall("write_file", { path: "/tmp/b.txt" });

  const history = detector.getSequenceHistory();
  assert.equal(history.length, 2);

  // Modify returned array - should not affect internal state
  history.push("fake_entry");
  assert.equal(detector.getSequenceHistory().length, 2);
});

test("TightLoopDetector tracks recentInputs (capped at 5)", () => {
  const detector = new TightLoopDetector({ warnThreshold: 10, escalateThreshold: 20 });

  for (let i = 0; i < 10; i++) {
    detector.recordToolCall("read_file", { path: `/tmp/file${i}.txt` });
  }

  const patterns = detector.getPatterns();
  const exactPattern = patterns.find((p) => p.patternType === "exact");
  assert.ok(exactPattern != null);
  assert.ok(exactPattern!.recentInputs.length <= 5);
});

test("TightLoopDetector handles null and undefined inputs", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("process", null);
  const result = detector.recordToolCall("process", null);

  assert.equal(result.action, "warn");
});

test("TightLoopDetector handles numeric inputs", () => {
  const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });

  detector.recordToolCall("calculate", 42);
  detector.recordToolCall("calculate", 42);

  const result = detector.recordToolCall("calculate", 42);
  assert.equal(result.action, "escalate");
});

test("createTightLoopDetector factory creates detector with config", () => {
  const detector = createTightLoopDetector({ warnThreshold: 5, escalateThreshold: 10 });

  for (let i = 0; i < 5; i++) {
    const result = detector.recordToolCall("test", { value: "same" });
    if (i < 4) assert.equal(result.action, "continue");
    else assert.equal(result.action, "warn");
  }
});

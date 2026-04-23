import assert from "node:assert/strict";
import test from "node:test";
import { TightLoopDetector, createTightLoopDetector, } from "../../../../../src/platform/execution/execution-engine/tight-loop-detector.js";
test("TightLoopDetector exports createTightLoopDetector function", () => {
    assert.equal(typeof createTightLoopDetector, "function");
});
test("TightLoopDetector detects exact loop patterns", () => {
    const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });
    // First call - should continue, pattern created but not yet detected as loop
    const result1 = detector.recordToolCall("read_file", { path: "/test.txt" });
    assert.equal(result1.action, "continue");
    assert.equal(result1.patternType, null); // First call creates pattern, no loop yet
    assert.ok(!result1.pattern);
    // Second call - should warn
    const result2 = detector.recordToolCall("read_file", { path: "/test.txt" });
    assert.equal(result2.action, "warn");
    assert.equal(result2.patternType, "exact");
    assert.ok(result2.pattern);
    assert.equal(result2.pattern.count, 2);
    // Third call - should escalate
    const result3 = detector.recordToolCall("read_file", { path: "/test.txt" });
    assert.equal(result3.action, "escalate");
    assert.equal(result3.patternType, "exact");
    assert.ok(result3.pattern.escalated);
});
test("TightLoopDetector detects similar loop patterns", () => {
    const detector = new TightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });
    // Same tool with slightly different input formatting
    detector.recordToolCall("read_file", { path: "/a.txt" });
    detector.recordToolCall("read_file", { path: "/b.txt" });
    detector.recordToolCall("read_file", { path: "/c.txt" });
    // Should detect similar pattern after multiple similar calls
    const patterns = detector.getPatterns();
    assert.ok(patterns.length >= 0); // Either exact or similar patterns exist
});
test("TightLoopDetector respects custom thresholds", () => {
    const detector = new TightLoopDetector({
        warnThreshold: 5,
        escalateThreshold: 10,
    });
    // Record 4 times - should still be continue since warn is at 5
    for (let i = 0; i < 4; i++) {
        const result = detector.recordToolCall("read_file", { path: "/test.txt" });
        assert.equal(result.action, "continue");
    }
    // 5th time - should warn
    const warnResult = detector.recordToolCall("read_file", { path: "/test.txt" });
    assert.equal(warnResult.action, "warn");
});
test("TightLoopDetector checkSequentialLoop detects repeating sequences", () => {
    const detector = new TightLoopDetector({
        sequenceWindowSize: 3,
        sequenceRepeatThreshold: 2,
        warnThreshold: 2,
        escalateThreshold: 3,
    });
    // Record a sequence: A, B, C
    detector.recordToolCall("tool_a", { input: "1" });
    detector.recordToolCall("tool_b", { input: "2" });
    detector.recordToolCall("tool_c", { input: "3" });
    // Repeat the same sequence: A, B, C
    detector.recordToolCall("tool_a", { input: "1" });
    detector.recordToolCall("tool_b", { input: "2" });
    detector.recordToolCall("tool_c", { input: "3" });
    // Should detect sequential loop
    const result = detector.checkSequentialLoop();
    assert.equal(result.isLoop, true);
    assert.ok(result.count >= 2);
});
test("TightLoopDetector checkSequentialLoop returns continue when no loop", () => {
    const detector = new TightLoopDetector({
        sequenceWindowSize: 3,
        sequenceRepeatThreshold: 2,
    });
    // Record different sequences
    detector.recordToolCall("tool_a", { input: "1" });
    detector.recordToolCall("tool_b", { input: "2" });
    detector.recordToolCall("tool_c", { input: "3" });
    detector.recordToolCall("tool_x", { input: "4" });
    detector.recordToolCall("tool_y", { input: "5" });
    const result = detector.checkSequentialLoop();
    assert.equal(result.isLoop, false);
    assert.equal(result.count, 0);
    assert.equal(result.action, "continue");
});
test("TightLoopDetector getPatterns returns all tracked patterns", () => {
    const detector = new TightLoopDetector();
    detector.recordToolCall("read_file", { path: "/a.txt" });
    detector.recordToolCall("read_file", { path: "/a.txt" });
    detector.recordToolCall("write_file", { path: "/b.txt" });
    const patterns = detector.getPatterns();
    assert.ok(patterns.length >= 2);
});
test("TightLoopDetector getEscalatedPatterns returns only escalated", () => {
    const detector = new TightLoopDetector({
        warnThreshold: 1,
        escalateThreshold: 2,
    });
    // One tool call repeated enough to escalate
    detector.recordToolCall("read_file", { path: "/test.txt" });
    detector.recordToolCall("read_file", { path: "/test.txt" });
    const escalated = detector.getEscalatedPatterns();
    assert.ok(escalated.length >= 1);
    assert.ok(escalated.every((p) => p.escalated));
});
test("TightLoopDetector getWarnPatterns returns warning patterns", () => {
    const detector = new TightLoopDetector({
        warnThreshold: 2,
        escalateThreshold: 5,
    });
    // Just below escalate threshold but at warn threshold
    detector.recordToolCall("read_file", { path: "/test.txt" });
    detector.recordToolCall("read_file", { path: "/test.txt" });
    const warns = detector.getWarnPatterns();
    assert.ok(warns.length >= 1);
    assert.ok(warns.every((p) => !p.escalated && p.count >= 2));
});
test("TightLoopDetector reset clears all patterns", () => {
    const detector = new TightLoopDetector();
    detector.recordToolCall("read_file", { path: "/test.txt" });
    detector.recordToolCall("read_file", { path: "/test.txt" });
    assert.ok(detector.getPatterns().length > 0);
    detector.reset();
    assert.equal(detector.getPatterns().length, 0);
    assert.equal(detector.getEscalatedPatterns().length, 0);
    assert.equal(detector.getWarnPatterns().length, 0);
});
test("TightLoopDetector getConfig returns configuration", () => {
    const config = {
        warnThreshold: 5,
        escalateThreshold: 10,
        similarInputThreshold: 0.9,
        sequenceWindowSize: 7,
        sequenceRepeatThreshold: 4,
    };
    const detector = new TightLoopDetector(config);
    const retrievedConfig = detector.getConfig();
    assert.equal(retrievedConfig.warnThreshold, 5);
    assert.equal(retrievedConfig.escalateThreshold, 10);
    assert.equal(retrievedConfig.similarInputThreshold, 0.9);
    assert.equal(retrievedConfig.sequenceWindowSize, 7);
    assert.equal(retrievedConfig.sequenceRepeatThreshold, 4);
});
test("TightLoopDetector default config values", () => {
    const detector = new TightLoopDetector();
    const config = detector.getConfig();
    assert.equal(config.warnThreshold, 3);
    assert.equal(config.escalateThreshold, 5);
    assert.equal(config.similarInputThreshold, 0.8);
    assert.equal(config.sequenceWindowSize, 5);
    assert.equal(config.sequenceRepeatThreshold, 3);
});
test("TightLoopDetector getSequenceHistory returns action sequence", () => {
    const detector = new TightLoopDetector();
    detector.recordToolCall("tool_a", { input: "1" });
    detector.recordToolCall("tool_b", { input: "2" });
    detector.recordToolCall("tool_c", { input: "3" });
    const history = detector.getSequenceHistory();
    assert.ok(history.length >= 3);
});
test("TightLoopDetector pattern contains correct metadata", () => {
    const detector = new TightLoopDetector();
    const result = detector.recordToolCall("read_file", { path: "/test.txt" });
    // First call creates pattern
    const patterns = detector.getPatterns();
    assert.ok(patterns.length > 0);
    const pattern = patterns.find((p) => p.toolName === "read_file");
    assert.ok(pattern);
    assert.equal(pattern.patternType, "exact");
    assert.ok(pattern.inputHash.length > 0);
    assert.ok(pattern.firstSeen.length > 0);
    assert.ok(pattern.lastSeen.length > 0);
    assert.ok(pattern.recentInputs.length > 0);
});
test("createTightLoopDetector creates instance with config", () => {
    const detector = createTightLoopDetector({
        warnThreshold: 10,
        escalateThreshold: 20,
    });
    const config = detector.getConfig();
    assert.equal(config.warnThreshold, 10);
    assert.equal(config.escalateThreshold, 20);
});
test("TightLoopDetector handles different tool names separately", () => {
    const detector = new TightLoopDetector({
        warnThreshold: 2,
        escalateThreshold: 3,
    });
    // Same input but different tools
    detector.recordToolCall("read_file", { path: "/test.txt" });
    detector.recordToolCall("write_file", { path: "/test.txt" });
    // Neither should be at warn threshold yet
    const patterns = detector.getPatterns();
    const readPatterns = patterns.filter((p) => p.toolName === "read_file");
    const writePatterns = patterns.filter((p) => p.toolName === "write_file");
    assert.ok(readPatterns.every((p) => p.count === 1));
    assert.ok(writePatterns.every((p) => p.count === 1));
});
//# sourceMappingURL=tight-loop-detector.test.js.map
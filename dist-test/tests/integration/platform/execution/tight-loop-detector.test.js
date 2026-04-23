import test from "node:test";
import assert from "node:assert/strict";
import { createTightLoopDetector, } from "../../../../src/platform/execution/execution-engine/tight-loop-detector.js";
test("TightLoopDetector sandbox: single tool repeat detection", () => {
    const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 4 });
    const r1 = detector.recordToolCall("edit_replace", { file: "/tmp/x.txt" });
    assert.equal(r1.action, "continue");
    const r2 = detector.recordToolCall("edit_replace", { file: "/tmp/x.txt" });
    assert.ok(r2.action === "continue" || r2.action === "warn");
    const r3 = detector.recordToolCall("edit_replace", { file: "/tmp/x.txt" });
    assert.ok(r3.action === "warn" || r3.action === "escalate");
});
test("TightLoopDetector sandbox: pattern tracking across tools", () => {
    const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });
    detector.recordToolCall("toolA", { data: "same" });
    detector.recordToolCall("toolB", { data: "same" });
    detector.recordToolCall("toolA", { data: "same" });
    const patterns = detector.getPatterns();
    const toolAPatterns = patterns.filter((p) => p.toolName === "toolA");
    assert.ok(toolAPatterns.length > 0);
});
test("TightLoopDetector sandbox: sequence history preserved", () => {
    const detector = createTightLoopDetector();
    detector.recordToolCall("step1", { id: 1 });
    detector.recordToolCall("step2", { id: 2 });
    detector.recordToolCall("step3", { id: 3 });
    const history = detector.getSequenceHistory();
    assert.equal(history.length, 3);
});
test("TightLoopDetector sandbox: reset clears all state", () => {
    const detector = createTightLoopDetector();
    detector.recordToolCall("tool", { data: "input" });
    detector.recordToolCall("tool", { data: "input" });
    assert.ok(detector.getPatterns().length > 0);
    detector.reset();
    assert.equal(detector.getPatterns().length, 0);
    assert.equal(detector.getSequenceHistory().length, 0);
});
test("TightLoopDetector sandbox: escalation triggers at threshold", () => {
    const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 3 });
    detector.recordToolCall("repeat_tool", { same: "input" });
    detector.recordToolCall("repeat_tool", { same: "input" });
    const r3 = detector.recordToolCall("repeat_tool", { same: "input" });
    assert.ok(r3.action === "escalate" || r3.action === "warn");
});
test("TightLoopDetector sandbox: getConfig reflects settings", () => {
    const detector = createTightLoopDetector({
        warnThreshold: 10,
        escalateThreshold: 20,
        sequenceWindowSize: 7,
    });
    const config = detector.getConfig();
    assert.equal(config.warnThreshold, 10);
    assert.equal(config.escalateThreshold, 20);
    assert.equal(config.sequenceWindowSize, 7);
});
test("TightLoopDetector sandbox: similar inputs detected", () => {
    const detector = createTightLoopDetector();
    detector.recordToolCall("search", { query: "apple" });
    detector.recordToolCall("search", { query: "apples" });
    detector.recordToolCall("search", { query: "apple sauce" });
    const patterns = detector.getPatterns();
    assert.ok(patterns.length > 0);
});
test("TightLoopDetector sandbox: warn patterns returned", () => {
    const detector = createTightLoopDetector({ warnThreshold: 2, escalateThreshold: 5 });
    detector.recordToolCall("loop_tool", { x: 1 });
    detector.recordToolCall("loop_tool", { x: 1 });
    const warns = detector.getWarnPatterns();
    assert.ok(warns.length > 0);
});
test("TightLoopDetector sandbox: escalated patterns returned", () => {
    const detector = createTightLoopDetector({ warnThreshold: 1, escalateThreshold: 2 });
    detector.recordToolCall("bad_loop", { data: "a" });
    detector.recordToolCall("bad_loop", { data: "a" });
    const escalated = detector.getEscalatedPatterns();
    assert.ok(escalated.length > 0);
});
test("TightLoopDetector sandbox: recentInputs limited to 5", () => {
    const detector = createTightLoopDetector();
    for (let i = 0; i < 10; i++) {
        detector.recordToolCall("tool", { iteration: i });
    }
    const patterns = detector.getPatterns();
    for (const p of patterns) {
        assert.ok(p.recentInputs.length <= 5);
    }
});
//# sourceMappingURL=tight-loop-detector.test.js.map
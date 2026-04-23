import assert from "node:assert/strict";
import test from "node:test";
import { normalizeToolInputForHash, hashToolCall, LoopDetectionState, createLoopDetectionMiddleware, createLoopDetectionMiddlewareFull, SequenceLoopDetector, } from "../../../../../src/platform/execution/execution-engine/loop-detection.js";
test("normalizeToolInputForHash handles null", () => {
    assert.equal(normalizeToolInputForHash(null), "null");
});
test("normalizeToolInputForHash handles undefined", () => {
    assert.equal(normalizeToolInputForHash(undefined), "null");
});
test("normalizeToolInputForHash handles string", () => {
    assert.equal(normalizeToolInputForHash("Hello World"), "hello world");
});
test("normalizeToolInputForHash trims string", () => {
    assert.equal(normalizeToolInputForHash("  Hello  "), "hello");
});
test("normalizeToolInputForHash handles object", () => {
    const result = normalizeToolInputForHash({ b: 2, a: 1 });
    assert.equal(result, '{"a":1,"b":2}');
});
test("normalizeToolInputForHash handles number", () => {
    assert.equal(normalizeToolInputForHash(42), "42");
});
test("normalizeToolInputForHash handles boolean", () => {
    assert.equal(normalizeToolInputForHash(true), "true");
});
test("hashToolCall generates consistent hash", () => {
    const hash1 = hashToolCall("read_file", { path: "/tmp/test.txt" });
    const hash2 = hashToolCall("read_file", { path: "/tmp/test.txt" });
    assert.equal(hash1, hash2, "Same input should produce same hash");
});
test("hashToolCall generates different hash for different input", () => {
    const hash1 = hashToolCall("read_file", { path: "/tmp/a.txt" });
    const hash2 = hashToolCall("read_file", { path: "/tmp/b.txt" });
    assert.notEqual(hash1, hash2, "Different input should produce different hash");
});
test("hashToolCall generates different hash for different tool", () => {
    const hash1 = hashToolCall("tool_a", { x: 1 });
    const hash2 = hashToolCall("tool_b", { x: 1 });
    assert.notEqual(hash1, hash2, "Different tool should produce different hash");
});
test("hashToolCall returns 16 character hex string", () => {
    const hash = hashToolCall("test_tool", { arg: "value" });
    assert.equal(hash.length, 16, "Hash should be 16 characters");
    assert.match(hash, /^[0-9a-f]{16}$/, "Hash should be hex string");
});
test("LoopDetectionState records tool call and returns continue", () => {
    const state = new LoopDetectionState();
    const result = state.recordToolCall("test_tool", { arg: "value" });
    assert.equal(result.action, "continue", "First call should return continue");
    assert.equal(result.pattern.count, 1, "Count should be 1");
});
test("LoopDetectionState returns warn at threshold", () => {
    const state = new LoopDetectionState({ warnThreshold: 3 });
    const args = { path: "/tmp/test.txt" };
    state.recordToolCall("read_file", args); // count = 1
    state.recordToolCall("read_file", args); // count = 2
    const result = state.recordToolCall("read_file", args); // count = 3
    assert.equal(result.action, "warn", "Should return warn at threshold");
    assert.equal(result.pattern.count, 3, "Count should be 3");
});
test("LoopDetectionState returns escalate at threshold", () => {
    const state = new LoopDetectionState({ escalateThreshold: 5 });
    const args = { path: "/tmp/test.txt" };
    for (let i = 0; i < 4; i++) {
        state.recordToolCall("read_file", args);
    }
    const result = state.recordToolCall("read_file", args); // count = 5
    assert.equal(result.action, "escalate", "Should return escalate at threshold");
    assert.equal(result.pattern.count, 5, "Count should be 5");
    assert.equal(result.pattern.escalated, true, "Pattern should be marked escalated");
});
test("LoopDetectionState getPatterns returns all patterns", () => {
    const state = new LoopDetectionState();
    state.recordToolCall("tool_a", { x: 1 });
    state.recordToolCall("tool_b", { y: 2 });
    const patterns = state.getPatterns();
    assert.equal(patterns.length, 2, "Should have 2 patterns");
});
test("LoopDetectionState getEscalatedPatterns returns only escalated", () => {
    const state = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });
    // Tool A reaches escalate
    state.recordToolCall("tool_a", { x: 1 });
    state.recordToolCall("tool_a", { x: 1 });
    state.recordToolCall("tool_a", { x: 1 });
    // Tool B stays at warn
    state.recordToolCall("tool_b", { y: 1 });
    state.recordToolCall("tool_b", { y: 1 });
    const escalated = state.getEscalatedPatterns();
    assert.equal(escalated.length, 1, "Should have 1 escalated pattern");
    assert.equal(escalated[0].toolName, "tool_a");
});
test("LoopDetectionState getRepeatCount returns correct count", () => {
    const state = new LoopDetectionState();
    const args = { path: "/test" };
    state.recordToolCall("read_file", args);
    state.recordToolCall("read_file", args);
    state.recordToolCall("read_file", args);
    assert.equal(state.getRepeatCount("read_file", args), 3);
    assert.equal(state.getRepeatCount("write_file", args), 0);
});
test("LoopDetectionState wouldEscalate returns correct boolean", () => {
    const state = new LoopDetectionState({ escalateThreshold: 3 });
    assert.equal(state.wouldEscalate("tool", { x: 1 }), false);
    state.recordToolCall("tool", { x: 1 });
    state.recordToolCall("tool", { x: 1 });
    state.recordToolCall("tool", { x: 1 });
    assert.equal(state.wouldEscalate("tool", { x: 1 }), true);
    assert.equal(state.wouldEscalate("tool", { x: 2 }), false);
});
test("LoopDetectionState reset clears all patterns", () => {
    const state = new LoopDetectionState();
    state.recordToolCall("tool_a", { x: 1 });
    state.recordToolCall("tool_b", { y: 2 });
    assert.equal(state.getPatterns().length, 2);
    state.reset();
    assert.equal(state.getPatterns().length, 0);
});
test("LoopDetectionState removePattern removes specific pattern", () => {
    const state = new LoopDetectionState();
    const args1 = { path: "/a" };
    const args2 = { path: "/b" };
    state.recordToolCall("read_file", args1);
    state.recordToolCall("read_file", args2);
    state.recordToolCall("write_file", args1);
    assert.equal(state.getPatterns().length, 3);
    state.removePattern("read_file", args1);
    assert.equal(state.getPatterns().length, 2);
    assert.equal(state.getRepeatCount("read_file", args1), 0);
    assert.equal(state.getRepeatCount("read_file", args2), 1);
});
test("LoopDetectionState getConfig returns configuration", () => {
    const config = {
        warnThreshold: 2,
        escalateThreshold: 5,
        askAtWarn: true,
        terminateAtEscalate: false,
    };
    const state = new LoopDetectionState(config);
    const retrievedConfig = state.getConfig();
    assert.equal(retrievedConfig.warnThreshold, 2);
    assert.equal(retrievedConfig.escalateThreshold, 5);
    assert.equal(retrievedConfig.askAtWarn, true);
    assert.equal(retrievedConfig.terminateAtEscalate, false);
});
test("LoopDetectionState uses custom hash function", () => {
    const customHashFn = (toolName, input) => `custom_${toolName}_${JSON.stringify(input)}`;
    const state = new LoopDetectionState({ hashFn: customHashFn });
    const { pattern, action } = state.recordToolCall("test_tool", { arg: "value" });
    assert.equal(action, "continue");
    assert.ok(pattern.inputHash.startsWith("custom_"), "Should use custom hash function");
});
test("createLoopDetectionMiddleware creates middleware and state", () => {
    const { middleware, state } = createLoopDetectionMiddleware();
    assert.ok(middleware, "Should return middleware");
    assert.ok(middleware.name, "middleware should have name");
    assert.ok(state instanceof LoopDetectionState, "Should return LoopDetectionState instance");
});
test("createLoopDetectionMiddleware runs before_agent hook", async () => {
    const { middleware, state } = createLoopDetectionMiddleware();
    // No loops detected yet, should succeed
    const result = await middleware.run({ runtime: { traceId: "test", taskId: "task_1" }, chainStartedAt: "", agentRound: 0, stepId: null, executionId: null, taskId: "task_1" }, { request: "test request", history: [] });
    assert.equal(result.success, true);
});
test("createLoopDetectionMiddlewareFull creates beforeAgent and wrapToolCall hooks", () => {
    const { beforeAgent, wrapToolCall, state } = createLoopDetectionMiddlewareFull();
    assert.ok(beforeAgent, "should have beforeAgent hook");
    assert.ok(wrapToolCall, "should have wrapToolCall hook");
    assert.ok(state instanceof LoopDetectionState, "should have state");
});
test("createLoopDetectionMiddlewareFull beforeAgent blocks escalated patterns", async () => {
    const { beforeAgent, state } = createLoopDetectionMiddlewareFull({ escalateThreshold: 2 });
    // Escalate the pattern
    state.recordToolCall("bad_tool", { x: 1 });
    state.recordToolCall("bad_tool", { x: 1 });
    const result = await beforeAgent.run({ runtime: { traceId: "test", taskId: "task_1" }, chainStartedAt: "", agentRound: 0, stepId: null, executionId: null, taskId: "task_1" }, { request: "test", history: [] });
    assert.equal(result.success, false);
    assert.ok(result.error?.code.includes("loop_detection.escalated"));
});
test("createLoopDetectionMiddlewareFull wrapToolCall throws on escalation", async () => {
    const { wrapToolCall, state } = createLoopDetectionMiddlewareFull({ escalateThreshold: 2 });
    // Build up to escalation
    state.recordToolCall("bad_tool", { x: 1 });
    state.recordToolCall("bad_tool", { x: 1 });
    await assert.rejects(async () => {
        await wrapToolCall.run({ runtime: { traceId: "test", taskId: "task_1" }, chainStartedAt: "", agentRound: 0, stepId: null, executionId: null, taskId: "task_1" }, { toolName: "bad_tool", args: { x: 1 } }, async () => "should not reach here");
    }, (error) => {
        assert.equal(error instanceof Error, true);
        assert.match(String(error.code ?? ""), /loop_detection\.escalated/);
        assert.match(error.message, /Tool bad_tool repeated 3 times/);
        return true;
    }, "Should throw on escalated tool call");
});
test("SequenceLoopDetector records actions and detects loops", () => {
    const detector = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });
    const result1 = detector.recordAction("read");
    assert.equal(result1.isLoop, false);
    const result2 = detector.recordAction("write");
    assert.equal(result2.isLoop, false);
    const result3 = detector.recordAction("read");
    assert.equal(result3.isLoop, false);
    // Repeat the original 3-action window once more.
    const result4 = detector.recordAction("write");
    assert.equal(result4.isLoop, false);
    const result5 = detector.recordAction("read");
    assert.equal(result5.isLoop, true, "Should detect sequence loop");
    assert.deepEqual(result5.sequence, ["read", "write", "read"]);
    assert.equal(result5.count, 2);
});
test("SequenceLoopDetector getHistory returns action history", () => {
    const detector = new SequenceLoopDetector();
    detector.recordAction("a");
    detector.recordAction("b");
    detector.recordAction("c");
    const history = detector.getHistory();
    assert.deepEqual(history, ["a", "b", "c"]);
});
test("SequenceLoopDetector reset clears state", () => {
    const detector = new SequenceLoopDetector();
    detector.recordAction("x");
    detector.recordAction("y");
    assert.equal(detector.getHistory().length, 2);
    detector.reset();
    assert.deepEqual(detector.getHistory(), []);
});
test("SequenceLoopDetector handles window overflow", () => {
    const detector = new SequenceLoopDetector({ windowSize: 2, repeatThreshold: 2 });
    for (let i = 0; i < 10; i++) {
        detector.recordAction(`action_${i % 3}`);
    }
    // Should handle large history without issues
    const history = detector.getHistory();
    assert.ok(history.length <= 4, "History should be bounded by window size * 2");
});
test("LoopDetectionState with default config", () => {
    const state = new LoopDetectionState();
    assert.equal(state.getConfig().warnThreshold, 3);
    assert.equal(state.getConfig().escalateThreshold, 5);
    assert.equal(state.getConfig().askAtWarn, true);
    assert.equal(state.getConfig().terminateAtEscalate, true);
});
test("LoopPattern interface structure", () => {
    const state = new LoopDetectionState();
    const result = state.recordToolCall("test_tool", { arg: "value" });
    const pattern = result.pattern;
    assert.ok(typeof pattern.toolName === "string");
    assert.ok(typeof pattern.inputHash === "string");
    assert.ok(typeof pattern.inputSummary === "string");
    assert.ok(typeof pattern.count === "number");
    assert.ok(typeof pattern.firstSeen === "string");
    assert.ok(typeof pattern.lastSeen === "string");
    assert.ok(typeof pattern.escalated === "boolean");
});
//# sourceMappingURL=loop-detection.test.js.map
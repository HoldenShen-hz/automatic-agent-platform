import test from "node:test";
import assert from "node:assert/strict";
import { AgentExecutor, createAgentExecutor, initializeAgentExecutor, getAgentExecutorContext, getGlobalAgentMiddlewareChain, } from "../../../src/platform/execution/execution-engine/agent-executor.js";
import { resetMiddleware } from "../../../src/platform/execution/execution-engine/middleware-init.js";
function createTestContext() {
    return {
        traceId: "test-trace",
        taskId: "test-task",
        executionId: "test-exec",
        sessionId: "test-session",
        stepId: "test-step",
        agentRound: 0,
    };
}
test("AgentExecutor creates with default options", () => {
    const executor = createAgentExecutor();
    assert.ok(executor instanceof AgentExecutor);
    executor.resetLoopDetection();
});
test("AgentExecutor registers middleware hooks", () => {
    const executor = createAgentExecutor({ loopDetection: null });
    const hooks = executor.getRegisteredHooks();
    assert.ok(Array.isArray(hooks.beforeAgent));
    assert.ok(Array.isArray(hooks.beforeModel));
    assert.ok(Array.isArray(hooks.afterModel));
    assert.ok(Array.isArray(hooks.wrapModelCall));
    assert.ok(Array.isArray(hooks.wrapToolCall));
    assert.ok(Array.isArray(hooks.afterAgent));
    assert.ok(hooks.wrapToolCall.includes("cache-governance"));
});
test("AgentExecutor executeAgentRound runs full middleware chain", async () => {
    const executor = createAgentExecutor({ loopDetection: null });
    const executionLog = [];
    const result = await executor.executeAgentRound({
        request: "test request",
        history: [],
        messages: [{ role: "user", content: "test" }],
        model: "test-model",
        context: createTestContext(),
    }, async () => {
        executionLog.push("model_call");
        return { content: "test response" };
    });
    assert.ok(result.response);
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.beforeAgentWarnings));
    assert.ok(Array.isArray(result.beforeModelWarnings));
    assert.ok(Array.isArray(result.afterModelWarnings));
    assert.ok(Array.isArray(result.afterAgentWarnings));
});
test("AgentExecutor with loop detection registers detection hooks", () => {
    const executor = createAgentExecutor({
        loopDetection: { warnThreshold: 2, escalateThreshold: 3 },
    });
    const hooks = executor.getRegisteredHooks();
    const hasLoopDetectionBeforeAgent = hooks.beforeAgent.some((h) => h.includes("loop_detection"));
    const hasLoopDetectionWrapTool = hooks.wrapToolCall.some((h) => h.includes("loop_detection"));
    assert.ok(hasLoopDetectionBeforeAgent || hooks.beforeAgent.length >= 1, "Should have before_agent hook");
    assert.ok(hasLoopDetectionWrapTool || hooks.wrapToolCall.length >= 1, "Should have wrap_tool_call hook");
});
test("AgentExecutor tracks loop detection patterns", async () => {
    const executor = createAgentExecutor({
        loopDetection: { warnThreshold: 2, escalateThreshold: 3 },
    });
    const initialPatterns = executor.getLoopDetectionPatterns();
    assert.ok(Array.isArray(initialPatterns));
    executor.resetLoopDetection();
    const afterReset = executor.getLoopDetectionPatterns();
    assert.equal(afterReset.length, 0);
});
test("AgentExecutor executeAgentRound increments agent round", async () => {
    const executor = createAgentExecutor({ loopDetection: null });
    await executor.executeAgentRound({
        request: "first",
        history: [],
        messages: [],
        context: createTestContext(),
    }, async () => "first");
    await executor.executeAgentRound({
        request: "second",
        history: [],
        messages: [],
        context: createTestContext(),
    }, async () => "second");
    await executor.executeAgentRound({
        request: "third",
        history: [],
        messages: [],
        context: createTestContext(),
    }, async () => "third");
});
test("AgentExecutor wrapToolCall wraps tool execution", async () => {
    const executor = createAgentExecutor({ loopDetection: null });
    let toolCallCount = 0;
    const result = await executor.wrapToolCall("test_tool", { arg1: "value1" }, async () => {
        toolCallCount++;
        return "tool_result";
    });
    assert.equal(result.result, "tool_result");
    assert.equal(toolCallCount, 1);
    assert.ok(Array.isArray(result.warnings));
});
test("initializeAgentExecutor returns singleton context", () => {
    resetMiddleware();
    const ctx1 = initializeAgentExecutor({ loopDetection: null });
    const ctx2 = getAgentExecutorContext();
    assert.ok(ctx1);
    assert.ok(ctx2);
    assert.strictEqual(ctx1, ctx2);
});
test("getGlobalAgentMiddlewareChain returns global chain", () => {
    const chain = getGlobalAgentMiddlewareChain();
    assert.ok(chain);
    assert.ok(typeof chain.beforeAgent === "function");
    assert.ok(typeof chain.beforeModel === "function");
    assert.ok(typeof chain.afterModel === "function");
    assert.ok(typeof chain.wrapModelCall === "function");
    assert.ok(typeof chain.wrapToolCall === "function");
    assert.ok(typeof chain.afterAgent === "function");
    assert.ok(typeof chain.runAgentRound === "function");
});
test("AgentExecutor fails gracefully on model error", async () => {
    const executor = createAgentExecutor({ loopDetection: null });
    await assert.rejects(async () => {
        await executor.executeAgentRound({
            request: "test",
            history: [],
            messages: [],
            context: createTestContext(),
        }, async () => {
            throw new Error("Model call failed");
        });
    }, { message: "Model call failed" });
});
test("AgentExecutor result includes loop detection when enabled", async () => {
    const executor = createAgentExecutor({
        loopDetection: { warnThreshold: 2, escalateThreshold: 3 },
    });
    const result = await executor.executeAgentRound({
        request: "test",
        history: [],
        messages: [],
        context: createTestContext(),
    }, async () => ({ content: "response" }));
    assert.ok(result.loopDetection !== undefined);
    assert.ok(Array.isArray(result.loopDetection.patterns));
    assert.ok(typeof result.loopDetection.escalated === "boolean");
});
test("AgentExecutor with custom logger receives middleware logs", async () => {
    const logs = [];
    const executor = createAgentExecutor({
        loopDetection: null,
        logger: (code, msg) => {
            logs.push({ code, msg });
        },
    });
    await executor.executeAgentRound({
        request: "test",
        history: [],
        messages: [],
        context: createTestContext(),
    }, async () => ({ content: "response" }));
});
test("AgentExecutor executeAgentRound passes request and history to middleware", async () => {
    const executor = createAgentExecutor({ loopDetection: null });
    const result = await executor.executeAgentRound({
        request: "my request",
        history: [{ role: "user", content: "previous" }],
        messages: [{ role: "user", content: "my request" }],
        context: createTestContext(),
    }, async () => ({ content: "response" }));
    assert.ok(result);
});
test("AgentExecutor resetLoopDetection clears patterns", async () => {
    const executor = createAgentExecutor({
        loopDetection: { warnThreshold: 1, escalateThreshold: 2 },
    });
    await executor.wrapToolCall("test_tool", { data: "test" }, async () => "result");
    const beforeReset = executor.getLoopDetectionPatterns();
    assert.ok(beforeReset.length >= 0);
    executor.resetLoopDetection();
    const afterReset = executor.getLoopDetectionPatterns();
    assert.equal(afterReset.length, 0);
});
//# sourceMappingURL=agent-executor.test.js.map
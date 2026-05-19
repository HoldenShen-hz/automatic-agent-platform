import test from "node:test";
import assert from "node:assert/strict";
import { AgentMiddlewareChain, createMiddlewareChain, globalMiddlewareChain, } from "../../../src/platform/execution/execution-engine/agent-middleware-chain.js";
test("globalMiddlewareChain is an AgentMiddlewareChain instance", () => {
    assert.ok(globalMiddlewareChain instanceof AgentMiddlewareChain);
});
test("globalMiddlewareChain has default failOpen behavior", async () => {
    const failingHook = {
        name: "global_failing",
        priority: 0,
        run: async () => ({
            success: false,
            error: { code: "test.fail", message: "Intentional failure" },
        }),
    };
    globalMiddlewareChain.registerBeforeAgent(failingHook);
    const result = await globalMiddlewareChain.beforeAgent({ request: "test", history: [] });
    // Should continue due to failOpen: true
    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes("Intentional failure"));
    // Clean up
    globalMiddlewareChain.reset();
});
test("AgentMiddlewareChain reset clears all hooks", () => {
    const chain = createMiddlewareChain();
    chain.registerBeforeAgent({
        name: "test_hook",
        priority: 0,
        run: async () => ({ success: true }),
    });
    const hooksBefore = chain.getRegisteredHooks();
    assert.equal(hooksBefore.beforeAgent.length, 1);
    chain.reset();
    const hooksAfter = chain.getRegisteredHooks();
    assert.equal(hooksAfter.beforeAgent.length, 0);
});
test("AgentMiddlewareChain getRegisteredHooks returns all hook types", () => {
    const chain = createMiddlewareChain();
    const hooks = chain.getRegisteredHooks();
    assert.ok(Array.isArray(hooks.beforeAgent));
    assert.ok(Array.isArray(hooks.beforeModel));
    assert.ok(Array.isArray(hooks.afterModel));
    assert.ok(Array.isArray(hooks.wrapModelCall));
    assert.ok(Array.isArray(hooks.wrapToolCall));
    assert.ok(Array.isArray(hooks.afterAgent));
});
test("AgentMiddlewareChain multiple hooks of same type are tracked", () => {
    const chain = createMiddlewareChain();
    chain.registerBeforeAgent({
        name: "hook_1",
        priority: 10,
        run: async () => ({ success: true }),
    });
    chain.registerBeforeAgent({
        name: "hook_2",
        priority: 5,
        run: async () => ({ success: true }),
    });
    const hooks = chain.getRegisteredHooks();
    assert.equal(hooks.beforeAgent.length, 2);
});
test("AgentMiddlewareChain wrapToolCall hook can access args", async () => {
    const chain = createMiddlewareChain();
    let capturedArgs = {};
    const capturingHook = {
        name: "capturer",
        priority: 0,
        run: async (_ctx, input, next) => {
            capturedArgs = { ...input.args };
            return next();
        },
    };
    chain.registerWrapToolCall(capturingHook);
    await chain.wrapToolCall({ toolName: "read_file", args: { path: "/tmp/test.txt", encoding: "utf8" } }, async () => "result");
    assert.equal(capturedArgs.path, "/tmp/test.txt");
    assert.equal(capturedArgs.encoding, "utf8");
});
test("AgentMiddlewareChain beforeModel hooks receive model from input", async () => {
    const chain = createMiddlewareChain();
    let receivedModel = undefined;
    chain.registerBeforeModel({
        name: "model_checker",
        priority: 0,
        run: async (_ctx, input) => {
            receivedModel = input.model;
            return { success: true };
        },
    });
    await chain.beforeModel({ messages: [], model: "claude-3.5" });
    assert.equal(receivedModel, "claude-3.5");
});
test("AgentMiddlewareChain beforeModel works without model in input", async () => {
    const chain = createMiddlewareChain();
    let receivedModel = undefined;
    chain.registerBeforeModel({
        name: "model_checker",
        priority: 0,
        run: async (_ctx, input) => {
            receivedModel = input.model;
            return { success: true };
        },
    });
    await chain.beforeModel({ messages: [] });
    assert.equal(receivedModel, undefined);
});
test("AgentMiddlewareChain afterAgent hooks receive response", async () => {
    const chain = createMiddlewareChain();
    let receivedResponse = null;
    chain.registerAfterAgent({
        name: "response_tracker",
        priority: 0,
        run: async (_ctx, input) => {
            receivedResponse = input.response;
            return { success: true };
        },
    });
    await chain.afterAgent({ response: { answer: 42 }, toolsUsed: [] });
    assert.deepEqual(receivedResponse, { answer: 42 });
});
test("AgentMiddlewareChain afterAgent hooks receive toolsUsed", async () => {
    const chain = createMiddlewareChain();
    let receivedTools = [];
    chain.registerAfterAgent({
        name: "tools_tracker",
        priority: 0,
        run: async (_ctx, input) => {
            receivedTools = input.toolsUsed;
            return { success: true };
        },
    });
    await chain.afterAgent({ response: {}, toolsUsed: ["read", "write", "execute"] });
    assert.deepEqual(receivedTools, ["read", "write", "execute"]);
});
test("AgentMiddlewareChain afterModel hooks receive both messages and response", async () => {
    const chain = createMiddlewareChain();
    let receivedMessages = [];
    let receivedResponse = null;
    chain.registerAfterModel({
        name: "model_output",
        priority: 0,
        run: async (_ctx, input) => {
            receivedMessages = input.messages;
            receivedResponse = input.response;
            return { success: true };
        },
    });
    await chain.afterModel({ messages: ["msg1", "msg2"], response: "model_output" });
    assert.deepEqual(receivedMessages, ["msg1", "msg2"]);
    assert.equal(receivedResponse, "model_output");
});
test("AgentMiddlewareChain sortedInsert maintains priority order", () => {
    const chain = createMiddlewareChain();
    chain.registerBeforeAgent({
        name: "high_priority",
        priority: 100,
        run: async () => ({ success: true }),
    });
    chain.registerBeforeAgent({
        name: "low_priority",
        priority: 1,
        run: async () => ({ success: true }),
    });
    chain.registerBeforeAgent({
        name: "medium_priority",
        priority: 50,
        run: async () => ({ success: true }),
    });
    const hooks = chain.getRegisteredHooks();
    const names = hooks.beforeAgent;
    assert.equal(names[0], "low_priority");
    assert.equal(names[1], "medium_priority");
    assert.equal(names[2], "high_priority");
});
test("AgentMiddlewareChain context buildContext uses provided agentRound and stepId", async () => {
    const chain = createMiddlewareChain();
    let contextRound = -1;
    let contextStepId = null;
    chain.registerBeforeAgent({
        name: "context_inspector",
        priority: 0,
        run: async (ctx) => {
            contextRound = ctx.agentRound;
            contextStepId = ctx.stepId;
            return { success: true };
        },
    });
    await chain.beforeAgent({ request: "test", history: [] }, { agentRound: 5, stepId: "step_abc" });
    assert.equal(contextRound, 5);
    assert.equal(contextStepId, "step_abc");
});
test("AgentMiddlewareChain context inherits from provided ctx", async () => {
    const chain = createMiddlewareChain();
    let taskIdReceived = "";
    chain.registerBeforeAgent({
        name: "taskid_checker",
        priority: 0,
        run: async (ctx) => {
            taskIdReceived = ctx.taskId;
            return { success: true };
        },
    });
    const ctx = {
        runtime: { traceId: "trace_123", taskId: "task_from_ctx" },
        chainStartedAt: "",
        agentRound: 0,
        stepId: null,
        executionId: null,
        taskId: "task_from_ctx",
    };
    await chain.beforeAgent({ request: "test", history: [] }, { ctx });
    assert.equal(taskIdReceived, "task_from_ctx");
});
//# sourceMappingURL=agent-middleware-chain-global.test.js.map
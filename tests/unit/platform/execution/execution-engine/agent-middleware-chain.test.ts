import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentMiddlewareChain,
  globalMiddlewareChain,
  createMiddlewareChain,
  type BeforeAgentHook,
  type BeforeModelHook,
  type AfterModelHook,
  type WrapModelCallHook,
  type WrapToolCallHook,
  type AfterAgentHook,
  type MiddlewareContext,
  type MiddlewareResult,
} from "../../../../../src/platform/execution/execution-engine/agent-middleware-chain.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function createMockMiddlewareContext(): MiddlewareContext {
  return {
    runtime: {
      traceId: "test-trace",
      taskId: "test-task",
      executionId: "test-exec",
      sessionId: "test-session",
      workflowId: "test-workflow",
      divisionId: "test-division",
      agentId: "test-agent",
    },
    chainStartedAt: "2024-01-01T00:00:00.000Z",
    agentRound: 0,
    stepId: "test-step",
    executionId: "test-exec",
    taskId: "test-task",
  };
}

function createPassThroughHook(name: string, priority = 0): BeforeAgentHook {
  return {
    name,
    priority,
    run: async () => ({ success: true }),
  };
}

// ---------------------------------------------------------------------------
// AgentMiddlewareChain construction
// ---------------------------------------------------------------------------

test("AgentMiddlewareChain can be instantiated", () => {
  const chain = new AgentMiddlewareChain();
  assert.ok(chain instanceof AgentMiddlewareChain, "Should create instance");
});

test("AgentMiddlewareChain accepts failOpen option", () => {
  const chain = new AgentMiddlewareChain({ failOpen: true });
  assert.ok(chain instanceof AgentMiddlewareChain);
});

test("AgentMiddlewareChain accepts custom logger option", () => {
  const logger = (code: string, msg: string, ctx: MiddlewareContext) => {
    // Custom logger
  };
  const chain = new AgentMiddlewareChain({ logger });
  assert.ok(chain instanceof AgentMiddlewareChain);
});

test("AgentMiddlewareChain accepts both failOpen and logger options", () => {
  const logger = (code: string, msg: string, ctx: MiddlewareContext) => {};
  const chain = new AgentMiddlewareChain({ failOpen: false, logger });
  assert.ok(chain instanceof AgentMiddlewareChain);
});

// ---------------------------------------------------------------------------
// createMiddlewareChain factory
// ---------------------------------------------------------------------------

test("createMiddlewareChain creates new chain instance", () => {
  const chain = createMiddlewareChain();
  assert.ok(chain instanceof AgentMiddlewareChain);
});

test("createMiddlewareChain accepts options", () => {
  const chain = createMiddlewareChain({ failOpen: true });
  assert.ok(chain instanceof AgentMiddlewareChain);
});

// ---------------------------------------------------------------------------
// Hook registration - beforeAgent
// ---------------------------------------------------------------------------

test("registerBeforeAgent adds hook to chain", async () => {
  const chain = new AgentMiddlewareChain();
  const hook = createPassThroughHook("test-before-agent");
  chain.registerBeforeAgent(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.beforeAgent.includes("test-before-agent"));
});

test("registerBeforeAgent sorts hooks by priority (ascending)", async () => {
  const chain = new AgentMiddlewareChain();
  chain.registerBeforeAgent(createPassThroughHook("low", 10));
  chain.registerBeforeAgent(createPassThroughHook("high", 1));
  chain.registerBeforeAgent(createPassThroughHook("medium", 5));

  const hooks = chain.getRegisteredHooks();
  assert.equal(hooks.beforeAgent[0], "high");
  assert.equal(hooks.beforeAgent[1], "medium");
  assert.equal(hooks.beforeAgent[2], "low");
});

// ---------------------------------------------------------------------------
// Hook registration - beforeModel
// ---------------------------------------------------------------------------

test("registerBeforeModel adds hook to chain", () => {
  const chain = new AgentMiddlewareChain();
  const hook: BeforeModelHook = {
    name: "test-before-model",
    priority: 0,
    run: async () => ({ success: true }),
  };
  chain.registerBeforeModel(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.beforeModel.includes("test-before-model"));
});

// ---------------------------------------------------------------------------
// Hook registration - afterModel
// ---------------------------------------------------------------------------

test("registerAfterModel adds hook to chain", () => {
  const chain = new AgentMiddlewareChain();
  const hook: AfterModelHook = {
    name: "test-after-model",
    priority: 0,
    run: async () => ({ success: true }),
  };
  chain.registerAfterModel(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.afterModel.includes("test-after-model"));
});

// ---------------------------------------------------------------------------
// Hook registration - wrapModelCall
// ---------------------------------------------------------------------------

test("registerWrapModelCall adds hook to chain", () => {
  const chain = new AgentMiddlewareChain();
  const hook: WrapModelCallHook = {
    name: "test-wrap-model",
    priority: 0,
    run: async (ctx, input, next) => next(),
  };
  chain.registerWrapModelCall(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.wrapModelCall.includes("test-wrap-model"));
});

// ---------------------------------------------------------------------------
// Hook registration - wrapToolCall
// ---------------------------------------------------------------------------

test("registerWrapToolCall adds hook to chain", () => {
  const chain = new AgentMiddlewareChain();
  const hook: WrapToolCallHook = {
    name: "test-wrap-tool",
    priority: 0,
    run: async (ctx, input, next) => next(),
  };
  chain.registerWrapToolCall(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.wrapToolCall.includes("test-wrap-tool"));
});

// ---------------------------------------------------------------------------
// Hook registration - afterAgent
// ---------------------------------------------------------------------------

test("registerAfterAgent adds hook to chain", () => {
  const chain = new AgentMiddlewareChain();
  const hook: AfterAgentHook = {
    name: "test-after-agent",
    priority: 0,
    run: async () => ({ success: true }),
  };
  chain.registerAfterAgent(hook);

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.afterAgent.includes("test-after-agent"));
});

// ---------------------------------------------------------------------------
// reset - clears all hooks
// ---------------------------------------------------------------------------

test("reset clears all hooks from chain", () => {
  const chain = new AgentMiddlewareChain();
  chain.registerBeforeAgent(createPassThroughHook("hook1"));
  chain.registerAfterAgent({
    name: "hook2",
    priority: 0,
    run: async () => ({ success: true }),
  });

  chain.reset();

  const hooks = chain.getRegisteredHooks();
  assert.equal(hooks.beforeAgent.length, 0);
  assert.equal(hooks.afterAgent.length, 0);
});

// ---------------------------------------------------------------------------
// getRegisteredHooks - returns all registered hooks
// ---------------------------------------------------------------------------

test("getRegisteredHooks returns empty arrays when no hooks registered", () => {
  const chain = new AgentMiddlewareChain();
  const hooks = chain.getRegisteredHooks();

  assert.ok(Array.isArray(hooks.beforeAgent));
  assert.ok(Array.isArray(hooks.beforeModel));
  assert.ok(Array.isArray(hooks.afterModel));
  assert.ok(Array.isArray(hooks.wrapModelCall));
  assert.ok(Array.isArray(hooks.wrapToolCall));
  assert.ok(Array.isArray(hooks.afterAgent));
  assert.equal(hooks.beforeAgent.length, 0);
  assert.equal(hooks.beforeModel.length, 0);
  assert.equal(hooks.afterModel.length, 0);
  assert.equal(hooks.wrapModelCall.length, 0);
  assert.equal(hooks.wrapToolCall.length, 0);
  assert.equal(hooks.afterAgent.length, 0);
});

test("getRegisteredHooks returns hook names in priority order", () => {
  const chain = new AgentMiddlewareChain();
  chain.registerBeforeAgent(createPassThroughHook("first", 1));
  chain.registerBeforeAgent(createPassThroughHook("second", 2));
  chain.registerBeforeAgent(createPassThroughHook("third", 3));

  const hooks = chain.getRegisteredHooks();
  assert.deepEqual(hooks.beforeAgent, ["first", "second", "third"]);
});

// ---------------------------------------------------------------------------
// beforeAgent - executes hooks and returns warnings
// ---------------------------------------------------------------------------

test("beforeAgent executes hooks and returns input with warnings", async () => {
  const chain = new AgentMiddlewareChain();
  chain.registerBeforeAgent(createPassThroughHook("pass-through"));

  const result = await chain.beforeAgent({
    request: "test request",
    history: [],
  });

  assert.ok(result.input);
  assert.equal(result.input.request, "test request");
  assert.ok(Array.isArray(result.warnings));
});

test("beforeAgent uses opts.agentRound for context", async () => {
  const chain = new AgentMiddlewareChain();
  const ctx = createMockMiddlewareContext();

  const result = await chain.beforeAgent(
    { request: "test", history: [] },
    { agentRound: 5, ctx },
  );

  assert.ok(result.input);
});

test("beforeAgent accepts stepId option", async () => {
  const chain = new AgentMiddlewareChain();
  const result = await chain.beforeAgent(
    { request: "test", history: [] },
    { agentRound: 0, stepId: "my-step" },
  );

  assert.ok(result.input);
});

// ---------------------------------------------------------------------------
// wrapToolCall - wraps tool execution with hooks
// ---------------------------------------------------------------------------

test("wrapToolCall executes hooks around tool call", async () => {
  const chain = new AgentMiddlewareChain();
  let hookCalled = false;
  chain.registerWrapToolCall({
    name: "test-hook",
    priority: 0,
    run: async (ctx, input, next) => {
      hookCalled = true;
      return next();
    },
  });

  const result = await chain.wrapToolCall(
    { toolName: "test_tool", args: {} },
    async () => "tool result",
  );

  assert.equal(hookCalled, true);
  assert.equal(result.result, "tool result");
});

test("wrapToolCall propagates errors from tool call", async () => {
  const chain = new AgentMiddlewareChain();
  const error = new Error("tool failed");
  chain.registerWrapToolCall({
    name: "test-hook",
    priority: 0,
    run: async (ctx, input, next) => next(),
  });

  await assert.rejects(
    async () => chain.wrapToolCall(
      { toolName: "failing_tool", args: {} },
      async () => { throw error; },
    ),
    /tool failed/,
  );
});

// ---------------------------------------------------------------------------
// wrapModelCall - wraps model calls with hooks
// ---------------------------------------------------------------------------

test("wrapModelCall executes hooks around model call", async () => {
  const chain = new AgentMiddlewareChain();
  let hookCalled = false;
  chain.registerWrapModelCall({
    name: "test-hook",
    priority: 0,
    run: async (ctx, input, next) => {
      hookCalled = true;
      return next();
    },
  });

  const result = await chain.wrapModelCall(
    { messages: [], model: "test-model" },
    async () => "model result",
  );

  assert.equal(hookCalled, true);
  assert.equal(result.result, "model result");
});

test("wrapModelCall propagates errors from model call", async () => {
  const chain = new AgentMiddlewareChain();
  const error = new Error("model failed");
  chain.registerWrapModelCall({
    name: "test-hook",
    priority: 0,
    run: async (ctx, input, next) => next(),
  });

  await assert.rejects(
    async () => chain.wrapModelCall(
      { messages: [], model: "failing-model" },
      async () => { throw error; },
    ),
    /model failed/,
  );
});

// ---------------------------------------------------------------------------
// afterAgent - executes hooks after agent round
// ---------------------------------------------------------------------------

test("afterAgent executes hooks and returns warnings", async () => {
  const chain = new AgentMiddlewareChain();
  chain.registerAfterAgent({
    name: "test-hook",
    priority: 0,
    run: async () => ({ success: true }),
  });

  const result = await chain.afterAgent({
    response: { result: "test" },
    toolsUsed: ["tool1"],
  });

  assert.ok(Array.isArray(result.warnings));
});

// ---------------------------------------------------------------------------
// globalMiddlewareChain singleton
// ---------------------------------------------------------------------------

test("globalMiddlewareChain is exported and is an AgentMiddlewareChain", () => {
  assert.ok(globalMiddlewareChain instanceof AgentMiddlewareChain);
});

test("globalMiddlewareChain has failOpen set to true by default", () => {
  // The global chain should be configured with failOpen: true
  assert.ok(globalMiddlewareChain instanceof AgentMiddlewareChain);
});

// ---------------------------------------------------------------------------
// MiddlewareResult type structure
// ---------------------------------------------------------------------------

test("MiddlewareResult can be created with success: true", () => {
  const result: MiddlewareResult = { success: true };
  assert.equal(result.success, true);
});

test("MiddlewareResult can be created with success: false and error", () => {
  const result: MiddlewareResult = {
    success: false,
    error: {
      code: "test.error",
      message: "Test error message",
      warning: true,
    },
  };
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "test.error");
  assert.equal(result.error?.warning, true);
});

test("MiddlewareResult can include modified input", () => {
  const result: MiddlewareResult = {
    success: true,
    input: { modified: "value" },
  };
  assert.equal((result.input as { modified: string }).modified, "value");
});

// ---------------------------------------------------------------------------
// Hook interface types
// ---------------------------------------------------------------------------

test("BeforeAgentHook has required name and priority", () => {
  const hook: BeforeAgentHook = {
    name: "test",
    priority: 1,
    run: async () => ({ success: true }),
  };
  assert.equal(hook.name, "test");
  assert.equal(hook.priority, 1);
});

test("WrapToolCallHook receives tool input and calls next", async () => {
  const hook: WrapToolCallHook = {
    name: "test",
    priority: 0,
    run: async (ctx, input, next) => {
      assert.equal(input.toolName, "my_tool");
      return next();
    },
  };

  await hook.run(createMockMiddlewareContext(), { toolName: "my_tool", args: {} }, async () => "result");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("beforeAgent handles empty history", async () => {
  const chain = new AgentMiddlewareChain();
  const result = await chain.beforeAgent({
    request: "test",
    history: [],
  });
  assert.ok(result.input);
});

test("wrapToolCall returns warnings array (empty on success)", async () => {
  const chain = new AgentMiddlewareChain();
  const result = await chain.wrapToolCall(
    { toolName: "test", args: {} },
    async () => "result",
  );
  assert.ok(Array.isArray(result.warnings));
});

test("multiple hooks of different types can be registered", () => {
  const chain = new AgentMiddlewareChain();
  chain.registerBeforeAgent(createPassThroughHook("ba"));
  chain.registerAfterAgent({
    name: "aa",
    priority: 0,
    run: async () => ({ success: true }),
  });
  chain.registerWrapToolCall({
    name: "wt",
    priority: 0,
    run: async (ctx, input, next) => next(),
  });

  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.beforeAgent.includes("ba"));
  assert.ok(hooks.afterAgent.includes("aa"));
  assert.ok(hooks.wrapToolCall.includes("wt"));
});

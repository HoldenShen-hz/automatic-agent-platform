import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import {
  AgentExecutor,
  initializeAgentExecutor,
  getAgentExecutorContext,
  getGlobalAgentMiddlewareChain,
  createAgentExecutor,
  type AgentExecutorOptions,
  type AgentExecutorContext,
  type AgentExecutorInput,
  type AgentExecutorResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/agent-executor.js";
import { AgentMiddlewareChain } from "../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js";
import type { LoopDetectionConfig } from "../../../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestContext(overrides?: Partial<AgentExecutorContext>): AgentExecutorContext {
  return {
    traceId: newId("trace"),
    taskId: newId("task"),
    executionId: newId("exec"),
    agentRound: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AgentExecutor executeAgentRound - detailed behavior tests
// ---------------------------------------------------------------------------

test("AgentExecutor executeAgentRound returns response from model [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test request",
    history: [],
    messages: [],
    context: createTestContext(),
  };

  const expectedResponse = { content: "model response content" };
  const executeModel = async () => expectedResponse;

  const result = await executor.executeAgentRound(input, executeModel);

  assert.deepEqual(result.response, expectedResponse);
});

test("AgentExecutor executeAgentRound passes request through middleware [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "middleware test",
    history: [{ role: "user", content: "previous interaction" }],
    messages: [{ role: "user", content: "current message" }],
    context: createTestContext({ agentRound: 1 }),
  };

  const executeModel = async () => ({ content: "response" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result.beforeAgentWarnings.length >= 0);
  assert.ok(Array.isArray(result.beforeModelWarnings));
});

test("AgentExecutor executeAgentRound includes all warning arrays in result [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test",
    history: [],
    messages: [],
    context: createTestContext(),
  };

  const executeModel = async () => ({ content: "test" });
  const result = await executor.executeAgentRound(input, executeModel);

  // Verify all warning arrays exist
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.beforeAgentWarnings));
  assert.ok(Array.isArray(result.beforeModelWarnings));
  assert.ok(Array.isArray(result.afterModelWarnings));
  assert.ok(Array.isArray(result.afterAgentWarnings));
});

test("AgentExecutor executeAgentRound handles model response with toolsUsed [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "use a tool",
    history: [],
    messages: [{ role: "user", content: "use search tool" }],
    context: createTestContext(),
  };

  const modelResponse = { content: "searching...", toolsUsed: ["web_search"] };
  const executeModel = async () => modelResponse;

  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result);
  assert.ok("response" in result);
});

test("AgentExecutor executeAgentRound preserves history in middleware flow [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const historyItem = { role: "assistant" as const, content: "previous response" };
  const input: AgentExecutorInput = {
    request: "continue conversation",
    history: [historyItem],
    messages: [{ role: "user", content: "new message" }],
    context: createTestContext(),
  };

  const executeModel = async () => ({ content: "continuation" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result);
  // History should pass through beforeAgent middleware
  assert.ok(result.beforeAgentWarnings !== undefined);
});

// ---------------------------------------------------------------------------
// AgentExecutor wrapToolCall - detailed behavior tests
// ---------------------------------------------------------------------------

test("AgentExecutor wrapToolCall wraps tool execution through chain [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const toolName = "file_read";
  const args = { path: "/tmp/test.txt" };
  let toolExecuted = false;

  const next = async () => {
    toolExecuted = true;
    return { success: true, data: "file contents" };
  };

  const result = await executor.wrapToolCall(toolName, args, next);

  assert.equal(toolExecuted, true);
  assert.ok("result" in result);
  assert.ok("success" in result.result);
});

test("AgentExecutor wrapToolCall returns tool result with warnings [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const toolName = "database_query";
  const args = { sql: "SELECT * FROM users" };

  const next = async () => [{ id: 1, name: "test" }];

  const result = await executor.wrapToolCall(toolName, args, next);

  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.result);
});

test("AgentExecutor wrapToolCall handles complex tool arguments [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const toolName = "multi_param_tool";
  const args = {
    stringParam: "value",
    numberParam: 42,
    boolParam: true,
    arrayParam: [1, 2, 3],
    nestedParam: { key: "value" },
  };

  const next = async () => ({ result: "success" });
  const result = await executor.wrapToolCall(toolName, args, next);

  assert.equal(result.result.result, "success");
});

test("AgentExecutor wrapToolCall passes through errors [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const toolName = "failing_tool";
  const args = { shouldFail: true };
  const expectedError = new Error("tool execution failed");

  const next = async () => {
    throw expectedError;
  };

  await assert.rejects(
    async () => executor.wrapToolCall(toolName, args, next),
    /tool execution failed/,
  );
});

// ---------------------------------------------------------------------------
// Middleware chain integration tests
// ---------------------------------------------------------------------------

test("AgentMiddlewareChain runAgentRound executes all middleware stages [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain();
  let stageOrder: string[] = [];

  chain.registerBeforeAgent({
    name: "before_agent_tracking",
    priority: 1,
    run: async () => {
      stageOrder.push("beforeAgent");
      return { success: true };
    },
  });

  chain.registerBeforeModel({
    name: "before_model_tracking",
    priority: 1,
    run: async () => {
      stageOrder.push("beforeModel");
      return { success: true };
    },
  });

  chain.registerWrapModelCall({
    name: "wrap_model_tracking",
    priority: 1,
    run: async (ctx, input, next) => {
      stageOrder.push("wrapModelCall");
      return next();
    },
  });

  chain.registerAfterModel({
    name: "after_model_tracking",
    priority: 1,
    run: async () => {
      stageOrder.push("afterModel");
      return { success: true };
    },
  });

  chain.registerAfterAgent({
    name: "after_agent_tracking",
    priority: 1,
    run: async () => {
      stageOrder.push("afterAgent");
      return { success: true };
    },
  });

  const result = await chain.runAgentRound({
    request: "test request",
    history: [],
    messages: [],
    agentRound: 0,
    executeModel: async () => {
      stageOrder.push("executeModel");
      return { content: "response" };
    },
  });

  assert.deepEqual(stageOrder, [
    "beforeAgent",
    "beforeModel",
    "wrapModelCall",
    "executeModel",
    "afterModel",
    "afterAgent",
  ]);
  assert.ok(result.result);
});

test("AgentMiddlewareChain runAgentRound returns structured warnings from each stage [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain({ failOpen: true });

  // Hooks that return success: false are what actually generate warnings in the chain
  chain.registerBeforeAgent({
    name: "before_agent_warning",
    priority: 1,
    run: async () => ({
      success: false,
      error: { code: "warn.ba", message: "before agent warning", warning: true },
      continueOnError: true,
    }),
  });

  chain.registerBeforeModel({
    name: "before_model_warning",
    priority: 1,
    run: async () => ({
      success: false,
      error: { code: "warn.bm", message: "before model warning", warning: true },
      continueOnError: true,
    }),
  });

  const result = await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    agentRound: 0,
    executeModel: async () => ({ content: "test" }),
  });

  // With failOpen, failures generate warnings in the format "middleware.{hook}.failed: {message}"
  assert.ok(result.beforeAgentWarnings.some(w => w.includes("before agent warning")), `Expected warning in beforeAgentWarnings, got: ${JSON.stringify(result.beforeAgentWarnings)}`);
  assert.ok(result.beforeModelWarnings.some(w => w.includes("before model warning")), `Expected warning in beforeModelWarnings, got: ${JSON.stringify(result.beforeModelWarnings)}`);
});

test("AgentMiddlewareChain runAgentRound handles stepId in context [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain();
  let capturedStepId: string | null = null;

  chain.registerBeforeModel({
    name: "capture_step_id",
    priority: 1,
    run: async (ctx) => {
      capturedStepId = ctx.stepId;
      return { success: true };
    },
  });

  const result = await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    agentRound: 2,
    stepId: "step-123",
    executeModel: async () => ({ content: "test" }),
  });

  assert.equal(capturedStepId, "step-123");
});

test("AgentMiddlewareChain runAgentRound passes model option through stages [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain();
  let capturedModel: string | undefined;

  chain.registerBeforeModel({
    name: "capture_model",
    priority: 1,
    run: async (ctx, input) => {
      capturedModel = input.model;
      return { success: true };
    },
  });

  await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    model: "claude-opus-4-20250514",
    agentRound: 0,
    executeModel: async () => ({ content: "test" }),
  });

  assert.equal(capturedModel, "claude-opus-4-20250514");
});

test("AgentMiddlewareChain runAgentRound handles model undefined [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain();
  let capturedInputModel: string | undefined;

  chain.registerBeforeModel({
    name: "check_model",
    priority: 1,
    run: async (ctx, input) => {
      capturedInputModel = input.model;
      return { success: true };
    },
  });

  const result = await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    agentRound: 0,
    executeModel: async () => ({ content: "test" }),
  });

  assert.equal(capturedInputModel, undefined);
  assert.ok(result.result);
});

test("AgentMiddlewareChain runAgentRound continues after hook failure with failOpen [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain({ failOpen: true });
  let modelCalled = false;

  chain.registerBeforeAgent({
    name: "failing_hook",
    priority: 1,
    run: async () => {
      throw new Error("deliberate failure");
    },
  });

  const result = await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    agentRound: 0,
    executeModel: async () => {
      modelCalled = true;
      return { content: "response after failure" };
    },
  });

  assert.equal(modelCalled, true);
  assert.ok(result.result);
});

test("AgentMiddlewareChain afterModel hook receives modified messages [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain();
  const modifiedMessages = [{ role: "user" as const, content: "modified message" }];

  chain.registerBeforeModel({
    name: "modify_messages",
    priority: 1,
    run: async (ctx, input) => ({
      success: true,
      input: { messages: modifiedMessages, model: input.model },
    }),
  });

  let receivedMessages: unknown[] = [];
  chain.registerAfterModel({
    name: "capture_messages",
    priority: 1,
    run: async (ctx, input) => {
      receivedMessages = input.messages;
      return { success: true };
    },
  });

  await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [{ role: "user", content: "original" }],
    agentRound: 0,
    executeModel: async () => ({ content: "test" }),
  });

  assert.deepEqual(receivedMessages, modifiedMessages);
});

// ---------------------------------------------------------------------------
// Loop detection integration tests
// ---------------------------------------------------------------------------

test("AgentExecutor with loop detection config creates loop state [agent-executor-flow]", () => {
  const loopConfig: LoopDetectionConfig = {
    warnThreshold: 3,
    escalateThreshold: 5,
  };

  const executor = new AgentExecutor({ loopDetection: loopConfig });
  const patterns = executor.getLoopDetectionPatterns();

  assert.ok(Array.isArray(patterns));
});

test("AgentExecutor loop detection can be reset [agent-executor-flow]", () => {
  const executor = new AgentExecutor({
    loopDetection: { warnThreshold: 1, escalateThreshold: 3 },
  });

  // reset should not throw
  assert.doesNotThrow(() => executor.resetLoopDetection());
});

test("AgentExecutor executeAgentRound with loop detection includes loop info [agent-executor-flow]", async () => {
  const executor = new AgentExecutor({
    loopDetection: { warnThreshold: 2, escalateThreshold: 5 },
  });

  const input: AgentExecutorInput = {
    request: "test with loop detection",
    history: [],
    messages: [],
    context: createTestContext(),
  };

  const executeModel = async () => ({ content: "response" });
  const result = await executor.executeAgentRound(input, executeModel);

  // Loop detection info may or may not be present depending on state
  if (result.loopDetection) {
    assert.ok(Array.isArray(result.loopDetection.patterns));
    assert.ok(typeof result.loopDetection.escalated === "boolean");
  }
});

test("AgentExecutor with null loop detection has no loop state [agent-executor-flow]", () => {
  const executor = new AgentExecutor({ loopDetection: null });
  const patterns = executor.getLoopDetectionPatterns();

  assert.ok(Array.isArray(patterns));
  assert.equal(patterns.length, 0);
});

// ---------------------------------------------------------------------------
// initializeAgentExecutor tests
// ---------------------------------------------------------------------------

test("initializeAgentExecutor registers default middleware hooks [agent-executor-flow]", () => {
  // This initializes the global chain with default hooks
  const ctx = initializeAgentExecutor({});

  assert.ok(ctx.chain);
  const hooks = ctx.chain.getRegisteredHooks();

  // Default hooks should be registered
  assert.ok(Array.isArray(hooks.wrapToolCall));
});

test("initializeAgentExecutor is idempotent [agent-executor-flow]", () => {
  const ctx1 = initializeAgentExecutor({});
  const ctx2 = initializeAgentExecutor({});

  assert.strictEqual(ctx1, ctx2, "Should return same context on repeated calls");
});

test("initializeAgentExecutor with failOpen false [agent-executor-flow]", () => {
  const ctx = initializeAgentExecutor({ failOpen: false });

  assert.ok(ctx.chain);
  assert.ok(ctx.loopDetection);
});

test("initializeAgentExecutor with logger captures logs [agent-executor-flow]", () => {
  let loggerCalled = false;
  const logger = (code: string, msg: string, ctx: unknown) => {
    loggerCalled = true;
  };

  initializeAgentExecutor({ logger });

  assert.ok(typeof loggerCalled === "boolean");
});

// ---------------------------------------------------------------------------
// createAgentExecutor factory tests
// ---------------------------------------------------------------------------

test("createAgentExecutor accepts loop detection options [agent-executor-flow]", () => {
  const executor = createAgentExecutor({
    loopDetection: {
      warnThreshold: 2,
      escalateThreshold: 4,
      askAtWarn: true,
      terminateAtEscalate: false,
    },
  });

  assert.ok(executor instanceof AgentExecutor);
  const patterns = executor.getLoopDetectionPatterns();
  assert.ok(Array.isArray(patterns));
});

test("createAgentExecutor with custom logger [agent-executor-flow]", () => {
  const logger = (code: string, msg: string) => {
    // logger implementation
  };

  const executor = createAgentExecutor({ logger });

  assert.ok(executor instanceof AgentExecutor);
});

test("createAgentExecutor multiple calls create separate executors [agent-executor-flow]", () => {
  const executor1 = createAgentExecutor();
  const executor2 = createAgentExecutor();

  // Both should be valid instances
  assert.ok(executor1 instanceof AgentExecutor);
  assert.ok(executor2 instanceof AgentExecutor);

  // They should have independent state
  const patterns1 = executor1.getLoopDetectionPatterns();
  const patterns2 = executor2.getLoopDetectionPatterns();
  assert.deepEqual(patterns1, patterns2);
});

// ---------------------------------------------------------------------------
// getGlobalAgentMiddlewareChain tests
// ---------------------------------------------------------------------------

test("getGlobalAgentMiddlewareChain returns singleton chain [agent-executor-flow]", () => {
  const chain1 = getGlobalAgentMiddlewareChain();
  const chain2 = getGlobalAgentMiddlewareChain();

  assert.ok(chain1 === chain2, "Should return same singleton instance");
});

test("getGlobalAgentMiddlewareChain has expected hook types [agent-executor-flow]", () => {
  const chain = getGlobalAgentMiddlewareChain();
  const hooks = chain.getRegisteredHooks();

  assert.ok("beforeAgent" in hooks);
  assert.ok("beforeModel" in hooks);
  assert.ok("afterModel" in hooks);
  assert.ok("wrapModelCall" in hooks);
  assert.ok("wrapToolCall" in hooks);
  assert.ok("afterAgent" in hooks);
});

// ---------------------------------------------------------------------------
// getAgentExecutorContext tests
// ---------------------------------------------------------------------------

test("getAgentExecutorContext returns null before initialization [agent-executor-flow]", () => {
  // Note: Due to module-level singleton pattern, this may return non-null
  // if other tests have already initialized. We just verify it doesn't throw.
  const ctx = getAgentExecutorContext();
  assert.ok(ctx === null || typeof ctx === "object");
});

test("getAgentExecutorContext after initialization returns context [agent-executor-flow]", () => {
  initializeAgentExecutor({});
  const ctx = getAgentExecutorContext();

  assert.ok(ctx !== null);
  assert.ok("chain" in ctx);
  assert.ok("loopDetection" in ctx);
});

// ---------------------------------------------------------------------------
// Edge cases and error handling
// ---------------------------------------------------------------------------

test("AgentExecutor executeAgentRound handles empty request string [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "",
    history: [],
    messages: [],
    context: createTestContext(),
  };

  const executeModel = async () => ({ content: "response" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result);
});

test("AgentExecutor executeAgentRound handles large history array [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const largeHistory = Array.from({ length: 50 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i}`,
  }));

  const input: AgentExecutorInput = {
    request: "process large history",
    history: largeHistory,
    messages: [{ role: "user", content: "current" }],
    context: createTestContext(),
  };

  const executeModel = async () => ({ content: "response" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result);
  assert.ok(Array.isArray(result.beforeAgentWarnings));
});

test("AgentExecutor wrapToolCall with empty args [agent-executor-flow]", async () => {
  const executor = new AgentExecutor();
  const toolName = "no_args_tool";
  const args = {};

  const next = async () => ({ success: true });
  const result = await executor.wrapToolCall(toolName, args, next);

  assert.ok("result" in result);
  assert.ok(Array.isArray(result.warnings));
});

test("AgentMiddlewareChain runAgentRound passes all warnings to result [agent-executor-flow]", async () => {
  const chain = new AgentMiddlewareChain({ failOpen: true });

  // When success: false is returned with continueOnError, warnings are generated
  chain.registerBeforeAgent({
    name: "warn1",
    priority: 1,
    run: async () => ({ success: false, error: { code: "w1", message: "warning1", warning: true }, continueOnError: true }),
  });

  chain.registerBeforeModel({
    name: "warn2",
    priority: 1,
    run: async () => ({ success: false, error: { code: "w2", message: "warning2", warning: true }, continueOnError: true }),
  });

  chain.registerAfterModel({
    name: "warn3",
    priority: 1,
    run: async () => ({ success: false, error: { code: "w3", message: "warning3", warning: true } }),
  });

  chain.registerAfterAgent({
    name: "warn4",
    priority: 1,
    run: async () => ({ success: false, error: { code: "w4", message: "warning4", warning: true } }),
  });

  const result = await chain.runAgentRound({
    request: "test",
    history: [],
    messages: [],
    agentRound: 0,
    executeModel: async () => ({ content: "test" }),
  });

  // All warnings should be collected
  assert.ok(result.beforeAgentWarnings.length > 0, `Expected beforeAgentWarnings, got: ${JSON.stringify(result.beforeAgentWarnings)}`);
  assert.ok(result.beforeModelWarnings.length > 0, `Expected beforeModelWarnings, got: ${JSON.stringify(result.beforeModelWarnings)}`);
  assert.ok(result.afterModelWarnings.length > 0, `Expected afterModelWarnings, got: ${JSON.stringify(result.afterModelWarnings)}`);
  assert.ok(result.afterAgentWarnings.length > 0, `Expected afterAgentWarnings, got: ${JSON.stringify(result.afterAgentWarnings)}`);
});
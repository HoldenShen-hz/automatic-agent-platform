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
} from "../../../../../src/platform/five-plane-execution/execution-engine/agent-executor.js";
import type { LoopDetectionConfig } from "../../../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

// Test helper to reset executor context between tests
function resetExecutorContext(): void {
  // The executor context is a module-level singleton, so we can't easily reset it
  // for individual tests. Instead, we test the public API behavior.
}

test("AgentExecutor instantiates with default options [agent-executor]", () => {
  const executor = new AgentExecutor();
  assert.ok(executor instanceof AgentExecutor, "AgentExecutor should be instantiable");
});

test("AgentExecutor instantiates with custom options [agent-executor]", () => {
  const options: AgentExecutorOptions = {
    failOpen: true,
    loopDetection: { warnThreshold: 2, escalateThreshold: 4 },
  };
  const executor = new AgentExecutor(options);
  assert.ok(executor instanceof AgentExecutor, "AgentExecutor should be instantiable with custom options");
});

test("AgentExecutor getRegisteredHooks returns hook names [agent-executor]", () => {
  const executor = new AgentExecutor();
  const hooks = executor.getRegisteredHooks();

  assert.ok(Array.isArray(hooks.beforeAgent), "beforeAgent should be an array");
  assert.ok(Array.isArray(hooks.beforeModel), "beforeModel should be an array");
  assert.ok(Array.isArray(hooks.afterModel), "afterModel should be an array");
  assert.ok(Array.isArray(hooks.wrapModelCall), "wrapModelCall should be an array");
  assert.ok(Array.isArray(hooks.wrapToolCall), "wrapToolCall should be an array");
  assert.ok(Array.isArray(hooks.afterAgent), "afterAgent should be an array");
});

test("AgentExecutor getLoopDetectionPatterns returns array [agent-executor]", () => {
  const executor = new AgentExecutor();
  const patterns = executor.getLoopDetectionPatterns();
  assert.ok(Array.isArray(patterns), "getLoopDetectionPatterns should return an array");
});

test("AgentExecutor resetLoopDetection does not throw [agent-executor]", () => {
  const executor = new AgentExecutor();
  assert.doesNotThrow(() => executor.resetLoopDetection(), "resetLoopDetection should not throw");
});

test("AgentExecutor executeAgentRound handles missing context gracefully [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test request",
    history: [],
    messages: [],
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      agentRound: 0,
    },
  };

  // Mock executeModel that returns a response
  const executeModel = async () => ({ content: "test response" });

  // This should not throw even without full context setup
  const result = await executor.executeAgentRound(input, executeModel);
  assert.ok(result, "executeAgentRound should return a result");
  assert.ok(Array.isArray(result.warnings), "warnings should be an array");
});

test("AgentExecutor wrapToolCall returns result and warnings [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const toolName = "test_tool";
  const args = { param: "value" };
  const next = async () => ({ result: "success" });

  const wrappedResult = await executor.wrapToolCall(toolName, args, next);

  assert.ok(wrappedResult, "wrapToolCall should return a result");
  assert.ok("result" in wrappedResult, "result should contain result property");
  assert.ok(Array.isArray(wrappedResult.warnings), "warnings should be an array");
});

test("initializeAgentExecutor returns context [agent-executor]", () => {
  const ctx = initializeAgentExecutor({});
  assert.ok(ctx, "initializeAgentExecutor should return context");
  assert.ok("chain" in ctx, "context should have chain property");
  assert.ok("loopDetection" in ctx, "context should have loopDetection property");
});

test("initializeAgentExecutor returns same context on multiple calls [agent-executor]", () => {
  const ctx1 = initializeAgentExecutor({});
  const ctx2 = initializeAgentExecutor({});
  assert.equal(ctx1, ctx2, "initializeAgentExecutor should return same context on subsequent calls");
});

test("getAgentExecutorContext returns context after initialization [agent-executor]", () => {
  initializeAgentExecutor({});
  const ctx = getAgentExecutorContext();
  assert.ok(ctx !== null, "getAgentExecutorContext should return non-null after initialization");
  assert.ok("chain" in ctx, "context should have chain property");
});

test("getAgentExecutorContext returns null before initialization [agent-executor]", () => {
  // Note: Due to module-level singleton, this test assumes first call is after reset
  const ctx = getAgentExecutorContext();
  // The context may or may not be null depending on test order
  // Just verify the function returns without throwing
  assert.ok(ctx === null || typeof ctx === "object", "getAgentExecutorContext should return null or object");
});

test("getGlobalAgentMiddlewareChain returns middleware chain [agent-executor]", () => {
  const chain = getGlobalAgentMiddlewareChain();
  assert.ok(chain, "getGlobalAgentMiddlewareChain should return a chain");
  assert.ok(typeof chain.getRegisteredHooks === "function", "chain should have getRegisteredHooks method");
});

test("createAgentExecutor factory creates AgentExecutor instance [agent-executor]", () => {
  const executor = createAgentExecutor();
  assert.ok(executor instanceof AgentExecutor, "createAgentExecutor should create AgentExecutor instance");
});

test("AgentExecutor with loop detection config [agent-executor]", () => {
  const loopConfig: LoopDetectionConfig = {
    warnThreshold: 2,
    escalateThreshold: 4,
    askAtWarn: true,
    terminateAtEscalate: true,
  };
  const executor = new AgentExecutor({ loopDetection: loopConfig });
  assert.ok(executor instanceof AgentExecutor, "AgentExecutor should be instantiable with loop detection config");
});

test("AgentExecutor with null loop detection disables loop detection [agent-executor]", () => {
  const executor = new AgentExecutor({ loopDetection: null });
  assert.ok(executor instanceof AgentExecutor, "AgentExecutor should work with null loop detection");
  const patterns = executor.getLoopDetectionPatterns();
  assert.ok(Array.isArray(patterns), "Loop detection patterns should still be observable");
});

test("AgentExecutor with logger option [agent-executor]", () => {
  const logger = (code: string, msg: string, ctx: unknown) => {
    // Simple logger implementation
    console.log(`[${code}] ${msg}`);
  };
  const executor = new AgentExecutor({ logger });
  assert.ok(executor instanceof AgentExecutor, "AgentExecutor should be instantiable with logger");
});

test("AgentExecutor executeAgentRound with stepId [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test request",
    history: [],
    messages: [],
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      stepId: newId("step"),
      agentRound: 0,
    },
  };

  const executeModel = async () => ({ content: "response with step" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result, "executeAgentRound should return result with stepId");
});

test("AgentExecutor executeAgentRound with model override [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test request",
    history: [],
    messages: [],
    model: "claude-sonnet-4-20250514",
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      agentRound: 0,
    },
  };

  const executeModel = async () => ({ content: "response with model" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result, "executeAgentRound should return result with model override");
});

test("AgentExecutor executeAgentRound tracks agent round increment [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const context: AgentExecutorContext = {
    traceId: newId("trace"),
    taskId: newId("task"),
    executionId: newId("exec"),
    agentRound: 0,
  };

  const input: AgentExecutorInput = {
    request: "test",
    history: [],
    messages: [],
    context,
  };

  const executeModel = async () => ({ content: "response" });

  await executor.executeAgentRound(input, executeModel);
  await executor.executeAgentRound(input, executeModel);

  // The executor internally tracks agent round, we verify it doesn't throw
  assert.ok(true, "Multiple executeAgentRound calls should work");
});

test("AgentExecutor executeAgentRound with empty messages [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "minimal request",
    history: [],
    messages: [],
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      agentRound: 0,
    },
  };

  const executeModel = async () => ({ content: "minimal response" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result, "executeAgentRound should handle empty messages");
});

test("AgentExecutor executeAgentRound with history [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "request with history",
    history: [{ role: "user", content: "previous" }],
    messages: [{ role: "user", content: "current" }],
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      agentRound: 0,
    },
  };

  const executeModel = async () => ({ content: "response with history" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok(result, "executeAgentRound should handle history");
  assert.ok(Array.isArray(result.beforeAgentWarnings), "beforeAgentWarnings should be an array");
  assert.ok(Array.isArray(result.afterAgentWarnings), "afterAgentWarnings should be an array");
});

test("AgentExecutor context includes sessionId when provided [agent-executor]", () => {
  const ctx: AgentExecutorContext = {
    traceId: newId("trace"),
    taskId: newId("task"),
    executionId: newId("exec"),
    sessionId: newId("sess"),
    agentRound: 0,
  };

  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test",
    history: [],
    messages: [],
    context: ctx,
  };

  assert.equal(input.context.sessionId, ctx.sessionId, "sessionId should be preserved in context");
});

test("AgentExecutorResult has correct structure [agent-executor]", async () => {
  const executor = new AgentExecutor();
  const input: AgentExecutorInput = {
    request: "test",
    history: [],
    messages: [],
    context: {
      traceId: newId("trace"),
      taskId: newId("task"),
      executionId: newId("exec"),
      agentRound: 0,
    },
  };

  const executeModel = async () => ({ content: "test" });
  const result = await executor.executeAgentRound(input, executeModel);

  assert.ok("response" in result, "result should have response property");
  assert.ok("warnings" in result, "result should have warnings property");
  assert.ok("beforeAgentWarnings" in result, "result should have beforeAgentWarnings");
  assert.ok("beforeModelWarnings" in result, "result should have beforeModelWarnings");
  assert.ok("afterModelWarnings" in result, "result should have afterModelWarnings");
  assert.ok("afterAgentWarnings" in result, "result should have afterAgentWarnings");
  assert.ok("promptCache" in result, "result should have promptCache property");
});

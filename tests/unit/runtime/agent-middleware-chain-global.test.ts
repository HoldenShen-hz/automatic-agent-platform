import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentMiddlewareChain,
  createMiddlewareChain,
  globalMiddlewareChain,
  type BeforeAgentHook,
  type WrapToolCallHook,
  type MiddlewareContext,
} from "../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js";

test("globalMiddlewareChain is an AgentMiddlewareChain instance [agent-middleware-chain-global]", () => {
  assert.ok(globalMiddlewareChain instanceof AgentMiddlewareChain);
});

test("globalMiddlewareChain has default failOpen behavior [agent-middleware-chain-global]", async () => {
  const failingHook: BeforeAgentHook = {
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
  assert.ok(result.warnings[0]!.includes("Intentional failure"));

  // Clean up
  globalMiddlewareChain.reset();
});

test("AgentMiddlewareChain reset clears all hooks [agent-middleware-chain-global]", () => {
  const chain = createMiddlewareChain();

  chain.registerBeforeAgent({
    name: "test_hook",
    priority: 0,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  const hooksBefore = chain.getRegisteredHooks();
  assert.equal(hooksBefore.beforeAgent.length, 1);

  chain.reset();

  const hooksAfter = chain.getRegisteredHooks();
  assert.equal(hooksAfter.beforeAgent.length, 0);
});

test("AgentMiddlewareChain getRegisteredHooks returns all hook types [agent-middleware-chain-global]", () => {
  const chain = createMiddlewareChain();

  const hooks = chain.getRegisteredHooks();

  assert.ok(Array.isArray(hooks.beforeAgent));
  assert.ok(Array.isArray(hooks.beforeModel));
  assert.ok(Array.isArray(hooks.afterModel));
  assert.ok(Array.isArray(hooks.wrapModelCall));
  assert.ok(Array.isArray(hooks.wrapToolCall));
  assert.ok(Array.isArray(hooks.afterAgent));
});

test("AgentMiddlewareChain multiple hooks of same type are tracked [agent-middleware-chain-global]", () => {
  const chain = createMiddlewareChain();

  chain.registerBeforeAgent({
    name: "hook_1",
    priority: 10,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  chain.registerBeforeAgent({
    name: "hook_2",
    priority: 5,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  const hooks = chain.getRegisteredHooks();
  assert.equal(hooks.beforeAgent.length, 2);
});

test("AgentMiddlewareChain wrapToolCall hook can access args [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let capturedArgs: Record<string, unknown> = {};

  const capturingHook: WrapToolCallHook = {
    name: "capturer",
    priority: 0,
    run: async (_ctx, input, next) => {
      capturedArgs = { ...input.args };
      return next();
    },
  };

  chain.registerWrapToolCall(capturingHook);

  await chain.wrapToolCall(
    { toolName: "read_file", args: { path: "/tmp/test.txt", encoding: "utf8" } },
    async () => "result",
  );

  assert.equal(capturedArgs.path, "/tmp/test.txt");
  assert.equal(capturedArgs.encoding, "utf8");
});

test("AgentMiddlewareChain beforeModel hooks receive model from input [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let receivedModel: string | undefined = undefined;

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

test("AgentMiddlewareChain beforeModel works without model in input [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let receivedModel: string | undefined = undefined;

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

test("AgentMiddlewareChain afterAgent hooks receive response [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let receivedResponse: unknown = null;

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

test("AgentMiddlewareChain afterAgent hooks receive toolsUsed [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let receivedTools: string[] = [];

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

test("AgentMiddlewareChain afterModel hooks receive both messages and response [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let receivedMessages: unknown[] = [];
  let receivedResponse: unknown = null;

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

test("AgentMiddlewareChain sortedInsert maintains priority order [agent-middleware-chain-global]", () => {
  const chain = createMiddlewareChain();

  chain.registerBeforeAgent({
    name: "high_priority",
    priority: 100,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  chain.registerBeforeAgent({
    name: "low_priority",
    priority: 1,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  chain.registerBeforeAgent({
    name: "medium_priority",
    priority: 50,
    run: async () => ({ success: true }),
  } as BeforeAgentHook);

  const hooks = chain.getRegisteredHooks();
  const names = hooks.beforeAgent;

  assert.equal(names[0], "low_priority");
  assert.equal(names[1], "medium_priority");
  assert.equal(names[2], "high_priority");
});

test("AgentMiddlewareChain context buildContext uses provided agentRound and stepId [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let contextRound = -1;
  let contextStepId: string | null = null;

  chain.registerBeforeAgent({
    name: "context_inspector",
    priority: 0,
    run: async (ctx) => {
      contextRound = ctx.agentRound;
      contextStepId = ctx.stepId;
      return { success: true };
    },
  } as BeforeAgentHook);

  await chain.beforeAgent(
    { request: "test", history: [] },
    { agentRound: 5, stepId: "step_abc" },
  );

  assert.equal(contextRound, 5);
  assert.equal(contextStepId, "step_abc");
});

test("AgentMiddlewareChain context inherits from provided ctx [agent-middleware-chain-global]", async () => {
  const chain = createMiddlewareChain();
  let taskIdReceived: string = "";

  chain.registerBeforeAgent({
    name: "taskid_checker",
    priority: 0,
    run: async (ctx) => {
      taskIdReceived = ctx.taskId;
      return { success: true };
    },
  } as BeforeAgentHook);

  const ctx: MiddlewareContext = {
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
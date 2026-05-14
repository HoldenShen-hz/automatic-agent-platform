import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for agent-middleware-chain.ts - R9-23 onSucceeded/onFailed lifecycle hooks
 *
 * Coverage areas:
 * 1. registerOnSucceeded adds hook to the chain
 * 2. registerOnFailed adds hook to the chain
 * 3. onSucceeded hook receives taskId, executionId, output, durationMs
 * 4. onFailed hook receives taskId, executionId, errorCode, errorMessage, durationMs
 * 5. Hooks are called in sorted order (by priority)
 * 6. Multiple hooks receive the same input
 */

interface OnSucceededPayload {
  taskId: string;
  executionId: string;
  output: unknown;
  durationMs: number;
}

interface OnFailedPayload {
  taskId: string;
  executionId: string;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
}

// Mock runtime context for testing
const mockRuntimeContext = {
  traceId: "test-trace-id",
  taskId: "test-task-123",
  executionId: "test-execution-456",
};

test("AgentMiddlewareChain has registerOnSucceeded method", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  assert.ok(typeof chain.registerOnSucceeded === "function", "registerOnSucceeded should be a function");
});

test("AgentMiddlewareChain has registerOnFailed method", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  assert.ok(typeof chain.registerOnFailed === "function", "registerOnFailed should be a function");
});

test("registerOnSucceeded adds hook to the chain", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  let called = false;

  chain.registerOnSucceeded({
    name: "test-succeeded-hook",
    priority: 50,
    run: async (payload: OnSucceededPayload) => {
      called = true;
    },
  });

  const registered = chain.getRegisteredHooks();
  assert.ok(registered.onSucceeded.includes("test-succeeded-hook"), "Hook should be registered");
  assert.ok(called === false, "Hook should not be called until trigger");
});

test("registerOnFailed adds hook to the chain", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  let called = false;

  chain.registerOnFailed({
    name: "test-failed-hook",
    priority: 50,
    run: async (payload: OnFailedPayload) => {
      called = true;
    },
  });

  const registered = chain.getRegisteredHooks();
  assert.ok(registered.onFailed.includes("test-failed-hook"), "Hook should be registered");
  assert.ok(called === false, "Hook should not be called until trigger");
});

test("onSucceeded hook receives taskId, executionId, output, durationMs", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  let receivedPayload: OnSucceededPayload | null = null;

  chain.registerOnSucceeded({
    name: "payload-check-succeeded",
    priority: 50,
    run: async (payload: OnSucceededPayload) => {
      receivedPayload = payload;
    },
  });

  await chain.triggerOnSucceeded({
    taskId: "task-abc",
    executionId: "exec-xyz",
    output: { result: "success", data: [1, 2, 3] },
    durationMs: 150,
  });

  assert.ok(receivedPayload !== null, "Payload should be received");
  assert.equal(receivedPayload.taskId, "task-abc", "taskId should match");
  assert.equal(receivedPayload.executionId, "exec-xyz", "executionId should match");
  assert.deepStrictEqual(receivedPayload.output, { result: "success", data: [1, 2, 3] }, "output should match");
  assert.equal(receivedPayload.durationMs, 150, "durationMs should match");
});

test("onFailed hook receives taskId, executionId, errorCode, errorMessage, durationMs", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  let receivedPayload: OnFailedPayload | null = null;

  chain.registerOnFailed({
    name: "payload-check-failed",
    priority: 50,
    run: async (payload: OnFailedPayload) => {
      receivedPayload = payload;
    },
  });

  await chain.triggerOnFailed({
    taskId: "task-def",
    executionId: "exec-uvw",
    errorCode: "EXECUTION_FAILED",
    errorMessage: "Task execution timed out",
    durationMs: 3000,
  });

  assert.ok(receivedPayload !== null, "Payload should be received");
  assert.equal(receivedPayload.taskId, "task-def", "taskId should match");
  assert.equal(receivedPayload.executionId, "exec-uvw", "executionId should match");
  assert.equal(receivedPayload.errorCode, "EXECUTION_FAILED", "errorCode should match");
  assert.equal(receivedPayload.errorMessage, "Task execution timed out", "errorMessage should match");
  assert.equal(receivedPayload.durationMs, 3000, "durationMs should match");
});

test("onSucceeded hooks are called in sorted order by priority", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const callOrder: string[] = [];

  chain.registerOnSucceeded({
    name: "low-priority-succeeded",
    priority: 10,
    run: async () => {
      callOrder.push("low");
    },
  });

  chain.registerOnSucceeded({
    name: "high-priority-succeeded",
    priority: 100,
    run: async () => {
      callOrder.push("high");
    },
  });

  chain.registerOnSucceeded({
    name: "medium-priority-succeeded",
    priority: 50,
    run: async () => {
      callOrder.push("medium");
    },
  });

  await chain.triggerOnSucceeded({
    taskId: "task-order",
    executionId: "exec-order",
    output: "ordered",
    durationMs: 100,
  });

  assert.deepStrictEqual(callOrder, ["high", "medium", "low"], "Hooks should be called in descending priority order");
});

test("onFailed hooks are called in sorted order by priority", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const callOrder: string[] = [];

  chain.registerOnFailed({
    name: "low-priority-failed",
    priority: 10,
    run: async () => {
      callOrder.push("low");
    },
  });

  chain.registerOnFailed({
    name: "high-priority-failed",
    priority: 100,
    run: async () => {
      callOrder.push("high");
    },
  });

  chain.registerOnFailed({
    name: "medium-priority-failed",
    priority: 50,
    run: async () => {
      callOrder.push("medium");
    },
  });

  await chain.triggerOnFailed({
    taskId: "task-order",
    executionId: "exec-order",
    errorCode: "ERR",
    errorMessage: "Error",
    durationMs: 100,
  });

  assert.deepStrictEqual(callOrder, ["high", "medium", "low"], "Hooks should be called in descending priority order");
});

test("Multiple onSucceeded hooks receive the same input", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const receivedInputs: OnSucceededPayload[] = [];

  chain.registerOnSucceeded({
    name: "hook-a-succeeded",
    priority: 50,
    run: async (payload: OnSucceededPayload) => {
      receivedInputs.push({ ...payload });
    },
  });

  chain.registerOnSucceeded({
    name: "hook-b-succeeded",
    priority: 60,
    run: async (payload: OnSucceededPayload) => {
      receivedInputs.push({ ...payload });
    },
  });

  await chain.triggerOnSucceeded({
    taskId: "task-multi",
    executionId: "exec-multi",
    output: { value: 42 },
    durationMs: 200,
  });

  assert.equal(receivedInputs.length, 2, "Both hooks should be called");
  assert.deepStrictEqual(receivedInputs[0], receivedInputs[1], "Both hooks should receive identical payload");
  assert.equal(receivedInputs[0].taskId, "task-multi", "First hook should receive correct taskId");
  assert.equal(receivedInputs[1].taskId, "task-multi", "Second hook should receive correct taskId");
});

test("Multiple onFailed hooks receive the same input", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const receivedInputs: OnFailedPayload[] = [];

  chain.registerOnFailed({
    name: "hook-a-failed",
    priority: 50,
    run: async (payload: OnFailedPayload) => {
      receivedInputs.push({ ...payload });
    },
  });

  chain.registerOnFailed({
    name: "hook-b-failed",
    priority: 60,
    run: async (payload: OnFailedPayload) => {
      receivedInputs.push({ ...payload });
    },
  });

  await chain.triggerOnFailed({
    taskId: "task-multi",
    executionId: "exec-multi",
    errorCode: "MULTI_ERROR",
    errorMessage: "Multiple hooks error",
    durationMs: 500,
  });

  assert.equal(receivedInputs.length, 2, "Both hooks should be called");
  assert.deepStrictEqual(receivedInputs[0], receivedInputs[1], "Both hooks should receive identical payload");
  assert.equal(receivedInputs[0].errorCode, "MULTI_ERROR", "First hook should receive correct errorCode");
  assert.equal(receivedInputs[1].errorCode, "MULTI_ERROR", "Second hook should receive correct errorCode");
});

test("getRegisteredHooks includes onSucceeded and onFailed arrays", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();

  chain.registerOnSucceeded({
    name: "registered-succeeded",
    priority: 50,
    run: async () => {},
  });

  chain.registerOnFailed({
    name: "registered-failed",
    priority: 50,
    run: async () => {},
  });

  const registered = chain.getRegisteredHooks();
  assert.ok(Array.isArray(registered.onSucceeded), "onSucceeded should be an array");
  assert.ok(Array.isArray(registered.onFailed), "onFailed should be an array");
  assert.ok(registered.onSucceeded.includes("registered-succeeded"), "succeeded hook should be registered");
  assert.ok(registered.onFailed.includes("registered-failed"), "failed hook should be registered");
});

test("reset clears onSucceeded and onFailed hooks", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();

  chain.registerOnSucceeded({
    name: "reset-succeeded",
    priority: 50,
    run: async () => {},
  });

  chain.registerOnFailed({
    name: "reset-failed",
    priority: 50,
    run: async () => {},
  });

  chain.reset();

  const registered = chain.getRegisteredHooks();
  assert.equal(registered.onSucceeded.length, 0, "onSucceeded hooks should be cleared");
  assert.equal(registered.onFailed.length, 0, "onFailed hooks should be cleared");
});

test("triggerOnSucceeded calls all registered hooks even if one throws", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const callResults: string[] = [];

  chain.registerOnSucceeded({
    name: "hook-that-throws-succeeded",
    priority: 50,
    run: async () => {
      callResults.push("before-throw");
      throw new Error("Intentional test error");
    },
  });

  chain.registerOnSucceeded({
    name: "hook-after-throw-succeeded",
    priority: 60,
    run: async () => {
      callResults.push("after-throw");
    },
  });

  // Should not throw - hooks are fail-open
  await chain.triggerOnSucceeded({
    taskId: "task-fail-open",
    executionId: "exec-fail-open",
    output: "result",
    durationMs: 100,
  });

  assert.deepStrictEqual(callResults, ["before-throw", "after-throw"], "Both hooks should be called despite error");
});

test("triggerOnFailed calls all registered hooks even if one throws", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  const callResults: string[] = [];

  chain.registerOnFailed({
    name: "hook-that-throws-failed",
    priority: 50,
    run: async () => {
      callResults.push("before-throw");
      throw new Error("Intentional test error");
    },
  });

  chain.registerOnFailed({
    name: "hook-after-throw-failed",
    priority: 60,
    run: async () => {
      callResults.push("after-throw");
    },
  });

  // Should not throw - hooks are fail-open
  await chain.triggerOnFailed({
    taskId: "task-fail-open",
    executionId: "exec-fail-open",
    errorCode: "TEST_ERROR",
    errorMessage: "Test error message",
    durationMs: 100,
  });

  assert.deepStrictEqual(callResults, ["before-throw", "after-throw"], "Both hooks should be called despite error");
});

test("succeeded and failed hooks are independent - adding one does not affect the other", async () => {
  const { AgentMiddlewareChain } = await import("../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js");

  const chain = new AgentMiddlewareChain();
  let succeededCalled = false;
  let failedCalled = false;

  chain.registerOnSucceeded({
    name: "only-succeeded-hook",
    priority: 50,
    run: async () => {
      succeededCalled = true;
    },
  });

  chain.registerOnFailed({
    name: "only-failed-hook",
    priority: 50,
    run: async () => {
      failedCalled = true;
    },
  });

  await chain.triggerOnSucceeded({
    taskId: "task-indep",
    executionId: "exec-indep",
    output: "output",
    durationMs: 50,
  });

  assert.ok(succeededCalled, "Succeeded hook should be called");
  assert.ok(!failedCalled, "Failed hook should not be called when succeeded triggers");

  succeededCalled = false;

  await chain.triggerOnFailed({
    taskId: "task-indep",
    executionId: "exec-indep",
    errorCode: "ERR",
    errorMessage: "Error",
    durationMs: 50,
  });

  assert.ok(!succeededCalled, "Succeeded hook should not be called when failed triggers");
  assert.ok(failedCalled, "Failed hook should be called");
});

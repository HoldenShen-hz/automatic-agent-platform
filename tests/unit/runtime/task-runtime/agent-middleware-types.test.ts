import test from "node:test";
import assert from "node:assert/strict";
import type {
  MiddlewareResult,
  MiddlewareContext,
  MiddlewareHook,
  BeforeAgentHook,
  BeforeModelHook,
  AfterModelHook,
  WrapModelCallHook,
  WrapToolCallHook,
  AfterAgentHook,
  OnSucceededPayload,
  OnFailedPayload,
  OnSucceededHook,
  OnFailedHook,
} from "../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-types.js";

test("MiddlewareResult structure accepts valid shapes [agent-middleware-types]", () => {
  const successResult: MiddlewareResult = { success: true };
  assert.equal(successResult.success, true);

  const withInput: MiddlewareResult = { success: true, input: { key: "value" } };
  assert.deepEqual(withInput.input, { key: "value" });

  const withError: MiddlewareResult = {
    success: false,
    error: { code: "ERR_TEST", message: "Test error", warning: true },
  };
  assert.equal(withError.success, false);
  assert.equal(withError.error?.code, "ERR_TEST");
  assert.equal(withError.error?.warning, true);

  const continueOnError: MiddlewareResult = { success: false, continueOnError: true };
  assert.equal(continueOnError.continueOnError, true);
});

test("MiddlewareContext structure accepts valid shapes [agent-middleware-types]", () => {
  const ctx: MiddlewareContext = {
    runtime: { traceId: "trace_1", taskId: "task_1" },
    chainStartedAt: "2024-01-01T00:00:00.000Z",
    agentRound: 1,
    stepId: "step_1",
    executionId: "exec_1",
    taskId: "task_1",
  };

  assert.equal(ctx.runtime.traceId, "trace_1");
  assert.equal(ctx.agentRound, 1);
  assert.equal(ctx.stepId, "step_1");
  assert.equal(ctx.executionId, "exec_1");
});

test("MiddlewareContext accepts null stepId and executionId [agent-middleware-types]", () => {
  const ctx: MiddlewareContext = {
    runtime: { traceId: "trace_1", taskId: "task_1" },
    chainStartedAt: "2024-01-01T00:00:00.000Z",
    agentRound: 0,
    stepId: null,
    executionId: null,
    taskId: "task_1",
  };

  assert.equal(ctx.stepId, null);
  assert.equal(ctx.executionId, null);
});

test("MiddlewareHook structure with name and priority [agent-middleware-types]", () => {
  const hook: MiddlewareHook = { name: "test_hook", priority: 100 };
  assert.equal(hook.name, "test_hook");
  assert.equal(hook.priority, 100);
});

test("BeforeAgentHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: BeforeAgentHook = {
    name: "before_agent",
    priority: 10,
    run: async (ctx, input) => {
      return { success: true };
    },
  };

  assert.equal(hook.name, "before_agent");
  assert.equal(hook.priority, 10);
});

test("BeforeModelHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: BeforeModelHook = {
    name: "before_model",
    priority: 20,
    run: async (ctx, input) => {
      return { success: true, input: input.messages };
    },
  };

  assert.equal(hook.name, "before_model");
});

test("AfterModelHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: AfterModelHook = {
    name: "after_model",
    priority: 30,
    run: async (ctx, input) => {
      return { success: true };
    },
  };

  assert.equal(hook.name, "after_model");
});

test("WrapModelCallHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: WrapModelCallHook = {
    name: "wrap_model",
    priority: 40,
    run: async (ctx, input, next) => {
      return await next();
    },
  };

  assert.equal(hook.name, "wrap_model");
});

test("WrapToolCallHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: WrapToolCallHook = {
    name: "wrap_tool",
    priority: 50,
    run: async (ctx, input, next) => {
      return await next();
    },
  };

  assert.equal(hook.name, "wrap_tool");
});

test("AfterAgentHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: AfterAgentHook = {
    name: "after_agent",
    priority: 60,
    run: async (ctx, input) => {
      return { success: true };
    },
  };

  assert.equal(hook.name, "after_agent");
});

test("OnSucceededPayload structure [agent-middleware-types]", () => {
  const payload: OnSucceededPayload = {
    taskId: "task_123",
    executionId: "exec_456",
    output: { result: "success" },
    durationMs: 1500,
  };

  assert.equal(payload.taskId, "task_123");
  assert.equal(payload.executionId, "exec_456");
  assert.deepEqual(payload.output, { result: "success" });
  assert.equal(payload.durationMs, 1500);
});

test("OnFailedPayload structure [agent-middleware-types]", () => {
  const payload: OnFailedPayload = {
    taskId: "task_123",
    executionId: "exec_456",
    errorCode: "ERR_EXECUTION_FAILED",
    errorMessage: "Execution timed out",
    durationMs: 30000,
  };

  assert.equal(payload.taskId, "task_123");
  assert.equal(payload.executionId, "exec_456");
  assert.equal(payload.errorCode, "ERR_EXECUTION_FAILED");
  assert.equal(payload.errorMessage, "Execution timed out");
  assert.equal(payload.durationMs, 30000);
});

test("OnSucceededHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: OnSucceededHook = {
    name: "on_succeeded",
    priority: 70,
    run: async (payload) => {
      // Handle success
    },
  };

  assert.equal(hook.name, "on_succeeded");
});

test("OnFailedHook extends MiddlewareHook with correct signature [agent-middleware-types]", () => {
  const hook: OnFailedHook = {
    name: "on_failed",
    priority: 80,
    run: async (payload) => {
      // Handle failure
    },
  };

  assert.equal(hook.name, "on_failed");
});
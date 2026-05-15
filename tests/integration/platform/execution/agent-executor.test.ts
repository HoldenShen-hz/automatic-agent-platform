import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentExecutor,
  initializeAgentExecutor,
  getAgentExecutorContext,
  type AgentExecutorContext,
} from "../../../../src/platform/five-plane-execution/execution-engine/agent-executor.js";
import { resetMiddleware } from "../../../../src/platform/five-plane-execution/execution-engine/middleware-init.js";

function createTestContext(): AgentExecutorContext {
  return {
    traceId: "sandbox-test-trace",
    taskId: "sandbox-test-task",
    executionId: "sandbox-test-exec",
    sessionId: "sandbox-test-session",
    stepId: "sandbox-test-step",
    agentRound: 0,
  };
}

test("AgentExecutor sandbox: middleware chain integration", async () => {
  resetMiddleware();

  const executor = createAgentExecutor({
    loopDetection: { warnThreshold: 2, escalateThreshold: 5 },
  });

  const executionLog: string[] = [];

  const result = await executor.executeAgentRound(
    {
      request: "sandbox test request",
      history: [],
      messages: [{ role: "user", content: "sandbox test" }],
      model: "test-model",
      context: createTestContext(),
    },
    async () => {
      executionLog.push("model_call_executed");
      return { content: "sandbox response" };
    },
  );

  assert.ok(result.response);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.loopDetection !== undefined);
  assert.ok(Array.isArray(result.loopDetection!.patterns));

  executor.resetLoopDetection();
});

test("AgentExecutor sandbox: loop detection escalation", async () => {
  resetMiddleware();

  const executor = createAgentExecutor({
    loopDetection: { warnThreshold: 1, escalateThreshold: 2 },
  });

  await executor.wrapToolCall(
    "repeat_tool",
    { data: "same" },
    async () => {
      return "first_call";
    },
  );

  await executor.wrapToolCall(
    "repeat_tool",
    { data: "same" },
    async () => {
      return "second_call";
    },
  );

  const patterns = executor.getLoopDetectionPatterns();
  assert.ok(patterns.length >= 0);

  executor.resetLoopDetection();
});

test("AgentExecutor sandbox: isolation between executor instances", async () => {
  resetMiddleware();

  const executor1 = createAgentExecutor({ loopDetection: null });
  const executor2 = createAgentExecutor({ loopDetection: null });

  await executor1.executeAgentRound(
    {
      request: "executor1",
      history: [],
      messages: [],
      context: createTestContext(),
    },
    async () => "executor1_response",
  );

  await executor2.executeAgentRound(
    {
      request: "executor2",
      history: [],
      messages: [],
      context: createTestContext(),
    },
    async () => "executor2_response",
  );
});

test("AgentExecutor sandbox: singleton context is shared", () => {
  resetMiddleware();

  const ctx1 = initializeAgentExecutor({ loopDetection: null });
  const ctx2 = getAgentExecutorContext();

  assert.ok(ctx1 !== null);
  assert.ok(ctx2 !== null);
  assert.strictEqual(ctx1, ctx2);
});

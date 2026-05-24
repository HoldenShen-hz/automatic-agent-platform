import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentMiddlewareChain,
  type OnFailedPayload,
  type OnSucceededPayload,
} from "../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js";

test("AgentMiddlewareChain registers succeeded and failed hooks", () => {
  const chain = new AgentMiddlewareChain();

  chain.registerOnSucceeded({
    name: "success-hook",
    priority: 10,
    run: async () => {},
  });
  chain.registerOnFailed({
    name: "failure-hook",
    priority: 10,
    run: async () => {},
  });

  const registered = chain.getRegisteredHooks();
  assert.deepEqual(registered.onSucceeded, ["success-hook"]);
  assert.deepEqual(registered.onFailed, ["failure-hook"]);
});

test("AgentMiddlewareChain invokes success hooks in descending priority order with shared payload", async () => {
  const chain = new AgentMiddlewareChain();
  const order: string[] = [];
  const payloads: OnSucceededPayload[] = [];

  chain.registerOnSucceeded({
    name: "low",
    priority: 10,
    run: async (payload) => {
      order.push("low");
      payloads.push(payload);
    },
  });
  chain.registerOnSucceeded({
    name: "high",
    priority: 100,
    run: async (payload) => {
      order.push("high");
      payloads.push(payload);
    },
  });

  await chain.triggerOnSucceeded({
    taskId: "task-1",
    executionId: "exec-1",
    output: { ok: true },
    durationMs: 42,
  });

  const firstPayload = payloads[0];
  const secondPayload = payloads[1];
  assert.deepEqual(order, ["high", "low"]);
  assert.ok(firstPayload);
  assert.ok(secondPayload);
  assert.deepEqual(firstPayload, secondPayload);
  assert.equal(firstPayload.taskId, "task-1");
});

test("AgentMiddlewareChain invokes failed hooks with canonical failure payloads", async () => {
  const chain = new AgentMiddlewareChain();
  const received: OnFailedPayload[] = [];

  chain.registerOnFailed({
    name: "failure",
    priority: 50,
    run: async (payload) => {
      received.push(payload);
    },
  });

  await chain.triggerOnFailed({
    taskId: "task-2",
    executionId: "exec-2",
    errorCode: "EXECUTION_FAILED",
    errorMessage: "boom",
    durationMs: 99,
  });

  const firstFailure = received[0];
  assert.ok(firstFailure);
  assert.equal(firstFailure.taskId, "task-2");
  assert.equal(firstFailure.executionId, "exec-2");
  assert.equal(firstFailure.errorCode, "EXECUTION_FAILED");
});

test("AgentMiddlewareChain reset clears registered lifecycle hooks", () => {
  const chain = new AgentMiddlewareChain();
  chain.registerOnSucceeded({ name: "success-hook", priority: 1, run: async () => {} });
  chain.registerOnFailed({ name: "failure-hook", priority: 1, run: async () => {} });

  chain.reset();

  assert.deepEqual(chain.getRegisteredHooks(), {
    beforeAgent: [],
    beforeModel: [],
    afterModel: [],
    wrapModelCall: [],
    wrapToolCall: [],
    afterAgent: [],
    onSucceeded: [],
    onFailed: [],
  });
});

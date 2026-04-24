import assert from "node:assert/strict";
import test from "node:test";

import { AdapterExecutor } from "../../../../../src/platform/execution/plugin-executor/adapter-executor.js";

test("AdapterExecutor executes REST adapters with injected fetch", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => new Response(init?.body as string, {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
  });

  const result = await executor.execute("rest-adapter", {
    action: "sync",
    payload: { ok: true },
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.protocol, "rest");
});

test("AdapterExecutor executes MQ adapters with dispatcher", async () => {
  const executor = new AdapterExecutor({
    mqDispatcher: async (_descriptor, request) => ({
      acceptedAction: request.action,
      taskId: request.context.taskId,
    }),
  });
  executor.register({
    adapterId: "mq-adapter",
    protocol: "mq",
    endpoint: "queue://jobs",
  });

  const result = await executor.execute("mq-adapter", {
    action: "publish",
    payload: { body: "hello" },
    context: { taskId: "task_2" },
  });

  assert.equal(result.status, "ok");
  assert.deepStrictEqual(result.output, { acceptedAction: "publish", taskId: "task_2" });
});

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

test("AdapterExecutor REST adapter handles non-200 response as error", async () => {
  let callCount = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      callCount++;
      return new Response("Not Found", { status: 404 });
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
  });

  const result = await executor.execute("rest-adapter", {
    action: "sync",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  assert.ok(result.output && typeof result.output === "object" && "error" in result.output);
});

test("AdapterExecutor REST adapter handles JSON and text responses", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ echoed: body.payload }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
  });

  const result = await executor.execute("rest-adapter", {
    action: "echo",
    payload: { message: "hello" },
    context: { taskId: "task_1", tenantId: "tenant-1", correlationId: "corr-1" },
  });

  assert.equal(result.status, "ok");
  assert.deepStrictEqual(result.output, { echoed: { message: "hello" } });
});

test("AdapterExecutor MQ adapter throws when dispatcher is missing", async () => {
  const executor = new AdapterExecutor();
  executor.register({
    adapterId: "mq-adapter",
    protocol: "mq",
    endpoint: "queue://jobs",
  });

  const result = await executor.execute("mq-adapter", {
    action: "publish",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  assert.ok(result.output && typeof result.output === "object" && "error" in result.output);
});

test("AdapterExecutor retry policy retries on failure", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Temporary failure");
      }
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 10,
    },
  });

  const result = await executor.execute("rest-adapter", {
    action: "sync",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 3);
});

test("AdapterExecutor retry policy returns error when all attempts fail", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      throw new Error("Permanent failure");
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 5,
    },
  });

  const result = await executor.execute("rest-adapter", {
    action: "sync",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  assert.equal(result.attempts, 3);
  assert.ok(result.output && typeof result.output === "object" && "error" in result.output);
});

test("AdapterExecutor listAdapters returns all registered adapters", () => {
  const executor = new AdapterExecutor();
  executor.register({
    adapterId: "adapter-1",
    protocol: "rest",
    endpoint: "https://example.com/1",
  });
  executor.register({
    adapterId: "adapter-2",
    protocol: "grpc",
    endpoint: "localhost:50051",
  });

  const adapters = executor.listAdapters();
  assert.equal(adapters.length, 2);
  assert.ok(adapters.some((a) => a.adapterId === "adapter-1"));
  assert.ok(adapters.some((a) => a.adapterId === "adapter-2"));
});

test("AdapterExecutor execute throws for unknown adapter", async () => {
  const executor = new AdapterExecutor();

  await assert.rejects(
    () =>
      executor.execute("nonexistent", {
        action: "sync",
        payload: {},
        context: { taskId: "task_1" },
      }),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("AdapterExecutor includes duration and attempt count in result", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => new Response('{"ok":true}', {
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
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.attempts, 1);
  assert.ok(result.durationMs >= 0);
  assert.ok(result.durationMs >= 0);
});

test("AdapterExecutor passes correlationId and tenantId in context", async () => {
  let receivedContext: unknown = null;
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(init?.body as string);
      receivedContext = body.context;
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
  });

  await executor.execute("rest-adapter", {
    action: "sync",
    payload: {},
    context: {
      taskId: "task_1",
      tenantId: "tenant-abc",
      correlationId: "corr-xyz",
    },
  });

  assert.deepStrictEqual(receivedContext, {
    taskId: "task_1",
    tenantId: "tenant-abc",
    correlationId: "corr-xyz",
  });
});

test("AdapterExecutor uses custom headers in REST requests", async () => {
  let receivedHeaders: Record<string, string> = {};
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      receivedHeaders = (init?.headers as Record<string, string>) ?? {};
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  executor.register({
    adapterId: "rest-adapter",
    protocol: "rest",
    endpoint: "https://example.com/adapter",
    headers: {
      "x-custom-header": "custom-value",
      "x-api-key": "secret-key",
    },
  });

  await executor.execute("rest-adapter", {
    action: "sync",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(receivedHeaders["x-custom-header"], "custom-value");
  assert.equal(receivedHeaders["x-api-key"], "secret-key");
  assert.equal(receivedHeaders["content-type"], "application/json");
});

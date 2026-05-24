import assert from "node:assert/strict";
import test from "node:test";

import {
  AdapterExecutor,
  type AdapterDescriptor,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/adapter-executor.js";
import type { GrpcCallResponse } from "../../../../../src/platform/five-plane-interface/api/grpc-adapter-service.js";

function makeDescriptor(overrides: Partial<AdapterDescriptor> = {}): AdapterDescriptor {
  return {
    adapterId: "adapter-1",
    protocol: "rest",
    endpoint: "https://example.test/adapter",
    ...overrides,
  };
}

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("AdapterExecutor registers descriptors and rejects duplicates", () => {
  const executor = new AdapterExecutor();
  const descriptor = makeDescriptor();

  executor.register(descriptor);

  assert.equal(executor.listAdapters().length, 1);
  assert.throws(() => executor.register(descriptor), /adapter_already_registered/);
});

test("AdapterExecutor rejects unknown adapters", async () => {
  const executor = new AdapterExecutor();

  await assert.rejects(
    executor.execute("missing", {
      action: "ping",
      payload: {},
      context: { taskId: "task-1", tenantId: null },
    }),
    /adapter_not_found/,
  );
});

test("AdapterExecutor executes REST adapters and forwards payload", async () => {
  let capturedBody = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedBody = String(init?.body ?? "");
    return makeJsonResponse({ ok: true, result: "done" });
  };
  const executor = new AdapterExecutor({ fetchImpl });
  executor.register(makeDescriptor({ headers: { "x-test": "1" } }));

  const result = await executor.execute("adapter-1", {
    action: "sync",
    payload: { value: 42 },
    context: { taskId: "task-1", tenantId: "tenant-1", correlationId: "corr-1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.protocol, "rest");
  assert.deepEqual(result.output, { ok: true, result: "done" });
  assert.ok(capturedBody.includes("\"action\":\"sync\""));
  assert.ok(capturedBody.includes("\"value\":42"));
});

test("AdapterExecutor returns null for REST no-content responses", async () => {
  const fetchImpl: typeof fetch = async () => new Response(null, { status: 204 });
  const executor = new AdapterExecutor({ fetchImpl });
  executor.register(makeDescriptor());

  const result = await executor.execute("adapter-1", {
    action: "noop",
    payload: {},
    context: { taskId: "task-1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.output, null);
});

test("AdapterExecutor exhausts retries and returns structured error output", async () => {
  let attempts = 0;
  const fetchImpl: typeof fetch = async () => {
    attempts += 1;
    throw new Error("upstream_down");
  };
  const executor = new AdapterExecutor({ fetchImpl });
  executor.register(makeDescriptor({
    retryPolicy: {
      maxAttempts: 2,
      backoffMs: 0,
      jitterPercent: 0,
    },
  }));

  const result = await executor.execute("adapter-1", {
    action: "sync",
    payload: {},
    context: { taskId: "task-1", tenantId: null },
  });

  assert.equal(attempts, 2);
  assert.equal(result.status, "error");
  assert.equal(result.attempts, 2);
  assert.deepEqual(result.output, {
    error: "upstream_down",
    error_code: "RETRY_EXHAUSTED",
    retryExhausted: true,
    maxAttempts: 2,
    lastErrorCode: "Error",
  });
});

test("AdapterExecutor routes gRPC adapters through the configured factory", async () => {
  const executor = new AdapterExecutor({
    grpcFactory: () => ({
      call: async (
        serviceName: string,
        method: string,
        request: Record<string, unknown>,
        metadata?: Record<string, string>,
      ): Promise<GrpcCallResponse> => ({
        success: true,
        data: { serviceName, method, request, metadata },
      }),
    }) as never,
  });
  executor.register(makeDescriptor({
    protocol: "grpc",
    endpoint: "127.0.0.1:50051",
    grpc: {
      packageName: "demo.pkg",
      serviceName: "Runner",
    },
  }));

  const result = await executor.execute("adapter-1", {
    action: "Execute",
    payload: { x: 1 },
    context: { taskId: "task-1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.protocol, "grpc");
  assert.deepEqual(result.output, {
    serviceName: "demo.pkg.Runner",
    method: "Execute",
    request: {
      payload: { x: 1 },
      context: { taskId: "task-1", tenantId: null },
    },
    metadata: undefined,
  });
});

test("AdapterExecutor throws for MQ adapters without a dispatcher", async () => {
  const executor = new AdapterExecutor();
  executor.register(makeDescriptor({
    protocol: "mq",
    endpoint: "mq://queue/demo",
  }));

  await assert.rejects(
    executor.execute("adapter-1", {
      action: "publish",
      payload: {},
      context: { taskId: "task-1", tenantId: null },
    }),
    /mq_dispatcher_missing/,
  );
});

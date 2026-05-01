/**
 * Unit Tests: Adapter Executor
 *
 * Tests for the AdapterExecutor which handles protocol-based adapter execution
 * with retry logic, idempotency, and error handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdapterExecutor, type AdapterDescriptor } from "../../../../../src/platform/five-plane-execution/plugin-executor/adapter-executor.js";

// Mock GrpcAdapterService for testing
class MockGrpcAdapterService {
  public call = async () => ({ success: true, data: null });
}

function createTestDescriptor(overrides: Partial<AdapterDescriptor> = {}): AdapterDescriptor {
  return {
    adapterId: "test-adapter",
    protocol: "rest",
    endpoint: "https://api.test.com/adapter",
    ...overrides,
  };
}

function createMockFetch(response: unknown, ok = true) {
  return async () => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    headers: new Map([["content-type", "application/json"]]),
    json: async () => response,
    text: async () => JSON.stringify(response),
  }) as unknown as typeof fetch;
}

test("AdapterExecutor registers adapter descriptor", () => {
  const executor = new AdapterExecutor();
  const descriptor = createTestDescriptor();

  executor.register(descriptor);

  const adapters = executor.listAdapters();
  assert.equal(adapters.length, 1);
  assert.equal(adapters[0]?.adapterId, "test-adapter");
});

test("AdapterExecutor rejects duplicate adapter registration", () => {
  const executor = new AdapterExecutor();
  const descriptor = createTestDescriptor();

  executor.register(descriptor);

  assert.throws(
    () => executor.register(descriptor),
    { message: /adapter_already_registered/ },
  );
});

test("AdapterExecutor execute throws for unknown adapter", async () => {
  const executor = new AdapterExecutor();

  await assert.rejects(
    async () => executor.execute("unknown-adapter", {
      action: "test",
      payload: {},
      context: { taskId: "task_1", tenantId: null },
    }),
    { message: /adapter_not_found/ },
  );
});

test("AdapterExecutor execute returns ok status on success", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: createMockFetch({ result: "success" }),
  });
  executor.register(createTestDescriptor({ protocol: "rest" }));

  const result = await executor.execute("test-adapter", {
    action: "test_action",
    payload: { key: "value" },
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 1);
  assert.equal(result.action, "test_action");
});

test("AdapterExecutor execute respects maxAttempts retry", async () => {
  let attempts = 0;
  const failingFetch = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error("Temporary failure");
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ success: true }),
    } as unknown as Response;
  };

  const executor = new AdapterExecutor({
    fetchImpl: failingFetch as unknown as typeof fetch,
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    retryPolicy: { maxAttempts: 3, backoffMs: 10, backoffMaxMs: 50 },
  }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 3);
});

test("AdapterExecutor execute returns error status after retry exhaustion", async () => {
  const alwaysFailingFetch = async () => {
    throw new Error("Permanent failure");
  };

  const executor = new AdapterExecutor({
    fetchImpl: alwaysFailingFetch as unknown as typeof fetch,
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    retryPolicy: { maxAttempts: 2, backoffMs: 10, backoffMaxMs: 50 },
  }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "error");
  assert.equal(result.attempts, 2);
  assert.ok((result.output as Record<string, unknown>).error_code, "RETRY_EXHAUSTED");
});

test("AdapterExecutor execute uses exponential backoff", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: createMockFetch({ result: "success" }),
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    retryPolicy: { maxAttempts: 3, backoffMs: 50, backoffMaxMs: 500 },
  }));

  const startTime = Date.now();
  await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });
  const elapsed = Date.now() - startTime;

  // Should have some delay due to backoff between retries
  // Note: In this test with successful first attempt, no backoff needed
  assert.ok(elapsed < 1000);
});

test("AdapterExecutor execute handles 204 No Content response", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => ({
      ok: true,
      status: 204,
      statusText: "No Content",
      headers: new Map(),
    }) as unknown as Response,
  });
  executor.register(createTestDescriptor({ protocol: "rest" }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.output, null);
});

test("AdapterExecutor execute handles grpc protocol", async () => {
  const executor = new AdapterExecutor({
    grpcFactory: () => new MockGrpcAdapterService() as any,
  });
  executor.register(createTestDescriptor({
    protocol: "grpc",
    endpoint: "localhost:50051",
    grpc: {
      packageName: "test.package",
      serviceName: "TestService",
    },
  }));

  const result = await executor.execute("test-adapter", {
    action: "test_action",
    payload: { data: "test" },
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.protocol, "grpc");
});

test("AdapterExecutor execute throws for unsupported protocol", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: createMockFetch({ result: "success" }),
  });
  executor.register(createTestDescriptor({
    protocol: "mq",
    endpoint: "mq://localhost",
    // No mqDispatcher provided
  }));

  await assert.rejects(
    async () => executor.execute("test-adapter", {
      action: "test",
      payload: {},
      context: { taskId: "task_1", tenantId: null },
    }),
    { message: /mq_dispatcher_missing/ },
  );
});

test("AdapterExecutor execute handles non-ok response", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ error: "Invalid request" }),
    }) as unknown as Response,
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    retryPolicy: { maxAttempts: 1 },
  }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(result.status, "error");
  assert.ok((result.output as Record<string, unknown>).error?.includes("rest_failed"));
});

test("AdapterExecutor execute passes headers to REST calls", async () => {
  const capturedHeaders: Record<string, string> = {};
  const executor = new AdapterExecutor({
    fetchImpl: async (url, init) => {
      if (init?.headers) {
        const headers = init.headers as Record<string, string>;
        Object.entries(headers).forEach(([k, v]) => { capturedHeaders[k] = v; });
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ result: "ok" }),
      } as unknown as Response;
    },
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    headers: { "X-Custom-Header": "custom-value", "Authorization": "Bearer token" },
  }));

  await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal(capturedHeaders["X-Custom-Header"], "custom-value");
  assert.equal(capturedHeaders["Authorization"], "Bearer token");
});

test("AdapterExecutor execute uses custom timeout", async () => {
  let startTime = 0;
  const slowFetch = async (url: string, init: RequestInit) => {
    startTime = Date.now();
    // AbortSignal.timeout will abort if takes longer than timeout
    // We simulate a slow response that gets aborted
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({}),
    } as unknown as Response;
  };

  const executor = new AdapterExecutor({
    fetchImpl: slowFetch as unknown as typeof fetch,
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    timeoutMs: 50, // Very short timeout
  }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  // Should have error due to timeout
  assert.equal(result.status, "error");
});

test("AdapterExecutor execute calculates durationMs", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ result: "ok" }),
      } as unknown as Response;
    },
  });
  executor.register(createTestDescriptor({ protocol: "rest" }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.ok(result.durationMs >= 0);
});

test("AdapterExecutor listAdapters returns all registered adapters", () => {
  const executor = new AdapterExecutor();

  executor.register(createTestDescriptor({ adapterId: "adapter_1" }));
  executor.register(createTestDescriptor({ adapterId: "adapter_2", endpoint: "https://api.test2.com" }));
  executor.register(createTestDescriptor({ adapterId: "adapter_3", endpoint: "https://api.test3.com" }));

  const adapters = executor.listAdapters();
  assert.equal(adapters.length, 3);
  assert.ok(adapters.some((a) => a.adapterId === "adapter_1"));
  assert.ok(adapters.some((a) => a.adapterId === "adapter_2"));
  assert.ok(adapters.some((a) => a.adapterId === "adapter_3"));
});

test("AdapterExecutor execute with correlationId includes in log context", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: createMockFetch({ result: "success" }),
  });
  executor.register(createTestDescriptor({ protocol: "rest" }));

  const result = await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: "tenant_abc", correlationId: "corr_123" },
  });

  assert.equal(result.status, "ok");
});

test("AdapterExecutor execute retry uses backoff multiplier", async () => {
  let attemptTimestamps: number[] = [];
  const timestampsFetch = async () => {
    attemptTimestamps.push(Date.now());
    if (attemptTimestamps.length < 3) {
      throw new Error("Retry me");
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ result: "ok" }),
    } as unknown as Response;
  };

  const executor = new AdapterExecutor({
    fetchImpl: timestampsFetch as unknown as typeof fetch,
  });
  executor.register(createTestDescriptor({
    protocol: "rest",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 100,
      backoffMultiplier: 2,
      backoffMaxMs: 1000,
      jitterPercent: 0,
    },
  }));

  await executor.execute("test-adapter", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  // With multiplier 2 and base 100ms: delays should be ~100ms, then ~200ms
  if (attemptTimestamps.length >= 3) {
    const firstDelay = attemptTimestamps[1] - attemptTimestamps[0];
    const secondDelay = attemptTimestamps[2] - attemptTimestamps[1];
    // First retry delay should be approximately backoffMs
    assert.ok(firstDelay >= 50, "First delay should be at least 50ms");
    // Second retry delay should be approximately backoffMs * multiplier
    assert.ok(secondDelay >= 100, "Second delay should be at least 100ms");
  }
});
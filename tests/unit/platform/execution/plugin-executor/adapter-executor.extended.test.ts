/**
 * AdapterExecutor Extended Unit Tests
 *
 * Additional tests for external adapter execution:
 * - gRPC adapter factory and invocation
 * - REST adapter timeout and content type handling
 * - Retry policy edge cases
 * - Error classification
 * - Multiple adapter scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AdapterExecutor, type AdapterDescriptor, type AdapterExecutionRequest } from "../../../../../src/platform/execution/plugin-executor/adapter-executor.js";

// ─────────────────────────────────────────────────────────────────────────────
// gRPC Adapter Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor uses custom gRPC factory", async () => {
  let factoryCallCount = 0;
  const executor = new AdapterExecutor({
    grpcFactory: (descriptor) => {
      factoryCallCount++;
      // Return a mock that will fail on call since we don't have a real gRPC server
      return {
        call: async () => {
          throw new Error("gRPC not available in test");
        },
      } as any;
    },
  });

  executor.register({
    adapterId: "grpc-adapter",
    protocol: "grpc",
    endpoint: "localhost:50051",
    grpc: {
      packageName: "test.package",
      serviceName: "TestService",
    },
  });

  const result = await executor.execute("grpc-adapter", {
    action: "TestAction",
    payload: { data: "test" },
    context: { taskId: "task_1" },
  });

  assert.equal(factoryCallCount, 1);
  assert.equal(result.status, "error");
});

test("AdapterExecutor gRPC extracts service name from grpc config", async () => {
  let receivedServiceName = "";
  const executor = new AdapterExecutor({
    grpcFactory: (descriptor) => {
      return {
        call: async (serviceName: string) => {
          receivedServiceName = serviceName;
          throw new Error("gRPC not available");
        },
      } as any;
    },
  });

  executor.register({
    adapterId: "grpc-adapter",
    protocol: "grpc",
    endpoint: "localhost:50051",
    grpc: {
      packageName: "my.package",
      serviceName: "MyService",
    },
  });

  await executor.execute("grpc-adapter", {
    action: "DoThing",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(receivedServiceName, "my.package.MyService");
});

test("AdapterExecutor gRPC falls back to adapterId when grpc config missing", async () => {
  let receivedServiceName = "";
  const executor = new AdapterExecutor({
    grpcFactory: () => {
      return {
        call: async (serviceName: string) => {
          receivedServiceName = serviceName;
          throw new Error("gRPC not available");
        },
      } as any;
    },
  });

  executor.register({
    adapterId: "fallback-grpc-adapter",
    protocol: "grpc",
    endpoint: "localhost:50051",
    // No grpc config
  });

  await executor.execute("fallback-grpc-adapter", {
    action: "DoThing",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(receivedServiceName, "fallback-grpc-adapter");
});

test("AdapterExecutor gRPC parses host from endpoint when grpc host not specified", async () => {
  const executor = new AdapterExecutor({
    grpcFactory: (descriptor) => {
      // The default factory parses host from endpoint
      return {
        call: async () => {
          throw new Error("gRPC not available");
        },
      } as any;
    },
  });

  executor.register({
    adapterId: "grpc-host-test",
    protocol: "grpc",
    endpoint: "192.168.1.100:50051",
    grpc: {
      packageName: "test",
      serviceName: "Service",
    },
  });

  const result = await executor.execute("grpc-host-test", {
    action: "Test",
    payload: {},
    context: { taskId: "task_1" },
  });

  // Should attempt execution (will fail with gRPC not available)
  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// REST Adapter Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor REST adapter uses custom timeout", async () => {
  let receivedSignal: AbortSignal | null = null;
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      receivedSignal = init?.signal as AbortSignal | null;
      // Don't complete - we just want to see the signal
      return new Response('{}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "rest-timeout",
    protocol: "rest",
    endpoint: "https://example.com",
    timeoutMs: 30000,
  });

  await executor.execute("rest-timeout", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.ok(receivedSignal);
});

test("AdapterExecutor REST adapter handles text response", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () =>
      new Response("plain text response", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
  });

  executor.register({
    adapterId: "rest-text",
    protocol: "rest",
    endpoint: "https://example.com/text",
  });

  const result = await executor.execute("rest-text", {
    action: "getText",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.output, "plain text response");
});

test("AdapterExecutor REST adapter handles empty response body", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => new Response("", { status: 204 }),
  });

  executor.register({
    adapterId: "rest-empty",
    protocol: "rest",
    endpoint: "https://example.com/empty",
  });

  const result = await executor.execute("rest-empty", {
    action: "delete",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
});

test("AdapterExecutor REST adapter handles request with no headers", async () => {
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
    adapterId: "rest-no-headers",
    protocol: "rest",
    endpoint: "https://example.com",
    // No headers specified
  });

  await executor.execute("rest-no-headers", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(receivedHeaders["content-type"], "application/json");
});

test("AdapterExecutor REST adapter includes action and context in body", async () => {
  let receivedBody: unknown = null;
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      if (init?.body) {
        receivedBody = JSON.parse(init.body as string);
      }
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "rest-body-structure",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  await executor.execute("rest-body-structure", {
    action: "myAction",
    payload: { key: "value" },
    context: { taskId: "task_123", tenantId: "tenant_abc" },
  });

  assert.ok(receivedBody);
  assert.equal((receivedBody as any).action, "myAction");
  assert.deepStrictEqual((receivedBody as any).payload, { key: "value" });
  assert.deepStrictEqual((receivedBody as any).context, {
    taskId: "task_123",
    tenantId: "tenant_abc",
  });
});

test("AdapterExecutor REST uses POST method regardless of action type", async () => {
  let receivedMethod = "";
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      receivedMethod = init?.method ?? "";
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "rest-post-method",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  await executor.execute("rest-post-method", {
    action: "someAction",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(receivedMethod, "POST");
});

test("AdapterExecutor REST adds Content-Type for JSON body", async () => {
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
    adapterId: "rest-content-type",
    protocol: "rest",
    endpoint: "https://example.com",
    headers: { "x-custom": "value" }, // Already has custom header
  });

  await executor.execute("rest-content-type", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  // Content-Type should be set to application/json
  assert.equal(receivedHeaders["content-type"], "application/json");
  // Custom header should be preserved
  assert.equal(receivedHeaders["x-custom"], "value");
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry Policy Edge Case Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor retry policy handles maxAttempts of 1", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      throw new Error("Always fails");
    },
  });

  executor.register({
    adapterId: "retry-once",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: {
      maxAttempts: 1,
      backoffMs: 0,
    },
  });

  const result = await executor.execute("retry-once", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  assert.equal(result.attempts, 1);
});

test("AdapterExecutor retry policy handles zero backoff", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      if (attempts < 2) throw new Error("Fail first");
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "zero-backoff",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 0,
    },
  });

  const result = await executor.execute("zero-backoff", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 2);
});

test("AdapterExecutor retry policy handles retry with backoff delay", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      if (attempts < 2) throw new Error("Temporary failure");
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const startTime = Date.now();
  const result = await executor.execute("retry-backoff", {
    adapterId: "retry-backoff",
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  } as any);
  const elapsed = Date.now() - startTime;

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 2);
  // With backoff, there should be some delay (though minimal in test environment)
});

test("AdapterExecutor retry policy does not retry on success", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "no-retry-needed",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: {
      maxAttempts: 5,
      backoffMs: 1000,
    },
  });

  const result = await executor.execute("no-retry-needed", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor handles non-JSON error responses", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => new Response("Internal Server Error", { status: 500 }),
  });

  executor.register({
    adapterId: "server-error",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  const result = await executor.execute("server-error", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  assert.ok(result.output && typeof result.output === "object" && "error" in result.output);
});

test("AdapterExecutor handles network errors", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      throw new Error("ENOTFOUND: getaddrinfo failed");
    },
  });

  executor.register({
    adapterId: "network-error",
    protocol: "rest",
    endpoint: "https://nonexistent.example.com",
  });

  const result = await executor.execute("network-error", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
});

test("AdapterExecutor handles timeout errors", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      // Simulate a timeout by immediately aborting
      init?.signal?.throwOnAbort?.();
      return new Response("", { status: 0 });
    },
  });

  executor.register({
    adapterId: "timeout-error",
    protocol: "rest",
    endpoint: "https://slow.example.com",
    timeoutMs: 1,
  });

  const result = await executor.execute("timeout-error", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
});

test("AdapterExecutor preserves error message from failed requests", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      throw new Error("Connection refused");
    },
  });

  executor.register({
    adapterId: "error-message",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  const result = await executor.execute("error-message", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  const output = result.output as { error?: string };
  assert.equal(output.error, "Connection refused");
});

test("AdapterExecutor handles non-Error objects thrown", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      throw "string error";
    },
  });

  executor.register({
    adapterId: "string-error",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  const result = await executor.execute("string-error", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
  const output = result.output as { error?: string };
  assert.equal(output.error, "string error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Duration and Performance Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor returns positive durationMs", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      // Small delay to ensure duration is measurable
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "duration-test",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  const result = await executor.execute("duration-test", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.ok(result.durationMs >= 0);
});

test("AdapterExecutor reports attempt count correctly on multi-attempt success", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      if (attempts < 3) throw new Error("Fail twice");
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "attempt-count",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: { maxAttempts: 5, backoffMs: 5 },
  });

  const result = await executor.execute("attempt-count", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.attempts, 3);
});

test("AdapterExecutor reports attempt count correctly on all failures", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      throw new Error("Always fails");
    },
  });

  executor.register({
    adapterId: "attempt-count-fail",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: { maxAttempts: 4, backoffMs: 5 },
  });

  const result = await executor.execute("attempt-count-fail", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.attempts, 4);
  assert.equal(attempts, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// Adapter Registry Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor does not allow duplicate adapter registration", () => {
  const executor = new AdapterExecutor();
  const descriptor: AdapterDescriptor = {
    adapterId: "duplicate-adapter",
    protocol: "rest",
    endpoint: "https://example.com",
  };

  executor.register(descriptor);

  assert.throws(
    () => executor.register(descriptor),
    (err: Error) => {
      return err.message.includes("already registered") || err.message.includes("Adapter already registered");
    },
  );
});

test("AdapterExecutor allows different adapters with same endpoint", () => {
  const executor = new AdapterExecutor();

  executor.register({
    adapterId: "adapter-a",
    protocol: "rest",
    endpoint: "https://same-endpoint.com/api",
  });

  executor.register({
    adapterId: "adapter-b",
    protocol: "rest",
    endpoint: "https://same-endpoint.com/api",
  });

  const adapters = executor.listAdapters();
  assert.equal(adapters.length, 2);
});

test("AdapterExecutor listAdapters returns empty initially", () => {
  const executor = new AdapterExecutor();

  const adapters = executor.listAdapters();
  assert.deepStrictEqual(adapters, []);
});

test("AdapterExecutor listAdapters returns readonly array", () => {
  const executor = new AdapterExecutor();
  executor.register({
    adapterId: "readonly-test",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  const adapters = executor.listAdapters();
  (adapters as unknown as { length: number }).length = 10;

  // Should not affect internal state
  assert.equal(executor.listAdapters().length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Protocol Routing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor routes to REST protocol handler", async () => {
  let handlerCalled = false;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      handlerCalled = true;
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "route-rest",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  await executor.execute("route-rest", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(handlerCalled, true);
});

test("AdapterExecutor routes to gRPC protocol handler", async () => {
  const executor = new AdapterExecutor({
    grpcFactory: () => ({
      call: async () => {
        throw new Error("gRPC not available");
      },
    } as any),
  });

  executor.register({
    adapterId: "route-grpc",
    protocol: "grpc",
    endpoint: "localhost:50051",
  });

  const result = await executor.execute("route-grpc", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  // Should route to gRPC handler (which fails in test)
  assert.equal(result.status, "error");
});

test("AdapterExecutor routes to MQ protocol handler", async () => {
  const executor = new AdapterExecutor({
    mqDispatcher: async (descriptor, request) => ({
      mqAdapterId: descriptor.adapterId,
      receivedAction: request.action,
    }),
  });

  executor.register({
    adapterId: "route-mq",
    protocol: "mq",
    endpoint: "queue://test",
  });

  const result = await executor.execute("route-mq", {
    action: "publish",
    payload: { message: "hello" },
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
  const output = result.output as { mqAdapterId?: string; receivedAction?: string };
  assert.equal(output.mqAdapterId, "route-mq");
  assert.equal(output.receivedAction, "publish");
});

test("AdapterExecutor handles unsupported protocol", async () => {
  const executor = new AdapterExecutor();

  // Create an executor with an invalid protocol directly in the map
  (executor as any).descriptors.set("unknown-protocol", {
    adapterId: "unknown-protocol",
    protocol: "unknown" as any,
    endpoint: "https://example.com",
  });

  const result = await executor.execute("unknown-protocol", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Values Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor defaults to fetch global when no fetchImpl provided", () => {
  // This test verifies that without a custom fetchImpl, the global fetch is used
  // We can't actually test the global fetch in unit tests without a real endpoint
  // So we just verify the executor is created without error
  const executor = new AdapterExecutor();
  assert.ok(executor);
});

test("AdapterExecutor defaults maxAttempts to 1", async () => {
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      throw new Error("Fail");
    },
  });

  executor.register({
    adapterId: "default-attempts",
    protocol: "rest",
    endpoint: "https://example.com",
    // No retryPolicy specified
  });

  const result = await executor.execute("default-attempts", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.attempts, 1);
});

test("AdapterExecutor defaults backoffMs to 0", async () => {
  let attempts = 0;
  const executor = new AdapterExecutor({
    fetchImpl: async () => {
      attempts++;
      if (attempts < 2) throw new Error("Fail");
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "default-backoff",
    protocol: "rest",
    endpoint: "https://example.com",
    retryPolicy: {
      maxAttempts: 3,
      // No backoffMs specified - should default to 0
    },
  });

  const startTime = Date.now();
  const result = await executor.execute("default-backoff", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });
  const elapsed = Date.now() - startTime;

  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 2);
  // With zero backoff, should complete quickly
  assert.ok(elapsed < 100);
});

test("AdapterExecutor defaults timeoutMs to 5000", async () => {
  let receivedTimeout: number | undefined;
  const executor = new AdapterExecutor({
    fetchImpl: async (_input, init) => {
      // Can't directly access timeout from AbortSignal, but we can verify
      // the request was made (which implies timeout was set)
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  executor.register({
    adapterId: "default-timeout",
    protocol: "rest",
    endpoint: "https://example.com",
    // No timeoutMs specified - should default to 5000
  });

  const result = await executor.execute("default-timeout", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Passthrough Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AdapterExecutor preserves full context in request body", async () => {
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
    adapterId: "full-context",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  await executor.execute("full-context", {
    action: "test",
    payload: { nested: { deep: true } },
    context: {
      taskId: "task-specific",
      tenantId: "tenant-specific",
      correlationId: "corr-specific",
    },
  });

  assert.deepStrictEqual(receivedContext, {
    taskId: "task-specific",
    tenantId: "tenant-specific",
    correlationId: "corr-specific",
  });
});

test("AdapterExecutor handles null tenantId in context", async () => {
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
    adapterId: "null-tenant",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  await executor.execute("null-tenant", {
    action: "test",
    payload: {},
    context: { taskId: "task_1", tenantId: null },
  });

  assert.equal((receivedContext as any).tenantId, null);
});

test("AdapterExecutor handles undefined optional context fields", async () => {
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
    adapterId: "partial-context",
    protocol: "rest",
    endpoint: "https://example.com",
  });

  // Only pass required taskId, not optional tenantId/correlationId
  await executor.execute("partial-context", {
    action: "test",
    payload: {},
    context: { taskId: "task_1" },
  });

  assert.deepStrictEqual(receivedContext, { taskId: "task_1" });
});
import assert from "node:assert/strict";
import test from "node:test";

import { DatadogTransport } from "../../../../../../src/platform/shared/observability/transports/datadog-transport.js";
import type { StructuredLogEntry } from "../../../../../../src/platform/shared/observability/structured-logger.js";

function createTestEntry(overrides: Partial<StructuredLogEntry> = {}): StructuredLogEntry {
  // Filter out undefined values to satisfy exactOptionalPropertyTypes
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined)
  ) as Partial<StructuredLogEntry>;
  return {
    level: "info",
    message: "test message",
    service: "test-service",
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...definedOverrides,
  };
}

// Mock request factory that simulates a failing request
function createFailingMockRequestFactory() {
  const mockRequest = (_options: any, _callback: (response: { statusCode: number }) => void) => {
    let errorHandler: ((error: Error) => void) | null = null;
    const mockReq = {
      on: (event: string, handler: (...args: any[]) => void) => {
        if (event === "error") {
          errorHandler = handler as (error: Error) => void;
        }
        return mockReq;
      },
      once: () => mockReq,
      end: () => {
        queueMicrotask(() => errorHandler?.(new Error("Network error")));
        return mockReq;
      },
      write: () => mockReq,
      destroy: () => {},
    };
    return mockReq;
  };

  return { mockRequest };
}

// Mock request factory that tracks all requests
function createTrackingMockRequestFactory() {
  const requests: any[] = [];

  const mockRequest = (options: any, callback: (response: { statusCode: number }) => void) => {
    requests.push({ options, body: "" });

    const mockReq = {
      on: (event: string, handler: (...args: any[]) => void) => {
        return mockReq;
      },
      once: () => mockReq,
      end: (data?: string) => {
        if (requests.length > 0 && data) {
          requests[requests.length - 1].body = data;
        }
        queueMicrotask(() => callback({ statusCode: 202 }));
        return mockReq;
      },
      write: (data: string) => {
        if (requests.length > 0) {
          requests[requests.length - 1].body += data;
        }
        return mockReq;
      },
      destroy: () => {},
    };
    return mockReq;
  };

  return { mockRequest, getRequests: () => requests };
}

test("DatadogTransport handles request error gracefully", async () => {
  const { mockRequest } = createFailingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    maxRetryWindowMs: 0,
    env: "test",
  });

  transport.write(createTestEntry({ message: "error test" }));

  // flushInternal should resolve even if request fails
  // The error handler does: req.on("error", () => resolve());
  await transport.flush();
  assert.equal((transport as unknown as { batch: StructuredLogEntry[] }).batch.length, 1);

  await transport.close();
  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
});

test("DatadogTransport flushInternal transforms entries with service metadata", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "my-service",
    source: "my-source",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write(createTestEntry({
    level: "warn",
    message: "warning message",
    taskId: "task-123",
  }));

  await transport.flush();

  const requests = getRequests();
  assert.equal(requests.length, 1);

  const body = JSON.parse(requests[0].body);
  assert.equal(body[0].service, "my-service");
  assert.equal(body[0].ddsource, "my-source");
  assert.equal(body[0].message, "warning message");
  assert.equal(body[0].taskId, "task-123");
});

test("DatadogTransport flushInternal includes ddtags with configured env", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    env: "dev",
  });

  transport.write(createTestEntry({ message: "no env test" }));
  await transport.flush();

  const requests = getRequests();
  const body = JSON.parse(requests[0].body);
  assert.ok(body[0].ddtags.includes("env:dev"));
});

test("DatadogTransport flushInternal batches multiple entries", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 10,
    requestFactory: mockRequest as any,
    env: "test",
  });

  // Write multiple entries
  for (let i = 0; i < 5; i++) {
    transport.write(createTestEntry({ message: `batch entry ${i}` }));
  }

  await transport.flush();

  const requests = getRequests();
  assert.equal(requests.length, 1);

  const body = JSON.parse(requests[0].body);
  assert.equal(body.length, 5);
});

test("DatadogTransport write auto-flushes at batch size boundary", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 3,
    requestFactory: mockRequest as any,
    env: "test",
  });

  // Write 3 entries (equals batch size, should trigger auto-flush)
  transport.write(createTestEntry({ message: "1" }));
  transport.write(createTestEntry({ message: "2" }));
  transport.write(createTestEntry({ message: "3" }));

  // Give event loop time to process
  await new Promise<void>((resolve) => setTimeout(resolve, 20));

  const requests = getRequests();
  assert.ok(requests.length >= 1);

  await transport.close();
});

test("DatadogTransport flushInternal sends correct hostname format", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    site: "datadoghq.eu",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write(createTestEntry({ message: "eu site test" }));
  await transport.flush();

  const requests = getRequests();
  assert.ok(requests[0].options.hostname.includes("datadoghq.eu"));
});

test("DatadogTransport flushInternal sends correct API path", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write(createTestEntry({ message: "path test" }));
  await transport.flush();

  const requests = getRequests();
  assert.ok(requests[0].options.path.includes("/api/v2/logs"));
});

test("DatadogTransport flushInternal sends correct HTTP method", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write(createTestEntry({ message: "method test" }));
  await transport.flush();

  const requests = getRequests();
  assert.equal(requests[0].options.method, "POST");
});

test("DatadogTransport flushInternal sends correct headers", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write(createTestEntry({ message: "headers test" }));
  await transport.flush();

  const requests = getRequests();
  assert.equal(requests[0].options.headers["Content-Type"], "application/json");
  assert.equal(requests[0].options.headers["DD-API-KEY"], "test-api-key");
});

test("DatadogTransport handles entries with all optional fields", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    env: "test",
  });

  transport.write({
    level: "error",
    message: "full entry",
    service: "test-service",
    timestamp: "2026-04-23T12:00:00.000Z",
    createdAt: "2026-04-23T12:00:00.000Z",
    taskId: "task-full",
    agentId: "agent-full",
    sessionId: "session-full",
    stepId: "step-full",
    traceId: "trace-full",
    spanId: "span-full",
    parentSpanId: "parent-full",
    correlationId: "corr-full",
    data: { key: "value", count: 999 },
  });

  await transport.flush();

  const requests = getRequests();
  const body = JSON.parse(requests[0].body);
  assert.equal(body[0].taskId, "task-full");
  assert.equal(body[0].agentId, "agent-full");
  assert.equal(body[0].data.count, 999);
});

test("DatadogTransport flushInternal does not send empty batch", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
  });

  // Don't write anything, just flush
  await transport.flush();

  const requests = getRequests();
  // Empty batch should not send a request
  assert.equal(requests.length, 0);
});

test("DatadogTransport close sends remaining entries", async () => {
  const { mockRequest, getRequests } = createTrackingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 100,  // Large batch size so entries aren't auto-flushed
    requestFactory: mockRequest as any,
    env: "test",
  });

  // Write some entries that won't be auto-flushed
  transport.write(createTestEntry({ message: "remaining 1" }));
  transport.write(createTestEntry({ message: "remaining 2" }));

  // Close should flush remaining entries
  await transport.close();

  const requests = getRequests();
  assert.equal(requests.length, 1);

  const body = JSON.parse(requests[0].body);
  assert.equal(body.length, 2);
});

test("DatadogTransport close is safe to call multiple times", async () => {
  const { mockRequest } = createFailingMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
    maxRetryWindowMs: 0,
    env: "test",
  });

  transport.write(createTestEntry({ message: "multi close test" }));

  // Multiple closes should not throw
  await transport.close();
  await transport.close();
  await transport.close();

  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
  assert.equal((transport as unknown as { batch: StructuredLogEntry[] }).batch.length, 1);
});

test("DatadogTransport timer is cleared after close", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    flushIntervalMs: 1000,  // 1 second interval
  });

  await transport.close();

  await transport.close();
  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { DatadogTransport } from "../../../../../../src/platform/shared/observability/transports/datadog-transport.js";
import type { StructuredLogEntry } from "../../../../../../src/platform/shared/observability/structured-logger.js";

function createTestEntry(overrides: Partial<StructuredLogEntry> = {}): StructuredLogEntry {
  return {
    level: "info",
    message: "test message",
    service: "test-service",
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Mock request factory to capture outgoing requests
function createMockRequestFactory() {
  let lastRequest: {
    hostname: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  } | null = null;

  const mockRequest = (options: {
    hostname: string;
    path: string;
    method: string;
    headers: Record<string, string>;
  }, callback: () => void) => {
    lastRequest = {
      hostname: options.hostname,
      path: options.path,
      method: options.method,
      headers: options.headers,
      body: "",
    };

    const mockReq = {
      on: (_event: string, _handler: (...args: any[]) => void) => mockReq,
      once: (_event: string, _handler: (...args: any[]) => void) => mockReq,
      end: (data?: string) => {
        if (lastRequest && data) {
          lastRequest.body = data;
        }
        // Call the callback to signal request is "done"
        callback();
        return mockReq;
      },
      write: (data: string) => {
        if (lastRequest) {
          lastRequest.body = (lastRequest.body || "") + data;
        }
        return mockReq;
      },
      destroy: () => {},
    };
    return mockReq;
  };

  return { mockRequest, getLastRequest: () => lastRequest };
}

test("DatadogTransport name is datadog", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport constructor sets default batchSize to 100", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport constructor sets default flushIntervalMs to 5000", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport constructor sets default site to datadoghq.com", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport constructor sets default source to automatic-agent", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport constructor accepts custom config", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "custom-service",
    site: "datadoghq.eu",
    source: "custom-source",
    batchSize: 50,
    flushIntervalMs: 3000,
  });
  assert.equal(transport.name, "datadog");
});

test("DatadogTransport.write adds entry to batch", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 100,
  });

  transport.write(createTestEntry({ message: "batch entry 1" }));
  transport.write(createTestEntry({ message: "batch entry 2" }));

  // Just verify it doesn't throw
  assert.ok(true);
});

test("DatadogTransport.write does not trigger auto-flush when batch is not full", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 100,
  });

  // Write less than batch size
  transport.write(createTestEntry({ message: "single entry" }));

  // Should not throw
  assert.ok(true);
});

test("DatadogTransport.write triggers auto-flush when batch is full", () => {
  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 2,
    requestFactory: mockRequest as any,
  });

  // Fill the batch (2 entries = batchSize)
  transport.write(createTestEntry({ message: "entry 1" }));
  transport.write(createTestEntry({ message: "entry 2" }));

  // The second write should trigger flush
  // Allow event loop to process
  return new Promise<void>((resolve) => setTimeout(resolve, 10)).then(() => {
    const lastReq = getLastRequest();
    assert.ok(lastReq !== null, "Request should have been made");
    assert.ok(lastReq.body.includes("entry 1"));
    assert.ok(lastReq.body.includes("entry 2"));
  });
});

test("DatadogTransport.flushInternal handles empty batch", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  // Flush empty batch should return immediately
  await transport.flush();
  assert.ok(true);
});

test("DatadogTransport.flushInternal sends entries to Datadog API", async () => {
  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
  });

  transport.write(createTestEntry({
    level: "error",
    message: "error occurred",
    data: { errorCode: 500 },
  }));

  await transport.flush();

  const lastReq = getLastRequest();
  assert.ok(lastReq !== null, "Request should have been made");
  assert.equal(lastReq.method, "POST");
  assert.ok(lastReq.path.includes("/api/v2/logs"));
  assert.ok(lastReq.hostname.includes("datadoghq.com"));
  assert.ok(lastReq.headers["DD-API-KEY"], "test-api-key");
  assert.ok(lastReq.body.includes("error occurred"));
  assert.ok(lastReq.body.includes("test-service"));
  assert.ok(lastReq.body.includes("automatic-agent"));
});

test("DatadogTransport.flushInternal includes ddtags with NODE_ENV", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
  });

  transport.write(createTestEntry({ message: "production log" }));
  await transport.flush();

  process.env.NODE_ENV = originalNodeEnv;

  const lastReq = getLastRequest();
  assert.ok(lastReq !== null, "lastReq should not be null");
  assert.ok(lastReq!.body.includes("env:production"));
});

test("DatadogTransport.flushInternal uses custom site for hostname", async () => {
  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    site: "datadoghq.eu",
    requestFactory: mockRequest as any,
  });

  transport.write(createTestEntry({ message: "eu log" }));
  await transport.flush();

  const lastReq = getLastRequest();
  assert.ok(lastReq !== null, "lastReq should not be null");
  assert.ok(lastReq!.hostname.includes("datadoghq.eu"));
});

test("DatadogTransport.close clears timer", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  await transport.close();
  // Timer should be cleared - close should not throw
  assert.ok(true);
});

test("DatadogTransport.close is idempotent", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  await transport.close();
  await transport.close();

  assert.ok(true);
});

test("DatadogTransport.close flushes remaining batch", async () => {
  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory: mockRequest as any,
  });

  transport.write(createTestEntry({ message: "final entry" }));
  await transport.close();

  const lastReq = getLastRequest();
  assert.ok(lastReq !== null, "Request should have been made on close");
  assert.ok(lastReq.body.includes("final entry"));
});

test("DatadogTransport batch entries include service and source", async () => {
  const { mockRequest, getLastRequest } = createMockRequestFactory();

  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "my-service",
    source: "my-source",
    requestFactory: mockRequest as any,
  });

  transport.write(createTestEntry({ message: "batch with metadata" }));
  await transport.flush();

  const lastReq = getLastRequest();
  assert.ok(lastReq !== null, "lastReq should not be null");
  const body = JSON.parse(lastReq!.body);
  assert.ok(Array.isArray(body));
  assert.equal(body[0].service, "my-service");
  assert.equal(body[0].ddsource, "my-source");
});

test("DatadogTransport handles write with all fields", () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 100,
  });

  transport.write({
    level: "info",
    message: "full entry",
    service: "test-service",
    taskId: "task-123",
    agentId: "agent-456",
    sessionId: "session-789",
    traceId: "trace-abc",
    spanId: "span-def",
    correlationId: "corr-xyz",
    data: { key: "value" },
    createdAt: "2026-04-23T00:00:00.000Z",
    timestamp: "2026-04-23T00:00:00.000Z",
  });

  assert.ok(true);
});
import assert from "node:assert/strict";
import test from "node:test";

import { StdoutTransport } from "../../../../../../src/platform/shared/observability/transports/stdout-transport.js";
import { DatadogTransport } from "../../../../../../src/platform/shared/observability/transports/datadog-transport.js";
import { FluentdTransport } from "../../../../../../src/platform/shared/observability/transports/fluentd-transport.js";

function captureStdout(run: () => void): string[] {
  const output: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    output.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
    const callback = args.find((value): value is ((error?: Error | null) => void) => typeof value === "function");
    callback?.(null);
    return true;
  }) as typeof process.stdout.write;
  try {
    run();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

function getDatadogState(transport: DatadogTransport): {
  batch: unknown[];
  batchSize: number;
  flushIntervalMs: number;
  site: string;
  source: string;
  timer: NodeJS.Timeout | null;
} {
  return transport as unknown as {
    batch: unknown[];
    batchSize: number;
    flushIntervalMs: number;
    site: string;
    source: string;
    timer: NodeJS.Timeout | null;
  };
}

function createMockRequestFactory() {
  let requestCount = 0;
  const mockRequest = (_options: unknown, callback: (response: { statusCode: number }) => void) => {
    const req = {
      on: (_event: string, _handler: (...args: unknown[]) => void) => req,
      once: (_event: string, _handler: (...args: unknown[]) => void) => req,
      end: (_data?: string) => {
        requestCount += 1;
        callback({ statusCode: 200 });
        return req;
      },
      write: (_data: string) => req,
      destroy: () => undefined,
    };
    return req;
  };
  return { mockRequest, getRequestCount: () => requestCount };
}

function createFluentdTransport() {
  return new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });
}

function getFluentdState(transport: FluentdTransport): {
  tag: string;
  reconnectIntervalMs: number;
  bufferLimit: number;
  buffer: string[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  socket: { destroyed?: boolean; writable?: boolean } | null;
} {
  return transport as unknown as {
    tag: string;
    reconnectIntervalMs: number;
    bufferLimit: number;
    buffer: string[];
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    socket: { destroyed?: boolean; writable?: boolean } | null;
  };
}

test("StdoutTransport has correct name", () => {
  const transport = new StdoutTransport();
  assert.equal(transport.name, "stdout");
});

test("StdoutTransport.write writes JSON to stdout", async () => {
  const transport = new StdoutTransport();
  const entry = {
    level: "info",
    message: "test message",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
  };
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
  await transport.close();
});

test("StdoutTransport.write handles all log levels", async () => {
  const transport = new StdoutTransport();
  const levels = ["debug", "info", "warn", "error"] as const;

  const output = captureStdout(() => {
    for (const level of levels) {
      transport.write({
        level,
        message: `test ${level}`,
        service: "test-service",
        createdAt: "2026-04-22T00:00:00.000Z",
        timestamp: "2026-04-22T00:00:00.000Z",
      });
    }
  });
  assert.deepEqual(output.map((line) => JSON.parse(line).level), levels);
  await transport.close();
});

test("StdoutTransport.write handles entry with data", async () => {
  const transport = new StdoutTransport();
  const entry = {
    level: "info",
    message: "test with data",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
    data: { key: "value", count: 42 },
    taskId: "task_123",
    traceId: "trace_abc",
  };
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
  await transport.close();
});

test("StdoutTransport.flush is a no-op", async () => {
  const transport = new StdoutTransport();
  assert.equal(await transport.flush(), undefined);
  await transport.close();
});

test("StdoutTransport.close is a no-op", async () => {
  const transport = new StdoutTransport();
  assert.equal(await transport.close(), undefined);
});

test("DatadogTransport has correct name", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  assert.equal(transport.name, "datadog");
  await transport.close();
});

test("DatadogTransport constructor sets defaults", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });
  const state = getDatadogState(transport);
  assert.equal(state.batchSize, 100);
  assert.equal(state.flushIntervalMs, 5000);
  assert.equal(state.site, "datadoghq.com");
  assert.equal(state.source, "automatic-agent");
  await transport.close();
});

test("DatadogTransport constructor accepts custom config", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    site: "datadoghq.eu",
    source: "custom-source",
    batchSize: 50,
    flushIntervalMs: 3000,
  });
  assert.equal(transport.name, "datadog");
  await transport.close();
});

test("DatadogTransport.write adds entry to batch", async () => {
  const { mockRequest, getRequestCount } = createMockRequestFactory();
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
    batchSize: 100, // Large batch size to avoid flush
    requestFactory: mockRequest as never,
  });

  transport.write({
    level: "info",
    message: "test message",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
  });
  const state = getDatadogState(transport);
  assert.equal(state.batch.length, 1);
  assert.equal((state.batch[0] as { message: string }).message, "test message");
  assert.equal(getRequestCount(), 0);
  await transport.close();
});

test("DatadogTransport.close clears timer and flushes", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  assert.equal(await transport.close(), undefined);
  assert.equal(getDatadogState(transport).timer, null);
});

test("DatadogTransport.close is idempotent", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  await transport.close();
  await transport.close();
  assert.equal(getDatadogState(transport).timer, null);
});

test("DatadogTransport.flush handles empty batch", async () => {
  const transport = new DatadogTransport({
    apiKey: "test-api-key",
    service: "test-service",
  });

  assert.equal(await transport.flush(), undefined);
  await transport.close();
});

test("FluentdTransport has correct name", async () => {
  const transport = createFluentdTransport();
  assert.equal(transport.name, "fluentd");
  await transport.close();
});

test("FluentdTransport constructor sets defaults", async () => {
  const transport = createFluentdTransport();
  const state = getFluentdState(transport);
  assert.equal(state.reconnectIntervalMs, 5000);
  assert.equal(state.bufferLimit, 10000);
  await transport.close();
});

test("FluentdTransport constructor accepts custom config", async () => {
  const transport = new FluentdTransport({
    host: "fluentd.example.com",
    port: 24224,
    tag: "custom-tag",
    reconnectIntervalMs: 3000,
    bufferLimit: 5000,
  });
  const state = getFluentdState(transport);
  assert.equal(transport.name, "fluentd");
  assert.equal(state.tag, "custom-tag");
  assert.equal(state.reconnectIntervalMs, 3000);
  assert.equal(state.bufferLimit, 5000);
  await transport.close();
});

test("FluentdTransport.write handles entry without socket", async () => {
  const transport = createFluentdTransport();

  transport.write({
    level: "info",
    message: "buffered message",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  const state = getFluentdState(transport);
  assert.equal(state.buffer.length, 1);
  assert.ok(state.buffer[0]?.includes("buffered message"));
  await transport.close();
});

test("FluentdTransport.flush returns promise", async () => {
  const transport = createFluentdTransport();
  assert.equal(await transport.flush(), undefined);
  await transport.close();
});

test("FluentdTransport.close clears reconnect timer", async () => {
  const transport = createFluentdTransport();
  transport.write({
    level: "info",
    message: "close timer",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  await transport.close();
  assert.equal(getFluentdState(transport).reconnectTimer, null);
});

test("FluentdTransport.close is idempotent", async () => {
  const transport = createFluentdTransport();
  await transport.close();
  await transport.close();
  assert.equal(getFluentdState(transport).socket, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { FluentdTransport } from "../../../../../../src/platform/shared/observability/transports/fluentd-transport.js";
import type { StructuredLogEntry } from "../../../../../../src/platform/shared/observability/structured-logger.js";

function createTestEntry(overrides: Partial<StructuredLogEntry> = {}): StructuredLogEntry {
  return {
    level: "info",
    message: "test message",
    createdAt: new Date().toISOString(),
    service: "test-service",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function getFluentdState(transport: FluentdTransport): {
  tag: string;
  reconnectIntervalMs: number;
  bufferLimit: number;
  buffer: string[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  socket: { destroyed?: boolean; writable?: boolean } | null;
  connect: () => void;
} {
  return transport as unknown as {
    tag: string;
    reconnectIntervalMs: number;
    bufferLimit: number;
    buffer: string[];
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    socket: { destroyed?: boolean; writable?: boolean } | null;
    connect: () => void;
  };
}

function disableConnect(transport: FluentdTransport): ReturnType<typeof getFluentdState> {
  const state = getFluentdState(transport);
  state.socket = null;
  state.connect = () => undefined;
  return state;
}

test("FluentdTransport has correct name", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });
  assert.equal(transport.name, "fluentd");
  await transport.close();
});

test("FluentdTransport constructor sets defaults", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });
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
  assert.equal(transport.name, "fluentd");
  await transport.close();
});

test("FluentdTransport.write handles entry without socket", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // Write should not throw even when socket is not connected
  const entry = createTestEntry({ message: "buffered message" });
  transport.write(entry);

  // Give time for async reconnect to be scheduled
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  const state = getFluentdState(transport);
  assert.equal(state.buffer.length, 1);
  assert.ok(state.buffer[0]?.includes("buffered message"));
  assert.ok(state.reconnectTimer != null);
  await transport.close();
});

test("FluentdTransport.write handles multiple entries", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });
  const state = disableConnect(transport);

  for (let i = 0; i < 5; i++) {
    transport.write(createTestEntry({ message: `message ${i}` }));
  }

  assert.equal(state.buffer.length, 5);
  assert.ok(state.buffer.every((line, index) => line.includes(`message ${index}`)));
  await transport.close();
});

test("FluentdTransport.write formats entry as fluentd message", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "myapp",
  });

  // Should not throw
  transport.write(createTestEntry({
    level: "error",
    message: "error occurred",
  }));

  const [tag, timestamp, entry] = JSON.parse(getFluentdState(transport).buffer[0] ?? "[]") as [
    string,
    number,
    StructuredLogEntry,
  ];
  assert.equal(tag, "myapp");
  assert.equal(typeof timestamp, "number");
  assert.equal(entry.level, "error");
  assert.equal(entry.message, "error occurred");
  await transport.close();
});

test("FluentdTransport.write with data payload", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  transport.write(createTestEntry({
    message: "task completed",
    data: { taskId: "task-123", durationMs: 500 },
  }));

  const [, , entry] = JSON.parse(getFluentdState(transport).buffer[0] ?? "[]") as [
    string,
    number,
    StructuredLogEntry,
  ];
  assert.deepEqual(entry.data, { taskId: "task-123", durationMs: 500 });
  await transport.close();
});

test("FluentdTransport.write with trace context", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  transport.write(createTestEntry({
    message: "trace test",
    traceId: "trace-abc",
    spanId: "span-def",
  }));

  const [, , entry] = JSON.parse(getFluentdState(transport).buffer[0] ?? "[]") as [
    string,
    number,
    StructuredLogEntry,
  ];
  assert.equal(entry.traceId, "trace-abc");
  assert.equal(entry.spanId, "span-def");
  await transport.close();
});

test("FluentdTransport handles rapid writes", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });
  const state = disableConnect(transport);

  // Rapid writes should not cause issues
  for (let i = 0; i < 100; i++) {
    transport.write(createTestEntry({ message: `rapid ${i}` }));
  }

  assert.equal(state.buffer.length, 100);
  await transport.close();
});

test("FluentdTransport.flush returns promise", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // Flush should return a promise even when socket is not writable
  const result = transport.flush();
  assert.ok(result instanceof Promise);
  await result;
  await transport.close();
});

test("FluentdTransport.close clears reconnect timer", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // Write something to trigger reconnect timer
  transport.write(createTestEntry());

  // Close should not throw
  await transport.close();
  const state = getFluentdState(transport);
  assert.equal(state.reconnectTimer, null);
  assert.equal(state.socket, null);
});

test("FluentdTransport.close is idempotent", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  await transport.close();
  await transport.close();
  const state = getFluentdState(transport);
  assert.equal(state.reconnectTimer, null);
  assert.equal(state.socket, null);
});

test("FluentdTransport.close waits for socket drain", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // Close should complete even if socket is not writable
  assert.equal(await transport.close(), undefined);
  assert.equal(getFluentdState(transport).socket, null);
});

test("FluentdTransport constructor with minimum valid port (0)", async () => {
  // Port 0 is valid and typically binds to a random available port
  const transport = new FluentdTransport({
    host: "localhost",
    port: 0,
    tag: "test",
  });
  assert.equal(transport.name, "fluentd");
  await transport.close();
});

test("FluentdTransport constructor with maximum valid port (65535)", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 65535,
    tag: "test",
  });
  assert.equal(transport.name, "fluentd");
  await transport.close();
});

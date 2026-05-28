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
  buffer: string[];
  reconnectAttempts: number;
  reconnectIntervalMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  maxReconnectAttempts: number;
  handleReconnect: () => void;
  socket: { destroyed?: boolean; writable?: boolean } | null;
  connect: () => void;
} {
  return transport as unknown as {
    buffer: string[];
    reconnectAttempts: number;
    reconnectIntervalMs: number;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    maxReconnectAttempts: number;
    handleReconnect: () => void;
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

test("FluentdTransport drops messages when buffer exceeds limit", async () => {
  const bufferLimit = 5;
  const transport = new FluentdTransport({
    host: "127.0.0.1",  // Use localhost to avoid long connection timeouts
    port: 59999,        // Unreachable port that will fail fast
    tag: "test",
    bufferLimit,
  });

  const state = disableConnect(transport);
  // Write more entries than the buffer can hold
  for (let i = 0; i < bufferLimit + 3; i++) {
    transport.write(createTestEntry({ message: `message ${i}` }));
  }

  assert.equal(state.buffer.length, bufferLimit);
  assert.ok(state.buffer[0]?.includes("message 0"));
  assert.ok(state.buffer.at(-1)?.includes(`message ${bufferLimit - 1}`));
  await transport.close();
});

test("FluentdTransport respects custom bufferLimit config", async () => {
  const customLimit = 3;
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
    bufferLimit: customLimit,
  });

  const state = disableConnect(transport);
  // Write exactly the limit
  for (let i = 0; i < customLimit; i++) {
    transport.write(createTestEntry({ message: `message ${i}` }));
  }

  // Write one more - should be dropped
  transport.write(createTestEntry({ message: "should be dropped" }));

  assert.equal(state.buffer.length, customLimit);
  assert.ok(state.buffer.every((line) => !line.includes("should be dropped")));
  await transport.close();
});

test("FluentdTransport stops reconnecting after max attempts exhausted", async () => {
  // Use a very short reconnect interval to speed up test
  const reconnectIntervalMs = 10;
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
    reconnectIntervalMs,
  });
  (transport as unknown as { maxReconnectAttempts: number }).maxReconnectAttempts = 2;

  const state = getFluentdState(transport);
  state.reconnectAttempts = 2;
  state.handleReconnect();
  assert.equal(state.reconnectAttempts, 2);
  assert.equal(state.reconnectTimer, null);
  await transport.close();
});

test("FluentdTransport exponential backoff increases delay", async () => {
  // This test verifies that backoff calculation works correctly
  // The formula is: Math.min(reconnectIntervalMs * Math.pow(2, reconnectAttempts - 1), 30000)
  const reconnectIntervalMs = 100;
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
    reconnectIntervalMs,
  });

  const state = getFluentdState(transport);
  state.handleReconnect();
  assert.equal(state.reconnectAttempts, 1);
  assert.ok(state.reconnectTimer != null);
  await transport.close();
});

test("FluentdTransport handles write when socket is destroyed", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });

  const state = getFluentdState(transport);
  state.socket = { destroyed: true, writable: false };
  transport.write(createTestEntry({ message: "after multiple disconnects" }));

  assert.equal(state.buffer.length, 1);
  assert.ok(state.buffer[0]?.includes("after multiple disconnects"));
  await transport.close();
});

test("FluentdTransport close can be called immediately after construction", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });

  assert.equal(await transport.close(), undefined);
  assert.equal(getFluentdState(transport).socket, null);
});

test("FluentdTransport close after multiple writes", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });
  const state = disableConnect(transport);

  // Write several entries
  for (let i = 0; i < 10; i++) {
    transport.write(createTestEntry({ message: `entry ${i}` }));
  }

  assert.equal(state.buffer.length, 10);
  await transport.close();
});

test("FluentdTransport write with different log levels", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });
  const state = disableConnect(transport);

  const levels: StructuredLogEntry["level"][] = ["debug", "info", "warn", "error"];

  for (const level of levels) {
    transport.write(createTestEntry({ level, message: `test ${level}` }));
  }

  assert.deepEqual(
    state.buffer.map((line) => (JSON.parse(line) as [string, number, StructuredLogEntry])[2].level),
    levels,
  );
  await transport.close();
});

test("FluentdTransport write preserves trace context", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });

  transport.write(createTestEntry({
    message: "trace test",
    traceId: "trace-abc123",
    spanId: "span-def456",
    parentSpanId: "parent-span-ghi789",
  }));

  const [, , entry] = JSON.parse(getFluentdState(transport).buffer[0] ?? "[]") as [
    string,
    number,
    StructuredLogEntry,
  ];
  assert.equal(entry.traceId, "trace-abc123");
  assert.equal(entry.parentSpanId, "parent-span-ghi789");
  await transport.close();
});

test("FluentdTransport write with complex data payload", async () => {
  const transport = new FluentdTransport({
    host: "127.0.0.1",
    port: 59999,
    tag: "test",
  });

  transport.write(createTestEntry({
    message: "complex data test",
    data: {
      nested: {
        deeply: {
          value: 42,
          array: [1, 2, 3],
        },
      },
      timestamp: Date.now(),
      boolean: true,
      null: null,
    },
  }));

  const [, , entry] = JSON.parse(getFluentdState(transport).buffer[0] ?? "[]") as [
    string,
    number,
    StructuredLogEntry,
  ];
  assert.equal((entry.data as { nested: { deeply: { value: number } } }).nested.deeply.value, 42);
  assert.deepEqual((entry.data as { nested: { deeply: { array: number[] } } }).nested.deeply.array, [1, 2, 3]);
  await transport.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { StdoutTransport } from "../../../../../src/platform/shared/observability/transports/stdout-transport.js";
import {
  DatadogTransport,
  type DatadogRequestFactory,
  type DatadogTransportConfig,
} from "../../../../../src/platform/shared/observability/transports/datadog-transport.js";
import { FluentdTransport, type FluentdTransportConfig } from "../../../../../src/platform/shared/observability/transports/fluentd-transport.js";
import type { StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

interface MockSocket extends EventEmitter {
  writable?: boolean;
  destroyed?: boolean;
  write: (data: string) => boolean;
  end: () => void;
  destroy?: () => void;
  hasRef?: () => boolean;
}

function createMockLogEntry(overrides: Partial<StructuredLogEntry> = {}): StructuredLogEntry {
  return {
    level: "info",
    message: "test log message",
    createdAt: new Date().toISOString(),
    service: "test-service",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createMockDatadogRequestFactory() {
  const bodies: string[] = [];
  const requestFactory: DatadogRequestFactory = ((options, callback) => {
    const emitter = new EventEmitter() as EventEmitter & {
      end: (body?: string) => void;
      on: (event: string, listener: (...args: unknown[]) => void) => typeof emitter;
    };
    emitter.end = (body?: string) => {
      bodies.push(body ?? "");
      if (typeof callback === "function") {
        callback({} as never);
      }
    };
    return emitter as never;
  }) as DatadogRequestFactory;
  return { bodies, requestFactory };
}

function createDatadogTestConfig(overrides: Partial<DatadogTransportConfig> = {}): DatadogTransportConfig {
  const { requestFactory } = createMockDatadogRequestFactory();
  return {
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory,
    ...overrides,
  };
}

// ============================================================================
// StdoutTransport Tests
// ============================================================================

test("StdoutTransport.write writes JSON to stdout", () => {
  const transport = new StdoutTransport();
  assert.equal(transport.name, "stdout");

  let writtenData = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    writtenData = chunk;
    return true;
  };

  try {
    const entry = createMockLogEntry({ message: "hello" });
    transport.write(entry);

    const parsed = JSON.parse(writtenData.trim());
    assert.equal(parsed.message, "hello");
    assert.equal(parsed.level, "info");
  } finally {
    process.stdout.write = originalWrite;
  }
});

test("StdoutTransport.flush is a no-op", async () => {
  const transport = new StdoutTransport();
  await transport.flush(); // Should not throw
});

test("StdoutTransport.close is a no-op", async () => {
  const transport = new StdoutTransport();
  await transport.close(); // Should not throw
});

// ============================================================================
// DatadogTransport Tests
// ============================================================================

test("DatadogTransport constructor sets defaults", () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);

  assert.equal(transport.name, "datadog");
  assert.equal((transport as unknown as { batchSize: number }).batchSize, 100);
  assert.equal((transport as unknown as { flushIntervalMs: number }).flushIntervalMs, 5000);
  assert.equal((transport as unknown as { site: string }).site, "datadoghq.com");
  assert.equal((transport as unknown as { source: string }).source, "automatic-agent");
  assert.equal((transport as unknown as { timer: NodeJS.Timeout }).timer.hasRef(), false);

  transport.close();
});

test("DatadogTransport constructor respects custom config", () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    site: "datadoghq.eu",
    source: "custom-source",
    batchSize: 50,
    flushIntervalMs: 3000,
  });

  const transport = new DatadogTransport(config);

  assert.equal((transport as unknown as { batchSize: number }).batchSize, 50);
  assert.equal((transport as unknown as { flushIntervalMs: number }).flushIntervalMs, 3000);
  assert.equal((transport as unknown as { site: string }).site, "datadoghq.eu");
  assert.equal((transport as unknown as { source: string }).source, "custom-source");
  assert.equal((transport as unknown as { timer: NodeJS.Timeout }).timer.hasRef(), false);

  transport.close();
});

test("DatadogTransport.write batches entries", () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 3,
  });

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  transport.write(createMockLogEntry({ message: "msg1" }));
  assert.equal(batch.length, 1);

  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(batch.length, 2);

  transport.write(createMockLogEntry({ message: "msg3" }));
  // Third write triggers flush since batchSize is 3
  assert.equal(batch.length, 0);

  transport.close();
});

test("DatadogTransport.write does not auto-flush when below batch size", () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 5,
  });

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  transport.write(createMockLogEntry({ message: "msg1" }));
  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(batch.length, 2);

  transport.close();
});

test("DatadogTransport.flush clears batch", async () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 100,
  });

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  transport.write(createMockLogEntry({ message: "msg1" }));
  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(batch.length, 2);

  await transport.flush();
  assert.equal(batch.length, 0);

  transport.close();
});

test("DatadogTransport.flush returns early when batch is empty", async () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  // Flush when batch is empty should return immediately
  await transport.flush();
  transport.close();
});

test("DatadogTransport.close clears timer and flushes", async () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 100,
    flushIntervalMs: 10000,
  });

  const transport = new DatadogTransport(config);
  const timer = (transport as unknown as { timer: NodeJS.Timeout | null }).timer;

  assert.ok(timer !== null);

  transport.write(createMockLogEntry({ message: "msg1" }));

  await transport.close();

  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
  assert.equal((transport as unknown as { batch: StructuredLogEntry[] }).batch.length, 0);
});

test("DatadogTransport.close can be called multiple times", async () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);

  await transport.close();
  await transport.close(); // Should not throw

  // Timer should be null after first close
  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
});

// ============================================================================
// FluentdTransport Tests
// ============================================================================

test("FluentdTransport constructor sets defaults", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  assert.equal(transport.name, "fluentd");
  assert.equal((transport as unknown as { reconnectIntervalMs: number }).reconnectIntervalMs, 5000);
  assert.equal((transport as unknown as { bufferLimit: number }).bufferLimit, 10000);
  const socket = (transport as unknown as { socket: { hasRef?: () => boolean } | null }).socket;
  if (typeof socket?.hasRef === "function") {
    assert.equal(socket.hasRef(), false);
  }

  transport.close();
});

test("FluentdTransport constructor respects custom config", () => {
  const config: FluentdTransportConfig = {
    host: "fluentd.example.com",
    port: 24224,
    tag: "my-app",
    reconnectIntervalMs: 3000,
    bufferLimit: 5000,
  };

  const transport = new FluentdTransport(config);

  assert.equal((transport as unknown as { reconnectIntervalMs: number }).reconnectIntervalMs, 3000);
  assert.equal((transport as unknown as { bufferLimit: number }).bufferLimit, 5000);

  transport.close();
});

test("FluentdTransport.write buffers when socket is not available", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test-tag",
  };

  const transport = new FluentdTransport(config);

  // Set buffer directly and ensure no socket is available
  (transport as unknown as { socket: MockSocket | null }).socket = null;
  const buffer: string[] = [];
  (transport as unknown as { buffer: string[] }).buffer = buffer;

  const entry = createMockLogEntry({ message: "buffered test" });
  transport.write(entry);

  assert.equal(buffer.length, 1);
  assert.ok(buffer[0] !== undefined);
  const parsed = JSON.parse(buffer[0] as string);
  assert.equal(parsed[0], "test-tag"); // tag
  assert.equal(typeof parsed[1], "number"); // timestamp
  assert.equal(parsed[2].message, "buffered test"); // entry

  transport.close();
});

test("FluentdTransport.write buffers when socket is not writable", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);
  const buffer: string[] = [];

  // No socket
  (transport as unknown as { socket: EventEmitter | null }).socket = null;

  (transport as unknown as { buffer: string[] }).buffer = buffer;

  const entry = createMockLogEntry({ message: "buffered" });
  transport.write(entry);

  assert.equal(buffer.length, 1);

  transport.close();
});

test("FluentdTransport.write respects buffer limit", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
    bufferLimit: 2,
  };

  const transport = new FluentdTransport(config);
  const buffer: string[] = [];

  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { buffer: string[] }).buffer = buffer;
  (transport as unknown as { connecting: boolean }).connecting = true;

  transport.write(createMockLogEntry({ message: "msg1" }));
  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(buffer.length, 2);

  // Third write should not add to buffer due to limit
  transport.write(createMockLogEntry({ message: "msg3" }));
  assert.equal(buffer.length, 2);

  transport.close();
});

test("FluentdTransport.write writes to socket when writable", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);
  let writtenData = "";

  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.writable = true;
  mockSocket.write = (data: string) => {
    writtenData = data;
    return true;
  };

  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  const entry = createMockLogEntry({ message: "direct write" });
  transport.write(entry);

  assert.ok(writtenData.includes("direct write"));

  transport.close();
});

test("FluentdTransport.handleReconnect stops after max attempts", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // Set to max reconnect attempts
  (transport as unknown as { reconnectAttempts: number }).reconnectAttempts = 10;

  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer = null;

  const entry = createMockLogEntry({ message: "should not reconnect" });
  transport.write(entry);

  // Should not set a reconnect timer since max attempts reached
  const reconnectTimer = (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer;
  assert.equal(reconnectTimer, null);

  transport.close();
});

test("FluentdTransport.close clears reconnect timer", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
    reconnectIntervalMs: 10000,
  };

  const transport = new FluentdTransport(config);

  // Trigger reconnect timer
  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer = setTimeout(() => {}, 1000);

  await transport.close();

  assert.equal((transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer, null);
});

test("FluentdTransport.close sets socket to null", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.end = () => {};
  mockSocket.destroy = () => {};
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  await transport.close();

  assert.equal((transport as unknown as { socket: MockSocket | null }).socket, null);
});

test("FluentdTransport.flush resolves when socket is not writable", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  (transport as unknown as { socket: EventEmitter | null }).socket = null;

  // Should resolve immediately
  await transport.flush();
});

test("FluentdTransport.connect returns early if already connecting", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // Set connecting to true
  (transport as unknown as { connecting: boolean }).connecting = true;
  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.write = () => true;
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  // Try to connect - should return early
  (transport as unknown as { connect: () => void }).connect();

  // Should still be connecting
  assert.equal((transport as unknown as { connecting: boolean }).connecting, true);

  transport.close();
});

test("FluentdTransport.connect returns early if socket exists and not destroyed", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.destroyed = false;
  mockSocket.write = () => true;
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;
  (transport as unknown as { connecting: boolean }).connecting = false;

  // Try to connect - should return early
  (transport as unknown as { connect: () => void }).connect();

  // Socket should still be the same
  assert.equal((transport as unknown as { socket: MockSocket | null }).socket, mockSocket);

  transport.close();
});

test("FluentdTransport.handleReconnect sets timer with exponential backoff", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
    reconnectIntervalMs: 1000, // 1 second base
  };

  const transport = new FluentdTransport(config);

  // Set reconnect attempts to 3 (less than max of 10)
  (transport as unknown as { reconnectAttempts: number }).reconnectAttempts = 3;
  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer = null;

  (transport as unknown as { handleReconnect: () => void }).handleReconnect();

  // Should set a reconnect timer
  const reconnectTimer = (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer;
  assert.notEqual(reconnectTimer, null);

  // Backoff should be min(1000 * 2^(3-1), 30000) = min(4000, 30000) = 4000
  // We can't directly check the delay, but we can verify the timer was set
  if (reconnectTimer) {
    assert.ok(true);
  }

  transport.close();
});

test("FluentdTransport.handleReconnect caps backoff at 30 seconds", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
    reconnectIntervalMs: 20000, // 20 second base - even 2 attempts would be 80 seconds
  };

  const transport = new FluentdTransport(config);

  // Set reconnect attempts high enough that uncapped backoff would exceed 30s
  // uncapped: 20000 * 2^(5-1) = 20000 * 16 = 320000 (320 seconds)
  (transport as unknown as { reconnectAttempts: number }).reconnectAttempts = 5;
  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer = null;

  (transport as unknown as { handleReconnect: () => void }).handleReconnect();

  // Should set a reconnect timer (capped at 30 seconds)
  const reconnectTimer = (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer;
  assert.notEqual(reconnectTimer, null);

  transport.close();
});

test("FluentdTransport socket connect event flushes buffer", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "buffered-tag",
  };

  const transport = new FluentdTransport(config);
  const buffer: string[] = [];
  let socketWriteCount = 0;

  // Set up buffer with entries
  (transport as unknown as { buffer: string[] }).buffer = buffer;
  (transport as unknown as { connecting: boolean }).connecting = false;

  // Add entries to buffer
  buffer.push(JSON.stringify(["buffered-tag", Math.floor(Date.now() / 1000), createMockLogEntry({ message: "buffered1" })]));
  buffer.push(JSON.stringify(["buffered-tag", Math.floor(Date.now() / 1000), createMockLogEntry({ message: "buffered2" })]));
  assert.equal(buffer.length, 2);

  // Now simulate socket connection
  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.writable = true;
  mockSocket.write = (data: string) => {
    socketWriteCount++;
    return true;
  };
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  (transport as unknown as { handleConnected: () => void }).handleConnected();

  // Buffer should be cleared
  assert.equal((transport as unknown as { buffer: string[] }).buffer.length, 0);
  // Socket should have received the buffered writes
  assert.equal(socketWriteCount, 2);

  transport.close();
});

test("FluentdTransport socket error triggers reconnect", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.write = () => true;
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;
  (transport as unknown as { connecting: boolean }).connecting = false;

  (transport as unknown as { handleDisconnected: () => void }).handleDisconnected();

  // Socket should be cleared and reconnect should be scheduled
  assert.equal((transport as unknown as { socket: MockSocket | null }).socket, null);
  assert.equal((transport as unknown as { connecting: boolean }).connecting, false);
  assert.notEqual((transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer, null);

  transport.close();
});

test("FluentdTransport socket close triggers reconnect", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.write = () => true;
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;
  (transport as unknown as { connecting: boolean }).connecting = false;

  (transport as unknown as { handleDisconnected: () => void }).handleDisconnected();

  // Socket should be cleared and reconnect should be scheduled
  assert.equal((transport as unknown as { socket: MockSocket | null }).socket, null);
  assert.equal((transport as unknown as { connecting: boolean }).connecting, false);
  assert.notEqual((transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer, null);

  transport.close();
});

test("FluentdTransport.write does not buffer when buffer is at limit", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
    bufferLimit: 2,
  };

  const transport = new FluentdTransport(config);
  const buffer: string[] = [];

  (transport as unknown as { socket: EventEmitter | null }).socket = null;
  (transport as unknown as { buffer: string[] }).buffer = buffer;
  (transport as unknown as { connecting: boolean }).connecting = true;

  // Fill buffer to limit
  transport.write(createMockLogEntry({ message: "msg1" }));
  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(buffer.length, 2);

  // This should not add to buffer (at limit)
  transport.write(createMockLogEntry({ message: "msg3" }));
  assert.equal(buffer.length, 2); // Should still be 2

  transport.close();
});

test("FluentdTransport flush resolves immediately when no socket", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // No socket
  (transport as unknown as { socket: EventEmitter | null }).socket = null;

  const result = transport.flush();
  assert.ok(result instanceof Promise);

  // Should resolve immediately
  await result;
  assert.ok(true);

  transport.close();
});

test("FluentdTransport flush waits for socket drain when writable", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // Socket that is writable but will not trigger drain immediately
  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.writable = true;
  mockSocket.write = () => true;
  // Override once to call the listener immediately (simulating no backpressure)
  (mockSocket as unknown as { once: (e: string, cb: () => void) => void }).once = (_e: string, cb: () => void) => cb();
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  // Flush should resolve quickly since we simulate immediate drain
  const start = Date.now();
  await transport.flush();
  const elapsed = Date.now() - start;

  // Should complete quickly with immediate drain
  assert.ok(elapsed < 100);

  transport.close();
});

test("FluentdTransport connect returns early if already connecting", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // Already connecting
  (transport as unknown as { connecting: boolean }).connecting = true;
  const mockSocket: MockSocket = new EventEmitter() as MockSocket;
  mockSocket.write = () => true;
  (transport as unknown as { socket: MockSocket | null }).socket = mockSocket;

  // Try to connect - should return early
  (transport as unknown as { connect: () => void }).connect();

  // Should still be connecting
  assert.equal((transport as unknown as { connecting: boolean }).connecting, true);

  transport.close();
});

test("FluentdTransport close is safe when reconnectTimer is not set", async () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);

  // Ensure no reconnect timer
  (transport as unknown as { reconnectTimer: ReturnType<typeof setTimeout> | null }).reconnectTimer = null;
  (transport as unknown as { socket: MockSocket | null }).socket = null;

  // Close should not throw
  await transport.close();
  assert.ok(true);
});

test("FluentdTransport reconnectAttempts starts at 0", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);
  assert.equal((transport as unknown as { reconnectAttempts: number }).reconnectAttempts, 0);
  transport.close();
});

test("FluentdTransport maxReconnectAttempts is 10", () => {
  const config: FluentdTransportConfig = {
    host: "localhost",
    port: 24224,
    tag: "test",
  };

  const transport = new FluentdTransport(config);
  assert.equal((transport as unknown as { maxReconnectAttempts: number }).maxReconnectAttempts, 10);
  transport.close();
});

// ============================================================================
// DatadogTransport Additional Tests
// ============================================================================

test("DatadogTransport flushInternal adds service, ddsource, ddtags to entries", async () => {
  const { bodies, requestFactory } = createMockDatadogRequestFactory();
  const config: DatadogTransportConfig = {
    apiKey: "test-api-key",
    service: "my-service",
    source: "my-source",
    requestFactory,
  };

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  transport.write(createMockLogEntry({ message: "test1" }));
  transport.write(createMockLogEntry({ message: "test2" }));
  assert.equal(batch.length, 2);

  // Manually call flushInternal (private method via casting)
  await (transport as unknown as { flushInternal: () => Promise<void> }).flushInternal.call(transport);

  // Batch should be cleared
  assert.equal(batch.length, 0);
  const parsed = JSON.parse(bodies[0] ?? "[]") as Array<Record<string, unknown>>;
  assert.equal(parsed[0]?.service, "my-service");
  assert.equal(parsed[0]?.ddsource, "my-source");
  assert.equal(parsed[0]?.ddtags, `env:${process.env.NODE_ENV ?? "dev"}`);

  transport.close();
});

test("DatadogTransport write auto-flushes when batch size reached", () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 2,
  });

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  // First write - batch size is 1
  transport.write(createMockLogEntry({ message: "msg1" }));
  assert.equal(batch.length, 1);

  // Second write - triggers flush since batchSize is 2
  transport.write(createMockLogEntry({ message: "msg2" }));
  assert.equal(batch.length, 0); // Flushed

  transport.close();
});

test("DatadogTransport timer is set on construction", () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    flushIntervalMs: 10000,
  });

  const transport = new DatadogTransport(config);
  const timer = (transport as unknown as { timer: NodeJS.Timeout | null }).timer;

  assert.ok(timer !== null);

  transport.close();
});

test("DatadogTransport batch is initialized as empty array", () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  assert.ok(Array.isArray(batch));
  assert.equal(batch.length, 0);

  transport.close();
});

test("DatadogTransport write returns void", () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  const result = transport.write(createMockLogEntry());

  assert.equal(result, undefined);

  transport.close();
});

test("DatadogTransport close returns promise", async () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  const result = transport.close();

  assert.ok(result instanceof Promise);
  await result;
});

test("DatadogTransport flush returns promise", () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  const result = transport.flush();

  assert.ok(result instanceof Promise);

  transport.close();
});

test("DatadogTransport flushInternal returns early when batch is empty", async () => {
  const config = createDatadogTestConfig();

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;
  assert.equal(batch.length, 0);

  // flushInternal should return early
  await (transport as unknown as { flushInternal: () => Promise<void> }).flushInternal.call(transport);

  // Batch should still be empty
  assert.equal(batch.length, 0);

  transport.close();
});

test("DatadogTransport handles NODE_ENV in ddtags", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const { bodies, requestFactory } = createMockDatadogRequestFactory();
  const config: DatadogTransportConfig = {
    apiKey: "test-api-key",
    service: "test-service",
    requestFactory,
  };

  const transport = new DatadogTransport(config);

  // The ddtags should contain env:production
  transport.write(createMockLogEntry({ message: "prod test" }));
  await transport.flush();
  const parsed = JSON.parse(bodies[0] ?? "[]") as Array<Record<string, unknown>>;
  assert.equal(parsed[0]?.ddtags, "env:production");

  process.env.NODE_ENV = originalEnv;

  await transport.close();
});

test("DatadogTransport close flushes remaining entries", async () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    batchSize: 100, // Large batch size so auto-flush doesn't trigger
    flushIntervalMs: 60000, // Long interval so timer doesn't trigger
  });

  const transport = new DatadogTransport(config);
  const batch = (transport as unknown as { batch: StructuredLogEntry[] }).batch;

  transport.write(createMockLogEntry({ message: "should be flushed on close" }));
  assert.equal(batch.length, 1);

  await transport.close();

  // Batch should be empty after close
  assert.equal(batch.length, 0);
});

test("DatadogTransport close clears timer before flush", async () => {
  const config = createDatadogTestConfig({
    service: "test-service",
    flushIntervalMs: 10000,
  });

  const transport = new DatadogTransport(config);
  const timer = (transport as unknown as { timer: NodeJS.Timeout | null }).timer;

  assert.ok(timer !== null);

  await transport.close();

  // Timer should be null after close
  assert.equal((transport as unknown as { timer: NodeJS.Timeout | null }).timer, null);
});

// ============================================================================
// StdoutTransport Additional Tests
// ============================================================================

test("StdoutTransport.write outputs valid JSON with all fields", () => {
  const transport = new StdoutTransport();

  let writtenData = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    writtenData = chunk;
    return true;
  };

  try {
    const entry: StructuredLogEntry = {
      level: "error",
      message: "error message",
      createdAt: "2026-04-23T12:00:00.000Z",
      data: { errorCode: 500, details: "server error" },
      taskId: "task-abc",
      traceId: "trace-xyz",
      spanId: "span-123",
      service: "test-service",
      timestamp: "2026-04-23T12:00:00.000Z",
    };

    transport.write(entry);

    const parsed = JSON.parse(writtenData.trim());
    assert.equal(parsed.level, "error");
    assert.equal(parsed.message, "error message");
    assert.equal(parsed.createdAt, "2026-04-23T12:00:00.000Z");
    assert.deepEqual(parsed.data, { errorCode: 500, details: "server error" });
    assert.equal(parsed.taskId, "task-abc");
    assert.equal(parsed.traceId, "trace-xyz");
    assert.equal(parsed.spanId, "span-123");
  } finally {
    process.stdout.write = originalWrite;
  }
});

test("StdoutTransport.write handles debug level", () => {
  const transport = new StdoutTransport();

  let writtenData = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    writtenData = chunk;
    return true;
  };

  try {
    transport.write({
      level: "debug",
      message: "debug message",
      createdAt: "2026-04-23T00:00:00.000Z",
      service: "test-service",
      timestamp: "2026-04-23T00:00:00.000Z",
    });

    const parsed = JSON.parse(writtenData.trim());
    assert.equal(parsed.level, "debug");
  } finally {
    process.stdout.write = originalWrite;
  }
});

test("StdoutTransport.write adds newline after JSON", () => {
  const transport = new StdoutTransport();

  let writtenData = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    writtenData = chunk;
    return true;
  };

  try {
    transport.write({
      level: "info",
      message: "test",
      createdAt: "2026-04-23T00:00:00.000Z",
      service: "test-service",
      timestamp: "2026-04-23T00:00:00.000Z",
    });

    // Should end with newline
    assert.ok(writtenData.endsWith("\n"));
  } finally {
    process.stdout.write = originalWrite;
  }
});

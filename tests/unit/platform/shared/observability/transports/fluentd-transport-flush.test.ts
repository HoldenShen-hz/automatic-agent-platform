import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

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

// Test the flush() deadlock fix: when the socket is writable but writableLength === 0,
// flush() must NOT wait for a 'drain' event that will never fire.
test("FluentdTransport flush does NOT deadlock when socket is writable with empty buffer", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // Simulate a connected socket that is writable but has nothing buffered.
  // This is the case that caused the original deadlock: writable=true but
  // writableLength=0 means the write buffer is empty, so 'drain' never fires.
  const mockSocket = new EventEmitter() as import("node:net").Socket;
  mockSocket.writable = true;
  mockSocket.writableLength = 0;
  mockSocket.destroyed = false;
  mockSocket.write = () => true;
  mockSocket.once = () => {};
  mockSocket.end = () => {};
  mockSocket.destroy = () => {};

  // Replace internal socket
  (transport as unknown as { socket: typeof mockSocket }).socket = mockSocket;

  // With the fix, flush() should resolve immediately because writableLength === 0
  // The original bug would register a 'drain' listener and never resolve.
  const timeout = new Promise<boolean>((_, reject) =>
    setTimeout(() => reject(new Error("flush() deadlocked - timeout after 1s")), 1000)
  );

  await assert.doesNotReject(Promise.race([transport.flush(), timeout]));
  await transport.close();
});

test("FluentdTransport flush waits for drain when socket write buffer is non-empty", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  const mockSocket = new EventEmitter() as import("node:net").Socket;
  mockSocket.writable = true;
  mockSocket.writableLength = 10; // Non-zero means data is buffered
  mockSocket.destroyed = false;
  mockSocket.write = () => false; // Simulate backpressure
  mockSocket.once = (event: string, cb: () => void) => {
    if (event === "drain") {
      // Defer drain callback to simulate async write buffer drain
      setImmediate(cb);
    }
  };
  mockSocket.end = () => {};
  mockSocket.destroy = () => {};

  (transport as unknown as { socket: typeof mockSocket }).socket = mockSocket;

  // flush() should wait for drain event when writableLength > 0
  const result = await transport.flush();
  assert.equal(result, undefined);
  await transport.close();
});

test("FluentdTransport flush resolves immediately when socket is null", async () => {
  const transport = new FluentdTransport({
    host: "localhost",
    port: 60000,
    tag: "test",
  });

  // No socket set - flush should resolve immediately
  const result = await transport.flush();
  assert.equal(result, undefined);
  await transport.close();
});
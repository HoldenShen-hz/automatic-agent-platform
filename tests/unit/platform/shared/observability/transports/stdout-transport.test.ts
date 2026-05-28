import assert from "node:assert/strict";
import test from "node:test";

import { StdoutTransport } from "../../../../../../src/platform/shared/observability/transports/stdout-transport.js";
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

test("StdoutTransport name is stdout", () => {
  const transport = new StdoutTransport();
  assert.equal(transport.name, "stdout");
});

test("StdoutTransport.write writes JSON to stdout", () => {
  const transport = new StdoutTransport();
  const entry = createTestEntry({ message: "write test" });
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.equal(output.length, 1);
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
});

test("StdoutTransport.write handles all log levels", () => {
  const transport = new StdoutTransport();
  const levels: StructuredLogEntry["level"][] = ["debug", "info", "warn", "error"];

  const output = captureStdout(() => {
    for (const level of levels) {
      transport.write(createTestEntry({ level, message: `test ${level}` }));
    }
  });
  assert.deepEqual(
    output.map((line) => JSON.parse(line).level),
    levels,
  );
});

test("StdoutTransport.write handles entry with data", () => {
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
  } satisfies StructuredLogEntry;
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
});

test("StdoutTransport.write handles entry with all optional fields", () => {
  const transport = new StdoutTransport();
  const entry = {
    level: "error",
    message: "full entry",
    service: "test-service",
    createdAt: "2026-04-22T00:00:00.000Z",
    timestamp: "2026-04-22T00:00:00.000Z",
    taskId: "task-1",
    agentId: "agent-1",
    sessionId: "session-1",
    stepId: "step-1",
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: "parent-span-1",
    correlationId: "corr-1",
    data: { nested: { value: 123 } },
  } satisfies StructuredLogEntry;
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
});

test("StdoutTransport.write outputs valid JSON", () => {
  const transport = new StdoutTransport();
  const entry = createTestEntry({
    level: "info",
    message: "json validation test",
    data: { array: [1, 2, 3], bool: true },
  });

  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
});

test("StdoutTransport.flush is a no-op and returns immediately", async () => {
  const transport = new StdoutTransport();
  assert.equal(await transport.flush(), undefined);
});

test("StdoutTransport.close is a no-op and returns immediately", async () => {
  const transport = new StdoutTransport();
  assert.equal(await transport.close(), undefined);
});

test("StdoutTransport implements LogTransport interface", () => {
  const transport = new StdoutTransport();
  // Verify it has all required properties
  assert.equal(typeof transport.name, "string");
  assert.equal(typeof transport.write, "function");
  assert.equal(typeof transport.flush, "function");
  assert.equal(typeof transport.close, "function");
});

test("StdoutTransport.write handles empty message", () => {
  const transport = new StdoutTransport();
  const output = captureStdout(() => {
    transport.write(createTestEntry({ message: "" }));
  });
  assert.equal(JSON.parse(output[0] ?? "").message, "");
});

test("StdoutTransport.write handles unicode characters", () => {
  const transport = new StdoutTransport();
  const output = captureStdout(() => {
    transport.write(createTestEntry({ message: "Hello 世界 🌍 🎉" }));
  });
  assert.equal(JSON.parse(output[0] ?? "").message, "Hello 世界 🌍 🎉");
});

test("StdoutTransport.write handles very long message", () => {
  const transport = new StdoutTransport();
  const longMessage = "a".repeat(10000);
  const output = captureStdout(() => {
    transport.write(createTestEntry({ message: longMessage }));
  });
  assert.equal(JSON.parse(output[0] ?? "").message.length, 10000);
});

test("StdoutTransport.write handles special JSON characters", () => {
  const transport = new StdoutTransport();
  const entry = createTestEntry({
    message: 'test with "quotes" and \\ backslash',
    data: { with: 'quotes " " and backslash \\' },
  });
  const output = captureStdout(() => {
    transport.write(entry);
  });
  assert.deepEqual(JSON.parse(output[0] ?? ""), entry);
});

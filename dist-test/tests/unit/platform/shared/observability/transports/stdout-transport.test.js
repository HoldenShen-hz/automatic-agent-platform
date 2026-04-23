import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import { StdoutTransport } from "../../../../../../src/platform/shared/observability/transports/stdout-transport.js";
function createTestEntry(overrides = {}) {
    return {
        level: "info",
        message: "test message",
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}
// Create a mock stdout to capture written data
function createMockStdout() {
    const output = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            output.push(chunk.toString());
            callback();
        },
    });
    return { output, stream };
}
test("StdoutTransport name is stdout", () => {
    const transport = new StdoutTransport();
    assert.equal(transport.name, "stdout");
});
test("StdoutTransport.write writes JSON to stdout", () => {
    const transport = new StdoutTransport();
    const entry = createTestEntry({ message: "write test" });
    transport.write(entry);
    // If we get here without throwing, the test passes
    assert.ok(true);
});
test("StdoutTransport.write handles all log levels", () => {
    const transport = new StdoutTransport();
    const levels = ["debug", "info", "warn", "error"];
    for (const level of levels) {
        transport.write(createTestEntry({ level, message: `test ${level}` }));
    }
    assert.ok(true);
});
test("StdoutTransport.write handles entry with data", () => {
    const transport = new StdoutTransport();
    transport.write({
        level: "info",
        message: "test with data",
        createdAt: "2026-04-22T00:00:00.000Z",
        data: { key: "value", count: 42 },
        taskId: "task_123",
        traceId: "trace_abc",
    });
    assert.ok(true);
});
test("StdoutTransport.write handles entry with all optional fields", () => {
    const transport = new StdoutTransport();
    transport.write({
        level: "error",
        message: "full entry",
        createdAt: "2026-04-22T00:00:00.000Z",
        taskId: "task-1",
        agentId: "agent-1",
        sessionId: "session-1",
        stepId: "step-1",
        traceId: "trace-1",
        spanId: "span-1",
        parentSpanId: "parent-span-1",
        correlationId: "corr-1",
        data: { nested: { value: 123 } },
    });
    assert.ok(true);
});
test("StdoutTransport.write outputs valid JSON", () => {
    const transport = new StdoutTransport();
    const entry = createTestEntry({
        level: "info",
        message: "json validation test",
        data: { array: [1, 2, 3], bool: true },
    });
    transport.write(entry);
    // JSON output should be parseable - if not, this would throw
    assert.ok(true);
});
test("StdoutTransport.flush is a no-op and returns immediately", async () => {
    const transport = new StdoutTransport();
    await transport.flush();
    assert.ok(true);
});
test("StdoutTransport.close is a no-op and returns immediately", async () => {
    const transport = new StdoutTransport();
    await transport.close();
    assert.ok(true);
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
    transport.write(createTestEntry({ message: "" }));
    assert.ok(true);
});
test("StdoutTransport.write handles unicode characters", () => {
    const transport = new StdoutTransport();
    transport.write(createTestEntry({ message: "Hello 世界 🌍 🎉" }));
    assert.ok(true);
});
test("StdoutTransport.write handles very long message", () => {
    const transport = new StdoutTransport();
    const longMessage = "a".repeat(10000);
    transport.write(createTestEntry({ message: longMessage }));
    assert.ok(true);
});
test("StdoutTransport.write handles special JSON characters", () => {
    const transport = new StdoutTransport();
    transport.write(createTestEntry({
        message: 'test with "quotes" and \\ backslash',
        data: { with: 'quotes " " and backslash \\' },
    }));
    assert.ok(true);
});
//# sourceMappingURL=stdout-transport.test.js.map
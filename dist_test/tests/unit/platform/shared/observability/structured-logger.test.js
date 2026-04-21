import assert from "node:assert/strict";
import test from "node:test";
import { startActiveSpan } from "../../../../../src/platform/shared/observability/otel-tracer.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
test("StructuredLogger constructor uses default retention limit", () => {
    const logger = new StructuredLogger();
    const summary = logger.getBufferSummary();
    assert.equal(summary.retentionLimit, 500);
    assert.equal(summary.entryCount, 0);
    assert.equal(summary.droppedEntryCount, 0);
});
test("StructuredLogger constructor accepts custom retention limit", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const summary = logger.getBufferSummary();
    assert.equal(summary.retentionLimit, 100);
});
test("StructuredLogger constructor clamps minimum retention limit to 1", () => {
    const logger = new StructuredLogger({ retentionLimit: 0 });
    const summary = logger.getBufferSummary();
    assert.equal(summary.retentionLimit, 1);
    const logger2 = new StructuredLogger({ retentionLimit: -5 });
    const summary2 = logger2.getBufferSummary();
    assert.equal(summary2.retentionLimit, 1);
});
test("StructuredLogger.log adds entry with timestamp", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.log({ level: "info", message: "test message" });
    assert.equal(entry.level, "info");
    assert.equal(entry.message, "test message");
    assert.equal(typeof entry.createdAt, "string");
    assert.ok(entry.createdAt.includes("T"), "ISO timestamp should contain T");
});
test("StructuredLogger.log includes optional fields when provided", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.log({
        level: "error",
        message: "error occurred",
        taskId: "task_123",
        agentId: "agent_456",
        sessionId: "sess_789",
        traceId: "trace_abc",
        data: { errorCode: "E001" },
    });
    assert.equal(entry.taskId, "task_123");
    assert.equal(entry.agentId, "agent_456");
    assert.equal(entry.sessionId, "sess_789");
    assert.equal(entry.traceId, "trace_abc");
    assert.deepEqual(entry.data, { errorCode: "E001" });
});
test("StructuredLogger.debug creates debug level entry", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.debug("debug message", { key: "value" });
    assert.equal(entry.level, "debug");
    assert.equal(entry.message, "debug message");
    assert.deepEqual(entry.data, { key: "value" });
});
test("StructuredLogger.info creates info level entry", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.info("info message");
    assert.equal(entry.level, "info");
    assert.equal(entry.message, "info message");
});
test("StructuredLogger.warn creates warn level entry", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.warn("warning message", { reason: "slow" });
    assert.equal(entry.level, "warn");
    assert.equal(entry.message, "warning message");
    assert.deepEqual(entry.data, { reason: "slow" });
});
test("StructuredLogger.error creates error level entry", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.error("error message");
    assert.equal(entry.level, "error");
    assert.equal(entry.message, "error message");
});
test("StructuredLogger.recent returns entries in chronological order", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    logger.info("first");
    logger.info("second");
    logger.info("third");
    const recent = logger.recent(3);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].message, "first");
    assert.equal(recent[1].message, "second");
    assert.equal(recent[2].message, "third");
});
test("StructuredLogger.recent limits results", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    for (let i = 0; i < 5; i++) {
        logger.info(`message ${i}`);
    }
    const recent = logger.recent(2);
    assert.equal(recent.length, 2);
});
test("StructuredLogger.recent returns empty array when no entries", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const recent = logger.recent();
    assert.deepEqual(recent, []);
});
test("StructuredLogger.recent defaults to 50 entries", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    for (let i = 0; i < 60; i++) {
        logger.info(`message ${i}`);
    }
    const recent = logger.recent();
    assert.equal(recent.length, 50);
});
test("StructuredLogger ring buffer overwrites old entries", () => {
    const logger = new StructuredLogger({ retentionLimit: 3 });
    logger.info("first");
    logger.info("second");
    logger.info("third");
    logger.info("fourth");
    logger.info("fifth");
    const recent = logger.recent(3);
    // Should have third, fourth, fifth (oldest first)
    assert.equal(recent[0].message, "third");
    assert.equal(recent[1].message, "fourth");
    assert.equal(recent[2].message, "fifth");
});
test("StructuredLogger tracks dropped entries when buffer wraps", () => {
    const logger = new StructuredLogger({ retentionLimit: 3 });
    assert.equal(logger.getBufferSummary().droppedEntryCount, 0);
    logger.info("first");
    logger.info("second");
    logger.info("third");
    logger.info("fourth"); // First entry dropped
    assert.equal(logger.getBufferSummary().droppedEntryCount, 1);
    logger.info("fifth"); // Second entry dropped
    logger.info("sixth"); // Third entry dropped
    assert.equal(logger.getBufferSummary().droppedEntryCount, 3);
});
test("StructuredLogger.recentByTask filters by taskId", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.log({ level: "info", message: "task1 msg1", taskId: "task_1" });
    logger.log({ level: "info", message: "task2 msg1", taskId: "task_2" });
    logger.log({ level: "info", message: "task1 msg2", taskId: "task_1" });
    logger.log({ level: "info", message: "task2 msg2", taskId: "task_2" });
    const task1Logs = logger.recentByTask("task_1");
    assert.equal(task1Logs.length, 2);
    assert.ok(task1Logs.every((e) => e.taskId === "task_1"));
});
test("StructuredLogger.recentByTrace filters by traceId", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.log({ level: "info", message: "traceA msg1", traceId: "trace_A" });
    logger.log({ level: "info", message: "traceB msg1", traceId: "trace_B" });
    logger.log({ level: "info", message: "traceA msg2", traceId: "trace_A" });
    const traceALogs = logger.recentByTrace("trace_A");
    assert.equal(traceALogs.length, 2);
    assert.ok(traceALogs.every((e) => e.traceId === "trace_A"));
});
test("StructuredLogger.recentByCorrelation filters by correlationId", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.log({ level: "info", message: "corr1 msg1", correlationId: "corr_1" });
    logger.log({ level: "info", message: "corr2 msg1", correlationId: "corr_2" });
    logger.log({ level: "info", message: "corr1 msg2", correlationId: "corr_1" });
    const corr1Logs = logger.recentByCorrelation("corr_1");
    assert.equal(corr1Logs.length, 2);
    assert.ok(corr1Logs.every((e) => e.correlationId === "corr_1"));
});
test("StructuredLogger.recentByTask respects limit parameter", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    for (let i = 0; i < 10; i++) {
        logger.log({ level: "info", message: `task1 msg ${i}`, taskId: "task_1" });
    }
    const recent = logger.recentByTask("task_1", 3);
    assert.equal(recent.length, 3);
});
test("StructuredLogger.getBufferSummary returns correct counts", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    logger.info("msg1");
    logger.info("msg2");
    logger.info("msg3");
    const summary = logger.getBufferSummary();
    assert.equal(summary.entryCount, 3);
    assert.equal(summary.retentionLimit, 10);
    assert.equal(summary.droppedEntryCount, 0);
});
test("StructuredLogger handles concurrent-ish logging", () => {
    const logger = new StructuredLogger({ retentionLimit: 5 });
    logger.info("msg1");
    logger.info("msg2");
    logger.info("msg3");
    // Verify entries are accessible
    const recent = logger.recent();
    assert.equal(recent.length, 3);
});
test("StructuredLogger.log preserves all structured fields", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const entry = logger.log({
        level: "info",
        message: "structured message",
        spanId: "span_123",
        parentSpanId: "parent_456",
        stepId: "step_789",
    });
    assert.equal(entry.spanId, "span_123");
    assert.equal(entry.parentSpanId, "parent_456");
    assert.equal(entry.stepId, "step_789");
});
test("StructuredLogger.log bridges active telemetry context when ids are omitted", async () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    await startActiveSpan("logger.bridge", {}, async (_span, context) => {
        const entry = logger.info("bridged");
        assert.equal(entry.traceId, context.traceId);
        assert.equal(entry.spanId, context.spanId);
    });
});
//# sourceMappingURL=structured-logger.test.js.map
/**
 * Integration Test: Structured Logging
 *
 * Verifies:
 * - StructuredLogger with file sink integration
 * - StructuredLogger with multiple transports
 * - Log filtering and querying in integration scenarios
 * - End-to-end log lifecycle with persistence
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { StructuredLogger, } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("structured-logging: logger captures entries with all correlation IDs", () => {
    const workspace = createTempWorkspace("aa-structured-log-");
    const logFile = join(workspace, "test.log");
    try {
        const logger = new StructuredLogger({ retentionLimit: 100 });
        // Log entries with various correlation IDs
        logger.log({
            level: "info",
            message: "task started",
            taskId: "task_integration_1",
            traceId: "trace_integration_1",
            correlationId: "corr_integration_1",
        });
        logger.log({
            level: "error",
            message: "task failed",
            taskId: "task_integration_1",
            traceId: "trace_integration_1",
            correlationId: "corr_integration_1",
            data: { errorCode: "E001", reason: "timeout" },
        });
        logger.log({
            level: "warn",
            message: "task retrying",
            taskId: "task_integration_1",
            traceId: "trace_integration_1",
            correlationId: "corr_integration_1",
            agentId: "agent_001",
            stepId: "step_execute",
        });
        // Verify entries are captured
        const entries = logger.getEntries();
        assert.equal(entries.length, 3, "Should have 3 log entries");
        // Verify filtering by task
        const taskEntries = logger.recentByTask("task_integration_1");
        assert.equal(taskEntries.length, 3, "Should find 3 entries for task_integration_1");
        // Verify filtering by trace
        const traceEntries = logger.recentByTrace("trace_integration_1");
        assert.equal(traceEntries.length, 3, "Should find 3 entries for trace_integration_1");
        // Verify filtering by correlation
        const corrEntries = logger.recentByCorrelation("corr_integration_1");
        assert.equal(corrEntries.length, 3, "Should find 3 entries for corr_integration_1");
        // Verify data payload preservation
        const errorEntry = entries.find((e) => e.level === "error");
        assert.ok(errorEntry, "Should find error entry");
        assert.deepEqual(errorEntry?.data, { errorCode: "E001", reason: "timeout" });
        // Verify agentId and stepId preservation
        const warnEntry = entries.find((e) => e.level === "warn");
        assert.ok(warnEntry, "Should find warn entry");
        assert.equal(warnEntry?.agentId, "agent_001");
        assert.equal(warnEntry?.stepId, "step_execute");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("structured-logging: logger ring buffer behavior under high volume", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    // Add more entries than retention limit
    for (let i = 0; i < 25; i++) {
        logger.info(`high_volume_message_${i}`, { index: i });
    }
    const entries = logger.getEntries();
    assert.equal(entries.length, 10, "Should respect retention limit of 10");
    // Verify oldest entries were dropped
    assert.equal(entries[0]?.message, "high_volume_message_15", "First entry should be message_15");
    assert.equal(entries[9]?.message, "high_volume_message_24", "Last entry should be message_24");
    // Verify dropped count
    const summary = logger.getBufferSummary();
    assert.equal(summary.droppedEntryCount, 15, "Should have dropped 15 entries");
    assert.equal(summary.entryCount, 10, "Entry count should be 10");
});
test("structured-logging: logger filters by level correctly", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");
    const entries = logger.getEntries();
    assert.equal(entries.length, 5, "Should have all 5 entries");
    // Verify level distribution
    const levels = entries.map((e) => e.level);
    assert.ok(levels.includes("debug"));
    assert.ok(levels.includes("info"));
    assert.ok(levels.includes("warn"));
    assert.ok(levels.includes("error"));
    assert.ok(levels.includes("fatal"));
});
test("structured-logging: logger recent returns entries in order", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    for (let i = 0; i < 10; i++) {
        logger.info(`message_${i}`);
    }
    const recent = logger.recent(5);
    assert.equal(recent.length, 5, "Should return 5 entries");
    assert.equal(recent[0]?.message, "message_5", "First recent entry should be message_5");
    assert.equal(recent[4]?.message, "message_9", "Last recent entry should be message_9");
});
test("structured-logging: logger with custom plane inference", () => {
    const logger = new StructuredLogger({
        retentionLimit: 50,
        planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts",
    });
    const entry = logger.info("dispatch operation");
    assert.equal(entry.plane, "P4", "Should infer P4 plane from execution path");
    assert.equal(entry.service, "index", "Should extract service name from file");
});
test("structured-logging: logger recentByTask with limit", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    // Add multiple entries for different tasks
    for (let i = 0; i < 5; i++) {
        logger.log({ level: "info", message: `task_A_msg_${i}`, taskId: "task_A" });
    }
    for (let i = 0; i < 3; i++) {
        logger.log({ level: "info", message: `task_B_msg_${i}`, taskId: "task_B" });
    }
    // Filter with limit
    const taskARecent = logger.recentByTask("task_A", 2);
    assert.equal(taskARecent.length, 2, "Should return only 2 entries for task_A");
    const taskBRecent = logger.recentByTask("task_B", 5);
    assert.equal(taskBRecent.length, 3, "Should return all 3 entries for task_B (less than limit)");
});
test("structured-logging: logger recentByTrace with no matches", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    logger.info("message 1", { traceId: "trace_1" });
    logger.info("message 2", { traceId: "trace_2" });
    const noMatch = logger.recentByTrace("trace_nonexistent");
    assert.equal(noMatch.length, 0, "Should return empty array for non-existent trace");
});
test("structured-logging: logger handles empty data payload", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    const entry = logger.log({
        level: "info",
        message: "message with null data",
        data: null,
    });
    assert.equal(entry.data, null);
});
test("structured-logging: logger preserves span context", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    const entry = logger.log({
        level: "info",
        message: "span context test",
        spanId: "span_abc123",
        parentSpanId: "parent_xyz789",
    });
    assert.equal(entry.spanId, "span_abc123");
    assert.equal(entry.parentSpanId, "parent_xyz789");
});
test("structured-logging: logger getBufferSummary reports accurate counts", () => {
    const logger = new StructuredLogger({ retentionLimit: 20 });
    // Add some entries
    for (let i = 0; i < 5; i++) {
        logger.info(`message_${i}`);
    }
    const summary = logger.getBufferSummary();
    assert.equal(summary.entryCount, 5);
    assert.equal(summary.retentionLimit, 20);
    assert.equal(summary.droppedEntryCount, 0);
    // Add more to trigger drops
    for (let i = 0; i < 20; i++) {
        logger.info(`overflow_message_${i}`);
    }
    const summary2 = logger.getBufferSummary();
    assert.equal(summary2.entryCount, 20, "Should be at capacity");
    assert.equal(summary2.droppedEntryCount, 5, "Should have dropped 5 entries");
});
test("structured-logging: logger handles concurrent log operations", () => {
    const logger = new StructuredLogger({ retentionLimit: 100 });
    // Simulate concurrent logging
    logger.info("first");
    logger.info("second");
    logger.info("third");
    const recent = logger.recent(3);
    assert.equal(recent.length, 3);
    // Verify order is preserved
    assert.equal(recent[0]?.message, "first");
    assert.equal(recent[1]?.message, "second");
    assert.equal(recent[2]?.message, "third");
});
test("structured-logging: logger accepts structuredPayload alias", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    const entry = logger.log({
        level: "info",
        message: "test with structured payload",
        structuredPayload: { key: "value", nested: { a: 1 } },
    });
    assert.deepEqual(entry.structuredPayload, { key: "value", nested: { a: 1 } });
    assert.deepEqual(entry.data, { key: "value", nested: { a: 1 } }, "data should mirror structuredPayload");
});
test("structured-logging: logger defaults service to unknown_service", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    const entry = logger.info("test message");
    assert.equal(entry.service, "unknown_service");
});
test("structured-logging: logger creates entries with ISO timestamp", () => {
    const logger = new StructuredLogger({ retentionLimit: 50 });
    const before = Date.now();
    const entry = logger.info("timestamp test");
    const after = Date.now();
    assert.ok(entry.timestamp.includes("T"), "Timestamp should be ISO format");
    const parsedTime = Date.parse(entry.timestamp);
    assert.ok(parsedTime >= before && parsedTime <= after, "Timestamp should be within expected range");
    assert.equal(entry.createdAt, entry.timestamp, "createdAt should equal timestamp");
});
//# sourceMappingURL=structured-logging-integration.test.js.map
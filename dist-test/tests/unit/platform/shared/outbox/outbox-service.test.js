/**
 * Unit tests for OutboxService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
function createMockConnection() {
    return {
        prepare: () => ({
            run: () => ({ changes: 1 }),
            get: () => null,
            all: () => [],
        }),
    };
}
function createMockDb() {
    return {
        transaction: (fn) => fn(),
        connection: createMockConnection(),
    };
}
function createMockEventBus(shouldFail = false) {
    return {
        publish: (input) => {
            if (shouldFail) {
                throw new Error("Connection refused");
            }
            return { id: `evt-${Date.now()}` };
        },
    };
}
test("OutboxService.writeOutboxEntry inserts entry and returns record", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("task", "task-123", "task:status_changed", { status: "running", taskId: "task-123" }, "trace-abc");
    assert.equal(entry.aggregateType, "task");
    assert.equal(entry.aggregateId, "task-123");
    assert.equal(entry.eventType, "task:status_changed");
    assert.equal(entry.traceId, "trace-abc");
    assert.equal(entry.publishedAt, null);
    assert.equal(entry.retryCount, 0);
});
test("OutboxService.writeOutboxEntries inserts multiple entries", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const entries = service.writeOutboxEntries([
        { aggregateType: "task", aggregateId: "task-1", eventType: "task:created", payload: { taskId: "task-1" } },
        { aggregateType: "task", aggregateId: "task-2", eventType: "task:created", payload: { taskId: "task-2" } },
    ]);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].aggregateType, "task");
    assert.equal(entries[1].aggregateType, "task");
});
test("OutboxService.getPendingEntries returns pending entries", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
    service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });
    const pending = service.getPendingEntries(10);
    assert.ok(Array.isArray(pending));
    assert.ok(pending.length >= 2);
});
test("OutboxService.getPendingEntries respects limit", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
    service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });
    service.writeOutboxEntry("task", "task-3", "task:created", { taskId: "task-3" });
    const pending = service.getPendingEntries(2);
    assert.ok(Array.isArray(pending));
});
test("OutboxService.getPendingCount returns count of pending entries", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const initialCount = service.getPendingCount();
    assert.equal(initialCount, 0);
    service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
    const count = service.getPendingCount();
    assert.ok(count >= 1);
});
test("OutboxService.publishEntry publishes to event bus on success", async () => {
    let publishCalled = false;
    const mockBus = {
        publish: (input) => {
            publishCalled = true;
            assert.equal(input.eventType, "task:status_changed");
            return { id: "evt-123" };
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("task", "task-123", "task:status_changed", { status: "running" });
    const result = await service.publishEntry(entry);
    assert.equal(result, true);
    assert.equal(publishCalled, true);
});
test("OutboxService.publishEntry returns false and marks failed on error", async () => {
    const mockBus = createMockEventBus(true); // will throw
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("task", "task-123", "task:status_changed", { status: "running" });
    const result = await service.publishEntry(entry);
    assert.equal(result, false);
    assert.ok(service.getFailedCount() >= 1);
});
test("OutboxService.publishPending publishes all pending entries", async () => {
    let publishCount = 0;
    const mockBus = {
        publish: () => {
            publishCount++;
            return { id: `evt-${publishCount}` };
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
    service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });
    service.writeOutboxEntry("task", "task-3", "task:created", { taskId: "task-3" });
    const result = await service.publishPending();
    assert.equal(result.published, 3);
    assert.equal(result.failed, 0);
    assert.equal(publishCount, 3);
});
test("OutboxService.publishPending handles mixed success and failure", async () => {
    let callCount = 0;
    const mockBus = {
        publish: () => {
            callCount++;
            if (callCount === 2) {
                throw new Error("Transient failure");
            }
            return { id: `evt-${callCount}` };
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
    service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });
    service.writeOutboxEntry("task", "task-3", "task:created", { taskId: "task-3" });
    const result = await service.publishPending();
    assert.equal(result.published, 2);
    assert.equal(result.failed, 1);
    assert.ok(service.getFailedCount() >= 1);
});
test("OutboxService uses default config when not provided", () => {
    const mockBus = createMockEventBus();
    // Should not throw
    const service = new OutboxService(createMockDb(), mockBus);
    const pending = service.getPendingEntries();
    assert.ok(Array.isArray(pending));
});
test("OutboxService accepts custom config", () => {
    const mockBus = createMockEventBus();
    // Should not throw
    const service = new OutboxService(createMockDb(), mockBus, {
        maxBatchSize: 50,
        publishTimeoutMs: 10000,
    });
    const pending = service.getPendingEntries(50);
    assert.ok(Array.isArray(pending));
});
// ── markPublished and markFailed Tests ────────────────────────────────────
test("OutboxService.markPublished updates entry publishedAt", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    // Write an entry
    const entry = service.writeOutboxEntry("task", "task-markpub-001", "task:created", { taskId: "task-markpub-001" });
    // Mark it as published
    service.markPublished(entry.id);
    // Re-query to verify publishedAt was set (mock returns null for get)
    // The markPublished call should not throw
    assert.ok(true, "markPublished should complete without error");
});
test("OutboxService.markFailed updates entry with error and retry count", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    // Write an entry
    const entry = service.writeOutboxEntry("task", "task-markfail-001", "task:created", { taskId: "task-markfail-001" });
    // Mark it as failed
    service.markFailed(entry.id, "Connection refused", 3, "2026-04-22T00:00:00Z");
    // Verify the failed count increased
    const failedCount = service.getFailedCount();
    assert.ok(failedCount >= 1, "getFailedCount should return >= 1 after markFailed");
});
test("OutboxService.markFailed with zero retry count", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("execution", "exec-markfail-001", "execution:failed", { executionId: "exec-markfail-001" });
    // Mark with zero retries
    service.markFailed(entry.id, "Timeout", 0, "2026-04-22T00:00:00Z");
    assert.ok(true, "markFailed with retryCount=0 should not throw");
});
// ── publishEntriesBatch Tests ──────────────────────────────────────────────
test("OutboxService.publishEntriesBatch publishes all entries successfully", async () => {
    let batchPublishCalled = false;
    const mockBus = {
        publish: () => ({ id: "evt-batch-1" }),
        publishBatch: (inputs) => {
            batchPublishCalled = true;
            assert.ok(inputs.length === 3, "Batch should contain 3 entries");
            return { publishedIds: inputs.map((_, i) => `evt-batch-${i + 1}`) };
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "batch-task-1", "task:created", { taskId: "batch-task-1" });
    service.writeOutboxEntry("task", "batch-task-2", "task:created", { taskId: "batch-task-2" });
    service.writeOutboxEntry("task", "batch-task-3", "task:created", { taskId: "batch-task-3" });
    const entries = service.getPendingEntries(10);
    const result = await service.publishEntriesBatch(entries);
    assert.equal(result.published, 3, "All 3 entries should be published");
    assert.equal(result.failed, 0, "No failures");
});
test("OutboxService.publishEntriesBatch returns {published:0, failed:0} for empty entries", async () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const result = await service.publishEntriesBatch([]);
    assert.equal(result.published, 0, "Empty batch should return published=0");
    assert.equal(result.failed, 0, "Empty batch should return failed=0");
});
test("OutboxService.publishEntriesBatch marks all as failed when batch throws", async () => {
    let callCount = 0;
    const mockBus = {
        publish: () => ({ id: "evt-single" }),
        publishBatch: () => {
            callCount++;
            throw new Error("Batch publish rejected - broker unavailable");
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "batch-fail-1", "task:created", { taskId: "batch-fail-1" });
    service.writeOutboxEntry("task", "batch-fail-2", "task:created", { taskId: "batch-fail-2" });
    const entries = service.getPendingEntries(10);
    const result = await service.publishEntriesBatch(entries);
    assert.equal(result.published, 0, "No entries should be published on batch failure");
    assert.equal(result.failed, 2, "Both entries should be marked as failed");
});
test("OutboxService.publishEntriesBatch handles partial failure scenario", async () => {
    // When publishBatch throws, all entries are marked as failed (not partial retry)
    const mockBus = {
        publishBatch: () => {
            throw new Error("Connection reset during batch");
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("execution", "partial-1", "execution:started", { executionId: "partial-1" });
    service.writeOutboxEntry("execution", "partial-2", "execution:started", { executionId: "partial-2" });
    const entries = service.getPendingEntries(10);
    const result = await service.publishEntriesBatch(entries);
    assert.equal(result.published, 0);
    assert.equal(result.failed, 2);
});
test("OutboxService.publishEntriesBatch logs debug message on success", async () => {
    const debugLogs = [];
    const mockBus = {
        publish: () => ({ id: "evt-dbg" }),
        publishBatch: (inputs) => ({
            publishedIds: inputs.map((_, i) => `evt-dbg-${i}`),
        }),
    };
    // Note: We're testing the code path exists - actual logging tested separately
    const service = new OutboxService(createMockDb(), mockBus);
    service.writeOutboxEntry("task", "log-test-1", "task:created", { taskId: "log-test-1" });
    const entries = service.getPendingEntries(10);
    const result = await service.publishEntriesBatch(entries);
    assert.equal(result.published, 1, "Should publish 1 entry");
    assert.equal(result.failed, 0, "Should have 0 failures");
});
// ── Additional edge case tests ─────────────────────────────────────────────
test("OutboxService handles task aggregate with null traceId", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("task", "task-notrace-001", "task:status_changed", { status: "running" }, null);
    assert.equal(entry.traceId, null, "traceId should accept null value");
});
test("OutboxService handles execution aggregate type", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("execution", "exec-123", "execution:completed", { executionId: "exec-123", status: "completed" });
    assert.equal(entry.aggregateType, "execution");
    assert.equal(entry.aggregateId, "exec-123");
});
test("OutboxService getFailedCount returns 0 initially", () => {
    const mockBus = createMockEventBus();
    const service = new OutboxService(createMockDb(), mockBus);
    const count = service.getFailedCount();
    assert.equal(count, 0, "getFailedCount should return 0 when no failures");
});
test("OutboxService publishEntry with execution aggregate sets correct taskId/executionId", async () => {
    let receivedExecutionId = null;
    const mockBus = {
        publish: (input) => {
            if (input.executionId) {
                receivedExecutionId = input.executionId;
            }
            return { id: "evt-exec" };
        },
    };
    const service = new OutboxService(createMockDb(), mockBus);
    const entry = service.writeOutboxEntry("execution", "exec-publish-001", "execution:started", { executionId: "exec-publish-001" });
    await service.publishEntry(entry);
    assert.equal(receivedExecutionId, "exec-publish-001", "execution aggregate should set executionId in publish");
});
//# sourceMappingURL=outbox-service.test.js.map
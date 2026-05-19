/**
 * Integration Tests: OutboxPollerService
 *
 * Tests the OutboxPollerService which polls pending outbox entries
 * and publishes them to the event bus asynchronously.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import { OutboxPollerService } from "../../../../../src/platform/shared/outbox/outbox-poller-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
/**
 * Fake DurableEventBus for testing - tracks published events and optionally throws errors.
 */
class FakeEventBus {
    publishedEvents = [];
    shouldThrow = false;
    throwError = new Error("publish error");
    reset() {
        this.publishedEvents = [];
        this.shouldThrow = false;
    }
    setThrowOnPublish(shouldThrow) {
        this.shouldThrow = shouldThrow;
    }
    publish(input) {
        if (this.shouldThrow) {
            throw this.throwError;
        }
        this.publishedEvents.push({
            eventType: input.eventType,
            taskId: input.taskId ?? null,
            executionId: input.executionId ?? null,
            traceId: input.traceId ?? null,
            payload: input.payload,
        });
    }
    publishBatch(inputs) {
        if (this.shouldThrow) {
            throw this.throwError;
        }
        for (const input of inputs) {
            this.publishedEvents.push({
                eventType: input.eventType,
                taskId: input.taskId ?? null,
                executionId: input.executionId ?? null,
                traceId: input.traceId ?? null,
                payload: input.payload,
            });
        }
    }
}
test.describe("OutboxPollerService integration tests", () => {
    let workspace;
    let db;
    let store;
    let fakeEventBus;
    let outboxService;
    let outboxPoller;
    let taskId;
    let now;
    test.beforeEach(() => {
        workspace = createTempWorkspace("outbox-poller-");
        const dbPath = `${workspace}/test.db`;
        db = new SqliteDatabase(dbPath);
        db.migrate();
        store = new AuthoritativeTaskStore(db);
        fakeEventBus = new FakeEventBus();
        outboxService = new OutboxService(db, fakeEventBus);
        taskId = newId("task");
        now = nowIso();
        // Insert a task for FK constraints
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                tenantId: null,
                title: "Outbox poller test task",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
    });
    test.afterEach(() => {
        if (outboxPoller) {
            outboxPoller.dispose();
        }
        db.close();
        cleanupPath(workspace);
    });
    test("OutboxPoller publishes pending entries to EventBus", async () => {
        // Arrange: Insert pending outbox entries
        outboxService.writeOutboxEntry("task", taskId, "task:status_changed", { status: "running" }, null);
        outboxService.writeOutboxEntry("task", taskId, "task:completed", { status: "completed" }, null);
        // Create poller with short interval
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000 }); // Long interval so we can manually poll
        // Act: Call poll manually
        const result = await outboxPoller.poll();
        // Assert: entries were published
        assert.strictEqual(result.published, 2, "Should publish 2 entries");
        assert.strictEqual(result.failed, 0, "Should have 0 failures");
        assert.strictEqual(fakeEventBus.publishedEvents.length, 2, "EventBus should have 2 events");
        // Verify metrics
        const metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.totalPublished, 2, "Total published should be 2");
        assert.strictEqual(metrics.pendingCount, 0, "Pending count should be 0 after poll");
        // Verify entries are marked as published in the database
        const pendingEntries = outboxService.getPendingEntries();
        assert.strictEqual(pendingEntries.length, 0, "No pending entries should remain");
    });
    test("OutboxPoller handles publish failure and marks entries as failed", async () => {
        // Arrange: Insert pending entry
        outboxService.writeOutboxEntry("task", taskId, "task:status_changed", { status: "running" }, null);
        // Mock EventBus to throw error
        fakeEventBus.setThrowOnPublish(true);
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000 });
        // Act: Call poll
        const result = await outboxPoller.poll();
        // Assert: entry should be marked as failed
        assert.strictEqual(result.published, 0, "Should have 0 published");
        assert.strictEqual(result.failed, 1, "Should have 1 failure");
        assert.strictEqual(fakeEventBus.publishedEvents.length, 0, "No events should be published due to error");
        // Verify metrics reflect the failure
        const metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.totalFailed, 1, "Total failed should be 1");
        // Verify entry retry count was incremented
        const pendingEntries = outboxService.getPendingEntries();
        assert.strictEqual(pendingEntries.length, 1, "Entry should still be pending (not max retries)");
        const entry0 = pendingEntries[0];
        assert.strictEqual(entry0.retryCount, 1, "Retry count should be incremented to 1");
        assert.ok(entry0.lastError?.includes("publish error"), "Last error should contain publish error");
    });
    test("OutboxPoller batch publishes multiple entries", async () => {
        // Arrange: Insert multiple pending entries
        const entryCount = 5;
        for (let i = 0; i < entryCount; i++) {
            outboxService.writeOutboxEntry("task", taskId, `task:event_${i}`, { index: i }, null);
        }
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000 });
        // Act: Call poll
        const result = await outboxPoller.poll();
        // Assert: all entries published in single batch call
        assert.strictEqual(result.published, entryCount, `Should publish ${entryCount} entries`);
        assert.strictEqual(result.failed, 0, "Should have 0 failures");
        assert.strictEqual(fakeEventBus.publishedEvents.length, entryCount, `EventBus should have ${entryCount} events`);
        // Verify metrics
        const metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.totalPublished, entryCount, "Total published should match");
        assert.strictEqual(metrics.pendingCount, 0, "Pending count should be 0");
    });
    test("getMetrics reflects correct state after polling", async () => {
        // Arrange: Start with empty outbox
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000 });
        // Act & Assert: Empty state metrics
        let metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.isRunning, false, "Poller should not be auto-running");
        assert.strictEqual(metrics.pendingCount, 0, "Pending count should be 0");
        assert.strictEqual(metrics.totalPublished, 0, "Total published should be 0");
        // Add pending entries
        outboxService.writeOutboxEntry("task", taskId, "task:started", { status: "started" }, null);
        outboxService.writeOutboxEntry("task", taskId, "task:progress", { progress: 50 }, null);
        // Poll
        await outboxPoller.poll();
        // Assert: Metrics reflect polling results
        metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.pendingCount, 0, "Pending count should be 0 after poll");
        assert.strictEqual(metrics.totalPublished, 2, "Total published should be 2");
        assert.strictEqual(metrics.totalFailed, 0, "Total failed should be 0");
        assert.ok(metrics.lastPollAt !== null, "Last poll time should be set");
        assert.ok(metrics.lastPollDurationMs >= 0, "Poll duration should be recorded");
    });
    test("OutboxPoller skips entries exceeding max retry count", async () => {
        // Arrange: Insert entry that has already exceeded max retries
        const entry = outboxService.writeOutboxEntry("task", taskId, "task:failing", { status: "failing" }, null);
        // Manually update the entry to have max retries
        db.connection.exec(`UPDATE outbox SET retry_count = 5, last_attempt_at = '${now}' WHERE id = '${entry.id}'`);
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000, maxRetries: 5 });
        // Act: Poll
        const result = await outboxPoller.poll();
        // Assert: Entry should be skipped (not published, not failed again)
        assert.strictEqual(result.published, 0, "Should not publish");
        assert.strictEqual(result.failed, 1, "Should count as failed (skipped)");
        assert.strictEqual(fakeEventBus.publishedEvents.length, 0, "No events should be published");
        // Verify metrics
        const metrics = outboxPoller.getMetrics();
        assert.strictEqual(metrics.totalFailed, 1, "Total failed should be 1");
    });
    test("OutboxPoller applies backoff for entries with retries", async () => {
        // Arrange: Insert entry with retry count > 0 but recent lastAttemptAt (within backoff window)
        const entry = outboxService.writeOutboxEntry("task", taskId, "task:retry", { attempt: 1 }, null);
        // Update to have retry count 1 and recent lastAttemptAt (now)
        db.connection.exec(`UPDATE outbox SET retry_count = 1, last_attempt_at = '${now}' WHERE id = '${entry.id}'`);
        outboxPoller = new OutboxPollerService(outboxService, { intervalMs: 10000, initialBackoffMs: 10000 });
        // Act: Poll immediately
        const result = await outboxPoller.poll();
        // Assert: Entry should be skipped due to backoff
        assert.strictEqual(result.published, 0, "Should not publish due to backoff");
        assert.strictEqual(fakeEventBus.publishedEvents.length, 0, "No events should be published");
        // Entry should still be pending
        const pendingEntries = outboxService.getPendingEntries();
        assert.strictEqual(pendingEntries.length, 1, "Entry should still be pending");
        const entry0 = pendingEntries[0];
        assert.strictEqual(entry0.retryCount, 1, "Retry count should be unchanged");
    });
});
//# sourceMappingURL=outbox-poller-integration.test.js.map
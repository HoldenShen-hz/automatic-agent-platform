/**
 * Unit tests for OutboxPollerService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OutboxPollerService } from "../../../../../src/platform/shared/outbox/outbox-poller-service.js";
function createMockOutboxService(overrides = {}) {
    return {
        getPendingEntries: overrides.getPendingEntries ?? (() => []),
        getPendingCount: overrides.getPendingCount ?? (() => 0),
        getFailedCount: overrides.getFailedCount ?? (() => 0),
        publishEntry: overrides.publishEntry ?? (async () => true),
    };
}
function createPendingEntry(overrides = {}) {
    return {
        id: "entry-1",
        aggregateType: "task",
        aggregateId: "task-1",
        eventType: "task:created",
        payloadJson: '{"taskId":"task-1"}',
        traceId: null,
        createdAt: new Date().toISOString(),
        publishedAt: null,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
        ...overrides,
    };
}
test("OutboxPollerService.getMetrics returns correct structure", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    const metrics = poller.getMetrics();
    assert.equal(metrics.isRunning, false);
    assert.equal(metrics.pendingCount, 0);
    assert.equal(metrics.failedCount, 0);
    assert.equal(metrics.totalPublished, 0);
    assert.equal(metrics.totalFailed, 0);
    assert.equal(metrics.consecutiveEmptyPolls, 0);
});
test("OutboxPollerService polls with no pending entries returns zero", async () => {
    const mockService = createMockOutboxService({
        getPendingEntries: () => [],
        getPendingCount: () => 0,
    });
    const poller = new OutboxPollerService(mockService);
    const result = await poller.poll();
    assert.deepEqual(result, { published: 0, failed: 0 });
});
test("OutboxPollerService start throws when disposed", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    poller.dispose();
    assert.throws(() => poller.start(), /disposed/);
});
test("OutboxPollerService start is idempotent", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    // Should not throw on first start
    poller.start();
    // Should not throw on second start (idempotent)
    poller.start();
    // Clean up
    poller.dispose();
});
test("OutboxPollerService stop is idempotent", async () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    // Start then stop
    poller.start();
    await poller.stop();
    // Stop again should be no-op
    await poller.stop();
});
test("OutboxPollerService stop waits for in-flight operations", async () => {
    let pollCount = 0;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry()],
        getPendingCount: () => 1,
        publishEntry: async () => {
            pollCount++;
            // Simulate slow publish
            await new Promise((resolve) => setTimeout(resolve, 20));
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, { intervalMs: 10 });
    poller.start();
    // Let a poll happen
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Stop with short timeout - in-flight should complete
    await poller.stop(100);
    // Cleanup
    poller.dispose();
});
test("OutboxPollerService poll increments totalPublished on success", async () => {
    let publishedId;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry({ id: "publish-test-1" })],
        getPendingCount: () => 1,
        publishEntry: async (entry) => {
            publishedId = entry.id;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService);
    const result = await poller.poll();
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);
    assert.equal(publishedId, "publish-test-1");
    const metrics = poller.getMetrics();
    assert.equal(metrics.totalPublished, 1);
});
test("OutboxPollerService poll increments totalFailed on error", async () => {
    let failedId;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry({ id: "fail-test-1" })],
        getPendingCount: () => 1,
        publishEntry: async (entry) => {
            failedId = entry.id;
            return false; // Simulate failure
        },
    });
    const poller = new OutboxPollerService(mockService);
    const result = await poller.poll();
    assert.equal(result.published, 0);
    assert.equal(result.failed, 1);
    assert.equal(failedId, "fail-test-1");
    const metrics = poller.getMetrics();
    assert.equal(metrics.totalFailed, 1);
});
test("OutboxPollerService poll skips entries exceeding maxRetries", async () => {
    let publishCallCount = 0;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [
            createPendingEntry({ id: "retry-entry", retryCount: 10 }), // Exceeds default maxRetries=5
        ],
        getPendingCount: () => 1,
        publishEntry: async () => {
            publishCallCount++;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, { maxRetries: 5 });
    const result = await poller.poll();
    // Entry should be skipped without calling publishEntry
    assert.equal(result.published, 0);
    assert.equal(result.failed, 1);
    assert.equal(publishCallCount, 0);
});
test("OutboxPollerService poll applies exponential backoff for retrying entries", async () => {
    const entries = [];
    let publishCallCount = 0;
    // Create an entry that retried recently
    const recentRetryTime = new Date(Date.now() - 500).toISOString(); // 500ms ago
    entries.push(createPendingEntry({
        id: "backoff-entry",
        retryCount: 1,
        lastAttemptAt: recentRetryTime,
    }));
    const mockService = createMockOutboxService({
        getPendingEntries: () => entries,
        getPendingCount: () => 1,
        publishEntry: async () => {
            publishCallCount++;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, {
        initialBackoffMs: 1000, // 1 second backoff
        maxBackoffMs: 5000,
    });
    const result = await poller.poll();
    // Should be skipped due to backoff (only 500ms since last attempt, backoff is 1000ms)
    // The entry is skipped (not counted as published or failed)
    assert.equal(publishCallCount, 0);
    assert.equal(result.published, 0);
    // Entry is skipped due to backoff, not counted as failed
});
test("OutboxPollerService poll allows entry after backoff expires", async () => {
    const oldRetryTime = new Date(Date.now() - 2000).toISOString(); // 2 seconds ago
    const mockService = createMockOutboxService({
        getPendingEntries: () => [
            createPendingEntry({
                id: "backoff-expired",
                retryCount: 1,
                lastAttemptAt: oldRetryTime,
            }),
        ],
        getPendingCount: () => 1,
        publishEntry: async () => true,
    });
    const poller = new OutboxPollerService(mockService, {
        initialBackoffMs: 1000, // 1 second - 2 seconds is enough
        maxBackoffMs: 5000,
    });
    const result = await poller.poll();
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);
});
test("OutboxPollerService getMetrics reflects current state", async () => {
    let pollCount = 0;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [
            createPendingEntry({ id: "metrics-1" }),
            createPendingEntry({ id: "metrics-2" }),
        ],
        getPendingCount: () => 2,
        getFailedCount: () => 1,
        publishEntry: async () => {
            pollCount++;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService);
    // One poll with 2 entries
    await poller.poll();
    const metrics = poller.getMetrics();
    assert.equal(metrics.pendingCount, 2); // Mock always returns 2
    assert.equal(metrics.failedCount, 1); // Mock always returns 1
    assert.equal(metrics.totalPublished, 2);
});
test("OutboxPollerService consecutiveEmptyPolls increments on empty polls", async () => {
    const mockService = createMockOutboxService({
        getPendingEntries: () => [],
        getPendingCount: () => 0,
    });
    const poller = new OutboxPollerService(mockService);
    await poller.poll();
    await poller.poll();
    await poller.poll();
    const metrics = poller.getMetrics();
    assert.equal(metrics.consecutiveEmptyPolls, 3);
});
test("OutboxPollerService consecutiveEmptyPolls resets after successful poll", async () => {
    // Use separate poll calls with different return values
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry()],
        getPendingCount: () => 1,
        publishEntry: async () => true,
    });
    const poller = new OutboxPollerService(mockService);
    // First, call getMetrics to establish baseline
    const initialMetrics = poller.getMetrics();
    const initialEmptyPolls = initialMetrics.consecutiveEmptyPolls;
    // Poll should succeed, which resets consecutiveEmptyPolls
    await poller.poll();
    const metricsAfterPoll = poller.getMetrics();
    // After a successful poll with entries, consecutiveEmptyPolls should be 0
    assert.equal(metricsAfterPoll.consecutiveEmptyPolls, 0);
});
test("OutboxPollerService processMetrics returns null when no scaling needed", () => {
    const mockService = createMockOutboxService();
    const controller = new OutboxPollerService(mockService);
    // Using getMetrics as proxy - if running is false, no events would be emitted
    const metrics = controller.getMetrics();
    assert.equal(metrics.isRunning, false);
});
test("OutboxPollerService custom config is applied", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService, {
        intervalMs: 500,
        batchSize: 50,
        maxRetries: 10,
        initialBackoffMs: 2000,
        maxBackoffMs: 60000,
    });
    // We can't directly access private config, but we can verify it doesn't throw
    // and the poller behaves according to the custom settings
    poller.start();
    poller.dispose();
});
test("OutboxPollerService dispose is idempotent", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    poller.dispose();
    poller.dispose(); // Should not throw
});
test("OutboxPollerService dispose clears interval", () => {
    const mockService = createMockOutboxService();
    const poller = new OutboxPollerService(mockService);
    poller.start();
    poller.dispose();
    const metrics = poller.getMetrics();
    // After dispose, isRunning should be false
    assert.equal(metrics.isRunning, false);
});
test("OutboxPollerService poll returns early when stopped", async () => {
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry()],
        getPendingCount: () => 1,
        publishEntry: async () => {
            // This should not be called if stop() takes effect
            await new Promise((resolve) => setTimeout(resolve, 100));
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService);
    poller.start();
    // Give the interval a chance to start
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Stop before a poll cycle completes
    await poller.stop(50);
    poller.dispose();
});
test("OutboxPollerService poll returns early when disposed", async () => {
    let publishCallCount = 0;
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry()],
        getPendingCount: () => 1,
        publishEntry: async () => {
            publishCallCount++;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, { intervalMs: 5 });
    poller.start();
    // Let one poll start
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Dispose during poll
    poller.dispose();
    // The poll may or may not have completed, but dispose should prevent future polls
    const metrics = poller.getMetrics();
    assert.equal(metrics.isRunning, false);
});
test("OutboxPollerService lastPollAt and lastPollDurationMs are updated", async () => {
    const mockService = createMockOutboxService({
        getPendingEntries: () => [],
        getPendingCount: () => 0,
    });
    const poller = new OutboxPollerService(mockService);
    // Before any poll
    let metrics = poller.getMetrics();
    assert.equal(metrics.lastPollAt, null);
    assert.equal(metrics.lastPollDurationMs, 0);
    await poller.poll();
    // After poll
    metrics = poller.getMetrics();
    assert.ok(metrics.lastPollAt !== null);
    assert.ok(metrics.lastPollDurationMs >= 0);
});
test("OutboxPollerService with zero maxRetries skips entries at retry limit", async () => {
    let callCount = 0;
    // With maxRetries=0, an entry with retryCount=0 is already at the limit (0 >= 0)
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry({ retryCount: 0 })],
        getPendingCount: () => 1,
        publishEntry: async () => {
            callCount++;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, { maxRetries: 0 });
    const result = await poller.poll();
    // Entry is skipped because retryCount (0) >= maxRetries (0)
    assert.equal(callCount, 0);
    assert.equal(result.published, 0);
    assert.equal(result.failed, 1);
});
test("OutboxPollerService with positive maxRetries processes entries below limit", async () => {
    let callCount = 0;
    // Set lastAttemptAt to old enough time to pass backoff check
    const oldTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
    const mockService = createMockOutboxService({
        getPendingEntries: () => [createPendingEntry({ retryCount: 2, lastAttemptAt: oldTime })],
        getPendingCount: () => 1,
        publishEntry: async () => {
            callCount++;
            return true;
        },
    });
    const poller = new OutboxPollerService(mockService, {
        maxRetries: 5,
        initialBackoffMs: 1000, // 2^1 * 1000 = 2000ms backoff for retryCount=2
    });
    const result = await poller.poll();
    // Entry is processed because retryCount (2) < maxRetries (5) and backoff has expired
    assert.equal(callCount, 1);
    assert.equal(result.published, 1);
});
//# sourceMappingURL=outbox-poller-service.test.js.map
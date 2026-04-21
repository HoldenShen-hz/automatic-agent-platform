/**
 * Unit tests for OutboxPollerService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OutboxPollerService } from "../../../../../src/platform/shared/outbox/outbox-poller-service.js";
test("OutboxPollerService.getMetrics returns correct structure", () => {
    const mockService = {
        getPendingEntries: () => [],
        getPendingCount: () => 0,
        getFailedCount: () => 0,
        publishEntry: async () => true,
    };
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
    const mockService = {
        getPendingEntries: () => [],
        getPendingCount: () => 0,
        getFailedCount: () => 0,
        publishEntry: async () => true,
    };
    const poller = new OutboxPollerService(mockService);
    const result = await poller.poll();
    assert.deepEqual(result, { published: 0, failed: 0 });
});
//# sourceMappingURL=outbox-poller-service.test.js.map
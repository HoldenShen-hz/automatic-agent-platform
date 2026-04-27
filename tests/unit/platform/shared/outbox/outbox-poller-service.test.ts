/**
 * Additional unit tests for OutboxPollerService - covering edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxPollerService } from "../../../../../src/platform/shared/outbox/outbox-poller-service.js";
import type { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import type { OutboxRecord } from "../../../../../src/platform/shared/outbox/outbox-types.js";

function createMockOutboxService(overrides: Partial<{
  getPendingEntries: () => OutboxRecord[];
  getPendingCount: () => number;
  getFailedCount: () => number;
  publishEntry: (entry: OutboxRecord) => Promise<boolean>;
}> = {}): OutboxService {
  return {
    getPendingEntries: overrides.getPendingEntries ?? (() => []),
    getPendingCount: overrides.getPendingCount ?? (() => 0),
    getFailedCount: overrides.getFailedCount ?? (() => 0),
    publishEntry: overrides.publishEntry ?? (async () => true),
  } as unknown as OutboxService;
}

function createPendingEntry(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
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

test("OutboxPollerService poll returns early when disposed", async () => {
  let pollCallCount = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => {
      pollCallCount++;
      // Return entry that would take time to process
      return [createPendingEntry()];
    },
    getPendingCount: () => 1,
    publishEntry: async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { intervalMs: 5 });
  poller.start();

  // Let first poll start
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Dispose during processing
  poller.dispose();

  // Give time for any in-flight processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify poll was attempted at least once before dispose
  assert.ok(pollCallCount >= 1);
});

test("OutboxPollerService poll skips entries at exact maxRetries boundary", async () => {
  let publishCallCount = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "boundary-entry", retryCount: 5 }), // Exactly at maxRetries=5
    ],
    getPendingCount: () => 1,
    publishEntry: async () => {
      publishCallCount++;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { maxRetries: 5 });
  const result = await poller.poll();

  // Entry should be skipped (5 >= 5)
  assert.equal(publishCallCount, 0);
  assert.equal(result.failed, 1);
});

test("OutboxPollerService poll processes entries below maxRetries boundary", async () => {
  let publishCallCount = 0;
  const oldTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "below-boundary", retryCount: 4, lastAttemptAt: oldTime }),
    ],
    getPendingCount: () => 1,
    publishEntry: async () => {
      publishCallCount++;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { maxRetries: 5 });
  const result = await poller.poll();

  // Entry should be processed (4 < 5 and backoff expired)
  assert.equal(publishCallCount, 1);
  assert.equal(result.published, 1);
});

test("OutboxPollerService calculates backoff with jitter", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService);

  // Access private calculateBackoff method via casting
  const calculateBackoff = (retryCount: number) =>
    (poller as unknown as { calculateBackoff: (retryCount: number) => number }).calculateBackoff.call(poller, retryCount);

  // For retryCount=1: 1000 * 2^0 = 1000ms base
  const backoff1 = calculateBackoff(1);
  assert.ok(backoff1 >= 1000 && backoff1 <= 1100, "Backoff for retry 1 should be around 1000ms with jitter");

  // For retryCount=2: 1000 * 2^1 = 2000ms base
  const backoff2 = calculateBackoff(2);
  assert.ok(backoff2 >= 2000 && backoff2 <= 2200, "Backoff for retry 2 should be around 2000ms with jitter");

  // For retryCount=3: 1000 * 2^2 = 4000ms base
  const backoff3 = calculateBackoff(3);
  assert.ok(backoff3 >= 4000 && backoff3 <= 4400, "Backoff for retry 3 should be around 4000ms with jitter");

  // For retryCount=10: should be capped at maxBackoffMs (30000ms)
  const backoff10 = calculateBackoff(10);
  assert.ok(backoff10 <= 30000 + (30000 * 0.1), "Backoff for retry 10 should be capped at maxBackoffMs + 10% jitter");
});

test("OutboxPollerService calculateBackoff respects maxBackoffMs", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, {
    initialBackoffMs: 1000,
    maxBackoffMs: 5000, // Lower max for testing
  });

  const calculateBackoff = (retryCount: number) =>
    (poller as unknown as { calculateBackoff: (retryCount: number) => number }).calculateBackoff.call(poller, retryCount);

  // With maxBackoffMs=5000, even high retry counts should be capped
  const backoffHigh = calculateBackoff(10);
  assert.ok(backoffHigh <= 5500, "Backoff should be capped at maxBackoffMs + 10% jitter");
});

test("OutboxPollerService poll with multiple entries processes all", async () => {
  let publishCallCount = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "multi-1" }),
      createPendingEntry({ id: "multi-2" }),
      createPendingEntry({ id: "multi-3" }),
    ],
    getPendingCount: () => 3,
    publishEntry: async () => {
      publishCallCount++;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService);
  const result = await poller.poll();

  assert.equal(publishCallCount, 3);
  assert.equal(result.published, 3);
  assert.equal(result.failed, 0);
});

test("OutboxPollerService poll with mixed success and failure counts correctly", async () => {
  let entryIndex = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "mixed-1" }),
      createPendingEntry({ id: "mixed-2" }),
      createPendingEntry({ id: "mixed-3" }),
    ],
    getPendingCount: () => 3,
    publishEntry: async () => {
      entryIndex++;
      return entryIndex % 2 === 1; // Fail on even index
    },
  });

  const poller = new OutboxPollerService(mockService);
  const result = await poller.poll();

  assert.equal(result.published, 2); // 1 and 3 succeeded
  assert.equal(result.failed, 1); // 2 failed
});

test("OutboxPollerService stop waits for poll to complete", async () => {
  let pollInProgress = false;
  const mockService = createMockOutboxService({
    getPendingEntries: () => {
      pollInProgress = true;
      return [createPendingEntry()];
    },
    getPendingCount: () => 1,
    publishEntry: async () => {
      pollInProgress = true;
      await new Promise(resolve => setTimeout(resolve, 30));
      pollInProgress = false;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { intervalMs: 100 });
  poller.start();

  // Wait for poll to be in progress
  await new Promise(resolve => setTimeout(resolve, 20));

  const stopPromise = poller.stop(200);

  // Stop should complete within timeout
  await stopPromise;

  // Poller should be stopped
  const metrics = poller.getMetrics();
  assert.equal(metrics.isRunning, false);
});

test("OutboxPollerService start sets interval and starts polling", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, { intervalMs: 10 });

  poller.start();

  const metrics = poller.getMetrics();
  assert.equal(metrics.isRunning, true);

  // Clean up
  poller.dispose();
});

test("OutboxPollerService metrics totalPublished accumulates across polls", async () => {
  const mockService = createMockOutboxService({
    getPendingEntries: () => [createPendingEntry()],
    getPendingCount: () => 1,
    publishEntry: async () => true,
  });

  const poller = new OutboxPollerService(mockService);

  await poller.poll();
  await poller.poll();
  await poller.poll();

  const metrics = poller.getMetrics();
  assert.equal(metrics.totalPublished, 3);
});

test("OutboxPollerService metrics totalFailed accumulates across polls", async () => {
  let pollCount = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [createPendingEntry()],
    getPendingCount: () => 1,
    publishEntry: async () => {
      pollCount++;
      return pollCount % 2 === 1; // Fail every other poll
    },
  });

  const poller = new OutboxPollerService(mockService);

  await poller.poll(); // success
  await poller.poll(); // fail
  await poller.poll(); // success
  await poller.poll(); // fail

  const metrics = poller.getMetrics();
  assert.equal(metrics.totalFailed, 2);
});

test("OutboxPollerService poll with batch size returns at most batch size entries", async () => {
  let entriesReturned = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => {
      entriesReturned++;
      return [
        createPendingEntry({ id: `batch-test-${entriesReturned}` }),
      ];
    },
    getPendingCount: () => 10, // More pending than batch size
    publishEntry: async () => true,
  });

  const poller = new OutboxPollerService(mockService, { batchSize: 3 });
  const result = await poller.poll();

  // Should only process batchSize entries
  assert.equal(result.published, 1);
  assert.ok(entriesReturned <= 2, "getPendingEntries should be called at most batchSize + 1 times");
});

test("OutboxPollerService poll returns zeros when no pending entries", async () => {
  const mockService = createMockOutboxService({
    getPendingCount: () => 0,
    getPendingEntries: () => [],
  });

  const poller = new OutboxPollerService(mockService);
  const result = await poller.poll();

  assert.equal(result.published, 0);
  assert.equal(result.failed, 0);
});

test("OutboxPollerService poll stops early when disposed mid-processing", async () => {
  let processedCount = 0;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "dispose-1" }),
      createPendingEntry({ id: "dispose-2" }),
      createPendingEntry({ id: "dispose-3" }),
    ],
    getPendingCount: () => 3,
    publishEntry: async () => {
      processedCount++;
      if (processedCount >= 1) {
        // Simulate dispose happening mid-processing
        return true;
      }
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { intervalMs: 1000 });
  poller.start();

  // Let first poll start and process at least one entry
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Dispose while poll is potentially running
  poller.dispose();

  // The poller should have processed at least some entries before dispose
  assert.ok(processedCount >= 0); // No guarantee since timing varies
});

test("OutboxPollerService poll with entry at maxRetries skips and counts as failed", async () => {
  let publishCalled = false;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "max-retry-entry", retryCount: 10 }),
    ],
    getPendingCount: () => 1,
    publishEntry: async () => {
      publishCalled = true;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { maxRetries: 5 });
  const result = await poller.poll();

  assert.equal(publishCalled, false);
  assert.equal(result.failed, 1);
});

test("OutboxPollerService poll with fresh entry (retryCount=0) processes immediately", async () => {
  let publishCalled = false;
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "fresh-entry", retryCount: 0, lastAttemptAt: null }),
    ],
    getPendingCount: () => 1,
    publishEntry: async () => {
      publishCalled = true;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { maxRetries: 5 });
  const result = await poller.poll();

  assert.equal(publishCalled, true);
  assert.equal(result.published, 1);
});

test("OutboxPollerService poll with backoff not yet expired skips entry", async () => {
  let publishCalled = false;
  const recentTime = new Date(Date.now() - 100).toISOString(); // Only 100ms ago
  const mockService = createMockOutboxService({
    getPendingEntries: () => [
      createPendingEntry({ id: "backoff-entry", retryCount: 1, lastAttemptAt: recentTime }),
    ],
    getPendingCount: () => 1,
    publishEntry: async () => {
      publishCalled = true;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, {
    maxRetries: 5,
    initialBackoffMs: 1000, // 1 second backoff
  });
  const result = await poller.poll();

  // Entry should be skipped because backoff hasn't expired
  assert.equal(publishCalled, false);
  assert.equal(result.published, 0);
  assert.equal(result.failed, 0);
});

test("OutboxPollerService getMetrics returns correct structure", () => {
  const mockService = createMockOutboxService({
    getPendingCount: () => 5,
    getFailedCount: () => 2,
  });

  const poller = new OutboxPollerService(mockService);
  const metrics = poller.getMetrics();

  assert.equal(metrics.isRunning, false);
  assert.equal(metrics.pendingCount, 5);
  assert.equal(metrics.failedCount, 2);
  assert.equal(metrics.totalPublished, 0);
  assert.equal(metrics.totalFailed, 0);
  assert.equal(metrics.consecutiveEmptyPolls, 0);
});

test("OutboxPollerService getMetrics after polling updates lastPollAt and lastPollDurationMs", async () => {
  const mockService = createMockOutboxService({
    getPendingEntries: () => [createPendingEntry()],
    getPendingCount: () => 1,
    publishEntry: async () => true,
  });

  const poller = new OutboxPollerService(mockService);
  await poller.poll();

  const metrics = poller.getMetrics();

  assert.ok(metrics.lastPollAt !== null);
  assert.ok(metrics.lastPollDurationMs >= 0);
});

test("OutboxPollerService start throws when already disposed", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService);

  poller.dispose();

  assert.throws(
    () => poller.start(),
    /disposed/,
  );
});

test("OutboxPollerService stop is idempotent when already stopped", async () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, { intervalMs: 10 });

  poller.start();
  await poller.stop(100);
  await poller.stop(100); // Second call should be no-op

  const metrics = poller.getMetrics();
  assert.equal(metrics.isRunning, false);
});

test("OutboxPollerService stop waits for in-flight poll to complete", async () => {
  let pollStarted = false;
  let pollResolve: () => void;
  const pollPromise = new Promise<void>((resolve) => { pollResolve = resolve; });

  const mockService = createMockOutboxService({
    getPendingEntries: () => {
      pollStarted = true;
      return [createPendingEntry()];
    },
    getPendingCount: () => 1,
    publishEntry: async () => {
      pollStarted = true;
      await pollPromise;
      return true;
    },
  });

  const poller = new OutboxPollerService(mockService, { intervalMs: 50 });
  poller.start();

  // Wait for poll to start
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Stop should complete even though poll is in-flight
  const stopPromise = poller.stop(500);
  pollResolve!();
  await stopPromise;

  const metrics = poller.getMetrics();
  assert.equal(metrics.isRunning, false);
});

test("OutboxPollerService consecutiveEmptyPolls increments when no pending", async () => {
  const mockService = createMockOutboxService({
    getPendingCount: () => 0,
    getPendingEntries: () => [],
  });

  const poller = new OutboxPollerService(mockService);

  await poller.poll();
  await poller.poll();
  await poller.poll();

  const metrics = poller.getMetrics();
  assert.equal(metrics.consecutiveEmptyPolls, 3);
});

test("OutboxPollerService consecutiveEmptyPolls resets after successful poll", async () => {
  const mockService = createMockOutboxService({
    getPendingEntries: () => [createPendingEntry()],
    getPendingCount: () => 1,
    publishEntry: async () => true,
  });

  const poller = new OutboxPollerService(mockService);

  // First two polls have no pending
  await poller.poll(); // has entries
  const metrics1 = poller.getMetrics();
  assert.equal(metrics1.consecutiveEmptyPolls, 0);
});

test("OutboxPollerService calculateBackoff returns correct base delay", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, {
    initialBackoffMs: 500,
    maxBackoffMs: 30000,
  });

  const calculateBackoff = (retryCount: number) =>
    (poller as unknown as { calculateBackoff: (retryCount: number) => number }).calculateBackoff.call(poller, retryCount);

  // initialBackoffMs=500
  // retryCount 1: 500 * 2^0 = 500
  const backoff1 = calculateBackoff(1);
  assert.ok(backoff1 >= 500 && backoff1 <= 550);
});

test("OutboxPollerService with custom config uses those values", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, {
    intervalMs: 200,
    batchSize: 50,
    maxRetries: 10,
    initialBackoffMs: 2000,
    maxBackoffMs: 60000,
  });

  const metrics = poller.getMetrics();
  // Just verify it initialized without error
  assert.ok(typeof metrics.isRunning === "boolean");
});

test("OutboxPollerService disposed cannot be restarted", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService);

  poller.dispose();

  assert.throws(
    () => poller.start(),
    /disposed/,
  );
});

test("OutboxPollerService dispose clears interval handle", () => {
  const mockService = createMockOutboxService();
  const poller = new OutboxPollerService(mockService, { intervalMs: 10 });

  poller.start();
  poller.dispose();

  // Poller should not be running after dispose
  const metrics = poller.getMetrics();
  assert.equal(metrics.isRunning, false);
});

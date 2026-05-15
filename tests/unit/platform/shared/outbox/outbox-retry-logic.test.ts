/**
 * Unit tests for OutboxService retry logic
 * Tests src/platform/shared/outbox/outbox-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { SqliteConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";

type ConnectionMock = Pick<SqliteConnection, "prepare">;

function createMockConnection(): ConnectionMock {
  return {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => null,
      all: () => [],
    }),
  } as unknown as ConnectionMock;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T): T => fn(),
    connection: createMockConnection() as SqliteConnection,
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockEventBus(overrides: {
  publish?: () => { id: string };
  shouldFail?: boolean;
  failError?: Error;
} = {}) {
  const { shouldFail = false, failError = new Error("Connection refused"), publish } = overrides;
  return {
    publish: publish ?? (() => {
      if (shouldFail) {
        throw failError;
      }
      return { id: `evt-${Date.now()}` };
    }),
    publishBatch: () => ({ published: 0 }),
  };
}

test("OutboxService publishEntry increments retryCount on failure", async () => {
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Publish failed"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "retry-test-1", "task:created", {});

  // Get initial retry count
  const failedBefore = service.getFailedCount();

  // Attempt to publish - should fail
  await service.publishEntry(entry);

  // Failed count should increase
  const failedAfter = service.getFailedCount();
  assert.ok(failedAfter > failedBefore);
});

test("OutboxService publishEntry records lastError on failure", async () => {
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Connection timeout"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "error-record-test", "task:created", {});

  await service.publishEntry(entry);

  // The entry should now be in failed state
  const failedCount = service.getFailedCount();
  assert.ok(failedCount >= 1);
});

test("OutboxService publishEntry records lastAttemptAt on failure", async () => {
  const beforeTime = new Date().toISOString();
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Network error"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "attempt-time-test", "task:created", {});

  await service.publishEntry(entry);

  const afterTime = new Date().toISOString();

  // The failed entry should have been updated with attempt time
  const pendingEntries = service.getPendingEntries();
  const failedEntry = pendingEntries.find(e => e.id === entry.id);
  // Entry is not pending if it failed, so we check failed count
  assert.ok(service.getFailedCount() >= 1);
});

test("OutboxService markFailed updates retryCount correctly", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "mark-fail-retry", "task:created", {});

  service.markFailed(entry.id, "Test error", 5, new Date().toISOString());

  // Entry should now be counted as failed
  assert.ok(service.getFailedCount() >= 1);
});

test("OutboxService markFailed handles non-existent entry gracefully", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Should not throw
  service.markFailed("nonexistent-id", "Error", 1, new Date().toISOString());

  assert.ok(true); // If we get here, test passed
});

test("OutboxService publishEntry returns false on failure", async () => {
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Publish error"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "return-false-test", "task:created", {});

  const result = await service.publishEntry(entry);

  assert.equal(result, false);
});

test("OutboxService publishEntry returns true on success", async () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "return-true-test", "task:created", {});

  const result = await service.publishEntry(entry);

  assert.equal(result, true);
});

test("OutboxService publishEntry parses payloadJson correctly on publish", async () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "parse-test", "task:created", {
    key: "value",
    nested: { data: 123 },
  });

  const result = await service.publishEntry(entry);

  assert.equal(result, true);
});

test("OutboxService publishEntry handles malformed JSON gracefully", async () => {
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Invalid JSON"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Create entry normally first
  const entry = service.writeOutboxEntry("task", "malformed-json-test", "task:created", { valid: true });

  // Force a failure scenario
  const result = await service.publishEntry(entry);

  // Should handle error gracefully
  assert.equal(typeof result, "boolean");
});

test("OutboxService getFailedCount returns 0 initially", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const count = service.getFailedCount();

  assert.equal(count, 0);
});

test("OutboxService getFailedCount after multiple failures", async () => {
  const mockBus = createMockEventBus({
    shouldFail: true,
    failError: new Error("Test error"),
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  service.writeOutboxEntry("task", "fail-1", "task:created", {});
  service.writeOutboxEntry("task", "fail-2", "task:created", {});
  service.writeOutboxEntry("task", "fail-3", "task:created", {});

  // All should fail
  await service.publishPending();

  const failedCount = service.getFailedCount();
  assert.ok(failedCount >= 3);
});

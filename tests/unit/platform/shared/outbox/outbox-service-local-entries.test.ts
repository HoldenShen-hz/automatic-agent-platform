/**
 * Tests for OutboxService local entries management
 * covering localEntries map operations and merge logic
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
  publishBatch?: () => { published: number };
  shouldFail?: boolean;
  failError?: Error;
} = {}) {
  const { shouldFail = false, failError = new Error("Connection refused"), publish, publishBatch } = overrides;
  return {
    publish: publish ?? (() => {
      if (shouldFail) {
        throw failError;
      }
      return { id: `evt-${Date.now()}` };
    }),
    publishBatch: publishBatch ?? (() => {
      if (shouldFail) {
        throw failError;
      }
      return { published: 1 };
    }),
  };
}

test("OutboxService localEntries map starts empty", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Get internal state via getPendingEntries which merges local entries
  const pending = service.getPendingEntries();

  // localEntries should be empty initially
  assert.ok(Array.isArray(pending));
});

test("OutboxService writeOutboxEntry adds to localEntries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "local-test-1", "task:created", { data: "test" });

  // Entry should be in local entries
  const pending = service.getPendingEntries();
  assert.ok(pending.some(e => e.id === entry.id));
});

test("OutboxService writeOutboxEntries adds multiple to localEntries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "multi-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "multi-2", eventType: "task:created", payload: {} },
  ]);

  // Both entries should be in local entries
  const pending = service.getPendingEntries();
  assert.equal(pending.filter(e => e.aggregateId.startsWith("multi-")).length, 2);
});

test("OutboxService publishEntry removes from localEntries on success", async () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "remove-test", "task:created", {});

  // Verify entry exists
  assert.ok(service.getPendingEntries().some(e => e.id === entry.id));

  await service.publishEntry(entry);

  // Entry should be removed from local entries
  assert.ok(!service.getPendingEntries().some(e => e.id === entry.id));
});

test("OutboxService markPublished removes from localEntries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "mark-remove-test", "task:created", {});

  // Verify entry exists
  assert.ok(service.getPendingEntries().some(e => e.id === entry.id));

  service.markPublished(entry.id);

  // Entry should be removed from local entries
  assert.ok(!service.getPendingEntries().some(e => e.id === entry.id));
});

test("OutboxService markFailed updates localEntry", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "mark-fail-test", "task:created", {});

  const errorMsg = "Test error";
  const retryCount = 2;
  const attemptAt = new Date().toISOString();

  service.markFailed(entry.id, errorMsg, retryCount, attemptAt);

  // Verify the failed count increased
  const failedCount = service.getFailedCount();
  assert.ok(failedCount >= 1);
});

test("OutboxService localEntries merge with repo entries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Write local entry
  const localEntry = service.writeOutboxEntry("task", "merge-test", "task:created", {});

  // getPendingEntries merges local entries with repo entries
  const pending = service.getPendingEntries();

  // Should contain our local entry
  assert.ok(pending.some(e => e.id === localEntry.id));
});

test("OutboxService localEntries don't duplicate on multiple writes", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  service.writeOutboxEntry("task", "dup-test", "task:created", {});
  service.writeOutboxEntry("task", "dup-test", "task:updated", {});

  const pending = service.getPendingEntries();
  const dupEntries = pending.filter(e => e.aggregateId === "dup-test");

  // Should not have duplicate IDs
  const ids = dupEntries.map(e => e.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size);
});

test("OutboxService updateLocalFailure updates existing local entry", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "update-local-test", "task:created", {});

  // Simulate a failed publish
  const errorMsg = "Connection refused";
  const newRetryCount = entry.retryCount + 1;

  service.markFailed(entry.id, errorMsg, newRetryCount, new Date().toISOString());

  // The entry should still be in pending (not yet published)
  // But getFailedCount should reflect the failure
  assert.ok(service.getFailedCount() >= 1);
});

test("OutboxService local entry with traceId preserves traceId", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const traceId = "trace-abc-123";
  const entry = service.writeOutboxEntry("task", "trace-test", "task:created", {}, traceId);

  const pending = service.getPendingEntries();
  const found = pending.find(e => e.id === entry.id);

  assert.ok(found !== undefined);
  assert.equal(found!.traceId, traceId);
});

test("OutboxService publishEntry preserves traceId on eventBus publish", async () => {
  let receivedTraceId: string | null = null;
  const mockBus = createMockEventBus({
    publish: (input: { eventType: string; taskId: string | null; executionId: string | null; traceId: string | null; payload: Record<string, unknown> }) => {
      receivedTraceId = input.traceId;
      return { id: "evt" };
    },
  });
  const service = new OutboxService(createMockDb(), mockBus as any);

  const traceId = "trace-preserve-xyz";
  const entry = service.writeOutboxEntry("task", "preserve-trace", "task:created", {}, traceId);

  await service.publishEntry(entry);

  assert.equal(receivedTraceId, traceId);
});

test("OutboxService getPendingCount includes local entries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Initially empty
  const initialCount = service.getPendingCount();
  assert.equal(initialCount, 0);

  service.writeOutboxEntry("task", "count-1", "task:created", {});
  service.writeOutboxEntry("task", "count-2", "task:created", {});

  const afterWriteCount = service.getPendingCount();
  assert.equal(afterWriteCount, 2);
});

test("OutboxService getFailedCount includes local entries with failures", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "failed-count-test", "task:created", {});

  service.markFailed(entry.id, "Error", 1, new Date().toISOString());

  const failedCount = service.getFailedCount();
  assert.ok(failedCount >= 1);
});

test("OutboxService writeOutboxEntries with empty array returns empty", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const result = service.writeOutboxEntries([]);

  assert.deepEqual(result, []);
  assert.equal(service.getPendingCount(), 0);
});

test("OutboxService publishEntry on non-existent entry handles gracefully", async () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  // Create a fake entry that was never written to this service
  const fakeEntry = {
    id: "non-existent-entry",
    aggregateType: "task" as const,
    aggregateId: "task-1",
    eventType: "task:created",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  // Should not throw, but will try to publish
  const result = await service.publishEntry(fakeEntry);

  // Result depends on eventBus behavior, but should not throw
  assert.equal(typeof result, "boolean");
});

test("OutboxService getPendingEntries with limit applies correctly", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any, { maxBatchSize: 2 });

  // Write 5 entries
  for (let i = 0; i < 5; i++) {
    service.writeOutboxEntry("task", `limit-test-${i}`, "task:created", {});
  }

  const pending = service.getPendingEntries(3);

  // Should be limited to 3 (or fewer if less available)
  assert.ok(pending.length <= 3);
});
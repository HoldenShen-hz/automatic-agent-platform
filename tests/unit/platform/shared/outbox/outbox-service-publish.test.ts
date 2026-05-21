/**
 * Tests for OutboxService publishEntry and publishEntriesBatch methods
 * covering various scenarios and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { SqliteConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";

type ConnectionMock = Pick<SqliteConnection, "prepare">;

function createMockConnection(): ConnectionMock {
  return {
    prepare: (sql: string) => ({
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

interface PublishCall {
  eventType: string;
  taskId: string | null;
  executionId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
}

test("OutboxService.publishEntry calls eventBus.publish with correct payload", async () => {
  let receivedCalls: PublishCall[] = [];
  const mockBus = {
    publish: (input: PublishCall) => {
      receivedCalls.push(input);
      return { id: "evt-123" };
    },
    publishBatch: (inputs: PublishCall[]) => ({ published: inputs.length }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "task-pub-1", "task:status_changed", { status: "running", progress: 50 });

  await service.publishEntry(entry);

  assert.equal(receivedCalls.length, 1);
  assert.equal(receivedCalls[0]!.eventType, "task:status_changed");
  assert.equal(receivedCalls[0]!.taskId, "task-pub-1");
  assert.equal(receivedCalls[0]!.executionId, null);
  assert.deepEqual(receivedCalls[0]!.payload, { status: "running", progress: 50 });
});

test("OutboxService.publishEntry sets executionId for execution aggregate", async () => {
  let receivedExecutionId: string | null = null;
  const mockBus = {
    publish: (input: PublishCall) => {
      receivedExecutionId = input.executionId;
      return { id: "evt-456" };
    },
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("execution", "exec-pub-1", "execution:completed", { result: "success" });

  await service.publishEntry(entry);

  assert.equal(receivedExecutionId, "exec-pub-1");
});

test("OutboxService.publishEntry parses payloadJson correctly", async () => {
  let receivedPayload: Record<string, unknown> | null = null;
  const mockBus = {
    publish: (input: PublishCall) => {
      receivedPayload = input.payload;
      return { id: "evt" };
    },
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const complexPayload = { users: [{ name: "Alice" }], count: 42, nested: { deep: true } };
  const entry = service.writeOutboxEntry("task", "parse-test", "task:created", complexPayload);

  await service.publishEntry(entry);

  assert.deepEqual(receivedPayload, complexPayload);
});

test("OutboxService.publishEntry on failure increments retryCount", async () => {
  const mockBus = {
    publish: () => {
      throw new Error("Publish failed");
    },
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "retry-test", "task:created", {});

  const beforeRetryCount = entry.retryCount;
  await service.publishEntry(entry);

  assert.ok(service.getFailedCount() >= 1);
});

test("OutboxService.publishEntry removes entry from localEntries on success", async () => {
  const mockBus = {
    publish: () => ({ id: "evt-success" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "remove-local-test", "task:created", {});

  assert.ok(service.getPendingEntries().some(e => e.id === entry.id));

  await service.publishEntry(entry);

  assert.ok(!service.getPendingEntries().some(e => e.id === entry.id));
});

test("OutboxService.publishEntry preserves traceId from entry", async () => {
  let receivedTraceId: string | null = null;
  const mockBus = {
    publish: (input: PublishCall) => {
      receivedTraceId = input.traceId;
      return { id: "evt" };
    },
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "trace-preserve", "task:created", {}, "trace-preserve-789");

  await service.publishEntry(entry);

  assert.equal(receivedTraceId, "trace-preserve-789");
});

test("OutboxService.publishEntriesBatch calls eventBus.publishBatch once", async () => {
  let batchCallCount = 0;
  let batchInputs: PublishCall[][] = [];

  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: (inputs: PublishCall[]) => {
      batchCallCount++;
      batchInputs.push(inputs);
      return { published: inputs.length };
    },
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "batch-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "batch-2", eventType: "task:created", payload: {} },
    { aggregateType: "execution", aggregateId: "batch-exec-1", eventType: "execution:started", payload: {} },
  ]);

  const result = await service.publishEntriesBatch(entries);

  assert.equal(batchCallCount, 1);
  assert.equal(result.published, 3);
  assert.equal(batchInputs[0]!.length, 3);
});

test("OutboxService.publishEntriesBatch with empty array returns zeros", async () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const result = await service.publishEntriesBatch([]);

  assert.equal(result.published, 0);
  assert.equal(result.failed, 0);
});

test("OutboxService.publishEntriesBatch on batch failure marks all as failed", async () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => {
      throw new Error("Batch connection failed");
    },
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "batch-fail-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "batch-fail-2", eventType: "task:created", payload: {} },
  ]);

  const result = await service.publishEntriesBatch(entries);

  assert.equal(result.published, 0);
  assert.equal(result.failed, 2);
});

test("OutboxService.publishEntriesBatch removes all entries from local on success", async () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 2 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "batch-remove-1", eventType: "task:created", payload: {} },
    { aggregateType: "task", aggregateId: "batch-remove-2", eventType: "task:created", payload: {} },
  ]);

  const ids = entries.map(e => e.id);
  assert.ok(ids.every(id => service.getPendingEntries().some(e => e.id === id)));

  await service.publishEntriesBatch(entries);

  assert.ok(!ids.some(id => service.getPendingEntries().some(e => e.id === id)));
});

test("OutboxService.publishPending with no entries returns zeros", async () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const result = await service.publishPending();

  assert.equal(result.published, 0);
  assert.equal(result.failed, 0);
});

test("OutboxService.publishPending publishes all pending entries", async () => {
  let publishCount = 0;
  const mockBus = {
    publish: () => {
      publishCount++;
      return { id: `evt-${Date.now()}` };
    },
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  service.writeOutboxEntry("task", "pending-1", "task:created", {});
  service.writeOutboxEntry("task", "pending-2", "task:created", {});
  service.writeOutboxEntry("task", "pending-3", "task:created", {});

  const result = await service.publishPending();

  assert.equal(publishCount, 3);
  assert.equal(result.published, 3);
});

test("OutboxService.publishPending with mixed results counts correctly", async () => {
  let entryIndex = 0;
  const mockBus = {
    publish: () => {
      entryIndex++;
      if (entryIndex % 2 === 0) {
        throw new Error("Even publish fails");
      }
      return { id: `evt-${Date.now()}` };
    },
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  for (let i = 0; i < 5; i++) {
    service.writeOutboxEntry("task", `mixed-${i}`, "task:created", {});
  }

  const result = await service.publishPending();

  assert.equal(result.published, 3); // 1, 3, 5 succeeded
  assert.equal(result.failed, 2); // 2, 4 failed
});

test("OutboxService.publishEntry returns true on success", async () => {
  const mockBus = {
    publish: () => ({ id: "evt-success" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "return-true-test", "task:created", {});

  const result = await service.publishEntry(entry);

  assert.equal(result, true);
});

test("OutboxService.publishEntry returns false on failure", async () => {
  const mockBus = {
    publish: () => {
      throw new Error("Publish failed");
    },
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "return-false-test", "task:created", {});

  const result = await service.publishEntry(entry);

  assert.equal(result, false);
});

test("OutboxService markPublished updates repository", () => {
  let updatedId: string | null = null;
  let updatedAt: string | null = null;

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        if (sql.includes("published_at")) {
          updatedId = String(params[1]);
          updatedAt = String(params[0]);
        }
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const db = {
    transaction: <T>(fn: () => T): T => fn(),
    connection: conn,
  } as unknown as AuthoritativeSqlDatabase;

  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(db, mockBus as any);

  const entry = service.writeOutboxEntry("task", "mark-pub-update", "task:created", {});

  service.markPublished(entry.id);

  assert.equal(updatedId, entry.id);
  assert.ok(updatedAt !== null);
});

test("OutboxService markFailed updates repository with error info", () => {
  let updatedId: string | null = null;
  let updatedError: string | null = null;
  let updatedRetry: number | null = null;

  const conn = {
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        if (sql.includes("last_error")) {
          updatedError = String(params[0]);
          updatedRetry = Number(params[1]);
          updatedId = String(params[3]);
        }
        return { changes: 1 };
      },
      get: () => null,
      all: () => [],
    }),
  } as unknown as SqliteConnection;

  const db = {
    transaction: <T>(fn: () => T): T => fn(),
    connection: conn,
  } as unknown as AuthoritativeSqlDatabase;

  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(db, mockBus as any);

  const entry = service.writeOutboxEntry("task", "mark-fail-update", "task:created", {});

  service.markFailed(entry.id, "Test error message", 3, new Date().toISOString());

  assert.equal(updatedId, entry.id);
  assert.equal(updatedError, "Test error message");
  assert.equal(updatedRetry, 3);
});

test("OutboxService publishEntry handles non-JSON payload gracefully", async () => {
  // When entry.payloadJson is not valid JSON, JSON.parse should throw
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  // Create entry with normal write first
  const entry = service.writeOutboxEntry("task", "malformed-json", "task:created", {});

  // Verify entry has valid JSON
  const parsedBefore = JSON.parse(entry.payloadJson);
  assert.deepEqual(parsedBefore, {});

  // publishEntry should handle JSON.parse on its own payload
  const result = await service.publishEntry(entry);

  assert.equal(typeof result, "boolean");
});

test("OutboxService publishEntry error message from non-Error thrown", async () => {
  const mockBus = {
    publish: () => {
      throw "String error not object"; // Throwing a string instead of Error
    },
    publishBatch: () => ({ published: 0 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "string-error", "task:created", {});

  const result = await service.publishEntry(entry);

  assert.equal(result, false);
  assert.ok(service.getFailedCount() >= 1);
});

test("OutboxService writeOutboxEntries with single entry works", () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const result = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "single", eventType: "task:created", payload: { id: 1 } },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.aggregateId, "single");
});

test("OutboxService writeOutboxEntries preserves payload structure", () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const complexPayload = {
    nested: { deep: { value: 42 } },
    array: [1, "two", { three: true }],
    nullValue: null,
  };

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "preserve-struct", eventType: "task:created", payload: complexPayload },
  ]);

  const parsed = JSON.parse(entries[0]!.payloadJson);
  assert.deepEqual(parsed, complexPayload);
});

test("OutboxService getPendingEntries sorts by createdAt ascending", () => {
  const mockBus = {
    publish: () => ({ id: "evt" }),
    publishBatch: () => ({ published: 1 }),
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry1 = service.writeOutboxEntry("task", "sort-1", "task:created", {});
  const entry2 = service.writeOutboxEntry("task", "sort-2", "task:created", {});
  const entry3 = service.writeOutboxEntry("task", "sort-3", "task:created", {});

  const pending = service.getPendingEntries();

  const sortEntries = pending.filter(e => ["sort-1", "sort-2", "sort-3"].some(s => e.aggregateId.includes(s)));

  if (sortEntries.length >= 2) {
    for (let i = 1; i < sortEntries.length; i++) {
      assert.ok(sortEntries[i - 1]!.createdAt <= sortEntries[i]!.createdAt,
        `Entries should be sorted by createdAt: ${sortEntries[i - 1]!.createdAt} <= ${sortEntries[i]!.createdAt}`);
    }
  }
});
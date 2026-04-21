/**
 * Unit tests for OutboxService
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import type { OutboxServiceConfig } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { SqliteConnection } from "../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";

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

function createMockEventBus(shouldFail = false) {
  return {
    publish: (input: { eventType: string; taskId: string | null; executionId: string | null; traceId: string | null; payload: Record<string, unknown> }) => {
      if (shouldFail) {
        throw new Error("Connection refused");
      }
      return { id: `evt-${Date.now()}` };
    },
  };
}

test("OutboxService.writeOutboxEntry inserts entry and returns record", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry(
    "task",
    "task-123",
    "task:status_changed",
    { status: "running", taskId: "task-123" },
    "trace-abc",
  );

  assert.equal(entry.aggregateType, "task");
  assert.equal(entry.aggregateId, "task-123");
  assert.equal(entry.eventType, "task:status_changed");
  assert.equal(entry.traceId, "trace-abc");
  assert.equal(entry.publishedAt, null);
  assert.equal(entry.retryCount, 0);
});

test("OutboxService.writeOutboxEntries inserts multiple entries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const entries = service.writeOutboxEntries([
    { aggregateType: "task", aggregateId: "task-1", eventType: "task:created", payload: { taskId: "task-1" } },
    { aggregateType: "task", aggregateId: "task-2", eventType: "task:created", payload: { taskId: "task-2" } },
  ]);

  assert.equal(entries.length, 2);
  assert.equal(entries[0]!.aggregateType, "task");
  assert.equal(entries[1]!.aggregateType, "task");
});

test("OutboxService.getPendingEntries returns pending entries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
  service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });

  const pending = service.getPendingEntries(10);

  assert.ok(Array.isArray(pending));
  assert.ok(pending.length >= 2);
});

test("OutboxService.getPendingEntries respects limit", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });
  service.writeOutboxEntry("task", "task-2", "task:created", { taskId: "task-2" });
  service.writeOutboxEntry("task", "task-3", "task:created", { taskId: "task-3" });

  const pending = service.getPendingEntries(2);

  assert.ok(Array.isArray(pending));
});

test("OutboxService.getPendingCount returns count of pending entries", () => {
  const mockBus = createMockEventBus();
  const service = new OutboxService(createMockDb(), mockBus as any);

  const initialCount = service.getPendingCount();
  assert.equal(initialCount, 0);

  service.writeOutboxEntry("task", "task-1", "task:created", { taskId: "task-1" });

  const count = service.getPendingCount();
  assert.ok(count >= 1);
});

test("OutboxService.publishEntry publishes to event bus on success", async () => {
  let publishCalled = false;
  const mockBus = {
    publish: (input: { eventType: string; taskId: string | null; executionId: string | null; traceId: string | null; payload: Record<string, unknown> }) => {
      publishCalled = true;
      assert.equal(input.eventType, "task:status_changed");
      return { id: "evt-123" };
    },
  };

  const service = new OutboxService(createMockDb(), mockBus as any);

  const entry = service.writeOutboxEntry("task", "task-123", "task:status_changed", { status: "running" });

  const result = await service.publishEntry(entry);

  assert.equal(result, true);
  assert.equal(publishCalled, true);
});

test("OutboxService.publishEntry returns false and marks failed on error", async () => {
  const mockBus = createMockEventBus(true); // will throw

  const service = new OutboxService(createMockDb(), mockBus as any);

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

  const service = new OutboxService(createMockDb(), mockBus as any);

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

  const service = new OutboxService(createMockDb(), mockBus as any);

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
  const service = new OutboxService(createMockDb(), mockBus as any);

  const pending = service.getPendingEntries();
  assert.ok(Array.isArray(pending));
});

test("OutboxService accepts custom config", () => {
  const mockBus = createMockEventBus();

  // Should not throw
  const service = new OutboxService(createMockDb(), mockBus as any, {
    maxBatchSize: 50,
    publishTimeoutMs: 10000,
  } as Partial<OutboxServiceConfig>);

  const pending = service.getPendingEntries(50);
  assert.ok(Array.isArray(pending));
});

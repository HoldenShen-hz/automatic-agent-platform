/**
 * Integration tests for OutboxService with real database
 * Tests src/platform/shared/outbox/outbox-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

/**
 * Fake DurableEventBus for testing - tracks published events
 */
class FakeEventBus {
  public publishedEvents: Array<{
    eventType: string;
    taskId: string | null;
    executionId: string | null;
    traceId: string | null;
    payload: Record<string, unknown>;
  }> = [];

  public reset(): void {
    this.publishedEvents = [];
  }

  public publish(input: {
    eventType: string;
    taskId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    payload: Record<string, unknown>;
  }): void {
    this.publishedEvents.push({
      eventType: input.eventType,
      taskId: input.taskId ?? null,
      executionId: input.executionId ?? null,
      traceId: input.traceId ?? null,
      payload: input.payload,
    });
  }

  public publishBatch(inputs: Array<{
    eventType: string;
    taskId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    payload: Record<string, unknown>;
  }>): void {
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

test.describe("OutboxService integration tests", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let store: AuthoritativeTaskStore;
  let fakeEventBus: FakeEventBus;
  let outboxService: OutboxService;
  let taskId: string;
  let now: string;

  test.beforeEach(() => {
    workspace = createTempWorkspace("outbox-service-integration-");
    const dbPath = `${workspace}/test.db`;
    db = new SqliteDatabase(dbPath);
    db.migrate();
    store = new AuthoritativeTaskStore(db);

    fakeEventBus = new FakeEventBus();
    outboxService = new OutboxService(db, fakeEventBus as any);

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
        title: "Outbox service integration test task",
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
    db.close();
    cleanupPath(workspace);
  });

  test("OutboxService writeOutboxEntry and getPendingEntries", () => {
    outboxService.writeOutboxEntry("task", taskId, "task:status_changed", { status: "running" }, "trace-1");

    const pending = outboxService.getPendingEntries();

    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.eventType, "task:status_changed");
    assert.equal(pending[0]!.traceId, "trace-1");
  });

  test("OutboxService getPendingCount returns correct count", () => {
    outboxService.writeOutboxEntry("task", taskId, "task:created", {}, null);
    outboxService.writeOutboxEntry("task", taskId, "task:started", {}, null);
    outboxService.writeOutboxEntry("task", taskId, "task:progress", { progress: 50 }, null);

    const count = outboxService.getPendingCount();

    assert.equal(count, 3);
  });

  test("OutboxService publishEntry marks entry as published", async () => {
    const entry = outboxService.writeOutboxEntry("task", taskId, "task:completed", { status: "completed" }, null);

    assert.ok(outboxService.getPendingEntries().some(e => e.id === entry.id));

    const result = await outboxService.publishEntry(entry);

    assert.equal(result, true);
    assert.ok(!outboxService.getPendingEntries().some(e => e.id === entry.id));
  });

  test("OutboxService publishPending publishes all entries", async () => {
    outboxService.writeOutboxEntry("task", taskId, "task:event_1", { index: 1 }, null);
    outboxService.writeOutboxEntry("task", taskId, "task:event_2", { index: 2 }, null);
    outboxService.writeOutboxEntry("task", taskId, "task:event_3", { index: 3 }, null);

    const result = await outboxService.publishPending();

    assert.equal(result.published, 3);
    assert.equal(result.failed, 0);
    assert.equal(fakeEventBus.publishedEvents.length, 3);
    assert.equal(outboxService.getPendingCount(), 0);
  });

  test("OutboxService publishPending with no entries returns zeros", async () => {
    const result = await outboxService.publishPending();

    assert.equal(result.published, 0);
    assert.equal(result.failed, 0);
    assert.equal(fakeEventBus.publishedEvents.length, 0);
  });

  test("OutboxService writeOutboxEntries bulk inserts correctly", () => {
    const entries = outboxService.writeOutboxEntries([
      { aggregateType: "task", aggregateId: taskId, eventType: "task:bulk_1", payload: { index: 1 } },
      { aggregateType: "task", aggregateId: taskId, eventType: "task:bulk_2", payload: { index: 2 } },
      { aggregateType: "task", aggregateId: taskId, eventType: "task:bulk_3", payload: { index: 3 } },
    ]);

    assert.equal(entries.length, 3);
    assert.equal(outboxService.getPendingCount(), 3);
  });

  test("OutboxService markPublished removes entry from pending", () => {
    const entry = outboxService.writeOutboxEntry("task", taskId, "task:mark_pub", {}, null);

    assert.ok(outboxService.getPendingEntries().some(e => e.id === entry.id));

    outboxService.markPublished(entry.id);

    assert.ok(!outboxService.getPendingEntries().some(e => e.id === entry.id));
  });

  test("OutboxService markFailed increments failed count", () => {
    const entry = outboxService.writeOutboxEntry("task", taskId, "task:mark_fail", {}, null);

    outboxService.markFailed(entry.id, "Test error", 1, nowIso());

    assert.ok(outboxService.getFailedCount() >= 1);
  });

  test("OutboxService getFailedCount returns correct count", () => {
    const entry1 = outboxService.writeOutboxEntry("task", taskId, "task:fail_1", {}, null);
    const entry2 = outboxService.writeOutboxEntry("task", taskId, "task:fail_2", {}, null);

    outboxService.markFailed(entry1.id, "Error 1", 1, nowIso());
    outboxService.markFailed(entry2.id, "Error 2", 1, nowIso());

    assert.equal(outboxService.getFailedCount(), 2);
  });

  test("OutboxService getPendingEntries respects maxBatchSize", () => {
    const service = new OutboxService(db, fakeEventBus as any, { maxBatchSize: 3 });

    for (let i = 0; i < 10; i++) {
      service.writeOutboxEntry("task", taskId, `task:batch_${i}`, { index: i }, null);
    }

    const pending = service.getPendingEntries();

    // Should be limited by maxBatchSize
    assert.ok(pending.length <= 3);
  });

  test("OutboxService publishEntriesBatch marks all as published", async () => {
    const entries = outboxService.writeOutboxEntries([
      { aggregateType: "task", aggregateId: taskId, eventType: "task:batch_pub_1", payload: {} },
      { aggregateType: "task", aggregateId: taskId, eventType: "task:batch_pub_2", payload: {} },
    ]);

    const result = await outboxService.publishEntriesBatch(entries);

    assert.equal(result.published, 2);
    assert.equal(result.failed, 0);
    assert.equal(fakeEventBus.publishedEvents.length, 2);
  });
});

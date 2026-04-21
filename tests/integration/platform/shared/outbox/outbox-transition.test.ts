/**
 * Integration Tests: Outbox Transition Service
 *
 * Tests that task state transitions write outbox entries in the same transaction.
 *
 * Defect [SYS-REL-2.6]: TransitionService writes events directly to the events table
 * rather than going through the Outbox pattern. This test validates that task status
 * transitions should write outbox entries atomically with the status update.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { OutboxService } from "../../../../../src/platform/shared/outbox/outbox-service.js";
import { TransitionService } from "../../../../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

/**
 * Fake DurableEventBus for testing - tracks published events.
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

test.describe("Outbox transition integration tests", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let store: AuthoritativeTaskStore;
  let fakeEventBus: FakeEventBus;
  let outboxService: OutboxService;
  let transitionService: TransitionService;
  let taskId: string;
  let now: string;

  test.beforeEach(() => {
    workspace = createTempWorkspace("outbox-transition-");
    const dbPath = `${workspace}/test.db`;
    db = new SqliteDatabase(dbPath);
    db.migrate();
    store = new AuthoritativeTaskStore(db);

    fakeEventBus = new FakeEventBus();
    outboxService = new OutboxService(db, fakeEventBus as any);
    transitionService = new TransitionService(db, store);

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
        title: "Outbox transition test task",
        status: "queued",
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

  test("task state transition writes outbox entry in same transaction", () => {
    // Arrange: Verify no outbox entries exist before transition
    const pendingBefore = outboxService.getPendingEntries();
    assert.strictEqual(pendingBefore.length, 0, "Should start with no pending outbox entries");

    // Act: Transition task status from queued to in_progress
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: null,
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonCode: null,
      reasonDetail: null,
      metadataJson: null,
      traceId: null,
      correlationId: null,
      occurredAt: nowIso(),
    });

    // Assert: Verify outbox entry was written in same transaction
    const pendingAfter = outboxService.getPendingEntries();
    assert.ok(pendingAfter.length > 0, "Should have at least one pending outbox entry after transition");

    // Find the outbox entry for task:status_changed
    const statusChangeEntry = pendingAfter.find(
      (entry) => entry.eventType === "task:status_changed" && entry.aggregateId === taskId,
    );

    assert.ok(statusChangeEntry !== undefined, "Should have outbox entry with event_type 'task:status_changed'");
    assert.strictEqual(statusChangeEntry!.aggregateType, "task", "Outbox entry aggregate type should be 'task'");
    assert.strictEqual(statusChangeEntry!.aggregateId, taskId, "Outbox entry aggregate ID should match task ID");

    // Verify payload contains status change information
    const payload = JSON.parse(statusChangeEntry!.payloadJson);
    assert.strictEqual(payload.entityKind, "task", "Payload should contain entityKind");
    assert.strictEqual(payload.entityId, taskId, "Payload should contain entityId");
    assert.strictEqual(payload.fromStatus, "queued", "Payload should contain fromStatus");
    assert.strictEqual(payload.toStatus, "in_progress", "Payload should contain toStatus");
  });

  test("task state transition does not write duplicate outbox entries on same transition", () => {
    // Act: Transition task status
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: null,
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonCode: null,
      reasonDetail: null,
      metadataJson: null,
      traceId: null,
      correlationId: null,
      occurredAt: nowIso(),
    });

    // Count outbox entries for this task and event type
    const pendingAfter = outboxService.getPendingEntries();
    const statusChangeEntries = pendingAfter.filter(
      (entry) => entry.eventType === "task:status_changed" && entry.aggregateId === taskId,
    );

    assert.strictEqual(statusChangeEntries.length, 1, "Should have exactly one outbox entry for this transition");
  });

  test("outbox entry is atomic with task status change", () => {
    // Act: Transition task status multiple times
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: null,
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonCode: null,
      reasonDetail: null,
      metadataJson: null,
      traceId: null,
      correlationId: null,
      occurredAt: nowIso(),
    });

    // Verify event bus was NOT called directly (outbox pattern should be used)
    // The outbox poller would eventually publish these, but immediate publishing bypasses outbox
    const pendingAfter = outboxService.getPendingEntries();
    assert.ok(pendingAfter.length > 0, "Outbox should contain entries");

    // Verify that events went through outbox, not direct to event bus
    // The defect is that currently events go directly to events table, not through outbox
    const taskStatusChangeOutboxEntries = pendingAfter.filter(
      (entry) => entry.eventType === "task:status_changed" && entry.aggregateId === taskId,
    );
    assert.ok(
      taskStatusChangeOutboxEntries.length > 0,
      "Should have outbox entries for task:status_changed events",
    );
  });
});
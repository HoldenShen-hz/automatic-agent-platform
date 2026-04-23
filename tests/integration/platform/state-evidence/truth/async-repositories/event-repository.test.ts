// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncEventRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/event-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { EventRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.skip("AsyncEventRepository", (group) => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    repo: AsyncEventRepository;
    cleanup: () => void;
  };

  group.beforeEach(() => {
    const workspace = createTempWorkspace("aa-async-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const repo = new AsyncEventRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      repo,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  group.afterEach(() => {
    harness.cleanup();
  });

  test("insertEvent and getEvent roundtrip", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-001",
      taskId: "task-event-001",
      sessionId: null,
      executionId: null,
      eventType: "task.created",
      payloadJson: '{"taskId":"task-event-001"}',
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };

    const record = await harness.repo.insertEvent(event);

    assert.equal(record.id, "event-001");
    assert.equal(record.eventType, "task.created");
    assert.ok(record.eventTier);

    const retrieved = await harness.repo.getEvent("event-001");
    assert.equal(retrieved?.id, "event-001");
    assert.equal(retrieved?.taskId, "task-event-001");
  });

  test("getEvent returns null for non-existent event", async () => {
    const result = await harness.repo.getEvent("non-existent-event");
    assert.equal(result, null);
  });

  test("listEventsByType returns events filtered by type", async () => {
    const events = [
      { id: "event-type-001", taskId: null, sessionId: null, executionId: null, eventType: "task.created", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:00:00.000Z" },
      { id: "event-type-002", taskId: null, sessionId: null, executionId: null, eventType: "task.created", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:01:00.000Z" },
      { id: "event-type-003", taskId: null, sessionId: null, executionId: null, eventType: "execution.started", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:02:00.000Z" },
    ];

    for (const event of events) {
      await harness.repo.insertEvent(event);
    }

    const taskCreatedEvents = await harness.repo.listEventsByType("task.created");
    assert.equal(taskCreatedEvents.length, 2);

    const executionStartedEvents = await harness.repo.listEventsByType("execution.started");
    assert.equal(executionStartedEvents.length, 1);
  });

  test("listEventsByType with limit", async () => {
    for (let i = 0; i < 5; i++) {
      const event = { id: `event-limit-${i}`, taskId: null, sessionId: null, executionId: null, eventType: "test.event", payloadJson: "{}", traceId: null, createdAt: new Date(2026, 3, 23, 10, i).toISOString() };
      await harness.repo.insertEvent(event);
    }

    const listed = await harness.repo.listEventsByType("test.event", 3);
    assert.equal(listed.length, 3);
  });

  test("insertEventConsumerAck and getEventConsumerAck roundtrip", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-ack-001",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "task.created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.repo.insertEvent(event);

    await harness.repo.insertEventConsumerAck({
      id: "eack-001",
      eventId: "event-ack-001",
      consumerId: "consumer-001",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    const retrieved = await harness.repo.getEventConsumerAck("event-ack-001", "consumer-001");
    assert.equal(retrieved?.id, "eack-001");
    assert.equal(retrieved?.consumerId, "consumer-001");
    assert.equal(retrieved?.status, "pending");
  });

  test("markEventAck updates ack status", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-mark-001",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "task.created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.repo.insertEvent(event);

    await harness.repo.insertEventConsumerAck({
      id: "eack-mark-001",
      eventId: "event-mark-001",
      consumerId: "consumer-mark",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    await harness.repo.markEventAck("event-mark-001", "consumer-mark", "acked", "2026-04-23T10:30:00.000Z", null);

    const retrieved = await harness.repo.getEventConsumerAck("event-mark-001", "consumer-mark");
    assert.equal(retrieved?.status, "acked");
    assert.equal(retrieved?.attemptCount, 1);
  });

  test("ackAllConsumersForEvent marks all pending/failed acks as acked", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-ack-all-001",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "task.created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.repo.insertEvent(event);

    // Insert multiple consumer acks
    const consumers = ["consumer-a", "consumer-b", "consumer-c"];
    for (const consumerId of consumers) {
      await harness.repo.insertEventConsumerAck({
        id: `eack-all-${consumerId}`,
        eventId: "event-ack-all-001",
        consumerId,
        status: "pending",
        lastAttemptAt: null,
        ackedAt: null,
        errorCode: null,
        attemptCount: 0,
      });
    }

    await harness.repo.ackAllConsumersForEvent("event-ack-all-001", "2026-04-23T11:00:00.000Z");

    for (const consumerId of consumers) {
      const ack = await harness.repo.getEventConsumerAck("event-ack-all-001", consumerId);
      assert.equal(ack?.status, "acked");
    }
  });

  test("countPendingTier1Acks counts pending tier 1 acks", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-tier1-001",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "task.created", // This is tier_1
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.repo.insertEvent(event);

    const count = await harness.repo.countPendingTier1Acks();
    assert.ok(count >= 1);
  });

  test("getRequiredConsumerIds returns consumer ids for event", async () => {
    const event: Omit<EventRecord, "eventTier" | "sessionId"> & { sessionId?: string | null } = {
      id: "event-consumers-001",
      taskId: null,
      sessionId: null,
      executionId: null,
      eventType: "task.created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.repo.insertEvent(event);

    const consumerIds = await harness.repo.getRequiredConsumerIds("event-consumers-001");
    assert.ok(consumerIds.length > 0);
  });
});

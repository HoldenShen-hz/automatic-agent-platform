/**
 * Integration Tests: EventRepository (SQLite Direct)
 *
 * Tests data access operations on the events and event_consumer_acks tables
 * using EventRepository with a real SQLite database in temp directory.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
test("EventRepository: insert and retrieve event", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_test.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const eventId = "event-repo-001";
        const now = new Date().toISOString();
        db.transaction(() => {
            repo.insertEvent({
                id: eventId,
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "task.created",
                payloadJson: '{"taskId":"new-task"}',
                traceId: null,
                createdAt: now,
            });
        });
        const event = repo.getEvent(eventId);
        assert.ok(event, "Event should be retrieved");
        assert.equal(event.id, eventId);
        assert.equal(event.eventType, "task.created");
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: get event returns undefined for non-existent", () => {
    const workspace = createTempWorkspace("aa-event-notfound-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_notfound.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const result = repo.getEvent("non-existent-event");
        assert.equal(result, undefined);
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: list events by type", () => {
    const workspace = createTempWorkspace("aa-event-type-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_type.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const now = new Date().toISOString();
        db.transaction(() => {
            repo.insertEvent({
                id: "event-type-001",
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "task.created",
                payloadJson: "{}",
                traceId: null,
                createdAt: now,
            });
            repo.insertEvent({
                id: "event-type-002",
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "task.created",
                payloadJson: "{}",
                traceId: null,
                createdAt: now,
            });
            repo.insertEvent({
                id: "event-type-003",
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "execution.started",
                payloadJson: "{}",
                traceId: null,
                createdAt: now,
            });
        });
        const taskCreatedEvents = repo.listEventsByType("task.created");
        assert.equal(taskCreatedEvents.length, 2);
        const executionStartedEvents = repo.listEventsByType("execution.started");
        assert.equal(executionStartedEvents.length, 1);
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: consumer ack operations", () => {
    const workspace = createTempWorkspace("aa-event-ack-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_ack.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const eventId = "event-ack-001";
        const consumerId = "consumer-001";
        const now = new Date().toISOString();
        db.transaction(() => {
            repo.insertEvent({
                id: eventId,
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "task.created",
                payloadJson: "{}",
                traceId: null,
                createdAt: now,
            });
            repo.insertEventConsumerAck({
                id: "eack-001",
                eventId,
                consumerId,
                status: "pending",
                lastAttemptAt: null,
                ackedAt: null,
                errorCode: null,
                attemptCount: 0,
            });
        });
        const ack = repo.getEventConsumerAck(eventId, consumerId);
        assert.ok(ack, "Acknowledgment should be retrieved");
        assert.equal(ack.eventId, eventId);
        assert.equal(ack.consumerId, consumerId);
        assert.equal(ack.status, "pending");
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: mark event ack", () => {
    const workspace = createTempWorkspace("aa-event-mark-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_mark.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const eventId = "event-mark-001";
        const consumerId = "consumer-mark";
        const now = new Date().toISOString();
        db.transaction(() => {
            repo.insertEvent({
                id: eventId,
                taskId: null,
                sessionId: null,
                executionId: null,
                eventType: "task.created",
                payloadJson: "{}",
                traceId: null,
                createdAt: now,
            });
            repo.insertEventConsumerAck({
                id: "eack-mark-001",
                eventId,
                consumerId,
                status: "pending",
                lastAttemptAt: null,
                ackedAt: null,
                errorCode: null,
                attemptCount: 0,
            });
        });
        const ackTime = new Date().toISOString();
        db.transaction(() => {
            repo.markEventAck({
                eventId,
                consumerId,
                status: "acked",
                occurredAt: ackTime,
                errorCode: null,
            });
        });
        const ack = repo.getEventConsumerAck(eventId, consumerId);
        assert.equal(ack.status, "acked");
        assert.equal(ack.attemptCount, 1);
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: list events for task", () => {
    const workspace = createTempWorkspace("aa-event-task-");
    let db;
    let repo;
    let taskRepo;
    try {
        const dbPath = join(workspace, "event_task.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        taskRepo = new TaskRepository(db.connection);
        const taskId = "event-task-001";
        const now = new Date().toISOString();
        db.transaction(() => {
            // Insert task first (required for FK)
            taskRepo.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                tenantId: null,
                title: "Test Task",
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
            // Insert multiple events for the task
            for (let i = 0; i < 5; i++) {
                repo.insertEvent({
                    id: `event-task-${i}`,
                    taskId,
                    sessionId: null,
                    executionId: null,
                    eventType: "task.status_changed",
                    payloadJson: JSON.stringify({ status: "in_progress" }),
                    traceId: null,
                    createdAt: now,
                });
            }
        });
        const events = repo.listEventsForTask(taskId);
        assert.equal(events.length, 5, "Should list all 5 events for the task");
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: insert event dead letter", () => {
    const workspace = createTempWorkspace("aa-event-dlq-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_dlq.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const now = new Date().toISOString();
        db.transaction(() => {
            repo.insertEventDeadLetter({
                id: "dlq-001",
                originalEventId: "event-original-001",
                eventType: "task.created",
                payloadJson: '{"test":"dlq"}',
                consumerId: "consumer-001",
                failureCount: 3,
                lastError: "Connection timeout",
                deadLetteredAt: now,
                reprocessedAt: null,
                reprocessResult: null,
            });
        });
        const deadLetters = repo.listEventDeadLetters(10);
        assert.equal(deadLetters.length, 1);
        assert.equal(deadLetters[0].id, "dlq-001");
        assert.equal(deadLetters[0].failureCount, 3);
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
test("EventRepository: list all events with pagination", () => {
    const workspace = createTempWorkspace("aa-event-all-");
    let db;
    let repo;
    try {
        const dbPath = join(workspace, "event_all.db");
        db = new SqliteDatabase(dbPath);
        db.migrate();
        repo = new EventRepository(db.connection);
        const now = new Date().toISOString();
        db.transaction(() => {
            for (let i = 0; i < 25; i++) {
                repo.insertEvent({
                    id: `event-all-${i}`,
                    taskId: null,
                    sessionId: null,
                    executionId: null,
                    eventType: "task.created",
                    payloadJson: JSON.stringify({ index: i }),
                    traceId: null,
                    createdAt: now,
                });
            }
        });
        const firstPage = repo.listAllEvents(10, 0);
        assert.equal(firstPage.length, 10, "First page should have 10 events");
        const secondPage = repo.listAllEvents(10, 10);
        assert.equal(secondPage.length, 10, "Second page should have 10 events");
        const thirdPage = repo.listAllEvents(10, 20);
        assert.equal(thirdPage.length, 5, "Third page should have 5 events");
    }
    finally {
        db?.close();
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=event-repository.test.js.map
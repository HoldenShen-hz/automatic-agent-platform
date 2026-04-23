import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { EventRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
function createTestTask(db, taskId, now) {
    const taskRepo = new TaskRepository(db.connection);
    taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    });
}
function createTestExecution(db, execId, taskId, now, attempt = 1) {
    const execRepo = new ExecutionRepository(db.connection);
    createTestTask(db, taskId, now);
    execRepo.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${execId}`,
        attempt,
        timeoutMs: 60000,
        budgetUsdLimit: 1.0,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
    });
}
test("EventRepository inserts an event and getEvent returns it", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-1", now);
        const event = {
            id: "event-001",
            taskId: "task-event-1",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: '{"newStatus":"in_progress"}',
            traceId: "trace-001",
            createdAt: now,
        };
        repo.insertEvent(event);
        const result = repo.getEvent("event-001");
        assert.ok(result, "getEvent should return the inserted event");
        assert.equal(result.id, "event-001");
        assert.equal(result.taskId, "task-event-1");
        assert.equal(result.eventType, "task:status_changed");
        assert.equal(result.eventTier, "tier_1");
        assert.equal(result.payloadJson, '{"newStatus":"in_progress"}');
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository getEvent returns undefined for non-existent event", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const result = repo.getEvent("nonexistent-event");
        assert.strictEqual(result, undefined);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository listEventsForTask returns all events for a task", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-list", now);
        for (let i = 1; i <= 3; i++) {
            repo.insertEvent({
                id: `event-list-${i}`,
                taskId: "task-event-list",
                sessionId: null,
                executionId: null,
                eventType: "task:status_changed",
                eventTier: "tier_1",
                payloadJson: `{"index":${i}}`,
                traceId: `trace-list-${i}`,
                createdAt: now,
            });
        }
        const results = repo.listEventsForTask("task-event-list");
        assert.equal(results.length, 3, "should return all 3 events");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository listEventsForTask with limit returns only specified number", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-limit", now);
        for (let i = 1; i <= 5; i++) {
            repo.insertEvent({
                id: `event-limit-${i}`,
                taskId: "task-event-limit",
                sessionId: null,
                executionId: null,
                eventType: "task:status_changed",
                eventTier: "tier_1",
                payloadJson: `{"index":${i}}`,
                traceId: `trace-limit-${i}`,
                createdAt: now,
            });
        }
        const results = repo.listEventsForTask("task-event-limit", 3);
        assert.equal(results.length, 3, "should return only 3 events");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository listEventsByType returns events with matching type", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-type", now);
        const eventTypes = ["task:created", "task:status_changed", "task:created"];
        for (let i = 0; i < 3; i++) {
            repo.insertEvent({
                id: `event-type-${i}`,
                taskId: "task-event-type",
                sessionId: null,
                executionId: null,
                eventType: eventTypes[i],
                eventTier: "tier_1",
                payloadJson: "{}",
                traceId: `trace-type-${i}`,
                createdAt: now,
            });
        }
        const createdEvents = repo.listEventsByType("task:created");
        assert.equal(createdEvents.length, 2, "should return 2 task:created events");
        const statusChangedEvents = repo.listEventsByType("task:status_changed");
        assert.equal(statusChangedEvents.length, 1, "should return 1 task:status_changed event");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository insertEventConsumerAck and getEventConsumerAck work", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-ack", now);
        repo.insertEvent({
            id: "event-ack-001",
            taskId: "task-event-ack",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-ack",
            createdAt: now,
        });
        const ack = {
            id: "ack-001",
            eventId: "event-ack-001",
            consumerId: "consumer-1",
            status: "pending",
            lastAttemptAt: null,
            ackedAt: null,
            errorCode: null,
            attemptCount: 0,
        };
        repo.insertEventConsumerAck(ack);
        const result = repo.getEventConsumerAck("event-ack-001", "consumer-1");
        assert.ok(result);
        assert.equal(result.id, "ack-001");
        assert.equal(result.eventId, "event-ack-001");
        assert.equal(result.consumerId, "consumer-1");
        assert.equal(result.status, "pending");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository markEventAck updates ack status to acked", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-mark", now);
        repo.insertEvent({
            id: "event-mark-001",
            taskId: "task-event-mark",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-mark",
            createdAt: now,
        });
        const ack = {
            id: "ack-mark-001",
            eventId: "event-mark-001",
            consumerId: "consumer-mark",
            status: "pending",
            lastAttemptAt: null,
            ackedAt: null,
            errorCode: null,
            attemptCount: 0,
        };
        repo.insertEventConsumerAck(ack);
        const beforeAck = repo.getEventConsumerAck("event-mark-001", "consumer-mark");
        assert.equal(beforeAck?.status, "pending");
        repo.markEventAck("event-mark-001", "consumer-mark");
        const afterAck = repo.getEventConsumerAck("event-mark-001", "consumer-mark");
        assert.equal(afterAck?.status, "acked");
        assert.ok(afterAck?.ackedAt, "ackedAt should be set");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository listPendingEventsForConsumer returns pending events", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-pending", now);
        repo.insertEvent({
            id: "event-pending-1",
            taskId: "task-pending",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-pending-1",
            createdAt: now,
        });
        repo.insertEvent({
            id: "event-pending-2",
            taskId: "task-pending",
            sessionId: null,
            executionId: null,
            eventType: "task:created",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-pending-2",
            createdAt: now,
        });
        repo.insertEventConsumerAck({
            id: "ack-pending-1",
            eventId: "event-pending-1",
            consumerId: "test-consumer",
            status: "pending",
            lastAttemptAt: null,
            ackedAt: null,
            errorCode: null,
            attemptCount: 0,
        });
        repo.insertEventConsumerAck({
            id: "ack-pending-2",
            eventId: "event-pending-2",
            consumerId: "test-consumer",
            status: "acked",
            lastAttemptAt: now,
            ackedAt: now,
            errorCode: null,
            attemptCount: 1,
        });
        const pending = repo.listPendingEventsForConsumer("test-consumer");
        assert.equal(pending.length, 1, "should return only 1 pending event");
        assert.equal(pending[0]?.event?.id, "event-pending-1");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository resetConsumerReplayState requeues acknowledged history for replay", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-replay-reset", now);
        repo.insertEvent({
            id: "event-replay-reset-1",
            taskId: "task-replay-reset",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-replay-reset-1",
            createdAt: now,
        });
        repo.insertEventConsumerAck({
            id: "ack-replay-reset-acked",
            eventId: "event-replay-reset-1",
            consumerId: "test-consumer",
            status: "acked",
            lastAttemptAt: now,
            ackedAt: now,
            errorCode: null,
            attemptCount: 3,
        });
        repo.insertEventConsumerAck({
            id: "ack-replay-reset-failed",
            eventId: "event-replay-reset-1",
            consumerId: "test-consumer-failed",
            status: "failed",
            lastAttemptAt: now,
            ackedAt: null,
            errorCode: "projection.failed",
            attemptCount: 2,
        });
        const changes = repo.resetConsumerReplayState("test-consumer");
        const resetAck = repo.getEventConsumerAck("event-replay-reset-1", "test-consumer");
        const failedAck = repo.getEventConsumerAck("event-replay-reset-1", "test-consumer-failed");
        assert.equal(changes, 1);
        assert.equal(resetAck?.status, "pending");
        assert.equal(resetAck?.lastAttemptAt, null);
        assert.equal(resetAck?.ackedAt, null);
        assert.equal(resetAck?.attemptCount, 0);
        assert.equal(failedAck?.status, "failed");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository countPendingTier1Acks returns correct count", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-count-acks", now);
        repo.insertEvent({
            id: "event-count-1",
            taskId: "task-count-acks",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-count-1",
            createdAt: now,
        });
        repo.insertEvent({
            id: "event-count-2",
            taskId: "task-count-acks",
            sessionId: null,
            executionId: null,
            eventType: "task:created",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-count-2",
            createdAt: now,
        });
        repo.insertEventConsumerAck({
            id: "ack-count-1",
            eventId: "event-count-1",
            consumerId: "consumer-1",
            status: "pending",
            lastAttemptAt: null,
            ackedAt: null,
            errorCode: null,
            attemptCount: 0,
        });
        repo.insertEventConsumerAck({
            id: "ack-count-2",
            eventId: "event-count-2",
            consumerId: "consumer-1",
            status: "pending",
            lastAttemptAt: null,
            ackedAt: null,
            errorCode: null,
            attemptCount: 0,
        });
        const count = repo.countPendingTier1Acks();
        assert.equal(count, 4, "should count manual plus auto-generated pending tier-1 acks");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository insertEvent violates primary key constraint throws error", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-event-dup", now);
        repo.insertEvent({
            id: "event-duplicate",
            taskId: "task-event-dup",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-dup",
            createdAt: now,
        });
        assert.throws(() => {
            repo.insertEvent({
                id: "event-duplicate",
                taskId: "task-event-dup",
                sessionId: null,
                executionId: null,
                eventType: "task:created",
                eventTier: "tier_1",
                payloadJson: "{}",
                traceId: "trace-dup-2",
                createdAt: now,
            });
        }, /UNIQUE.*event-duplicate|UNIQUE constraint failed/i);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository insertEvent with FK to execution works", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestExecution(db, "exec-event-fk", "task-event-fk", now);
        repo.insertEvent({
            id: "event-with-exec",
            taskId: "task-event-fk",
            sessionId: null,
            executionId: "exec-event-fk",
            eventType: "execution:started",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-exec-fk",
            createdAt: now,
        });
        const result = repo.getEvent("event-with-exec");
        assert.ok(result);
        assert.equal(result.executionId, "exec-event-fk");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository rejects insertion with non-existent task_id FK", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        // Attempt to insert event with non-existent task_id
        assert.throws(() => {
            repo.insertEvent({
                id: "event-fk-task",
                taskId: "nonexistent-task-id",
                sessionId: null,
                executionId: null,
                eventType: "task:created",
                eventTier: "tier_1",
                payloadJson: "{}",
                traceId: "trace-fk",
                createdAt: now,
            });
        }, (error) => {
            const message = error instanceof Error ? error.message : String(error);
            return message.includes("FOREIGN KEY") || message.includes("constraint");
        });
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository dead-letter helpers update ack state and persist dead letters", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-dlq", now);
        repo.insertEvent({
            id: "event-dlq-1",
            taskId: "task-dlq",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: "{}",
            traceId: "trace-dlq",
            createdAt: now,
        });
        repo.ensureEventConsumerAckPending("event-dlq-1", "manual-consumer");
        repo.markEventAck({
            eventId: "event-dlq-1",
            consumerId: "manual-consumer",
            status: "failed",
            occurredAt: now,
            errorCode: "projection.failed",
        });
        repo.markEventDeadLettered({
            eventId: "event-dlq-1",
            consumerId: "manual-consumer",
            occurredAt: now,
            errorCode: "projection.dead_lettered",
        });
        repo.insertEventDeadLetter({
            id: "dlq-1",
            originalEventId: "event-dlq-1",
            eventType: "task:status_changed",
            payloadJson: "{}",
            consumerId: "manual-consumer",
            failureCount: 3,
            lastError: "projection.dead_lettered",
            deadLetteredAt: now,
            reprocessedAt: null,
            reprocessResult: null,
        });
        const ack = repo.getEventConsumerAck("event-dlq-1", "manual-consumer");
        const deadLetters = repo.listEventDeadLetters();
        assert.equal(ack?.status, "dead_lettered");
        assert.equal(ack?.errorCode, "projection.dead_lettered");
        assert.equal(deadLetters[0]?.originalEventId, "event-dlq-1");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventRepository createTier1StatusEvent creates required acks and audit chain records", () => {
    const workspace = createTempWorkspace("aa-event-repo-");
    const dbPath = join(workspace, "event-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new EventRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestExecution(db, "exec-tier1", "task-tier1", now);
        const event = repo.createTier1StatusEvent({
            taskId: "task-tier1",
            executionId: "exec-tier1",
            eventType: "task:status_changed",
            traceId: "trace-tier1",
            payload: { status: "completed" },
        });
        const requiredConsumers = repo.getRequiredConsumerIds(event.id).sort();
        const pendingTier1 = repo.listPendingTier1Acks("9999-12-31T23:59:59.999Z");
        const integrityReport = repo.getTier1AuditIntegrityReport();
        assert.deepEqual(requiredConsumers, ["inspect_projection", "task_projection"]);
        assert.ok(pendingTier1.some((record) => record.eventId === event.id));
        assert.equal(integrityReport.checked, true);
        assert.ok(integrityReport.totalTrackedEvents >= 1);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=event-repository.test.js.map
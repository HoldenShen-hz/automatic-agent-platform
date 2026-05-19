// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncEventRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/event-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
test.describe("AsyncEventRepository", () => {
    let harness;
    test.beforeEach(() => {
        const workspace = createTempWorkspace("aa-async-event-repo-");
        const dbPath = join(workspace, "event-repo.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const adapter = new SqliteAsyncAdapter(db);
        const repo = new AsyncEventRepository(adapter.asyncConnection);
        const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
        harness = {
            workspace,
            dbPath,
            db,
            adapter,
            repo,
            taskRepo,
            cleanup() {
                db.close();
                cleanupPath(workspace);
            },
        };
    });
    test.afterEach(() => {
        harness.cleanup();
    });
    async function insertTestTask(taskId) {
        const task = {
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            tenantId: "tenant-event",
            title: `Task ${taskId}`,
            status: "in_progress",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await harness.taskRepo.insertTask(task);
    }
    test("insertEvent and getEvent roundtrip", async () => {
        await insertTestTask("task-event-001");
        const event = {
            id: "event-001",
            taskId: "task-event-001",
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            payloadJson: '{"taskId":"task-event-001"}',
            traceId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
        };
        const record = await harness.repo.insertEvent(event);
        assert.equal(record.id, "event-001");
        assert.equal(record.eventType, "task:status_changed");
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
            { id: "event-type-001", taskId: null, sessionId: null, executionId: null, eventType: "task:status_changed", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:00:00.000Z" },
            { id: "event-type-002", taskId: null, sessionId: null, executionId: null, eventType: "task:status_changed", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:01:00.000Z" },
            { id: "event-type-003", taskId: null, sessionId: null, executionId: null, eventType: "decision:requested", payloadJson: "{}", traceId: null, createdAt: "2026-04-23T10:02:00.000Z" },
        ];
        for (const event of events) {
            await harness.repo.insertEvent(event);
        }
        const taskCreatedEvents = await harness.repo.listEventsByType("task:status_changed");
        assert.equal(taskCreatedEvents.length, 2);
        const executionStartedEvents = await harness.repo.listEventsByType("decision:requested");
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
        const event = {
            id: "event-ack-001",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "dispatch:ticket_created",
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
    test("markEventAck preserves readable ack state", async () => {
        const event = {
            id: "event-mark-001",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertEvent(event);
        await harness.repo.markEventAck("event-mark-001", "task_projection", "acked", "2026-04-23T10:30:00.000Z", null);
        const retrieved = await harness.repo.getEventConsumerAck("event-mark-001", "task_projection");
        assert.ok(retrieved);
        assert.equal(retrieved?.consumerId, "task_projection");
    });
    test("ackAllConsumersForEvent marks all pending/failed acks as acked", async () => {
        const event = {
            id: "event-ack-all-001",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "dispatch:ticket_created",
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
        const event = {
            id: "event-tier1-001",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertEvent(event);
        const count = await harness.repo.countPendingTier1Acks();
        assert.equal(count, 2);
    });
    test("getRequiredConsumerIds returns consumer ids for event", async () => {
        const event = {
            id: "event-consumers-001",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "task:status_changed",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.repo.insertEvent(event);
        const consumerIds = await harness.repo.getRequiredConsumerIds("event-consumers-001");
        assert.deepEqual(consumerIds.sort(), ["inspect_projection", "task_projection"]);
    });
});
//# sourceMappingURL=event-repository.test.js.map
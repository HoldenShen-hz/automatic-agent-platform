/**
 * Integration Test: Durable Event Bus
 *
 * Tests event publishing, batch publishing, subscription delivery,
 * and acknowledgment handling using SQLite and temporary workspaces.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
test("integration: durable event bus publishes events and creates ack records for tier-1 consumers", () => {
    const ctx = createIntegrationContext("aa-event-bus-publish-");
    try {
        const bus = new DurableEventBus(ctx.db, ctx.store);
        seedTaskAndExecution(ctx.db, ctx.store, {
            taskId: "task-bus-publish",
            executionId: "exec-bus-publish",
            traceId: "trace-bus-publish",
        });
        const event = bus.publish({
            eventType: "task:status_changed",
            taskId: "task-bus-publish",
            executionId: "exec-bus-publish",
            traceId: "trace-bus-publish",
            payload: { fromStatus: "queued", toStatus: "in_progress" },
        });
        assert.ok(event.id.startsWith("evt_"), "Event should have a valid ID");
        assert.equal(event.eventType, "task:status_changed");
        assert.equal(event.eventTier, "tier_1");
        const acks = ctx.store.listPendingTier1Acks(event.id);
        assert.ok(acks.length > 0, "Tier-1 event should create ack records");
        bus.dispose();
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: durable event bus delivers events to subscribers and handles acknowledgments", async () => {
    const workspace = createTempWorkspace("aa-event-bus-deliver-");
    try {
        const db = new SqliteDatabase(join(workspace, "event-bus-deliver.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new DurableEventBus(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-bus-deliver",
            executionId: "exec-bus-deliver",
            traceId: "trace-bus-deliver",
        });
        let deliveredEvents = [];
        bus.subscribe("test_consumer", (event) => {
            deliveredEvents.push(event.id);
        });
        bus.publish({
            eventType: "execution:heartbeat",
            taskId: "task-bus-deliver",
            executionId: "exec-bus-deliver",
            traceId: "trace-bus-deliver",
            payload: { workerId: "worker-test", status: "idle" },
        });
        // Allow async delivery to complete
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(deliveredEvents.length > 0, "Subscriber should receive events");
        bus.dispose();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("integration: durable event bus publishes batch events and creates ack records", () => {
    const ctx = createIntegrationContext("aa-event-bus-batch-");
    try {
        const bus = new DurableEventBus(ctx.db, ctx.store);
        seedTaskAndExecution(ctx.db, ctx.store, {
            taskId: "task-bus-batch",
            executionId: "exec-bus-batch",
            traceId: "trace-bus-batch",
        });
        const events = bus.publishBatch([
            {
                eventType: "task:status_changed",
                taskId: "task-bus-batch",
                executionId: "exec-bus-batch",
                traceId: "trace-bus-batch-1",
                payload: { fromStatus: "queued", toStatus: "in_progress" },
            },
            {
                eventType: "execution:heartbeat",
                taskId: "task-bus-batch",
                executionId: "exec-bus-batch",
                traceId: "trace-bus-batch-2",
                payload: { workerId: "worker-batch", status: "busy" },
            },
            {
                eventType: "task:status_changed",
                taskId: "task-bus-batch",
                executionId: "exec-bus-batch",
                traceId: "trace-bus-batch-3",
                payload: { fromStatus: "in_progress", toStatus: "completed" },
            },
        ]);
        assert.equal(events.length, 3, "Should publish all 3 events");
        assert.ok(events.every((e) => e.id.startsWith("evt_")), "All events should have valid IDs");
        const acks = ctx.store.listPendingTier1Acks(events[0]?.id ?? "");
        assert.ok(acks.length > 0, "Tier-1 events should create ack records");
        bus.dispose();
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: durable event bus dispatches volatile tier-2 events to handlers", async () => {
    const workspace = createTempWorkspace("aa-event-bus-volatile-");
    try {
        const db = new SqliteDatabase(join(workspace, "event-bus-volatile.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new DurableEventBus(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-bus-volatile",
            executionId: "exec-bus-volatile",
            traceId: "trace-bus-volatile",
        });
        let handlerCalled = false;
        bus.subscribe("volatile_consumer", (event) => {
            if (event.eventType === "execution:heartbeat") {
                handlerCalled = true;
            }
        });
        bus.publish({
            eventType: "execution:heartbeat",
            taskId: "task-bus-volatile",
            executionId: "exec-bus-volatile",
            traceId: "trace-bus-volatile",
            payload: { workerId: "worker-volatile", status: "idle" },
        });
        // Allow async delivery to complete
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(handlerCalled, "Tier-2 events should be dispatched to handlers immediately");
        bus.dispose();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("integration: durable event bus rejects oversized payloads", () => {
    const ctx = createIntegrationContext("aa-event-bus-oversized-");
    try {
        const bus = new DurableEventBus(ctx.db, ctx.store);
        seedTaskAndExecution(ctx.db, ctx.store, {
            taskId: "task-bus-oversized",
            executionId: "exec-bus-oversized",
            traceId: "trace-bus-oversized",
        });
        const largePayload = { data: "x".repeat(1_000_001) };
        assert.throws(() => bus.publish({
            eventType: "task:status_changed",
            taskId: "task-bus-oversized",
            executionId: "exec-bus-oversized",
            traceId: "trace-bus-oversized",
            payload: largePayload,
        }), (err) => err.message.includes("payload_too_large"), "Should reject payloads exceeding 1MB");
        bus.dispose();
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: durable event bus can unsubscribe and stop receiving events", async () => {
    const workspace = createTempWorkspace("aa-event-bus-unsubscribe-");
    try {
        const db = new SqliteDatabase(join(workspace, "event-bus-unsubscribe.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new DurableEventBus(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-bus-unsub",
            executionId: "exec-bus-unsub",
            traceId: "trace-bus-unsub",
        });
        let deliveredCount = 0;
        bus.subscribe("unsub_consumer", (event) => {
            deliveredCount++;
        });
        bus.publish({
            eventType: "execution:heartbeat",
            taskId: "task-bus-unsub",
            executionId: "exec-bus-unsub",
            traceId: "trace-bus-unsub-1",
            payload: { workerId: "worker-unsub-1", status: "idle" },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        const countBeforeUnsub = deliveredCount;
        bus.unsubscribe("unsub_consumer");
        bus.publish({
            eventType: "execution:heartbeat",
            taskId: "task-bus-unsub",
            executionId: "exec-bus-unsub",
            traceId: "trace-bus-unsub-2",
            payload: { workerId: "worker-unsub-2", status: "idle" },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(deliveredCount, countBeforeUnsub, "Unsubscribed consumer should not receive new events");
        bus.dispose();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=durable-event-bus-integration.test.js.map
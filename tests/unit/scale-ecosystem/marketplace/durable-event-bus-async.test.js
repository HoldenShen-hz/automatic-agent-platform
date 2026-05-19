// @ts-nocheck
/**
 * Unit tests for DurableEventBusAsync
 *
 * @see src/scale-ecosystem/marketplace/durable-event-bus-async.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { DurableEventBusAsync } from "../../../../src/scale-ecosystem/marketplace/durable-event-bus-async.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function createTestBus() {
    const workspace = createTempWorkspace("aa-durable-bus-");
    const dbPath = join(workspace, "durable-bus.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBusAsync(db, store);
    return { workspace, db, bus };
}
test("DurableEventBusAsync constructor applies default options", () => {
    const workspace = createTempWorkspace("aa-durable-default-");
    const dbPath = join(workspace, "durable-default.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new DurableEventBusAsync(db, store);
        const metrics = bus.getMetrics();
        assert.equal(metrics.totalPublishedEvents, 0);
        assert.equal(metrics.totalDeliveredEvents, 0);
        bus.dispose();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("DurableEventBusAsync constructor applies custom options", () => {
    const workspace = createTempWorkspace("aa-durable-custom-");
    const dbPath = join(workspace, "durable-custom.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new DurableEventBusAsync(db, store, {
            maxDeliveryRetries: 5,
            initialBackoffMs: 200,
            maxBackoffMs: 10000,
            defaultTimeoutMs: 60000,
            maxBatchSize: 100,
            batchingEnabled: true,
        });
        bus.dispose();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("DurableEventBusAsync subscribe adds subscriber", () => {
    const h = createTestBus();
    try {
        let callCount = 0;
        const handler = () => { callCount++; };
        h.bus.subscribe("consumer_1", handler);
        const subscriber = h.bus.getSubscriber("consumer_1");
        assert.ok(subscriber !== undefined);
        assert.equal(subscriber.priority, "normal");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync subscribeHighPriority adds high priority subscriber", () => {
    const h = createTestBus();
    try {
        h.bus.subscribeHighPriority("consumer_high", () => { });
        const subscriber = h.bus.getSubscriber("consumer_high");
        assert.ok(subscriber !== undefined);
        assert.equal(subscriber.priority, "high");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync subscribeLowPriority adds low priority subscriber", () => {
    const h = createTestBus();
    try {
        h.bus.subscribeLowPriority("consumer_low", () => { });
        const subscriber = h.bus.getSubscriber("consumer_low");
        assert.ok(subscriber !== undefined);
        assert.equal(subscriber.priority, "low");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync unsubscribe removes subscriber", () => {
    const h = createTestBus();
    try {
        h.bus.subscribe("consumer_remove", () => { });
        assert.ok(h.bus.getSubscriber("consumer_remove") !== undefined);
        h.bus.unsubscribe("consumer_remove");
        assert.equal(h.bus.getSubscriber("consumer_remove"), undefined);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync getAllSubscribers returns all subscribers", () => {
    const h = createTestBus();
    try {
        h.bus.subscribe("consumer_a", () => { });
        h.bus.subscribe("consumer_b", () => { });
        h.bus.subscribeHighPriority("consumer_c", () => { });
        const all = h.bus.getAllSubscribers();
        assert.equal(all.size, 3);
        assert.ok(all.has("consumer_a"));
        assert.ok(all.has("consumer_b"));
        assert.ok(all.has("consumer_c"));
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync publish emits event_published", async () => {
    const h = createTestBus();
    try {
        let publishedEvent = null;
        h.bus.on("event_published", (event) => { publishedEvent = event; });
        const record = await h.bus.publish({
            eventType: "perf:test_event",
            payload: { message: "hello" },
        });
        assert.ok(record !== null);
        assert.equal(record.eventType, "perf:test_event");
        assert.ok(publishedEvent !== null);
        assert.equal(publishedEvent.eventType, "perf:test_event");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync publish rejects payload exceeding max size", async () => {
    const h = createTestBus();
    try {
        const largePayload = { data: "x".repeat(1_000_001) };
        await assert.rejects(async () => h.bus.publish({
            eventType: "perf:test_event",
            payload: largePayload,
        }), /exceeds maximum/);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync publish throws when circuit breaker is open", async () => {
    const h = createTestBus();
    try {
        // Force circuit breaker open by setting failure state
        h.bus.circuitBreakerOpen = true;
        h.bus.lastFailureTime = Date.now();
        await assert.rejects(async () => h.bus.publish({
            eventType: "perf:test_event",
            payload: { data: "test" },
        }), /Circuit breaker/);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync pendingForConsumer returns pending events", () => {
    const h = createTestBus();
    try {
        h.bus.subscribe("consumer_pending", () => { });
        const pending = h.bus.pendingForConsumer("consumer_pending");
        assert.ok(Array.isArray(pending));
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync pendingForConsumerAsync returns promise", async () => {
    const h = createTestBus();
    try {
        h.bus.subscribe("consumer_async", () => { });
        const pending = await h.bus.pendingForConsumerAsync("consumer_async");
        assert.ok(Array.isArray(pending));
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync getPendingCount returns count", () => {
    const h = createTestBus();
    try {
        h.bus.subscribe("consumer_count", () => { });
        const count = h.bus.getPendingCount("consumer_count");
        assert.equal(typeof count, "number");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync getMetrics returns metrics object", () => {
    const h = createTestBus();
    try {
        const metrics = h.bus.getMetrics();
        assert.ok("totalPublishedEvents" in metrics);
        assert.ok("totalDeliveredEvents" in metrics);
        assert.ok("totalFailedDeliveries" in metrics);
        assert.ok("totalDeadLetteredEvents" in metrics);
        assert.ok("averageDeliveryLatencyMs" in metrics);
        assert.ok("averagePublishLatencyMs" in metrics);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync resetMetrics resets all values", () => {
    const h = createTestBus();
    try {
        h.bus.resetMetrics();
        const metrics = h.bus.getMetrics();
        assert.equal(metrics.totalPublishedEvents, 0);
        assert.equal(metrics.totalDeliveredEvents, 0);
        assert.equal(metrics.totalFailedDeliveries, 0);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync getSyncService returns sync service", () => {
    const h = createTestBus();
    try {
        const syncService = h.bus.getSyncService();
        assert.ok(syncService !== null);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync dispose prevents further operations", () => {
    const h = createTestBus();
    h.bus.dispose();
    assert.throws(() => h.bus.subscribe("after_dispose", () => { }), /disposed/);
    h.db.close();
    cleanupPath(h.workspace);
});
test("DurableEventBusAsync double dispose is safe", () => {
    const h = createTestBus();
    h.bus.dispose();
    h.bus.dispose(); // Should not throw
    h.db.close();
    cleanupPath(h.workspace);
});
test("DurableEventBusAsync emits subscriber_added event", () => {
    const h = createTestBus();
    try {
        let addedEvent = null;
        h.bus.on("subscriber_added", (event) => { addedEvent = event; });
        h.bus.subscribe("new_consumer", () => { });
        assert.ok(addedEvent !== null);
        assert.equal(addedEvent.consumerId, "new_consumer");
        assert.equal(addedEvent.priority, "normal");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync emits subscriber_removed event", () => {
    const h = createTestBus();
    try {
        let removedEvent = null;
        h.bus.on("subscriber_removed", (event) => { removedEvent = event; });
        h.bus.subscribe("remove_me", () => { });
        h.bus.unsubscribe("remove_me");
        assert.ok(removedEvent !== null);
        assert.equal(removedEvent.consumerId, "remove_me");
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("DurableEventBusAsync circuit breaker closes after backoff", async () => {
    const h = createTestBus();
    try {
        let circuitCloseEvent = null;
        h.bus.on("circuit_breaker_close", () => { circuitCloseEvent = true; });
        // Open circuit breaker
        h.bus.circuitBreakerOpen = true;
        h.bus.lastFailureTime = Date.now() - 10000; // 10 seconds ago
        h.bus.failureCount = 5;
        // Should close circuit since maxBackoffMs (5000) has passed
        await h.bus.publish({
            eventType: "perf:test_event",
            payload: { data: "test" },
        });
        assert.equal(h.bus.circuitBreakerOpen, false);
        assert.equal(circuitCloseEvent, true);
    }
    finally {
        h.bus.dispose();
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=durable-event-bus-async.test.js.map
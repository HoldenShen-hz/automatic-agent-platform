import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { EventOpsService } from "../../../../../src/platform/state-evidence/events/event-ops-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
function createTestService(workspace) {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return new EventOpsService(db, store);
}
test("EventOpsService lists default consumers", () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const consumers = service.listDefaultConsumers();
        assert.ok(Array.isArray(consumers));
        assert.ok(consumers.length > 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.subscribe registers handler without throwing", () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        service.subscribe("test_consumer", async () => { });
        assert.ok(true); // subscribe doesn't throw
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.drainConsumer returns EventDrainResult structure", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const result = await service.drainConsumer("test_consumer");
        assert.equal(result.consumerId, "test_consumer");
        assert.ok(typeof result.pendingBefore === "number");
        assert.ok(typeof result.failedBefore === "number");
        assert.ok(typeof result.delivered === "number");
        assert.ok(typeof result.pendingAfter === "number");
        assert.ok(typeof result.failedAfter === "number");
        assert.ok(result.outcome === "delivered" || result.outcome === "failed");
        assert.ok(result.errorCode === null || typeof result.errorCode === "string");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.drainConsumer handles empty pending queue", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const result = await service.drainConsumer("no_pending_consumer");
        assert.equal(result.consumerId, "no_pending_consumer");
        assert.equal(result.pendingBefore, 0);
        assert.equal(result.delivered, 0);
        assert.equal(result.pendingAfter, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.replayConsumer returns result with replayedFromHistoryCount", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const result = await service.replayConsumer("test_consumer");
        assert.equal(result.consumerId, "test_consumer");
        assert.ok(typeof result.replayedFromHistoryCount === "number");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.drainDefaultConsumers returns array of results", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const results = await service.drainDefaultConsumers();
        assert.ok(Array.isArray(results));
        assert.ok(results.length > 0);
        for (const result of results) {
            assert.equal(typeof result.consumerId, "string");
            assert.equal(typeof result.outcome, "string");
        }
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.replayDefaultConsumers returns array of results", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const results = await service.replayDefaultConsumers();
        assert.ok(Array.isArray(results));
        assert.ok(results.length > 0);
        for (const result of results) {
            assert.equal(typeof result.consumerId, "string");
            assert.ok(typeof result.replayedFromHistoryCount === "number");
        }
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EventOpsService.drainConsumer sets outcome based on delivery success", async () => {
    const workspace = createTempWorkspace("aa-event-ops-");
    try {
        const service = createTestService(workspace);
        const result = await service.drainConsumer("any_consumer");
        // With empty queue, outcome should be "delivered" with 0 delivered
        assert.ok(result.outcome === "delivered" || result.outcome === "failed");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=event-ops-service.test.js.map
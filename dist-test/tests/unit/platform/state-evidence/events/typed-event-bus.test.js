import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { getEventSchema } from "../../../../../src/platform/state-evidence/events/event-registry.js";
import { TypedEventBus } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
test("event registry exposes typed schema metadata for registered events", () => {
    const schema = getEventSchema("skill:execution_started");
    assert.equal(schema.payloadSchemaRef, "event://skill/execution_started/v1");
    assert.equal(schema.compatibilityPolicy, "backward_compatible_additive");
    assert.equal(schema.producer, "skill_execution_service");
});
test("event registry exposes plugin isolation event metadata", () => {
    const schema = getEventSchema("plugin:error_isolated");
    assert.equal(schema.payloadSchemaRef, "event://plugin/error_isolated/v1");
    assert.equal(schema.producer, "plugin_spi_registry");
});
test("event registry exposes plugin invocation event metadata", () => {
    const schema = getEventSchema("plugin:invocation_completed");
    assert.equal(schema.payloadSchemaRef, "event://plugin/invocation_completed/v1");
    assert.equal(schema.producer, "plugin_spi_registry");
});
test("typed event bus publishes and filters typed tier1 events", async () => {
    const workspace = createTempWorkspace("aa-typed-event-bus-");
    try {
        const db = new SqliteDatabase(join(workspace, "events.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new TypedEventBus(db, store);
        const seen = [];
        seedTaskAndExecution(db, store, { taskId: "task-typed", executionId: "exec-typed", traceId: "trace-typed" });
        bus.subscribe("inspect_projection", ["decision:requested"], async ({ event, payload }) => {
            seen.push(`${event.eventType}:${String(payload.reason ?? "missing")}`);
        });
        bus.publish({
            eventType: "decision:responded",
            taskId: "task-typed",
            executionId: "exec-typed",
            traceId: "trace-typed",
            payload: {
                approvalId: "approval-typed",
                decisionType: "confirmed",
                confirmed: true,
                respondedBy: "user-1",
                respondedAt: "2026-04-14T00:00:00.000Z",
            },
        });
        bus.publish({
            eventType: "decision:requested",
            taskId: "task-typed",
            executionId: "exec-typed",
            traceId: "trace-typed",
            payload: {
                approvalId: "approval-typed",
                reason: "policy.high_risk",
            },
        });
        await bus.deliverPending("inspect_projection");
        assert.deepEqual(seen, ["decision:requested:policy.high_risk"]);
        assert.equal(bus.pendingForConsumer("inspect_projection").length, 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("typed event bus publishes plugin isolation events", async () => {
    const workspace = createTempWorkspace("aa-plugin-event-bus-");
    try {
        const db = new SqliteDatabase(join(workspace, "events.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new TypedEventBus(db, store);
        bus.publish({
            eventType: "plugin:error_isolated",
            payload: {
                pluginId: "plugin.coding.retriever",
                domainId: "coding",
                spiType: "retriever",
                lifecycleState: "degraded",
                occurredAt: "2026-04-16T00:00:00.000Z",
                reasonCode: "timeout",
                errorMessage: "timed out",
            },
        });
        const events = store.event.listEventsByType("plugin:error_isolated", 5);
        assert.equal(events.length, 1);
        assert.match(events[0]?.payloadJson ?? "", /plugin\.coding\.retriever/);
        assert.match(events[0]?.payloadJson ?? "", /timeout/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("typed event bus publishes plugin invocation audit events", async () => {
    const workspace = createTempWorkspace("aa-plugin-invocation-event-bus-");
    try {
        const db = new SqliteDatabase(join(workspace, "events.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new TypedEventBus(db, store);
        bus.publish({
            eventType: "plugin:invocation_completed",
            payload: {
                pluginId: "plugin.coding.presenter",
                domainId: "coding",
                spiType: "presenter",
                phase: "present",
                invocationId: "plugin_invocation_1",
                lifecycleState: "active",
                runtimeIsolation: "serialized_in_process",
                activeInvocationCount: 0,
                queuedInvocationCount: 0,
                occurredAt: "2026-04-16T00:00:00.000Z",
                status: "completed",
                durationMs: 12,
            },
        });
        const events = store.event.listEventsByType("plugin:invocation_completed", 5);
        assert.equal(events.length, 1);
        assert.match(events[0]?.payloadJson ?? "", /plugin_invocation_1/);
        assert.match(events[0]?.payloadJson ?? "", /serialized_in_process/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("typed event bus delivers subscribed tier2 events without ack replay", async () => {
    const workspace = createTempWorkspace("aa-tier2-direct-delivery-");
    try {
        const db = new SqliteDatabase(join(workspace, "events.db"));
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const bus = new TypedEventBus(db, store);
        const seen = [];
        bus.subscribe("feedback_projection", ["plugin:error_isolated"], async ({ payload }) => {
            seen.push(`${payload.pluginId}:${payload.lifecycleState}`);
        });
        bus.publish({
            eventType: "plugin:error_isolated",
            payload: {
                pluginId: "plugin.coding.retriever",
                domainId: "coding",
                spiType: "retriever",
                lifecycleState: "degraded",
                occurredAt: "2026-04-16T00:00:00.000Z",
                reasonCode: "timeout",
                errorMessage: "timed out",
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 25));
        assert.deepEqual(seen, ["plugin.coding.retriever:degraded"]);
        assert.equal(bus.pendingForConsumer("feedback_projection").length, 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=typed-event-bus.test.js.map
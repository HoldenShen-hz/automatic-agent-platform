import assert from "node:assert/strict";
import test from "node:test";
test("DomainEventPayload accepts all event types", () => {
    const eventTypes = [
        "domain.registered",
        "domain.activated",
        "domain.deactivated",
        "domain.degraded",
        "domain.disabled",
        "domain.error",
    ];
    for (const eventType of eventTypes) {
        const payload = {
            eventId: "evt_1",
            eventType,
            domainId: "coding",
            domainName: "Coding",
            occurredAt: Date.now(),
            actor: { type: "system", id: "system" },
            data: {},
        };
        assert.equal(payload.eventType, eventType);
    }
});
test("DomainEventPayload accepts all actor types", () => {
    const actorTypes = ["system", "operator", "plugin", "user"];
    for (const type of actorTypes) {
        const actor = { type, id: `${type}_1` };
        assert.equal(actor.type, type);
    }
});
test("DomainEventPayload stores error data for error events", () => {
    const payload = {
        eventId: "evt_err",
        eventType: "domain.error",
        domainId: "coding",
        domainName: "Coding",
        occurredAt: Date.now(),
        actor: { type: "operator", id: "op_1" },
        data: {
            errorMessage: "Plugin failed to load",
            errorCode: "PLUGIN_LOAD_FAILED",
            affectedPlugins: ["plugin_bad"],
            metadata: { reason: "missing_dep" },
        },
    };
    assert.equal(payload.data.errorMessage, "Plugin failed to load");
    assert.equal(payload.data.errorCode, "PLUGIN_LOAD_FAILED");
    assert.deepEqual(payload.data.affectedPlugins, ["plugin_bad"]);
});
test("DomainEventPayload stores status change data", () => {
    const payload = {
        eventId: "evt_status",
        eventType: "domain.deactivated",
        domainId: "coding",
        domainName: "Coding",
        occurredAt: Date.now(),
        actor: { type: "operator", id: "op_1" },
        data: {
            previousStatus: "active",
            newStatus: "inactive",
        },
    };
    assert.equal(payload.data.previousStatus, "active");
    assert.equal(payload.data.newStatus, "inactive");
});
test("DomainEventPayload supports optional metadata", () => {
    const payload = {
        eventId: "evt_meta",
        eventType: "domain.registered",
        domainId: "coding",
        domainName: "Coding",
        occurredAt: Date.now(),
        actor: { type: "system", id: "bootstrap" },
        data: {
            metadata: {
                version: "1.0",
                registeredBy: "admin",
                flags: ["beta", "experimental"],
            },
        },
    };
    assert.equal(payload.data.metadata?.version, "1.0");
    assert.deepEqual(payload.data.metadata?.flags, ["beta", "experimental"]);
});
test("DomainEventPayload allows empty data object", () => {
    const payload = {
        eventId: "evt_empty",
        eventType: "domain.registered",
        domainId: "coding",
        domainName: "Coding",
        occurredAt: Date.now(),
        actor: { type: "system", id: "system" },
        data: {},
    };
    assert.deepEqual(payload.data, {});
});
//# sourceMappingURL=domain-event-payload.test.js.map
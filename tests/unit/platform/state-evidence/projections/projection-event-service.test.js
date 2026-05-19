import assert from "node:assert/strict";
import test from "node:test";
import { EventProjectionService } from "../../../../../src/platform/state-evidence/projections/index.js";
// =============================================================================
// mock factories
// =============================================================================
function createEvent(overrides = {}) {
    return {
        eventId: "evt_test_1",
        eventType: "task:created",
        taskId: "task_001",
        payloadJson: '{"status":"created","priority":1}',
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}
// =============================================================================
// EventProjectionService.applyEvent
// =============================================================================
test("EventProjectionService.applyEvent creates projection from new event", () => {
    const service = new EventProjectionService();
    const event = createEvent({ eventId: "evt_new", eventType: "task:created" });
    const projection = service.applyEvent(event);
    assert.equal(projection.projectionName, "event_summary");
    assert.equal(projection.entityRef, "task_001");
    assert.equal(projection.sourceEventId, "evt_new");
    assert.ok(projection.projectionId != null);
});
test("EventProjectionService.applyEvent uses taskId from payload when event.taskId is null", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_payload_task",
        taskId: null,
        payloadJson: '{"taskId":"task_from_payload"}',
    });
    const projection = service.applyEvent(event);
    assert.equal(projection.entityRef, "task_from_payload");
});
test("EventProjectionService.applyEvent uses entityRef from payload when taskId is null", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_entity_ref",
        taskId: null,
        payloadJson: '{"entityRef":"entity_from_payload"}',
    });
    const projection = service.applyEvent(event);
    assert.equal(projection.entityRef, "entity_from_payload");
});
test("EventProjectionService.applyEvent falls back to eventId when no taskId or entityRef", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_fallback_id",
        taskId: null,
        payloadJson: '{"value":123}',
    });
    const projection = service.applyEvent(event);
    assert.equal(projection.entityRef, "evt_fallback_id");
});
test("EventProjectionService.applyEvent updates existing projection for same entity", () => {
    const service = new EventProjectionService();
    const event1 = createEvent({ eventId: "evt_first", eventType: "task:created" });
    const event2 = createEvent({ eventId: "evt_second", eventType: "task:status_changed" });
    const projection1 = service.applyEvent(event1);
    const projection2 = service.applyEvent(event2);
    assert.equal(projection2.projectionId, projection1.projectionId);
    assert.equal(projection2.sourceEventId, "evt_second");
});
test("EventProjectionService.applyEvent maps workflow: event types to workflow_summary", () => {
    const service = new EventProjectionService();
    const event = createEvent({ eventType: "workflow:step_completed" });
    const projection = service.applyEvent(event);
    assert.equal(projection.projectionName, "workflow_summary");
});
test("EventProjectionService.applyEvent maps approval: event types to approval_summary", () => {
    const service = new EventProjectionService();
    const event = createEvent({ eventType: "approval:requested" });
    const projection = service.applyEvent(event);
    assert.equal(projection.projectionName, "approval_summary");
});
test("EventProjectionService.applyEvent maps incident: event types to incident_summary", () => {
    const service = new EventProjectionService();
    const event = createEvent({ eventType: "incident:opened" });
    const projection = service.applyEvent(event);
    assert.equal(projection.projectionName, "incident_summary");
});
test("EventProjectionService.applyEvent stores parsed payload in state", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_parse",
        payloadJson: '{"priority":99,"name":"test"}',
    });
    const projection = service.applyEvent(event);
    const lastPayload = projection.state.lastPayload;
    assert.equal(lastPayload.priority, 99);
    assert.equal(lastPayload.name, "test");
});
test("EventProjectionService.applyEvent handles invalid JSON in payload gracefully", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_bad_json",
        payloadJson: "not valid json{{{",
    });
    const projection = service.applyEvent(event);
    assert.deepEqual(projection.state.lastPayload, { raw: "not valid json{{{" });
});
test("EventProjectionService.applyEvent handles non-object JSON payload", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_primitive",
        payloadJson: "12345",
    });
    const projection = service.applyEvent(event);
    assert.deepEqual(projection.state.lastPayload, { value: 12345 });
});
test("EventProjectionService.applyEvent stores lastEventAt timestamp", () => {
    const service = new EventProjectionService();
    const event = createEvent({
        eventId: "evt_timestamp",
        createdAt: "2026-04-24T12:00:00.000Z",
    });
    const projection = service.applyEvent(event);
    assert.equal(projection.state.lastEventAt, "2026-04-24T12:00:00.000Z");
});
test("EventProjectionService.applyEvent accumulates eventType in state", () => {
    const service = new EventProjectionService();
    const event1 = createEvent({ eventId: "evt_type1", eventType: "task:created" });
    const event2 = createEvent({ eventId: "evt_type2", eventType: "task:updated" });
    service.applyEvent(event1);
    const projection2 = service.applyEvent(event2);
    assert.equal(projection2.state.eventType, "task:updated");
});
test("EventProjectionService.applyEvent updates timestamp on each apply", () => {
    const service = new EventProjectionService();
    const event1 = createEvent({ eventId: "evt_t1", createdAt: "2026-01-01T00:00:00.000Z" });
    const event2 = createEvent({ eventId: "evt_t2", createdAt: "2026-04-24T12:00:00.000Z" });
    const p1 = service.applyEvent(event1);
    const p2 = service.applyEvent(event2);
    // updatedAt uses nowIso() which may have same millisecond timestamp
    // so we verify p2 is not before p1
    assert.ok(p2.updatedAt >= p1.updatedAt);
});
// =============================================================================
// EventProjectionService.getProjection
// =============================================================================
test("EventProjectionService.getProjection returns null for unknown projection", () => {
    const service = new EventProjectionService();
    const result = service.getProjection("unknown_projection", "entity_ref");
    assert.equal(result, null);
});
test("EventProjectionService.getProjection returns projection by name and entity", () => {
    const service = new EventProjectionService();
    const event = createEvent({ taskId: "task_find" });
    service.applyEvent(event);
    const result = service.getProjection("event_summary", "task_find");
    assert.ok(result != null);
    assert.equal(result.projectionName, "event_summary");
    assert.equal(result.entityRef, "task_find");
});
// =============================================================================
// EventProjectionService.listProjections
// =============================================================================
test("EventProjectionService.listProjections returns empty array initially", () => {
    const service = new EventProjectionService();
    const results = service.listProjections();
    assert.equal(results.length, 0);
});
test("EventProjectionService.listProjections returns all projections", () => {
    const service = new EventProjectionService();
    service.applyEvent(createEvent({ eventId: "evt_a", taskId: "task_a" }));
    service.applyEvent(createEvent({ eventId: "evt_b", taskId: "task_b" }));
    service.applyEvent(createEvent({ eventId: "evt_c", taskId: "task_c" }));
    const results = service.listProjections();
    assert.equal(results.length, 3);
});
test("EventProjectionService.listProjections returns updated projections after subsequent events", () => {
    const service = new EventProjectionService();
    service.applyEvent(createEvent({ eventId: "evt_dup", taskId: "task_dup" }));
    service.applyEvent(createEvent({ eventId: "evt_dup2", taskId: "task_dup" }));
    const results = service.listProjections();
    // Should still be 1 projection (updated, not duplicated)
    assert.equal(results.length, 1);
    assert.equal(results[0].sourceEventId, "evt_dup2");
});
//# sourceMappingURL=projection-event-service.test.js.map
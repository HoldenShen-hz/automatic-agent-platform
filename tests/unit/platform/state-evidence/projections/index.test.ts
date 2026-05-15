import assert from "node:assert/strict";
import test from "node:test";

import { EventProjectionService } from "../../../../../src/platform/five-plane-state-evidence/projections/index.js";

test("EventProjectionService creates and updates workflow projections from events", () => {
  const service = new EventProjectionService();
  const created = service.applyEvent({
    eventId: "evt_1",
    eventType: "workflow:planned",
    taskId: "task_1",
    payloadJson: JSON.stringify({ workflowId: "wf_1" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const updated = service.applyEvent({
    eventId: "evt_2",
    eventType: "workflow:step_completed",
    taskId: "task_1",
    payloadJson: JSON.stringify({ stepId: "step_1" }),
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  assert.equal(created.projectionName, "workflow_summary");
  assert.equal(updated.entityRef, "task_1");
  assert.equal(service.getProjection("workflow_summary", "task_1")?.sourceEventId, "evt_2");
});

test("EventProjectionService.getProjection returns null for non-existent projection", () => {
  const service = new EventProjectionService();
  assert.equal(service.getProjection("workflow_summary", "non_existent"), null);
});

test("EventProjectionService.getProjection returns null for unknown projection name", () => {
  const service = new EventProjectionService();
  service.applyEvent({
    eventId: "evt_1",
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(service.getProjection("unknown_projection", "task_1"), null);
});

test("EventProjectionService.listProjections returns all projections", () => {
  const service = new EventProjectionService();
  service.applyEvent({
    eventId: "evt_1",
    eventType: "workflow:planned",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  service.applyEvent({
    eventId: "evt_2",
    eventType: "task:created",
    taskId: "task_2",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  const projections = service.listProjections();
  assert.equal(projections.length, 2);
});

test("EventProjectionService applies approval events with approval_summary projection", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_approval_1",
    eventType: "approval:requested",
    taskId: "task_approval_1",
    payloadJson: JSON.stringify({ approvalId: "apr_1" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.projectionName, "approval_summary");
  assert.equal(result.entityRef, "task_approval_1");
});

test("EventProjectionService applies incident events with incident_summary projection", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_incident_1",
    eventType: "incident:created",
    taskId: "task_incident_1",
    payloadJson: JSON.stringify({ incidentId: "inc_1" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.projectionName, "incident_summary");
  assert.equal(result.entityRef, "task_incident_1");
});

test("EventProjectionService applies generic events with event_summary projection", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_generic_1",
    eventType: "some:random_event",
    taskId: null,
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.projectionName, "event_summary");
});

test("EventProjectionService uses entityRef from payload when taskId is null", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_1",
    eventType: "task:created",
    taskId: null,
    payloadJson: JSON.stringify({ entityRef: "entity_abc" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.entityRef, "entity_abc");
});

test("EventProjectionService uses taskId from payload when taskId and entityRef are null", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_1",
    eventType: "task:created",
    taskId: null,
    payloadJson: JSON.stringify({ taskId: "task_from_payload" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.entityRef, "task_from_payload");
});

test("EventProjectionService uses eventId when taskId, entityRef, and payload.taskId are all null", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_fallback_123",
    eventType: "task:created",
    taskId: null,
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.entityRef, "evt_fallback_123");
});

test("EventProjectionService state accumulates previous state", () => {
  const service = new EventProjectionService();
  const first = service.applyEvent({
    eventId: "evt_1",
    eventType: "task:created",
    taskId: "task_state",
    payloadJson: JSON.stringify({ status: "created" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const updated = service.applyEvent({
    eventId: "evt_2",
    eventType: "task:status_changed",
    taskId: "task_state",
    payloadJson: JSON.stringify({ status: "running" }),
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  // Verify the returned record has correct sourceEventId
  assert.equal(updated.sourceEventId, "evt_2");
  assert.equal(updated.state.eventType, "task:status_changed");

  // Verify the projection was stored correctly
  const projection = service.getProjection("event_summary", "task_state");
  assert.notEqual(projection, null);
  if (projection) {
    assert.equal(projection.sourceEventId, "evt_2");
    assert.equal(projection.state.eventType, "task:status_changed");
  }
});

test("EventProjectionService applies events with invalid JSON payload", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_invalid_json",
    eventType: "task:created",
    taskId: "task_invalid",
    payloadJson: "not valid json {{{",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.projectionName, "event_summary");
  const state = result.state.lastPayload as Record<string, unknown>;
  assert.deepEqual(state, { raw: "not valid json {{{" });
});

test("EventProjectionService applies events with null payload", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_null_payload",
    eventType: "task:created",
    taskId: "task_null",
    payloadJson: "null",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  const state = result.state.lastPayload as Record<string, unknown>;
  assert.deepEqual(state, { value: null });
});

test("EventProjectionService applies events with array payload", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_array_payload",
    eventType: "task:created",
    taskId: "task_array",
    payloadJson: JSON.stringify([1, 2, 3]),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  const state = result.state.lastPayload as Record<string, unknown>;
  assert.deepEqual(state, { value: [1, 2, 3] });
});

test("EventProjectionService applies events with primitive payload", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_primitive",
    eventType: "task:created",
    taskId: "task_prim",
    payloadJson: JSON.stringify("just a string"),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  const state = result.state.lastPayload as Record<string, unknown>;
  assert.deepEqual(state, { value: "just a string" });
});

test("EventProjectionService generates new projectionId for new entity", () => {
  const service = new EventProjectionService();
  const result = service.applyEvent({
    eventId: "evt_new_1",
    eventType: "task:created",
    taskId: "task_new",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  assert.ok(result.projectionId.startsWith("projection_"));
});

test("EventProjectionService preserves projectionId on subsequent events", () => {
  const service = new EventProjectionService();
  const first = service.applyEvent({
    eventId: "evt_first",
    eventType: "task:created",
    taskId: "task_same",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const second = service.applyEvent({
    eventId: "evt_second",
    eventType: "task:status_changed",
    taskId: "task_same",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  assert.equal(first.projectionId, second.projectionId);
});

test("EventProjectionService sets updatedAt timestamp", () => {
  const service = new EventProjectionService();
  const first = service.applyEvent({
    eventId: "evt_time_1",
    eventType: "task:created",
    taskId: "task_time",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const second = service.applyEvent({
    eventId: "evt_time_2",
    eventType: "task:status_changed",
    taskId: "task_time",
    payloadJson: "{}",
    createdAt: "2026-04-21T00:00:00.000Z",
  });

  // updatedAt should be a valid ISO timestamp string (set by nowIso at runtime)
  assert.ok(first.updatedAt.includes("T"), "updatedAt should be ISO format");
  assert.ok(second.updatedAt.includes("T"), "updatedAt should be ISO format");
  // The second event's lastEventAt should be from the event, not updatedAt
  assert.equal(second.state.lastEventAt, "2026-04-21T00:00:00.000Z");
});

test("EventProjectionService stores lastPayload from event", () => {
  const service = new EventProjectionService();
  const payload = { key: "value", nested: { a: 1 } };
  service.applyEvent({
    eventId: "evt_payload",
    eventType: "task:created",
    taskId: "task_payload",
    payloadJson: JSON.stringify(payload),
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  const projection = service.getProjection("event_summary", "task_payload");
  assert.deepEqual(projection?.state.lastPayload, payload);
});

test("EventProjectionService stores lastEventAt timestamp in state", () => {
  const service = new EventProjectionService();
  const eventTime = "2026-04-20T12:30:00.000Z";
  service.applyEvent({
    eventId: "evt_time_at",
    eventType: "task:created",
    taskId: "task_time_at",
    payloadJson: "{}",
    createdAt: eventTime,
  });

  const projection = service.getProjection("event_summary", "task_time_at");
  assert.equal(projection?.state.lastEventAt, eventTime);
});

test("EventProjectionService stores eventType in state", () => {
  const service = new EventProjectionService();
  service.applyEvent({
    eventId: "evt_type_store",
    eventType: "task:completed",
    taskId: "task_type",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });

  const projection = service.getProjection("event_summary", "task_type");
  assert.equal(projection?.state.eventType, "task:completed");
});

test("EventProjectionService handles multiple different entity projections", () => {
  const service = new EventProjectionService();
  service.applyEvent({
    eventId: "evt_multi_1",
    eventType: "workflow:planned",
    taskId: "workflow_1",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  service.applyEvent({
    eventId: "evt_multi_2",
    eventType: "approval:requested",
    taskId: "approval_1",
    payloadJson: "{}",
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  const all = service.listProjections();
  assert.equal(all.length, 2);
  const names = all.map(p => p.projectionName).sort();
  assert.deepEqual(names, ["approval_summary", "workflow_summary"]);
});

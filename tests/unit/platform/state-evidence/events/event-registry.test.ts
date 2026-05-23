import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_SCHEMA_REGISTRY,
  hasEventSchema,
  getRegisteredConsumers,
  getEventSchema,
  getEventReplayMetadata,
  isCanonicalEventName,
  validateEventPayload,
  type EventSchemaDefinition,
  type KnownEventType,
} from "../../../../../src/platform/five-plane-state-evidence/events/event-registry.js";

test("EVENT_SCHEMA_REGISTRY contains known event types", () => {
  assert.ok(EVENT_SCHEMA_REGISTRY["task:status_changed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["workflow:step_completed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["decision:requested"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["stream:chunk_emitted"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["domain:registered"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:error_isolated"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:invocation_started"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["plugin:invocation_completed"]);
  assert.ok(EVENT_SCHEMA_REGISTRY["knowledge:chunk_indexed"]);
});

test("hasEventSchema returns true for known event types", () => {
  assert.equal(hasEventSchema("task:status_changed"), true);
  assert.equal(hasEventSchema("workflow:step_completed"), true);
  assert.equal(hasEventSchema("decision:requested"), true);
});

test("hasEventSchema returns false for unknown event types", () => {
  assert.equal(hasEventSchema("unknown:event"), false);
  assert.equal(hasEventSchema(""), false);
  assert.equal(hasEventSchema("task:not_registered"), false);
});

test("getRegisteredConsumers returns consumers for known event", () => {
  const consumers = getRegisteredConsumers("task:status_changed");
  assert.ok(Array.isArray(consumers));
  assert.ok(consumers.length > 0);
});

test("domain and plugin lifecycle events declare feedback projection consumers", () => {
  assert.ok(getRegisteredConsumers("domain:registered").includes("feedback_projection"));
  assert.ok(getRegisteredConsumers("plugin:error_isolated").includes("feedback_projection"));
  assert.ok(getRegisteredConsumers("knowledge:chunk_indexed").includes("feedback_projection"));
});

test("getRegisteredConsumers returns empty array for unknown event", () => {
  const consumers = getRegisteredConsumers("unknown:event");
  assert.deepEqual(consumers, []);
});

test("getEventSchema returns schema for known event", () => {
  const schema = getEventSchema("task:status_changed");
  assert.equal(schema.type, "task:status_changed");
  assert.ok(schema.tier);
  assert.ok(schema.producer);
  assert.ok(Array.isArray(schema.consumers));
});

test("runtime platform events expose replay metadata and synthesized registry schema", () => {
  assert.equal(hasEventSchema("platform.harness_run.status_changed"), true);

  const schema = getEventSchema("platform.harness_run.status_changed");
  const metadata = getEventReplayMetadata("platform.harness_run.status_changed");

  assert.equal(schema.producer, "runtime-state-machine");
  assert.equal(metadata.sourceOfTruth, "platform");
  assert.equal(metadata.replayBehavior, "replay_as_fact");
  assert.equal(metadata.consumerContractTests.includes("runtime-state-machine.test.ts"), true);
});

test("getEventSchema throws ValidationError for unknown event", () => {
  assert.throws(
    () => getEventSchema("unknown:event"),
    (error: any) => {
      return error.code === "event.schema_missing" && error.message.includes("unknown:event");
    }
  );
});

test("KnownEventType includes tier_1 events", () => {
  const tier1Events: KnownEventType[] = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
    "decision:responded",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
  ];
  for (const event of tier1Events) {
    const schema = EVENT_SCHEMA_REGISTRY[event];
    assert.equal(schema.tier, "tier_1", `${event} should be tier_1`);
  }
});

test("KnownEventType includes tier_2 events", () => {
  const tier2Events: KnownEventType[] = [
    "dispatch:ticket_created",
    "dispatch:ticket_claimed",
    "worker:claim_accepted",
    "takeover:session_opened",
    "recovery:repair_applied",
    "skill:execution_started",
    "domain:registered",
    "plugin:error_isolated",
    "plugin:invocation_started",
    "knowledge:chunk_indexed",
  ];
  for (const event of tier2Events) {
    const schema = EVENT_SCHEMA_REGISTRY[event];
    assert.equal(schema.tier, "tier_2", `${event} should be tier_2`);
  }
});

test("KnownEventType includes tier_3 events", () => {
  const schema = EVENT_SCHEMA_REGISTRY["stream:chunk_emitted"];
  assert.equal(schema.tier, "tier_3");
});

test("EventSchemaDefinition has correct structure for tier_1 events", () => {
  const schema: EventSchemaDefinition = EVENT_SCHEMA_REGISTRY["task:status_changed"];
  assert.equal(schema.type, "task:status_changed");
  assert.equal(schema.tier, "tier_1");
  assert.ok(typeof schema.producer === "string");
  assert.ok(Array.isArray(schema.consumers));
  assert.ok(typeof schema.payloadSchemaRef === "string");
  assert.ok(schema.compatibilityPolicy === "backward_compatible_additive" || schema.compatibilityPolicy === "versioned_breaking_change");
});

test("All tier_1 events have required consumers", () => {
  const tier1Events = [
    "task:status_changed",
    "workflow:step_completed",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
  ];
  for (const event of tier1Events) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.length > 0, `${event} should have required consumers`);
  }
});

test("All events have payloadSchemaRef in correct format", () => {
  for (const [eventType, schema] of Object.entries(EVENT_SCHEMA_REGISTRY)) {
    assert.ok(schema.payloadSchemaRef.startsWith("event://"), `${eventType} should have event:// payload schema ref`);
    assert.ok(schema.payloadSchemaRef.endsWith("/v1"), `${eventType} should end with /v1`);
  }
});

test("getRegisteredConsumers is case-sensitive", () => {
  // Event types are lowercase with colons
  const consumers1 = getRegisteredConsumers("task:status_changed");
  const consumers2 = getRegisteredConsumers("Task:Status_Changed");
  assert.ok(consumers1.length !== consumers2.length || JSON.stringify(consumers1) !== JSON.stringify(consumers2));
});

test("validateEventPayload returns data for valid payload", () => {
  const payload = { fromStatus: "queued", toStatus: "in_progress" };
  const result = validateEventPayload("task:status_changed", payload);
  assert.equal(result.fromStatus, "queued");
  assert.equal(result.toStatus, "in_progress");
});

test("validateEventPayload throws ValidationError for invalid payload", () => {
  // Missing required fromStatus and toStatus fields
  const invalidPayload = { wrongField: "value" };
  assert.throws(
    () => validateEventPayload("task:status_changed", invalidPayload),
    (error: any) => {
      return error.code === "event.payload_invalid" && error.message.includes("task:status_changed");
    }
  );
});

test("validateEventPayload throws ValidationError for unknown event type", () => {
  const payload = { fromStatus: "queued", toStatus: "in_progress" };
  assert.throws(
    () => validateEventPayload("unknown:event_type", payload),
    (error: any) => {
      return error.code === "event.schema_missing" && error.message.includes("unknown:event_type");
    }
  );
});

test("validateEventPayload uses generic schema for events without specific validator", () => {
  // perf:test_event uses genericEventPayloadSchema (Record<string, unknown>)
  const result = validateEventPayload("perf:test_event", { anyField: "anyValue", num: 123 });
  assert.equal(result.anyField, "anyValue");
  assert.equal(result.num, 123);
});

test("validateEventPayload rejects subtask payload missing both stepId and subtaskId", () => {
  // subtaskOutcomePayloadSchema requires at least one of stepId or subtaskId
  const invalidPayload = { roleId: "agent", status: "completed" };
  assert.throws(
    () => validateEventPayload("subtask:completed", invalidPayload),
    (error: any) => {
      return error.code === "event.payload_invalid" && error.message.includes("subtask:completed");
    }
  );
});

test("isCanonicalEventName enforces dot-separated lowercase canonical event names", () => {
  assert.equal(isCanonicalEventName("oapeflir.stage.completed"), true);
  assert.equal(isCanonicalEventName("plugin.critical_cve.detected"), true);
  assert.equal(isCanonicalEventName("tool.schemaValidationFailed"), false);
  assert.equal(isCanonicalEventName("plugin-critical-cve.detected"), false);
  assert.equal(isCanonicalEventName("connector..egress.denied"), false);
  assert.equal(isCanonicalEventName("task:status_changed"), false);
});

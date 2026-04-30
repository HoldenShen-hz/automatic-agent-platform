/**
 * Unit tests for EventRegistry - Issue #2034
 *
 * Tests that verify getRegisteredConsumers handles edge cases without crashing.
 * Issue #2034: event-registry.ts:670-675 - getRegisteredConsumers undefined type dereference crash
 *
 * The bug was that when an event type was found in RUNTIME_EVENT_REPLAY_METADATA but
 * had no registered consumers in the metadata, the code would try to call consumers
 * on undefined or crash when trying to get the schema.
 *
 * These tests verify:
 * - getRegisteredConsumers returns empty array for unknown event types (not crash)
 * - getRegisteredConsumers handles RUNTIME_EVENT_REPLAY_METADATA events correctly
 * - getRegisteredConsumers handles events with no required consumers
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_SCHEMA_REGISTRY,
  RUNTIME_EVENT_REPLAY_METADATA,
  getRegisteredConsumers,
  getEventSchema,
  hasEventSchema,
  type KnownEventType,
} from "../../../../../src/platform/state-evidence/events/event-registry.js";

test("getRegisteredConsumers returns empty array for unknown event type - Issue #2034", () => {
  // This should NOT throw an error or crash - should return empty array
  const result = getRegisteredConsumers("completely:unknown:event:type");
  assert.deepEqual(result, [], "Should return empty array for unknown event type");
  assert.ok(Array.isArray(result), "Result should be an array");
});

test("getRegisteredConsumers returns empty array for unregistered platform event", () => {
  // Even though it "hasEventSchema" might return true via RUNTIME_EVENT_REPLAY_METADATA
  // getRegisteredConsumers should handle this gracefully
  const unknownPlatformEvent = "platform.unknown_platform_event_test";
  const hasSchema = hasEventSchema(unknownPlatformEvent);
  if (hasSchema) {
    const consumers = getRegisteredConsumers(unknownPlatformEvent);
    assert.ok(Array.isArray(consumers));
  }
});

test("getRegisteredConsumers handles event types in RUNTIME_EVENT_REPLAY_METADATA only", () => {
  // oapeflir.view.run_lifecycle is in RUNTIME_EVENT_REPLAY_METADATA
  // but also has a schema in EVENT_SCHEMA_REGISTRY
  const result = getRegisteredConsumers("oapeflir.view.run_lifecycle");
  assert.ok(Array.isArray(result), "Should return an array for oapeflir event");
  assert.ok(result.length > 0, "oapeflir event should have consumers");
});

test("getRegisteredConsumers handles perf events with empty consumers", () => {
  // perf:test_event has empty consumers array in the schema
  const result = getRegisteredConsumers("perf:test_event");
  assert.deepEqual(result, [], "perf events should have empty consumers");
});

test("getRegisteredConsumers handles perf burst event", () => {
  const result = getRegisteredConsumers("perf:burst_event");
  assert.deepEqual(result, [], "perf burst events should have empty consumers");
});

test("getRegisteredConsumers handles test:capacity event", () => {
  const result = getRegisteredConsumers("test:capacity");
  assert.deepEqual(result, [], "test capacity events should have empty consumers");
});

test("getRegisteredConsumers handles test:many_events event", () => {
  const result = getRegisteredConsumers("test:many_events");
  assert.deepEqual(result, [], "test many events should have empty consumers");
});

test("getRegisteredConsumers handles event type with only inspect_projection consumer", () => {
  // dispatch events only have inspect_projection
  const result = getRegisteredConsumers("dispatch:ticket_created");
  assert.ok(Array.isArray(result));
  assert.ok(result.includes("inspect_projection"), "dispatch events should have inspect_projection");
});

test("getRegisteredConsumers handles legacy event types from LEGACY_EVENT_SCHEMA_REGISTRY", () => {
  // These come from LEGACY_EVENT_SCHEMA_REGISTRY
  const legacyEvents = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
    "decision:responded",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
    "stream:chunk_emitted",
  ];

  for (const event of legacyEvents) {
    const result = getRegisteredConsumers(event);
    assert.ok(Array.isArray(result), `${event} should return an array`);
    if (event !== "stream:chunk_emitted") {
      assert.ok(result.length > 0, `${event} should have consumers`);
    }
  }
});

test("getRegisteredConsumers handles canonical runtime events", () => {
  const runtimeEvents = [
    "platform.request_envelope.admitted",
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.side_effect.status_changed",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.graph_scheduler.decision_recorded",
  ];

  for (const event of runtimeEvents) {
    const result = getRegisteredConsumers(event);
    assert.ok(Array.isArray(result), `${event} should return an array`);
    assert.ok(result.length > 0, `${event} should have consumers`);
  }
});

test("getRegisteredConsumers is safe to call with empty string", () => {
  const result = getRegisteredConsumers("");
  assert.deepEqual(result, [], "Empty string should return empty array");
});

test("getRegisteredConsumers is safe to call with special characters", () => {
  const result = getRegisteredConsumers("!@#$%^&*()");
  assert.deepEqual(result, [], "Special characters should return empty array");
});

test("getRegisteredConsumers handles events with only truth_projector and audit_projection", () => {
  // Events with sourceOfTruth = "platform" should get these defaults
  const schema = getEventSchema("platform.harness_run.status_changed");
  assert.ok(schema.consumers.includes("truth_projector"));
  assert.ok(schema.consumers.includes("audit_projection"));
});

test("getRegisteredConsumers handles events with oapeflir_projection consumer", () => {
  // Events with sourceOfTruth = "projection" should get oapeflir_projection
  const schema = getEventSchema("oapeflir.view.run_lifecycle");
  assert.ok(schema.consumers.includes("oapeflir_projection"));
});

test("hasEventSchema returns true for events in RUNTIME_EVENT_REPLAY_METADATA", () => {
  // oapeflir events are only in RUNTIME_EVENT_REPLAY_METADATA
  assert.equal(hasEventSchema("oapeflir.decision.recorded"), true);
  assert.equal(hasEventSchema("oapeflir.phase.transition"), true);
  assert.equal(hasEventSchema("oapeflir.view.run_lifecycle"), true);
});

test("hasEventSchema returns true for platform events", () => {
  assert.equal(hasEventSchema("platform.harness_run.created"), true);
  assert.equal(hasEventSchema("platform.node_run.created"), true);
  assert.equal(hasEventSchema("platform.side_effect.triggered"), true);
  assert.equal(hasEventSchema("platform.budget.reserved"), true);
});

test("hasEventSchema returns false for completely unknown events", () => {
  assert.equal(hasEventSchema("unknown:completely:fake:event"), false);
  assert.equal(hasEventSchema(""), false);
});

test("RUNTIME_EVENT_REPLAY_METADATA entries have proper structure", () => {
  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(typeof metadata.eventType === "string", `${eventType} should have eventType`);
    assert.ok(typeof metadata.sourceOfTruth === "string", `${eventType} should have sourceOfTruth`);
    assert.ok(typeof metadata.replayable === "boolean", `${eventType} should have replayable`);
    assert.ok(typeof metadata.sideEffectSafeToReplay === "boolean", `${eventType} should have sideEffectSafeToReplay`);
    assert.ok(typeof metadata.schemaOwner === "string", `${eventType} should have schemaOwner`);
    assert.ok(typeof metadata.replayBehavior === "string", `${eventType} should have replayBehavior`);
    assert.ok(Array.isArray(metadata.consumerContractTests), `${eventType} should have consumerContractTests array`);
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA replayBehavior values are valid", () => {
  const validBehaviors = ["replay_as_fact", "skip_side_effect", "simulate", "forbidden"] as const;

  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(
      validBehaviors.includes(metadata.replayBehavior as typeof validBehaviors[number]),
      `${eventType} has invalid replayBehavior: ${metadata.replayBehavior}`
    );
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA sourceOfTruth values are valid", () => {
  const validSources = ["platform", "projection"] as const;

  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(
      validSources.includes(metadata.sourceOfTruth as typeof validSources[number]),
      `${eventType} has invalid sourceOfTruth: ${metadata.sourceOfTruth}`
    );
  }
});

test("No event type in RUNTIME_EVENT_REPLAY_METADATA should have undefined consumers path - Issue #2034", () => {
  // This is the core issue - when getEventSchema is called for a RUNTIME_EVENT_REPLAY_METADATA
  // event that doesn't have explicit consumers, it should not crash
  const eventsOnlyInReplayMetadata = Object.keys(RUNTIME_EVENT_REPLAY_METADATA).filter(
    (type) => !(type in EVENT_SCHEMA_REGISTRY)
  );

  for (const eventType of eventsOnlyInReplayMetadata) {
    // This should NOT throw
    const result = getRegisteredConsumers(eventType);
    assert.ok(Array.isArray(result), `${eventType} should return an array`);
  }
});

test("Plugin events have feedback_projection consumer", () => {
  const pluginEvents = [
    "plugin:spi_registered",
    "plugin:activated",
    "plugin:error_isolated",
  ];

  for (const event of pluginEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("feedback_projection"), `${event} should have feedback_projection`);
  }
});

test("Domain events have feedback_projection consumer", () => {
  const domainEvents = ["domain:registered", "domain:activated"];

  for (const event of domainEvents) {
    const consumers = getRegisteredConsumers(event);
    assert.ok(consumers.includes("feedback_projection"), `${event} should have feedback_projection`);
  }
});

test("Knowledge events have feedback_projection consumer", () => {
  const result = getRegisteredConsumers("knowledge:chunk_indexed");
  assert.ok(result.includes("feedback_projection"));
});

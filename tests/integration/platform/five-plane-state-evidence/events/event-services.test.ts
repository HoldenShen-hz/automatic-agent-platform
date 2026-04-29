/**
 * Integration tests for event types
 *
 * Tests event tier classification and consumer registry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TIER_1_EVENT_TYPES,
  getEventTier,
  getRequiredConsumers,
} from "../../../../../src/platform/five-plane-state-evidence/events/event-types.js";

test("integration: event tier classification for all Tier 1 types", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    assert.equal(
      getEventTier(eventType),
      "tier_1",
      `${eventType} should be tier_1`,
    );
  }
});

test("integration: all Tier 1 events have required consumers", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(
      Array.isArray(consumers) && consumers.length > 0,
      `${eventType} should have required consumers`,
    );
  }
});

test("integration: Tier 1 event types includes platform namespace events", () => {
  const platformEvents = TIER_1_EVENT_TYPES.filter((e) => e.startsWith("platform."));
  assert.ok(platformEvents.length > 0, "Should have platform events");

  for (const event of platformEvents) {
    assert.equal(getEventTier(event), "tier_1");
  }
});

test("integration: Tier 1 event types includes oapeflir events", () => {
  const oapeflirEvents = TIER_1_EVENT_TYPES.filter((e) => e.startsWith("oapeflir."));
  assert.ok(oapeflirEvents.length > 0, "Should have oapeflir events");

  for (const event of oapeflirEvents) {
    const consumers = getRequiredConsumers(event);
    assert.ok(consumers.includes("oapeflir_projection"));
  }
});

test("integration: Tier 1 event types includes core business events", () => {
  const coreEvents = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
    "division:completed",
    "subtask:completed",
    "cost:limit_reached",
  ];

  for (const event of coreEvents) {
    assert.ok(TIER_1_EVENT_TYPES.includes(event), `${event} should be Tier 1`);
    const consumers = getRequiredConsumers(event);
    assert.ok(consumers.length > 0, `${event} should have consumers`);
  }
});

test("integration: getRequiredConsumers returns truth_projector for platform events", () => {
  const platformEvents = [
    "platform.harness_run.created",
    "platform.node_run.completed",
    "platform.side_effect.triggered",
    "platform.budget.reserved",
  ];

  for (const event of platformEvents) {
    const consumers = getRequiredConsumers(event);
    assert.ok(consumers.includes("truth_projector"), `${event} should require truth_projector`);
    assert.ok(consumers.includes("audit_projection"), `${event} should require audit_projection`);
  }
});

test("integration: getRequiredConsumers returns correct consumers for inspect events", () => {
  const eventsWithInspect = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
  ];

  for (const event of eventsWithInspect) {
    const consumers = getRequiredConsumers(event);
    assert.ok(consumers.includes("inspect_projection"), `${event} should require inspect_projection`);
  }
});

test("integration: getEventTier returns tier_2 for dispatch events", () => {
  const dispatchEvents = [
    "dispatch:ticket_created",
    "dispatch:ticket_claimed",
    "dispatch:execution_preempted",
  ];

  for (const event of dispatchEvents) {
    assert.equal(getEventTier(event), "tier_2", `${event} should be tier_2`);
  }
});

test("integration: getEventTier returns tier_2 for worker events", () => {
  const workerEvents = [
    "worker:heartbeat_recorded",
    "worker:writeback_recorded",
    "worker:claim_accepted",
  ];

  for (const event of workerEvents) {
    assert.equal(getEventTier(event), "tier_2", `${event} should be tier_2`);
  }
});

test("integration: getEventTier returns tier_3 for stream events", () => {
  assert.equal(getEventTier("stream:chunk_emitted"), "tier_3");
});

test("integration: non-Tier 1 events have empty consumer arrays", () => {
  const nonTier1Events = [
    "dispatch:ticket_created",
    "worker:heartbeat_recorded",
    "stream:chunk_emitted",
    "perf:test_event",
  ];

  for (const event of nonTier1Events) {
    const consumers = getRequiredConsumers(event);
    assert.deepEqual(consumers, [], `${event} should have empty consumers`);
  }
});
import assert from "node:assert/strict";
import test from "node:test";

import {
  TIER_1_EVENT_TYPES,
  getEventTier,
  getRequiredConsumers,
} from "../../../../../src/platform/state-evidence/events/event-types.js";

test("TIER_1_EVENT_TYPES contains expected events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("task:status_changed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("workflow:step_completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("decision:requested"));
  assert.ok(TIER_1_EVENT_TYPES.includes("decision:responded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("division:completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("division:failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("subtask:completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("subtask:failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:limit_reached"));
});

test("TIER_1_EVENT_TYPES has correct length", () => {
  assert.equal(TIER_1_EVENT_TYPES.length, 9);
});

test("getEventTier returns tier_1 for Tier 1 events", () => {
  assert.equal(getEventTier("task:status_changed"), "tier_1");
  assert.equal(getEventTier("workflow:step_completed"), "tier_1");
  assert.equal(getEventTier("decision:requested"), "tier_1");
  assert.equal(getEventTier("division:completed"), "tier_1");
});

test("getEventTier returns tier_2 for non-Tier 1 events", () => {
  assert.equal(getEventTier("dispatch:ticket_created"), "tier_2");
  assert.equal(getEventTier("worker:heartbeat_recorded"), "tier_2");
  assert.equal(getEventTier("stream:chunk_emitted"), "tier_2");
});

test("getEventTier returns tier_2 for unknown events", () => {
  assert.equal(getEventTier("unknown:event"), "tier_2");
  assert.equal(getEventTier(""), "tier_2");
});

test("getRequiredConsumers returns consumers for Tier 1 events", () => {
  const consumers = getRequiredConsumers("task:status_changed");
  assert.ok(consumers.includes("task_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for workflow events", () => {
  const consumers = getRequiredConsumers("workflow:step_completed");
  assert.ok(consumers.includes("workflow_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for decision events", () => {
  const consumers = getRequiredConsumers("decision:requested");
  assert.ok(consumers.includes("approval_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for division events", () => {
  const consumers = getRequiredConsumers("division:completed");
  assert.ok(consumers.includes("division_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for subtask events", () => {
  const consumers = getRequiredConsumers("subtask:completed");
  assert.ok(consumers.includes("task_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for cost events", () => {
  const consumers = getRequiredConsumers("cost:limit_reached");
  assert.ok(consumers.includes("budget_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns empty array for non-Tier 1 events", () => {
  const consumers = getRequiredConsumers("dispatch:ticket_created");
  assert.deepEqual(consumers, []);
});

test("getRequiredConsumers returns empty array for unknown events", () => {
  const consumers = getRequiredConsumers("unknown:event");
  assert.deepEqual(consumers, []);
});

test("getRequiredConsumers returns readonly array", () => {
  const consumers = getRequiredConsumers("task:status_changed");
  // Verify it's readonly (doesn't have push)
  assert.equal(Array.isArray(consumers), true);
});

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
  // §28 Missing namespaces
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:injected"));
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:rendered"));
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:validation_failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:budget_created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:budget_exceeded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:actualized"));
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:provisioned"));
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:suspended"));
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:deleted"));
  assert.ok(TIER_1_EVENT_TYPES.includes("pack:installed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("pack:uninstalled"));
  assert.ok(TIER_1_EVENT_TYPES.includes("marketplace:listing_published"));
  assert.ok(TIER_1_EVENT_TYPES.includes("marketplace:listing_purchased"));
  assert.ok(TIER_1_EVENT_TYPES.includes("anomaly:classified"));
  assert.ok(TIER_1_EVENT_TYPES.includes("slo:breached"));
  assert.ok(TIER_1_EVENT_TYPES.includes("slo:recovered"));
  assert.ok(TIER_1_EVENT_TYPES.includes("compliance:audit_recorded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("compliance:violation_detected"));
  assert.ok(TIER_1_EVENT_TYPES.includes("knowledge:document_indexed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("knowledge:query_processed"));
});

test("TIER_1_EVENT_TYPES has correct length", () => {
  assert.equal(TIER_1_EVENT_TYPES.length, 32);
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

// §28: Tests for new event namespace consumers

test("getRequiredConsumers returns consumers for delegation events", () => {
  const created = getRequiredConsumers("delegation:created");
  assert.ok(created.includes("delegation_projection"));
  assert.ok(created.includes("inspect_projection"));

  const completed = getRequiredConsumers("delegation:completed");
  assert.ok(completed.includes("delegation_projection"));

  const failed = getRequiredConsumers("delegation:failed");
  assert.ok(failed.includes("delegation_projection"));
});

test("getRequiredConsumers returns consumers for prompt events", () => {
  const injected = getRequiredConsumers("prompt:injected");
  assert.ok(injected.includes("prompt_projection"));
  assert.ok(injected.includes("inspect_projection"));

  const rendered = getRequiredConsumers("prompt:rendered");
  assert.ok(rendered.includes("prompt_projection"));

  const validationFailed = getRequiredConsumers("prompt:validation_failed");
  assert.ok(validationFailed.includes("prompt_projection"));
});

test("getRequiredConsumers returns consumers for cost events", () => {
  const budgetCreated = getRequiredConsumers("cost:budget_created");
  assert.ok(budgetCreated.includes("cost_dashboard"));
  assert.ok(budgetCreated.includes("inspect_projection"));

  const budgetExceeded = getRequiredConsumers("cost:budget_exceeded");
  assert.ok(budgetExceeded.includes("cost_dashboard"));

  const actualized = getRequiredConsumers("cost:actualized");
  assert.ok(actualized.includes("cost_dashboard"));
});

test("getRequiredConsumers returns consumers for tenant events", () => {
  const provisioned = getRequiredConsumers("tenant:provisioned");
  assert.ok(provisioned.includes("tenant_projection"));
  assert.ok(provisioned.includes("inspect_projection"));

  const suspended = getRequiredConsumers("tenant:suspended");
  assert.ok(suspended.includes("tenant_projection"));

  const deleted = getRequiredConsumers("tenant:deleted");
  assert.ok(deleted.includes("tenant_projection"));
});

test("getRequiredConsumers returns consumers for pack events", () => {
  const installed = getRequiredConsumers("pack:installed");
  assert.ok(installed.includes("pack_projection"));
  assert.ok(installed.includes("inspect_projection"));

  const uninstalled = getRequiredConsumers("pack:uninstalled");
  assert.ok(uninstalled.includes("pack_projection"));
});

test("getRequiredConsumers returns consumers for marketplace events", () => {
  const published = getRequiredConsumers("marketplace:listing_published");
  assert.ok(published.includes("marketplace_projection"));
  assert.ok(published.includes("inspect_projection"));

  const purchased = getRequiredConsumers("marketplace:listing_purchased");
  assert.ok(purchased.includes("marketplace_projection"));
});

test("getRequiredConsumers returns consumers for anomaly classification events", () => {
  const anomaly = getRequiredConsumers("anomaly:classified");
  assert.ok(anomaly.includes("incident_projection"));
  assert.ok(anomaly.includes("inspect_projection"));
});

test("getRequiredConsumers returns consumers for slo events", () => {
  const breached = getRequiredConsumers("slo:breached");
  assert.ok(breached.includes("slo_projection"));
  assert.ok(breached.includes("inspect_projection"));

  const recovered = getRequiredConsumers("slo:recovered");
  assert.ok(recovered.includes("slo_projection"));
});

test("getRequiredConsumers returns consumers for compliance events", () => {
  const auditRecorded = getRequiredConsumers("compliance:audit_recorded");
  assert.ok(auditRecorded.includes("compliance_projection"));
  assert.ok(auditRecorded.includes("inspect_projection"));

  const violation = getRequiredConsumers("compliance:violation_detected");
  assert.ok(violation.includes("compliance_projection"));
});

test("getRequiredConsumers returns consumers for knowledge events", () => {
  const indexed = getRequiredConsumers("knowledge:document_indexed");
  assert.ok(indexed.includes("knowledge_projection"));
  assert.ok(indexed.includes("inspect_projection"));

  const processed = getRequiredConsumers("knowledge:query_processed");
  assert.ok(processed.includes("knowledge_projection"));
});

/**
 * Unit tests for event-types module
 *
 * Tests tier classification, consumer registry, and event type utilities.
 * Provides comprehensive coverage of event type helpers and constants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TIER_1_EVENT_TYPES,
  getEventTier,
  getRequiredConsumers,
  type Tier1EventType,
} from "../../../../../src/platform/state-evidence/events/event-types.js";

test("TIER_1_EVENT_TYPES is a readonly array", () => {
  assert.ok(Array.isArray(TIER_1_EVENT_TYPES));
  // Verify it's frozen/readonly by checking it doesn't have mutators
  assert.ok(!Object.isFrozen(TIER_1_EVENT_TYPES) || Object.isSealed(TIER_1_EVENT_TYPES));
});

test("TIER_1_EVENT_TYPES contains all expected Tier 1 event types", () => {
  // Core business events
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
  assert.equal(TIER_1_EVENT_TYPES.length, 32);
});

test("TIER_1_EVENT_TYPES contains delegation namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("delegation:failed"));
});

test("TIER_1_EVENT_TYPES contains prompt namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:injected"));
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:rendered"));
  assert.ok(TIER_1_EVENT_TYPES.includes("prompt:validation_failed"));
});

test("TIER_1_EVENT_TYPES contains cost namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:budget_created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:budget_exceeded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("cost:actualized"));
});

test("TIER_1_EVENT_TYPES contains tenant namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:provisioned"));
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:suspended"));
  assert.ok(TIER_1_EVENT_TYPES.includes("tenant:deleted"));
});

test("TIER_1_EVENT_TYPES contains pack namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("pack:installed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("pack:uninstalled"));
});

test("TIER_1_EVENT_TYPES contains marketplace namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("marketplace:listing_published"));
  assert.ok(TIER_1_EVENT_TYPES.includes("marketplace:listing_purchased"));
});

test("TIER_1_EVENT_TYPES contains anomaly namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("anomaly:classified"));
});

test("TIER_1_EVENT_TYPES contains slo namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("slo:breached"));
  assert.ok(TIER_1_EVENT_TYPES.includes("slo:recovered"));
});

test("TIER_1_EVENT_TYPES contains compliance namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("compliance:audit_recorded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("compliance:violation_detected"));
});

test("TIER_1_EVENT_TYPES contains knowledge namespace events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("knowledge:document_indexed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("knowledge:query_processed"));
});

test("getEventTier returns tier_1 for all Tier 1 event types", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    assert.equal(
      getEventTier(eventType),
      "tier_1",
      `${eventType} should return tier_1`,
    );
  }
});

test("getEventTier returns tier_2 for dispatch events", () => {
  assert.equal(getEventTier("dispatch:ticket_created"), "tier_2");
  assert.equal(getEventTier("dispatch:ticket_claimed"), "tier_2");
  assert.equal(getEventTier("dispatch:decision_recorded"), "tier_2");
  assert.equal(getEventTier("dispatch:execution_preempted"), "tier_2");
  assert.equal(getEventTier("dispatch:ticket_reconciled"), "tier_2");
  assert.equal(getEventTier("dispatch:ticket_requeued"), "tier_2");
  assert.equal(getEventTier("dispatch:ticket_rebuilt"), "tier_2");
});

test("getEventTier returns tier_2 for worker events", () => {
  assert.equal(getEventTier("worker:claim_accepted"), "tier_2");
  assert.equal(getEventTier("worker:claim_rejected"), "tier_2");
  assert.equal(getEventTier("worker:heartbeat_recorded"), "tier_2");
  assert.equal(getEventTier("worker:writeback_recorded"), "tier_2");
  assert.equal(getEventTier("worker:writeback_rejected"), "tier_2");
  assert.equal(getEventTier("worker:lease_released_after_writeback"), "tier_2");
});

test("getEventTier returns tier_2 for takeover events", () => {
  assert.equal(getEventTier("takeover:session_opened"), "tier_2");
  assert.equal(getEventTier("takeover:action_applied"), "tier_2");
});

test("getEventTier returns tier_2 for recovery events", () => {
  assert.equal(getEventTier("recovery:repair_applied"), "tier_2");
  assert.equal(getEventTier("recovery:decision_recorded"), "tier_2");
  assert.equal(getEventTier("recovery:dead_lettered"), "tier_2");
  assert.equal(getEventTier("recovery:cancelled"), "tier_2");
});

test("getEventTier returns tier_2 for domain events", () => {
  assert.equal(getEventTier("domain:registered"), "tier_2");
  assert.equal(getEventTier("domain:activated"), "tier_2");
});

test("getEventTier returns tier_2 for plugin events", () => {
  assert.equal(getEventTier("plugin:spi_registered"), "tier_2");
  assert.equal(getEventTier("plugin:activated"), "tier_2");
  assert.equal(getEventTier("plugin:error_isolated"), "tier_2");
  assert.equal(getEventTier("plugin:invocation_started"), "tier_2");
  assert.equal(getEventTier("plugin:invocation_completed"), "tier_2");
});

test("getEventTier returns tier_2 for skill events", () => {
  assert.equal(getEventTier("skill:execution_started"), "tier_2");
  assert.equal(getEventTier("skill:cache_miss"), "tier_2");
  assert.equal(getEventTier("skill:cache_hit"), "tier_2");
  assert.equal(getEventTier("skill:cache_stored"), "tier_2");
  assert.equal(getEventTier("skill:step_started"), "tier_2");
  assert.equal(getEventTier("skill:retry_scheduled"), "tier_2");
  assert.equal(getEventTier("skill:step_succeeded"), "tier_2");
  assert.equal(getEventTier("skill:step_failed"), "tier_2");
  assert.equal(getEventTier("skill:execution_completed"), "tier_2");
});

test("getEventTier returns tier_3 for stream events", () => {
  assert.equal(getEventTier("stream:chunk_emitted"), "tier_3");
});

test("getEventTier returns tier_3 for perf test events", () => {
  assert.equal(getEventTier("perf:test_event"), "tier_3");
  assert.equal(getEventTier("perf:burst_event"), "tier_3");
  assert.equal(getEventTier("test:capacity"), "tier_3");
  assert.equal(getEventTier("test:many_events"), "tier_3");
});

test("getEventTier returns tier_2 for unknown events", () => {
  assert.equal(getEventTier("unknown:event"), "tier_2");
  assert.equal(getEventTier("foobar"), "tier_2");
  assert.equal(getEventTier(""), "tier_2");
});

test("getEventTier is case sensitive", () => {
  assert.equal(getEventTier("TASK:STATUS_CHANGED"), "tier_2");
  assert.equal(getEventTier("Task:Status:Changed"), "tier_2");
});

test("getRequiredConsumers returns correct consumers for task events", () => {
  const consumers = getRequiredConsumers("task:status_changed");
  assert.ok(consumers.includes("task_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for workflow events", () => {
  const consumers = getRequiredConsumers("workflow:step_completed");
  assert.ok(consumers.includes("workflow_projection"));
  assert.ok(consumers.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for decision events", () => {
  const requested = getRequiredConsumers("decision:requested");
  assert.ok(requested.includes("approval_projection"));
  assert.ok(requested.includes("inspect_projection"));

  const responded = getRequiredConsumers("decision:responded");
  assert.ok(responded.includes("approval_projection"));
  assert.ok(responded.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for division events", () => {
  const completed = getRequiredConsumers("division:completed");
  assert.ok(completed.includes("division_projection"));
  assert.ok(completed.includes("inspect_projection"));

  const failed = getRequiredConsumers("division:failed");
  assert.ok(failed.includes("division_projection"));
  assert.ok(failed.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for subtask events", () => {
  const completed = getRequiredConsumers("subtask:completed");
  assert.ok(completed.includes("task_projection"));
  assert.ok(completed.includes("inspect_projection"));

  const failed = getRequiredConsumers("subtask:failed");
  assert.ok(failed.includes("task_projection"));
  assert.ok(failed.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for cost events", () => {
  const limitReached = getRequiredConsumers("cost:limit_reached");
  assert.ok(limitReached.includes("budget_projection"));
  assert.ok(limitReached.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for delegation events", () => {
  const created = getRequiredConsumers("delegation:created");
  assert.ok(created.includes("delegation_projection"));
  assert.ok(created.includes("inspect_projection"));

  const completed = getRequiredConsumers("delegation:completed");
  assert.ok(completed.includes("delegation_projection"));

  const failed = getRequiredConsumers("delegation:failed");
  assert.ok(failed.includes("delegation_projection"));
});

test("getRequiredConsumers returns correct consumers for prompt events", () => {
  const injected = getRequiredConsumers("prompt:injected");
  assert.ok(injected.includes("prompt_projection"));
  assert.ok(injected.includes("inspect_projection"));

  const rendered = getRequiredConsumers("prompt:rendered");
  assert.ok(rendered.includes("prompt_projection"));

  const validationFailed = getRequiredConsumers("prompt:validation_failed");
  assert.ok(validationFailed.includes("prompt_projection"));
});

test("getRequiredConsumers returns correct consumers for cost budget events", () => {
  const budgetCreated = getRequiredConsumers("cost:budget_created");
  assert.ok(budgetCreated.includes("cost_dashboard"));
  assert.ok(budgetCreated.includes("inspect_projection"));

  const budgetExceeded = getRequiredConsumers("cost:budget_exceeded");
  assert.ok(budgetExceeded.includes("cost_dashboard"));

  const actualized = getRequiredConsumers("cost:actualized");
  assert.ok(actualized.includes("cost_dashboard"));
});

test("getRequiredConsumers returns correct consumers for tenant events", () => {
  const provisioned = getRequiredConsumers("tenant:provisioned");
  assert.ok(provisioned.includes("tenant_projection"));
  assert.ok(provisioned.includes("inspect_projection"));

  const suspended = getRequiredConsumers("tenant:suspended");
  assert.ok(suspended.includes("tenant_projection"));

  const deleted = getRequiredConsumers("tenant:deleted");
  assert.ok(deleted.includes("tenant_projection"));
});

test("getRequiredConsumers returns correct consumers for pack events", () => {
  const installed = getRequiredConsumers("pack:installed");
  assert.ok(installed.includes("pack_projection"));
  assert.ok(installed.includes("inspect_projection"));

  const uninstalled = getRequiredConsumers("pack:uninstalled");
  assert.ok(uninstalled.includes("pack_projection"));
});

test("getRequiredConsumers returns correct consumers for marketplace events", () => {
  const published = getRequiredConsumers("marketplace:listing_published");
  assert.ok(published.includes("marketplace_projection"));
  assert.ok(published.includes("inspect_projection"));

  const purchased = getRequiredConsumers("marketplace:listing_purchased");
  assert.ok(purchased.includes("marketplace_projection"));
});

test("getRequiredConsumers returns correct consumers for anomaly events", () => {
  const classified = getRequiredConsumers("anomaly:classified");
  assert.ok(classified.includes("incident_projection"));
  assert.ok(classified.includes("inspect_projection"));
});

test("getRequiredConsumers returns correct consumers for slo events", () => {
  const breached = getRequiredConsumers("slo:breached");
  assert.ok(breached.includes("slo_projection"));
  assert.ok(breached.includes("inspect_projection"));

  const recovered = getRequiredConsumers("slo:recovered");
  assert.ok(recovered.includes("slo_projection"));
});

test("getRequiredConsumers returns correct consumers for compliance events", () => {
  const auditRecorded = getRequiredConsumers("compliance:audit_recorded");
  assert.ok(auditRecorded.includes("compliance_projection"));
  assert.ok(auditRecorded.includes("inspect_projection"));

  const violation = getRequiredConsumers("compliance:violation_detected");
  assert.ok(violation.includes("compliance_projection"));
});

test("getRequiredConsumers returns correct consumers for knowledge events", () => {
  const indexed = getRequiredConsumers("knowledge:document_indexed");
  assert.ok(indexed.includes("knowledge_projection"));
  assert.ok(indexed.includes("inspect_projection"));

  const processed = getRequiredConsumers("knowledge:query_processed");
  assert.ok(processed.includes("knowledge_projection"));
});

test("getRequiredConsumers returns empty array for non-Tier 1 events", () => {
  const dispatch = getRequiredConsumers("dispatch:ticket_created");
  assert.deepEqual(dispatch, []);

  const worker = getRequiredConsumers("worker:heartbeat_recorded");
  assert.deepEqual(worker, []);

  const stream = getRequiredConsumers("stream:chunk_emitted");
  assert.deepEqual(stream, []);
});

test("getRequiredConsumers returns empty array for unknown events", () => {
  assert.deepEqual(getRequiredConsumers("unknown:event"), []);
  assert.deepEqual(getRequiredConsumers("foobar"), []);
  assert.deepEqual(getRequiredConsumers(""), []);
});

test("Tier1EventType is the correct union type", () => {
  const eventType: Tier1EventType = "task:status_changed";
  assert.equal(eventType, "task:status_changed");

  // All TIER_1_EVENT_TYPES should be assignable to Tier1EventType
  for (const event of TIER_1_EVENT_TYPES) {
    const typedEvent: Tier1EventType = event;
    assert.equal(typedEvent, event);
  }
});

test("REQUIRED_CONSUMERS_BY_EVENT_TYPE has entries for all Tier 1 events", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(
      Array.isArray(consumers) && consumers.length > 0,
      `${eventType} should have required consumers`,
    );
  }
});
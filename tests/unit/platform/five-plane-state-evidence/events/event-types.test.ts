/**
 * Unit tests for event-types module
 *
 * Tests tier classification, consumer registry, and event type utilities.
 * Provides comprehensive coverage of event type helpers and constants.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TIER_1_EVENT_TYPES,
  getEventTier,
  getRequiredConsumers,
  type Tier1EventType,
} from "../../../../../src/platform/five-plane-state-evidence/events/event-types.js";

test("TIER_1_EVENT_TYPES is a readonly array", () => {
  assert.ok(Array.isArray(TIER_1_EVENT_TYPES));
});

test("TIER_1_EVENT_TYPES contains core business events", () => {
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

test("TIER_1_EVENT_TYPES contains harness_run events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.status_changed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.admitted"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.planning"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.ready"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.pausing"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.replanning"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.compensating"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.aborted"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.harness_run.completed"));
});

test("TIER_1_EVENT_TYPES contains node_run events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.status_changed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.created"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.admitted"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.planning"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.ready"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.pausing"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.replanning"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.failed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.compensating"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.node_run.skipped"));
});

test("TIER_1_EVENT_TYPES contains side_effect events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.side_effect.status_changed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.side_effect.triggered"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.side_effect.completed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.side_effect.failed"));
});

test("TIER_1_EVENT_TYPES contains budget events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget.status_changed"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget.reserved"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget.actualized"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget.exceeded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("platform.budget_reconciliation.status_changed"));
});

test("TIER_1_EVENT_TYPES contains oapeflir events", () => {
  assert.ok(TIER_1_EVENT_TYPES.includes("oapeflir.view.run_lifecycle"));
  assert.ok(TIER_1_EVENT_TYPES.includes("oapeflir.decision.recorded"));
  assert.ok(TIER_1_EVENT_TYPES.includes("oapeflir.phase.transition"));
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

test("getRequiredConsumers returns correct consumers for harness_run events", () => {
  const consumers = getRequiredConsumers("platform.harness_run.status_changed");
  assert.ok(consumers.includes("truth_projector"));
  assert.ok(consumers.includes("audit_projection"));
});

test("getRequiredConsumers returns correct consumers for node_run events", () => {
  const consumers = getRequiredConsumers("platform.node_run.created");
  assert.ok(consumers.includes("truth_projector"));
  assert.ok(consumers.includes("audit_projection"));
});

test("getRequiredConsumers returns correct consumers for side_effect events", () => {
  const consumers = getRequiredConsumers("platform.side_effect.triggered");
  assert.ok(consumers.includes("truth_projector"));
  assert.ok(consumers.includes("audit_projection"));
});

test("getRequiredConsumers returns correct consumers for budget events", () => {
  const consumers = getRequiredConsumers("platform.budget.reserved");
  assert.ok(consumers.includes("truth_projector"));
  assert.ok(consumers.includes("audit_projection"));
});

test("getRequiredConsumers returns correct consumers for oapeflir events", () => {
  const runLifecycle = getRequiredConsumers("oapeflir.view.run_lifecycle");
  assert.ok(runLifecycle.includes("oapeflir_projection"));
  assert.ok(runLifecycle.includes("inspect_projection"));

  const decision = getRequiredConsumers("oapeflir.decision.recorded");
  assert.ok(decision.includes("oapeflir_projection"));

  const phase = getRequiredConsumers("oapeflir.phase.transition");
  assert.ok(phase.includes("oapeflir_projection"));
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

  for (const event of TIER_1_EVENT_TYPES) {
    const typedEvent: Tier1EventType = event;
    assert.equal(typedEvent, event);
  }
});
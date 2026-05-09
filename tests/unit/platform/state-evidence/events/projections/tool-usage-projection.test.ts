import test from "node:test";
import assert from "node:assert/strict";

import {
  toolUsageProjectionHandler,
  createEmptyToolUsageState,
  createToolUsageProjectionHandler,
  type ToolUsageState,
  type ProjectionInputEvent,
} from "../../../../../../src/platform/state-evidence/events/projections/tool-usage-projection.js";

/**
 * Helper to create a projection input event
 */
function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-04-19T10:00:00.000Z",
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson,
    createdAt,
  };
}

test("toolUsageProjectionHandler initializes state correctly", () => {
  const event = makeEvent("evt_1", "skill:execution_started", "task_1", '{"skillId":"skill_1"}');

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.toolId, "skill_1");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "started");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, new Set(["evt_1"]));
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
});

test("toolUsageProjectionHandler handles plugin:invocation_started", () => {
  const event = makeEvent(
    "evt_inv_1",
    "plugin:invocation_started",
    "task_1",
    '{"pluginId":"plugin_abc","toolName":"code_executor"}',
  );

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.toolId, "plugin_abc");
  assert.equal(state.toolName, "code_executor");
  assert.equal(state.status, "started");
  assert.equal(state.invocationCount, 1);
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
});

test("toolUsageProjectionHandler handles skill:step_succeeded", () => {
  const event = makeEvent(
    "evt_succ_1",
    "skill:step_succeeded",
    "task_1",
    '{"skillId":"skill_1","stepId":"step_1","durationMs":150}',
  );

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.status, "completed");
  assert.equal(state.successCount, 1);
  assert.equal(state.lastSuccessAt, "2026-04-19T10:00:00.000Z");
  // skill:step_succeeded does not increment invocationCount - only plugin:invocation_completed does
  assert.equal(state.invocationCount, 0);
});

test("toolUsageProjectionHandler handles skill:step_failed", () => {
  const event = makeEvent(
    "evt_fail_1",
    "skill:step_failed",
    "task_1",
    '{"skillId":"skill_1","stepId":"step_1","errorCode":"TIMEOUT"}',
  );

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.status, "failed");
  assert.equal(state.failureCount, 1);
  assert.equal(state.lastFailureAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastFailedStepId, "step_1");
});

test("toolUsageProjectionHandler handles skill:retry_scheduled", () => {
  const event = makeEvent("evt_retry_1", "skill:retry_scheduled", "task_1", '{"skillId":"skill_1"}');

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.status, "retrying");
  assert.equal(state.retryCount, 1);
});

test("toolUsageProjectionHandler handles skill:cache_hit", () => {
  const event = makeEvent("evt_cache_hit_1", "skill:cache_hit", "task_1", '{"skillId":"skill_1"}');

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.status, "cache_hit");
  assert.equal(state.cacheHitCount, 1);
});

test("toolUsageProjectionHandler handles skill:cache_miss", () => {
  const event = makeEvent("evt_cache_miss_1", "skill:cache_miss", "task_1", '{"skillId":"skill_1"}');

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.status, "cache_miss");
  assert.equal(state.cacheMissCount, 1);
});

test("toolUsageProjectionHandler is idempotent - same event twice", () => {
  const event = makeEvent(
    "evt_idem_1",
    "skill:step_succeeded",
    "task_1",
    '{"skillId":"skill_1"}',
  );

  const state1 = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;
  const state2 = toolUsageProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as ToolUsageState;

  // Should be the same - second event is skipped
  assert.equal(state2.eventCount, 1);
  assert.equal(state2.successCount, 1);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_idem_1"]));
});

test("toolUsageProjectionHandler accumulates multiple events", () => {
  const startedEvent = makeEvent(
    "evt_start",
    "skill:execution_started",
    "task_1",
    '{"skillId":"skill_1"}',
  );
  const succeededEvent = makeEvent(
    "evt_succ",
    "skill:step_succeeded",
    "task_1",
    '{"skillId":"skill_1"}',
  );

  const state1 = toolUsageProjectionHandler(null, startedEvent) as unknown as ToolUsageState;
  const state2 = toolUsageProjectionHandler(state1 as unknown as Record<string, unknown>, succeededEvent) as unknown as ToolUsageState;

  assert.equal(state2.invocationCount, 1);
  assert.equal(state2.successCount, 1);
  assert.equal(state2.eventCount, 2);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_start", "evt_succ"]));
});

test("createToolUsageProjectionHandler returns handler function", () => {
  const factory = createToolUsageProjectionHandler();

  assert.equal(typeof factory, "function");

  const event = makeEvent("evt_1", "skill:execution_started", "task_1", '{"skillId":"skill_1"}');
  const state = factory(null, event) as unknown as ToolUsageState;

  assert.equal(state.toolId, "skill_1");
});

test("toolUsageProjectionHandler parses payload with multiple fields", () => {
  const event = makeEvent(
    "evt_1",
    "plugin:invocation_started",
    "task_1",
    '{"pluginId":"plugin_x","toolName":"bash","executionId":"exec_123"}',
  );

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  assert.equal(state.toolId, "plugin_x");
  assert.equal(state.toolName, "bash");
  assert.equal(state.executionId, "exec_123");
});

test("toolUsageProjectionHandler timeline tracks events in order", () => {
  const events = [
    makeEvent("evt_1", "skill:execution_started", "task_1", '{"skillId":"skill_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "skill:step_succeeded", "task_1", '{"skillId":"skill_1"}', "2026-04-19T10:01:00.000Z"),
    makeEvent("evt_3", "skill:step_succeeded", "task_1", '{"skillId":"skill_1"}', "2026-04-19T10:02:00.000Z"),
  ];

  let state: ToolUsageState | null = null;
  for (const evt of events) {
    state = toolUsageProjectionHandler(state as unknown as Record<string, unknown>, evt) as unknown as ToolUsageState;
  }

  assert.equal(state!.timeline.length, 3);
  assert.equal(state!.timeline[0]!.eventType, "skill:execution_started");
  assert.equal(state!.timeline[1]!.eventType, "skill:step_succeeded");
  assert.equal(state!.timeline[2]!.eventType, "skill:step_succeeded");
});

test("createEmptyToolUsageState returns correct initial state", () => {
  const state = createEmptyToolUsageState();

  assert.equal(state.toolId, null);
  assert.equal(state.toolName, null);
  assert.equal(state.status, null);
  assert.equal(state.invocationCount, 0);
  assert.equal(state.successCount, 0);
  assert.equal(state.failureCount, 0);
  assert.equal(state.cacheHitCount, 0);
  assert.equal(state.cacheMissCount, 0);
  assert.equal(state.retryCount, 0);
  assert.deepEqual(state.processedEventIds, new Set());
  assert.deepEqual(state.timeline, []);
});

test("toolUsageProjectionHandler handles invalid JSON payload gracefully", () => {
  const event = makeEvent("evt_1", "skill:execution_started", "task_1", "not valid json");

  const state = toolUsageProjectionHandler(null, event) as unknown as ToolUsageState;

  // Should still initialize state, just with empty payload
  assert.equal(state.eventCount, 1);
  assert.equal(state.toolId, null);
});

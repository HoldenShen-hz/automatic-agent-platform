import test from "node:test";
import assert from "node:assert/strict";

import {
  workerStatusProjectionHandler,
  createEmptyWorkerStatusState,
  createWorkerStatusProjectionHandler,
  type WorkerStatusState,
  type ProjectionInputEvent,
} from "../../../../../../src/platform/state-evidence/events/projections/worker-status-projection.js";

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

test("workerStatusProjectionHandler initializes state correctly", () => {
  const event = makeEvent("evt_1", "worker:claim_accepted", "task_1", '{"workerId":"worker_1"}');

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.workerId, "worker_1");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "active");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, ["evt_1"]);
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
});

test("workerStatusProjectionHandler handles worker:claim_accepted", () => {
  const event = makeEvent(
    "evt_claim_1",
    "worker:claim_accepted",
    "task_1",
    '{"workerId":"worker_abc","tenantId":"tenant_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.workerId, "worker_abc");
  assert.equal(state.tenantId, "tenant_1");
  assert.equal(state.status, "active");
  assert.equal(state.claimsAccepted, 1);
  assert.equal(state.firstClaimAcceptedAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastClaimAcceptedAt, "2026-04-19T10:00:00.000Z");
});

test("workerStatusProjectionHandler handles worker:claim_rejected", () => {
  const event = makeEvent(
    "evt_rej_1",
    "worker:claim_rejected",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "rejected");
  assert.equal(state.claimsRejected, 1);
});

test("workerStatusProjectionHandler handles worker:heartbeat_recorded", () => {
  const event = makeEvent(
    "evt_hb_1",
    "worker:heartbeat_recorded",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "active");
  assert.equal(state.heartbeatsReceived, 1);
  assert.equal(state.lastHeartbeatAt, "2026-04-19T10:00:00.000Z");
});

test("workerStatusProjectionHandler transitions status from idle to active on heartbeat", () => {
  // Start with idle status
  const idleEvent = makeEvent(
    "evt_idle_1",
    "worker:heartbeat_recorded",
    "task_1",
    '{"workerId":"worker_1","status":"idle"}',
  );
  const stateAfterIdle = workerStatusProjectionHandler(null, idleEvent) as unknown as WorkerStatusState;
  assert.equal(stateAfterIdle.status, "active");
});

test("workerStatusProjectionHandler handles worker:writeback_recorded", () => {
  const event = makeEvent(
    "evt_wb_1",
    "worker:writeback_recorded",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "writeback");
  assert.equal(state.writebacksRecorded, 1);
  assert.equal(state.lastWritebackAt, "2026-04-19T10:00:00.000Z");
});

test("workerStatusProjectionHandler handles worker:writeback_rejected", () => {
  const event = makeEvent(
    "evt_wb_rej_1",
    "worker:writeback_rejected",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "rejected");
  assert.equal(state.writebacksRejected, 1);
  assert.equal(state.lastWritebackRejectedAt, "2026-04-19T10:00:00.000Z");
});

test("workerStatusProjectionHandler handles worker:lease_released_after_writeback", () => {
  const event = makeEvent(
    "evt_lease_1",
    "worker:lease_released_after_writeback",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "completed");
  assert.equal(state.leaseReleasesAfterWriteback, 1);
});

test("workerStatusProjectionHandler handles worker:registered", () => {
  const event = makeEvent(
    "evt_registered_1",
    "worker:registered",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "idle");
  assert.equal(state.eventCount, 1);
});

test("workerStatusProjectionHandler handles worker:deregistered", () => {
  const event = makeEvent(
    "evt_deregistered_1",
    "worker:deregistered",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "dead");
  assert.equal(state.eventCount, 1);
});

test("workerStatusProjectionHandler handles worker:drain_started", () => {
  const event = makeEvent(
    "evt_drain_started_1",
    "worker:drain_started",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.status, "idle");
  assert.equal(state.eventCount, 1);
});

test("workerStatusProjectionHandler is idempotent - same event twice", () => {
  const event = makeEvent(
    "evt_idem_1",
    "worker:claim_accepted",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state1 = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;
  const state2 = workerStatusProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as WorkerStatusState;

  // Second event should be skipped
  assert.equal(state2.eventCount, 1);
  assert.equal(state2.claimsAccepted, 1);
  assert.deepEqual(state2.processedEventIds, ["evt_idem_1"]);
});

test("workerStatusProjectionHandler accumulates multiple events", () => {
  const claimEvent = makeEvent(
    "evt_claim",
    "worker:claim_accepted",
    "task_1",
    '{"workerId":"worker_1"}',
  );
  const heartbeatEvent = makeEvent(
    "evt_hb",
    "worker:heartbeat_recorded",
    "task_1",
    '{"workerId":"worker_1"}',
  );

  const state1 = workerStatusProjectionHandler(null, claimEvent) as unknown as WorkerStatusState;
  const state2 = workerStatusProjectionHandler(state1 as unknown as Record<string, unknown>, heartbeatEvent) as unknown as WorkerStatusState;

  assert.equal(state2.claimsAccepted, 1);
  assert.equal(state2.heartbeatsReceived, 1);
  assert.equal(state2.eventCount, 2);
  assert.deepEqual(state2.processedEventIds, ["evt_claim", "evt_hb"]);
});

test("createWorkerStatusProjectionHandler returns handler function", () => {
  const factory = createWorkerStatusProjectionHandler();

  assert.equal(typeof factory, "function");

  const event = makeEvent("evt_1", "worker:claim_accepted", "task_1", '{"workerId":"worker_1"}');
  const state = factory(null, event) as unknown as WorkerStatusState;

  assert.equal(state.workerId, "worker_1");
});

test("workerStatusProjectionHandler parses payload with executionId", () => {
  const event = makeEvent(
    "evt_1",
    "worker:claim_accepted",
    "task_1",
    '{"workerId":"worker_1","executionId":"exec_xyz"}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  assert.equal(state.executionId, "exec_xyz");
});

test("workerStatusProjectionHandler timeline tracks events in order", () => {
  const events = [
    makeEvent("evt_1", "worker:claim_accepted", "task_1", '{"workerId":"worker_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "worker:heartbeat_recorded", "task_1", '{"workerId":"worker_1"}', "2026-04-19T10:01:00.000Z"),
    makeEvent("evt_3", "worker:writeback_recorded", "task_1", '{"workerId":"worker_1"}', "2026-04-19T10:02:00.000Z"),
  ];

  let state: WorkerStatusState | null = null;
  for (const evt of events) {
    state = workerStatusProjectionHandler(state as unknown as Record<string, unknown>, evt) as unknown as WorkerStatusState;
  }

  assert.equal(state!.timeline.length, 3);
  assert.equal(state!.timeline[0]!.eventType, "worker:claim_accepted");
  assert.equal(state!.timeline[1]!.eventType, "worker:heartbeat_recorded");
  assert.equal(state!.timeline[2]!.eventType, "worker:writeback_recorded");
});

test("createEmptyWorkerStatusState returns correct initial state", () => {
  const state = createEmptyWorkerStatusState();

  assert.equal(state.workerId, null);
  assert.equal(state.taskId, null);
  assert.equal(state.status, "idle");
  assert.equal(state.claimsAccepted, 0);
  assert.equal(state.claimsRejected, 0);
  assert.equal(state.heartbeatsReceived, 0);
  assert.deepEqual(state.processedEventIds, []);
  assert.deepEqual(state.timeline, []);
});

test("workerStatusProjectionHandler handles invalid JSON payload gracefully", () => {
  const event = makeEvent("evt_1", "worker:claim_accepted", "task_1", "not valid json");

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  // Should still initialize state, just with empty payload
  assert.equal(state.eventCount, 1);
  assert.equal(state.workerId, null);
});

test("workerStatusProjectionHandler skips traceContext in details", () => {
  const event = makeEvent(
    "evt_1",
    "worker:claim_accepted",
    "task_1",
    '{"workerId":"worker_1","traceContext":{"traceId":"abc"}}',
  );

  const state = workerStatusProjectionHandler(null, event) as unknown as WorkerStatusState;

  // traceContext should be excluded from details
  assert.equal(state.timeline[0]!.details!["traceContext"], undefined);
  assert.equal(state.timeline[0]!.details!["workerId"], "worker_1");
});

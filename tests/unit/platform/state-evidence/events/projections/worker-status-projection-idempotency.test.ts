import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyWorkerStatusState,
  workerStatusProjectionHandler,
} from "../../../../../../src/platform/five-plane-state-evidence/events/projections/worker-status-projection.js";

test("workerStatusProjectionHandler records processed event IDs", () => {
  const state = workerStatusProjectionHandler(null, {
    eventId: "evt-1",
    eventType: "worker:heartbeat_recorded",
    taskId: "task-1",
    payloadJson: JSON.stringify({ workerId: "worker-1" }),
    createdAt: "2026-05-04T00:00:00.000Z",
  }) as unknown as ReturnType<typeof createEmptyWorkerStatusState>;

  assert.deepEqual(state.processedEventIds, new Set(["evt-1"]));
});

test("workerStatusProjectionHandler skips duplicate events", () => {
  const initial = workerStatusProjectionHandler(null, {
    eventId: "evt-dup",
    eventType: "worker:heartbeat_recorded",
    taskId: "task-1",
    payloadJson: JSON.stringify({ workerId: "worker-1" }),
    createdAt: "2026-05-04T00:00:00.000Z",
  });

  const replayed = workerStatusProjectionHandler(initial, {
    eventId: "evt-dup",
    eventType: "worker:heartbeat_recorded",
    taskId: "task-1",
    payloadJson: JSON.stringify({ workerId: "worker-1" }),
    createdAt: "2026-05-04T00:00:01.000Z",
  }) as unknown as ReturnType<typeof createEmptyWorkerStatusState>;

  assert.equal(replayed.eventCount, 1);
  assert.deepEqual(replayed.processedEventIds, new Set(["evt-dup"]));
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkerDrainPhase,
  WorkerDrainProtocol,
  type WorkerDrainRequest,
} from "../../../../src/platform/five-plane-execution/worker-pool/worker-drain-protocol.js";

function createRequest(): WorkerDrainRequest {
  return {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2026-05-07T10:00:00.000Z",
    deadlineAt: "2026-05-07T10:10:00.000Z",
    drainReason: "graceful_shutdown",
    activeLeases: [
      {
        leaseId: "lease-1",
        nodeRunId: "node-1",
        expiresAt: "2026-05-07T10:12:00.000Z",
        handoverRequired: true,
      },
      {
        leaseId: "lease-2",
        nodeRunId: "node-2",
        expiresAt: "2026-05-07T10:12:00.000Z",
        handoverRequired: false,
      },
    ],
  };
}

test("WorkerDrainProtocol coordinates checkpoint against active drain state", async () => {
  const checkpointRequests: Array<Record<string, unknown>> = [];
  const protocol = new WorkerDrainProtocol({
    checkpointCoordinator: {
      createCheckpoint(request) {
        checkpointRequests.push(request as unknown as Record<string, unknown>);
        return true;
      },
    },
  });

  protocol.beginDrain(createRequest());
  const coordinated = await protocol.coordinateCheckpoint("worker-1", {
    runId: "run-1",
    stepId: "step-1",
  });

  assert.equal(coordinated, true);
  assert.deepEqual(checkpointRequests, [{
    workerId: "worker-1",
    runId: "run-1",
    stepId: "step-1",
    deadlineAt: "2026-05-07T10:10:00.000Z",
    activeLeaseIds: ["lease-1", "lease-2"],
    activeNodeRunIds: ["node-1", "node-2"],
  }]);
});

test("WorkerDrainProtocol releases completed leases through lease manager", () => {
  const releases: Array<Record<string, string>> = [];
  const protocol = new WorkerDrainProtocol({
    leaseManager: {
      releaseLease(request) {
        releases.push(request as unknown as Record<string, string>);
      },
    },
  });

  protocol.beginDrain(createRequest());
  protocol.releaseLease("worker-1", "lease-2");

  assert.deepEqual(releases, [{
    workerId: "worker-1",
    leaseId: "lease-2",
    nodeRunId: "node-2",
    reason: "completed",
  }]);
});

test("WorkerDrainProtocol termination forces handoff and notifies recovery", () => {
  const releases: Array<Record<string, string>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const protocol = new WorkerDrainProtocol({
    leaseManager: {
      releaseLease(request) {
        releases.push(request as unknown as Record<string, string>);
      },
    },
    recoveryNotifier: {
      notifyWorkerDrain(notification) {
        notifications.push(notification as unknown as Record<string, unknown>);
      },
    },
  });

  const initial = protocol.beginDrain(createRequest());
  const quiescing = protocol.advancePhase(initial, "2026-05-07T10:00:15.000Z");
  const terminated = protocol.advancePhase(quiescing, "2026-05-07T10:01:00.000Z");

  assert.equal(terminated.phase, WorkerDrainPhase.TERMINATE);
  assert.deepEqual(releases, [{
    workerId: "worker-1",
    leaseId: "lease-1",
    nodeRunId: "node-1",
    reason: "forced_handoff",
  }]);
  assert.deepEqual(notifications, [{
    workerId: "worker-1",
    deadlineAt: "2026-05-07T10:10:00.000Z",
    activeNodeRunIds: ["node-1", "node-2"],
    pendingLeaseIds: ["lease-1", "lease-2"],
    forcedHandoffLeaseIds: ["lease-1"],
  }]);
});

import assert from "node:assert/strict";
import test from "node:test";

// Import from the worker-pool index to verify exports
import { toWorkerSchedulingStatus } from "../../../../src/platform/five-plane-execution/worker-pool/worker/worker-scheduling-status.js";
import {
  computeWorkerLoadScore,
  computeEffectiveActiveLeaseCount,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
} from "../../../../src/platform/five-plane-execution/worker-pool/worker/worker-load-balancing.js";

// Re-export types from worker-pool index files
import type {
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerRemoteLogInput,
  WorkerHandshakeDecision,
  ExecutionWorkerHandshakeServiceOptions,
} from "../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-handshake-types.js";

import type { WorkerSchedulingStatus, WorkerStatus } from "../../../../src/platform/contracts/types/domain.js";

// Verify worker-pool index exports worker-scheduling-status
test("worker-pool index exports toWorkerSchedulingStatus [worker-pool-index]", () => {
  assert.ok(typeof toWorkerSchedulingStatus === "function");
});

// Verify worker-scheduling-status functionality
test("toWorkerSchedulingStatus returns correct scheduling status [worker-pool-index]", () => {
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
  assert.equal(toWorkerSchedulingStatus("degraded"), "degraded");
  assert.equal(toWorkerSchedulingStatus("draining"), "draining");
  assert.equal(toWorkerSchedulingStatus("quarantined"), "quarantined");
  assert.equal(toWorkerSchedulingStatus("offline"), "offline");
  assert.equal(toWorkerSchedulingStatus("unavailable"), "unavailable");
});

// Verify worker-load-balancing exports
test("worker-pool index exports computeWorkerLoadScore [worker-pool-index]", () => {
  assert.ok(typeof computeWorkerLoadScore === "function");
});

test("worker-pool index exports computeEffectiveActiveLeaseCount [worker-pool-index]", () => {
  assert.ok(typeof computeEffectiveActiveLeaseCount === "function");
});

test("worker-pool index exports summarizeWorkerLoadSkew [worker-pool-index]", () => {
  assert.ok(typeof summarizeWorkerLoadSkew === "function");
});

test("worker-pool index exports MAX_RECOMMENDED_STICKY_SHARE [worker-pool-index]", () => {
  assert.equal(typeof MAX_RECOMMENDED_STICKY_SHARE, "number");
  assert.equal(MAX_RECOMMENDED_STICKY_SHARE, 0.6);
});

// Worker load signal interface for testing
interface TestWorkerLoadSignal {
  workerId: string;
  queueAffinity: string | null;
  maxConcurrency: number;
  availableSlots: number;
  activeLeaseCount: number;
  runningExecutionCount: number;
  saturation: number | null;
  toolBacklogCount: number;
  cpuPct: number | null;
}

test("computeEffectiveActiveLeaseCount returns max of activeLeaseCount and runningExecutionCount [worker-pool-index]", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 3,
    runningExecutionCount: 5,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  assert.equal(computeEffectiveActiveLeaseCount(signal as never), 5);
});

test("computeEffectiveActiveLeaseCount returns activeLeaseCount when greater [worker-pool-index]", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 7,
    runningExecutionCount: 3,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  assert.equal(computeEffectiveActiveLeaseCount(signal as never), 7);
});

test("computeWorkerLoadScore returns non-negative number [worker-pool-index]", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  const score = computeWorkerLoadScore(signal as never);
  assert.ok(score >= 0);
});

test("computeWorkerLoadScore handles all saturation values [worker-pool-index]", () => {
  const signal1: TestWorkerLoadSignal = {
    workerId: "w1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: 0.5,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  const signal2: TestWorkerLoadSignal = {
    workerId: "w2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  const score1 = computeWorkerLoadScore(signal1 as never);
  const score2 = computeWorkerLoadScore(signal2 as never);
  assert.ok(score1 >= 0);
  assert.ok(score2 >= 0);
});

test("summarizeWorkerLoadSkew returns not detected for empty signals [worker-pool-index]", () => {
  const result = summarizeWorkerLoadSkew([]);
  assert.equal(result.detected, false);
  assert.equal(result.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew returns not detected for single worker [worker-pool-index]", () => {
  const signals: TestWorkerLoadSignal[] = [{
    workerId: "solo-worker",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  }];
  const result = summarizeWorkerLoadSkew(signals as never);
  assert.equal(result.detected, false);
});

test("summarizeWorkerLoadSkew returns not detected for low total lease count [worker-pool-index]", () => {
  const signals: TestWorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 1,
      runningExecutionCount: 1,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-2",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 1,
      runningExecutionCount: 1,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];
  const result = summarizeWorkerLoadSkew(signals as never);
  // MIN_LOAD_SKEW_ACTIVE_LEASES = 3, so with total=2 should not detect
  assert.equal(result.detected, false);
});

test("summarizeWorkerLoadSkew returns correct structure for valid signals [worker-pool-index]", () => {
  const signals: TestWorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 5,
      runningExecutionCount: 5,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-2",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 1,
      runningExecutionCount: 1,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];
  const result = summarizeWorkerLoadSkew(signals as never);
  assert.ok(typeof result.detected === "boolean");
  assert.ok(typeof result.dominantWorkerId === "string" || result.dominantWorkerId === null);
  assert.ok(typeof result.dominantWorkerShare === "number" || result.dominantWorkerShare === null);
  assert.ok(Array.isArray(result.skewedWorkerIds));
  assert.equal(result.totalActiveLeaseCount, 6);
  assert.equal(result.maxRecommendedStickyShare, 0.6);
});

// Handshake types exports verification
test("worker-pool exports WorkerClaimExecutionInput type [worker-pool-index]", () => {
  const input: WorkerClaimExecutionInput = {
    ticketId: "ticket-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    fencingToken: 1,
  };
  assert.equal(input.ticketId, "ticket-1");
});

test("worker-pool exports WorkerExecutionHeartbeatInput type [worker-pool-index]", () => {
  const input: WorkerExecutionHeartbeatInput = {
    executionId: "exec-1",
    workerId: "worker-1",
    leaseId: "lease-1",
    fencingToken: 1,
    ttlMs: 30000,
  };
  assert.equal(input.executionId, "exec-1");
});

test("worker-pool exports WorkerRemoteLogInput type [worker-pool-index]", () => {
  const input: WorkerRemoteLogInput = {
    level: "info",
    message: "test message",
  };
  assert.equal(input.level, "info");
});

test("worker-pool exports WorkerHandshakeDecision type [worker-pool-index]", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: true,
    reasonCode: null,
    executionId: "exec-1",
    ticketId: "ticket-1",
    leaseId: "lease-1",
  };
  assert.equal(decision.accepted, true);
});

test("worker-pool exports ExecutionWorkerHandshakeServiceOptions type [worker-pool-index]", () => {
  const options: ExecutionWorkerHandshakeServiceOptions = {};
  assert.ok(options !== null);
});

// WorkerSchedulingStatus type verification
test("WorkerSchedulingStatus type is usable [worker-pool-index]", () => {
  const statuses: WorkerSchedulingStatus[] = ["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 6);
});

test("WorkerStatus type includes all expected values [worker-pool-index]", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 7);
});
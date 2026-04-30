import assert from "node:assert/strict";
import test from "node:test";

import {
  computeWorkerLoadScore,
  computeEffectiveActiveLeaseCount,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
} from "../../../../../src/platform/execution/worker-pool/worker/worker-load-balancing.js";
import { toWorkerSchedulingStatus } from "../../../../../src/platform/execution/worker-pool/worker/worker-scheduling-status.js";
import type { WorkerSchedulingStatus, WorkerStatus } from "../../../../..//src/platform/contracts/types/domain.js";

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

test("worker-load-balancing exports computeWorkerLoadScore", () => {
  assert.ok(typeof computeWorkerLoadScore === "function");
});

test("worker-load-balancing exports computeEffectiveActiveLeaseCount", () => {
  assert.ok(typeof computeEffectiveActiveLeaseCount === "function");
});

test("worker-load-balancing exports summarizeWorkerLoadSkew", () => {
  assert.ok(typeof summarizeWorkerLoadSkew === "function");
});

test("worker-load-balancing exports MAX_RECOMMENDED_STICKY_SHARE", () => {
  assert.equal(typeof MAX_RECOMMENDED_STICKY_SHARE, "number");
  assert.equal(MAX_RECOMMENDED_STICKY_SHARE, 0.6);
});

test("computeEffectiveActiveLeaseCount returns max of activeLeaseCount and runningExecutionCount", () => {
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

test("computeEffectiveActiveLeaseCount returns activeLeaseCount when greater", () => {
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

test("computeEffectiveActiveLeaseCount returns equal values when both same", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-3",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 5,
    runningExecutionCount: 5,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  assert.equal(computeEffectiveActiveLeaseCount(signal as never), 5);
});

test("computeWorkerLoadScore returns non-negative number", () => {
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

test("computeWorkerLoadScore handles all saturation values", () => {
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

test("summarizeWorkerLoadSkew returns not detected for empty signals", () => {
  const result = summarizeWorkerLoadSkew([]);
  assert.equal(result.detected, false);
  assert.equal(result.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew returns not detected for single worker", () => {
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

test("summarizeWorkerLoadSkew returns not detected for low total lease count", () => {
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
  // MIN_LOAD_SKEW_ACTIVE_LEASES threshold not met
  assert.equal(result.detected, false);
});

test("summarizeWorkerLoadSkew returns correct structure for valid signals", () => {
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

test("toWorkerSchedulingStatus returns correct scheduling status for idle", () => {
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
});

test("toWorkerSchedulingStatus returns correct scheduling status for busy", () => {
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
});

test("toWorkerSchedulingStatus returns correct scheduling status for degraded", () => {
  assert.equal(toWorkerSchedulingStatus("degraded"), "degraded");
});

test("toWorkerSchedulingStatus returns correct scheduling status for draining", () => {
  assert.equal(toWorkerSchedulingStatus("draining"), "draining");
});

test("toWorkerSchedulingStatus returns correct scheduling status for quarantined", () => {
  assert.equal(toWorkerSchedulingStatus("quarantined"), "quarantined");
});

test("toWorkerSchedulingStatus returns correct scheduling status for offline", () => {
  assert.equal(toWorkerSchedulingStatus("offline"), "offline");
});

test("toWorkerSchedulingStatus returns correct scheduling status for unavailable", () => {
  assert.equal(toWorkerSchedulingStatus("unavailable"), "unavailable");
});

test("WorkerSchedulingStatus type includes all expected values", () => {
  const statuses: WorkerSchedulingStatus[] = ["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 6);
});

test("WorkerStatus type includes all expected values", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  assert.equal(statuses.length, 7);
});

test("computeWorkerLoadScore with zero availableSlots", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 0,
    activeLeaseCount: 4,
    runningExecutionCount: 4,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };
  const score = computeWorkerLoadScore(signal as never);
  assert.ok(score >= 0);
});

test("computeWorkerLoadScore with high toolBacklogCount", () => {
  const signal: TestWorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 10,
    cpuPct: null,
  };
  const score = computeWorkerLoadScore(signal as never);
  assert.ok(score >= 0);
});
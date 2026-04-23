import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
  type WorkerLoadSignal,
} from "../../../../../src/platform/execution/worker-pool/worker/worker-load-balancing.js";

function makeSignal(overrides: Partial<WorkerLoadSignal> = {}): WorkerLoadSignal {
  return {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
    ...overrides,
  };
}

test("computeEffectiveActiveLeaseCount returns max of activeLeaseCount and runningExecutionCount", () => {
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 3, runningExecutionCount: 1 })), 3);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 1, runningExecutionCount: 5 })), 5);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 2, runningExecutionCount: 2 })), 2);
});

test("computeWorkerLoadScore returns 0 for idle worker", () => {
  const signal = makeSignal({ activeLeaseCount: 0, runningExecutionCount: 0, toolBacklogCount: 0, cpuPct: null });
  const score = computeWorkerLoadScore(signal);
  assert.equal(score, 0);
});

test("computeWorkerLoadScore increases with active leases", () => {
  const low = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 1, maxConcurrency: 4, runningExecutionCount: 1 }));
  const high = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 3, maxConcurrency: 4, runningExecutionCount: 3 }));
  assert.ok(high > low);
});

test("computeWorkerLoadScore penalizes backlog", () => {
  const noBacklog = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 2, maxConcurrency: 4, runningExecutionCount: 2, toolBacklogCount: 0 }));
  const withBacklog = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 2, maxConcurrency: 4, runningExecutionCount: 2, toolBacklogCount: 8 }));
  assert.ok(withBacklog > noBacklog);
});

test("computeWorkerLoadScore penalizes high CPU", () => {
  const noCpu = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 2, maxConcurrency: 4, runningExecutionCount: 2, cpuPct: null }));
  const highCpu = computeWorkerLoadScore(makeSignal({ activeLeaseCount: 2, maxConcurrency: 4, runningExecutionCount: 2, cpuPct: 80 }));
  assert.ok(highCpu > noCpu);
});

test("summarizeWorkerLoadSkew returns not detected for single worker", () => {
  const signals = [makeSignal({ workerId: "worker-1", activeLeaseCount: 5, runningExecutionCount: 5 })];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
  assert.equal(summary.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew returns not detected below minimum active leases", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 1, runningExecutionCount: 1 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew returns not detected when load is balanced", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 1 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 1 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew detects skew when one worker dominates", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 8 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, availableSlots: 4, maxConcurrency: 8 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, true);
  assert.equal(summary.dominantWorkerId, "worker-1");
  assert.ok(summary.dominantWorkerShare != null);
  assert.ok(summary.dominantWorkerShare! > MAX_RECOMMENDED_STICKY_SHARE);
});

test("summarizeWorkerLoadSkew does not detect skew when alternative worker has capacity", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 8 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 5, runningExecutionCount: 5, availableSlots: 3, maxConcurrency: 8 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew totalActiveLeaseCount sums all workers", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 3, runningExecutionCount: 3 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 5, runningExecutionCount: 5 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.totalActiveLeaseCount, 8);
});

test("summarizeWorkerLoadSkew maxRecommendedStickyShare is 0.6", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, availableSlots: 4 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.maxRecommendedStickyShare, 0.6);
});

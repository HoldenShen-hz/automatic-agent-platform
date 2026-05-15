import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
  type WorkerLoadSignal,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker-load-balancing.js";

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

// ---------------------------------------------------------------------------
// computeEffectiveActiveLeaseCount
// ---------------------------------------------------------------------------

test("computeEffectiveActiveLeaseCount returns activeLeaseCount when greater", () => {
  const signal = makeSignal({ activeLeaseCount: 5, runningExecutionCount: 2 });
  assert.equal(computeEffectiveActiveLeaseCount(signal), 5);
});

test("computeEffectiveActiveLeaseCount returns runningExecutionCount when greater", () => {
  const signal = makeSignal({ activeLeaseCount: 2, runningExecutionCount: 7 });
  assert.equal(computeEffectiveActiveLeaseCount(signal), 7);
});

test("computeEffectiveActiveLeaseCount returns either when equal", () => {
  const signal = makeSignal({ activeLeaseCount: 3, runningExecutionCount: 3 });
  assert.equal(computeEffectiveActiveLeaseCount(signal), 3);
});

test("computeEffectiveActiveLeaseCount handles zero values", () => {
  const signal = makeSignal({ activeLeaseCount: 0, runningExecutionCount: 0 });
  assert.equal(computeEffectiveActiveLeaseCount(signal), 0);
});

test("computeEffectiveActiveLeaseCount handles undefined/null-like values", () => {
  const signal = makeSignal({ activeLeaseCount: 1, runningExecutionCount: 0 });
  assert.equal(computeEffectiveActiveLeaseCount(signal), 1);
});

// ---------------------------------------------------------------------------
// computeWorkerLoadScore
// ---------------------------------------------------------------------------

test("computeWorkerLoadScore returns 0 for completely idle worker", () => {
  const signal = makeSignal({
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    toolBacklogCount: 0,
    cpuPct: null,
    saturation: null,
  });
  assert.equal(computeWorkerLoadScore(signal), 0);
});

test("computeWorkerLoadScore increases with active lease ratio", () => {
  const lowLoad = makeSignal({
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    maxConcurrency: 4,
    toolBacklogCount: 0,
    cpuPct: null,
    saturation: null,
  });
  const highLoad = makeSignal({
    activeLeaseCount: 3,
    runningExecutionCount: 3,
    maxConcurrency: 4,
    toolBacklogCount: 0,
    cpuPct: null,
    saturation: null,
  });
  assert.ok(computeWorkerLoadScore(highLoad) > computeWorkerLoadScore(lowLoad));
});

test("computeWorkerLoadScore applies saturation penalty when provided", () => {
  const noSaturation = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    saturation: null,
  });
  const highSaturation = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    saturation: 0.9,
  });
  assert.ok(computeWorkerLoadScore(highSaturation) > computeWorkerLoadScore(noSaturation));
});

test("computeWorkerLoadScore penalizes tool backlog", () => {
  const noBacklog = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    toolBacklogCount: 0,
  });
  const highBacklog = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    toolBacklogCount: 8,
  });
  assert.ok(computeWorkerLoadScore(highBacklog) > computeWorkerLoadScore(noBacklog));
});

test("computeWorkerLoadScore penalizes high CPU usage", () => {
  const noCpu = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    cpuPct: null,
  });
  const highCpu = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    cpuPct: 80,
  });
  assert.ok(computeWorkerLoadScore(highCpu) > computeWorkerLoadScore(noCpu));
});

test("computeWorkerLoadScore caps CPU penalty at 100%", () => {
  const lowCpu = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    cpuPct: 50,
  });
  const highCpu = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 4,
    cpuPct: 150, // Over 100%
  });
  // CPU penalty is capped, so highCpu should not be significantly higher than lowCpu
  const diff = computeWorkerLoadScore(highCpu) - computeWorkerLoadScore(lowCpu);
  assert.ok(diff <= 0.2); // Max CPU penalty is 0.2
});

test("computeWorkerLoadScore handles maxConcurrency of 0", () => {
  const signal = makeSignal({
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    maxConcurrency: 0,
  });
  // Should use 1 as fallback to avoid division by zero
  const score = computeWorkerLoadScore(signal);
  assert.ok(Number.isFinite(score));
});

test("computeWorkerLoadScore combines all penalties", () => {
  const minimal = makeSignal({
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    toolBacklogCount: 0,
    cpuPct: null,
    saturation: null,
  });
  const maximal = makeSignal({
    activeLeaseCount: 4,
    runningExecutionCount: 4,
    maxConcurrency: 4,
    toolBacklogCount: 16, // Max backlog penalty
    cpuPct: 100,
    saturation: 1.0,
  });
  assert.ok(computeWorkerLoadScore(maximal) > computeWorkerLoadScore(minimal));
});

// ---------------------------------------------------------------------------
// summarizeWorkerLoadSkew
// ---------------------------------------------------------------------------

test("summarizeWorkerLoadSkew returns not detected for empty array", () => {
  const summary = summarizeWorkerLoadSkew([]);
  assert.equal(summary.detected, false);
  assert.equal(summary.dominantWorkerId, null);
  assert.equal(summary.totalActiveLeaseCount, 0);
});

test("summarizeWorkerLoadSkew returns not detected for single worker", () => {
  const signals = [makeSignal({ workerId: "worker-1", activeLeaseCount: 5, runningExecutionCount: 5 })];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew returns not detected when below minimum active leases", () => {
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
  assert.ok(summary.dominantWorkerShare! > MAX_RECOMMENDED_STICKY_SHARE);
});

test("summarizeWorkerLoadSkew does not detect skew when alternative worker has capacity", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 8 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 5, runningExecutionCount: 5, availableSlots: 3, maxConcurrency: 8 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  // Even though worker-1 has more, worker-2 has capacity and lower score
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew does not detect skew when share is at threshold", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 10 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 4, runningExecutionCount: 4, availableSlots: 0, maxConcurrency: 10 }),
  ];
  // 6/(6+4) = 0.6 = MAX_RECOMMENDED_STICKY_SHARE, not detected
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

test("summarizeWorkerLoadSkew detects skew above threshold", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 7, runningExecutionCount: 7, availableSlots: 0, maxConcurrency: 10 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 2, maxConcurrency: 10 }),
  ];
  // 7/(7+3) = 0.7 > 0.6
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, true);
  assert.equal(summary.dominantWorkerId, "worker-1");
});

test("summarizeWorkerLoadSkew handles workers with zero load", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 5, runningExecutionCount: 5, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 0, runningExecutionCount: 0, availableSlots: 5 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, true);
  assert.equal(summary.dominantWorkerId, "worker-1");
  assert.equal(summary.totalActiveLeaseCount, 5);
});

test("summarizeWorkerLoadSkew does not report skew for balanced workers even when load score differs", () => {
  const signals = [
    makeSignal({ workerId: "worker-a", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 0, cpuPct: 20 }),
    makeSignal({ workerId: "worker-b", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 0, cpuPct: 80 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
  assert.equal(summary.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew does not report skew for balanced workers even when workerId would break ties", () => {
  const signals = [
    makeSignal({ workerId: "worker-b", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 0 }),
    makeSignal({ workerId: "worker-a", activeLeaseCount: 3, runningExecutionCount: 3, availableSlots: 0 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
  assert.equal(summary.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew returns correct skewedWorkerIds when detected", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 8 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, availableSlots: 4, maxConcurrency: 8 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.deepEqual(summary.skewedWorkerIds, ["worker-1"]);
});

test("summarizeWorkerLoadSkew returns empty skewedWorkerIds when not detected", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 2, runningExecutionCount: 2, availableSlots: 2 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 2, runningExecutionCount: 2, availableSlots: 2 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.deepEqual(summary.skewedWorkerIds, []);
});

test("summarizeWorkerLoadSkew includes maxRecommendedStickyShare in result", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, availableSlots: 0, maxConcurrency: 8 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, availableSlots: 4, maxConcurrency: 8 }),
  ];
  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.maxRecommendedStickyShare, MAX_RECOMMENDED_STICKY_SHARE);
  assert.equal(summary.maxRecommendedStickyShare, 0.6);
});

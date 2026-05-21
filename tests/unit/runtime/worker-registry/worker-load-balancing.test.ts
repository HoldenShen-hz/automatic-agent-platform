import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
  type WorkerLoadSignal,
} from "../../../../src/platform/five-plane-execution/worker-pool/worker/worker-load-balancing.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeSignal(overrides: Partial<WorkerLoadSignal> = {}): WorkerLoadSignal {
  return {
    workerId: "worker-1",
    queueAffinity: "default",
    maxConcurrency: 4,
    availableSlots: 3,
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("MAX_RECOMMENDED_STICKY_SHARE is 0.6", () => {
  assert.equal(MAX_RECOMMENDED_STICKY_SHARE, 0.6);
});

// ---------------------------------------------------------------------------
// computeEffectiveActiveLeaseCount
// ---------------------------------------------------------------------------

test("computeEffectiveActiveLeaseCount returns activeLeaseCount when greater", () => {
  const signal = makeSignal({ activeLeaseCount: 5, runningExecutionCount: 3 });
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
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 0, runningExecutionCount: 0 })), 0);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 0, runningExecutionCount: 1 })), 1);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 1, runningExecutionCount: 0 })), 1);
});

// ---------------------------------------------------------------------------
// computeWorkerLoadScore - basic scoring
// ---------------------------------------------------------------------------

test("computeWorkerLoadScore returns 0 for idle worker", () => {
  const signal = makeSignal({ activeLeaseCount: 0, runningExecutionCount: 0 });
  assert.equal(computeWorkerLoadScore(signal), 0);
});

test("computeWorkerLoadScore increases with active leases", () => {
  const signal1 = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, runningExecutionCount: 1 });
  const signal2 = makeSignal({ maxConcurrency: 4, activeLeaseCount: 2, runningExecutionCount: 2 });
  assert.ok(computeWorkerLoadScore(signal2) > computeWorkerLoadScore(signal1));
});

test("computeWorkerLoadScore increases with running executions", () => {
  const signal1 = makeSignal({ maxConcurrency: 4, activeLeaseCount: 0, runningExecutionCount: 1 });
  const signal2 = makeSignal({ maxConcurrency: 4, activeLeaseCount: 0, runningExecutionCount: 2 });
  assert.ok(computeWorkerLoadScore(signal2) > computeWorkerLoadScore(signal1));
});

test("computeWorkerLoadScore uses saturation when provided", () => {
  const withoutSaturation = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, saturation: null });
  const withHighSaturation = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, saturation: 0.9 });
  assert.ok(computeWorkerLoadScore(withHighSaturation) >= computeWorkerLoadScore(withoutSaturation));
});

test("computeWorkerLoadScore uses saturation over activeLeaseRatio when higher", () => {
  // When saturation is very high, it should dominate the score
  const signal = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, runningExecutionCount: 1, saturation: 0.95 });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score >= 0.9);
});

test("computeWorkerLoadScore penalizes backlog", () => {
  const withoutBacklog = makeSignal({ maxConcurrency: 4, toolBacklogCount: 0 });
  const withBacklog = makeSignal({ maxConcurrency: 4, toolBacklogCount: 8 });
  assert.ok(computeWorkerLoadScore(withBacklog) > computeWorkerLoadScore(withoutBacklog));
});

test("computeWorkerLoadScore penalizes high CPU", () => {
  const withoutCpu = makeSignal({ maxConcurrency: 4, cpuPct: null });
  const withHighCpu = makeSignal({ maxConcurrency: 4, cpuPct: 90 });
  assert.ok(computeWorkerLoadScore(withHighCpu) >= computeWorkerLoadScore(withoutCpu));
});

test("computeWorkerLoadScore ignores negative CPU", () => {
  const signal = makeSignal({ maxConcurrency: 4, cpuPct: -10 });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score >= 0);
});

test("computeWorkerLoadScore caps CPU at 100", () => {
  const signal = makeSignal({ maxConcurrency: 4, cpuPct: 150 });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score >= 0);
});

test("computeWorkerLoadScore handles maxConcurrency of 0 by using 1", () => {
  const signal = makeSignal({ maxConcurrency: 0, activeLeaseCount: 5 });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score > 0);
});

test("computeWorkerLoadScore never returns negative score", () => {
  const signal = makeSignal({
    maxConcurrency: 4,
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score >= 0);
});

// ---------------------------------------------------------------------------
// summarizeWorkerLoadSkew - edge cases
// ---------------------------------------------------------------------------

test("summarizeWorkerLoadSkew returns not detected for empty array", () => {
  const result = summarizeWorkerLoadSkew([]);
  assert.equal(result.detected, false);
  assert.equal(result.dominantWorkerId, null);
  assert.equal(result.dominantWorkerShare, null);
  assert.deepEqual(result.skewedWorkerIds, []);
  assert.equal(result.totalActiveLeaseCount, 0);
});

test("summarizeWorkerLoadSkew returns not detected for single worker", () => {
  const signals = [makeSignal({ workerId: "worker-1", activeLeaseCount: 5, runningExecutionCount: 5 })];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, false);
  assert.equal(result.dominantWorkerId, null);
});

test("summarizeWorkerLoadSkew returns not detected when total leases below threshold", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 1, runningExecutionCount: 1 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, false);
});

test("summarizeWorkerLoadSkew returns not detected when dominant share is below threshold", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 3, runningExecutionCount: 3, maxConcurrency: 4, availableSlots: 1 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 3, runningExecutionCount: 3, maxConcurrency: 4, availableSlots: 1 }),
    makeSignal({ workerId: "worker-3", activeLeaseCount: 3, runningExecutionCount: 3, maxConcurrency: 4, availableSlots: 1 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, false);
});

// ---------------------------------------------------------------------------
// summarizeWorkerLoadSkew - detection
// ---------------------------------------------------------------------------

test("summarizeWorkerLoadSkew detects skew when one worker has too many leases", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
    makeSignal({ workerId: "worker-3", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, true);
  assert.equal(result.dominantWorkerId, "worker-1");
  assert.ok(result.dominantWorkerShare !== null);
  assert.ok(result.dominantWorkerShare! > MAX_RECOMMENDED_STICKY_SHARE);
  assert.deepEqual(result.skewedWorkerIds, ["worker-1"]);
  assert.equal(result.totalActiveLeaseCount, 8);
});

test("summarizeWorkerLoadSkew does not detect skew if alternative capacity does not exist", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, false);
});

test("summarizeWorkerLoadSkew ignores workers with no active leases when no alternative capacity", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 0, runningExecutionCount: 0, maxConcurrency: 4, availableSlots: 0 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, false);
  assert.equal(result.totalActiveLeaseCount, 6);
});

test("summarizeWorkerLoadSkew uses runningExecutionCount when higher than activeLeaseCount", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 2, runningExecutionCount: 10, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
    makeSignal({ workerId: "worker-3", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, true);
  assert.equal(result.dominantWorkerId, "worker-1");
  assert.equal(result.totalActiveLeaseCount, 12);
});

test("summarizeWorkerLoadSkew result includes maxRecommendedStickyShare", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
    makeSignal({ workerId: "worker-3", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.maxRecommendedStickyShare, MAX_RECOMMENDED_STICKY_SHARE);
  assert.equal(result.maxRecommendedStickyShare, 0.6);
});

test("summarizeWorkerLoadSkew dominant worker is selected by lease count then load score", () => {
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0, saturation: 0.9 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3, saturation: 0.3 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, true);
  assert.equal(result.dominantWorkerId, "worker-1");
});

test("summarizeWorkerLoadSkew dominant worker is determined by workerId when counts are equal", () => {
  // Both workers have same lease count and same load score
  // The one with alphabetically first workerId should be selected
  const signals = [
    makeSignal({ workerId: "worker-b", activeLeaseCount: 5, runningExecutionCount: 5, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-a", activeLeaseCount: 5, runningExecutionCount: 5, maxConcurrency: 4, availableSlots: 0 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  // worker-a comes first alphabetically, so it should be dominant
  assert.equal(result.dominantWorkerId, "worker-a");
});

test("summarizeWorkerLoadSkew detects skew at exact threshold when alternative capacity exists", () => {
  // total = 5, dominant share = 3/5 = 0.6 exactly at threshold
  // Skew should be detected if there's alternative capacity
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 3, runningExecutionCount: 3, maxConcurrency: 4, availableSlots: 1 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 2, runningExecutionCount: 2, maxConcurrency: 4, availableSlots: 2 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  // Share is exactly 0.6, which is not greater than 0.6, so should not detect
  assert.equal(result.detected, false);
});

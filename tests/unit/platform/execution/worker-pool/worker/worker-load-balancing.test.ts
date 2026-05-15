import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
  type WorkerLoadSignal,
} from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/worker-load-balancing.js";

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
// computeEffectiveActiveLeaseCount
// ---------------------------------------------------------------------------

test("computeEffectiveActiveLeaseCount returns max of activeLeaseCount and runningExecutionCount", () => {
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 5, runningExecutionCount: 3 })), 5);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 2, runningExecutionCount: 7 })), 7);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 3, runningExecutionCount: 3 })), 3);
});

test("computeEffectiveActiveLeaseCount handles zero values", () => {
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 0, runningExecutionCount: 0 })), 0);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 0, runningExecutionCount: 1 })), 1);
  assert.equal(computeEffectiveActiveLeaseCount(makeSignal({ activeLeaseCount: 1, runningExecutionCount: 0 })), 1);
});

// ---------------------------------------------------------------------------
// computeWorkerLoadScore
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

test("computeWorkerLoadScore penalizes high saturation", () => {
  const withoutSaturation = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, saturation: null });
  const withHighSaturation = makeSignal({ maxConcurrency: 4, activeLeaseCount: 1, saturation: 0.9 });
  assert.ok(computeWorkerLoadScore(withHighSaturation) >= computeWorkerLoadScore(withoutSaturation));
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

test("computeWorkerLoadScore handles maxConcurrency of 0 by using 1", () => {
  const signal = makeSignal({ maxConcurrency: 0, activeLeaseCount: 5 });
  const score = computeWorkerLoadScore(signal);
  assert.ok(score > 0);
});

// ---------------------------------------------------------------------------
// summarizeWorkerLoadSkew
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
  // worker-2 has no leases but also no available capacity (all slots used by 0 leases means nothing)
  // When a worker has 0 active leases, its loadScore is 0, but it also means there's no
  // alternative capacity if it has 0 available slots (can't take more work)
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 0, runningExecutionCount: 0, maxConcurrency: 4, availableSlots: 0 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  // Only one worker has load, so no skew can be detected
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
  // worker-1 has more leases and higher saturation (higher load score)
  // total = 7, worker-1 share = 6/7 ≈ 0.857 > 0.6 threshold
  const signals = [
    makeSignal({ workerId: "worker-1", activeLeaseCount: 6, runningExecutionCount: 6, maxConcurrency: 4, availableSlots: 0, saturation: 0.9 }),
    makeSignal({ workerId: "worker-2", activeLeaseCount: 1, runningExecutionCount: 1, maxConcurrency: 4, availableSlots: 3, saturation: 0.3 }),
  ];
  const result = summarizeWorkerLoadSkew(signals);
  assert.equal(result.detected, true);
  // worker-1 has higher lease count and higher saturation, so it should be dominant
  assert.equal(result.dominantWorkerId, "worker-1");
});

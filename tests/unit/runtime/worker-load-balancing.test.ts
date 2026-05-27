import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  MAX_RECOMMENDED_STICKY_SHARE,
} from "../../../src/platform/five-plane-execution/worker-pool/worker-load-balancing.js";

test("worker load balancing computes effective active leases from the stronger of active leases and running work [worker-load-balancing]", () => {
  assert.equal(
    computeEffectiveActiveLeaseCount({
      workerId: "worker-a",
      queueAffinity: "default",
      maxConcurrency: 4,
      availableSlots: 3,
      activeLeaseCount: 3,
      runningExecutionCount: 1,
      saturation: 0.9,
      toolBacklogCount: 2,
      cpuPct: 40,
    }),
    3,
  );
});

test("summarizeWorkerLoadSkew does NOT detect skew when dominantWorkerShare equals exactly MAX_RECOMMENDED_STICKY_SHARE (0.6) [worker-load-balancing]", () => {
  // With 5 total leases (3 on worker-a, 2 on worker-b), share = 3/5 = 0.6
  // 0.6 is NOT > 0.6, so skew should not be detected even with alternative capacity
  const summary = summarizeWorkerLoadSkew([
    {
      workerId: "worker-a",
      queueAffinity: "default",
      maxConcurrency: 4,
      availableSlots: 1,
      activeLeaseCount: 3,
      runningExecutionCount: 0,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-b",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 1,
      activeLeaseCount: 2,
      runningExecutionCount: 0,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ]);

  assert.equal(summary.detected, false, "Should not detect skew at exactly 0.6 share");
  assert.equal(summary.dominantWorkerShare, null, "Should not report dominant share when not detected");
  assert.equal(summary.totalActiveLeaseCount, 5);
  assert.equal(summary.maxRecommendedStickyShare, MAX_RECOMMENDED_STICKY_SHARE);
});

test("summarizeWorkerLoadSkew detects skew when dominantWorkerShare exceeds MAX_RECOMMENDED_STICKY_SHARE (0.6) [worker-load-balancing]", () => {
  // With 6 total leases (4 on worker-a, 2 on worker-b), share = 4/6 ≈ 0.667 > 0.6
  // Alternative capacity exists (worker-b has availableSlots and lower load score)
  const summary = summarizeWorkerLoadSkew([
    {
      workerId: "worker-a",
      queueAffinity: "default",
      maxConcurrency: 4,
      availableSlots: 1,
      activeLeaseCount: 4,
      runningExecutionCount: 0,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-b",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 1,
      activeLeaseCount: 2,
      runningExecutionCount: 0,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ]);

  assert.equal(summary.detected, true, "Should detect skew when share exceeds 0.6");
  assert.equal(summary.dominantWorkerId, "worker-a");
  assert.ok(summary.dominantWorkerShare != null && summary.dominantWorkerShare > 0.6);
  assert.deepEqual(summary.skewedWorkerIds, ["worker-a"]);
  assert.equal(summary.totalActiveLeaseCount, 6);
});

test("worker load balancing penalizes saturated workers and detects sticky load skew when alternative capacity exists [worker-load-balancing]", () => {
  const dominantScore = computeWorkerLoadScore({
    workerId: "worker-hot",
    queueAffinity: "default",
    maxConcurrency: 4,
    availableSlots: 3,
    activeLeaseCount: 3,
    runningExecutionCount: 1,
    saturation: 0.95,
    toolBacklogCount: 4,
    cpuPct: 78,
  });
  const coolScore = computeWorkerLoadScore({
    workerId: "worker-cool",
    queueAffinity: null,
    maxConcurrency: 1,
    availableSlots: 1,
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    saturation: 0.05,
    toolBacklogCount: 0,
    cpuPct: 12,
  });
  const summary = summarizeWorkerLoadSkew([
    {
      workerId: "worker-hot",
      queueAffinity: "default",
      maxConcurrency: 4,
      availableSlots: 3,
      activeLeaseCount: 3,
      runningExecutionCount: 1,
      saturation: 0.95,
      toolBacklogCount: 4,
      cpuPct: 78,
    },
    {
      workerId: "worker-cool",
      queueAffinity: null,
      maxConcurrency: 1,
      availableSlots: 1,
      activeLeaseCount: 0,
      runningExecutionCount: 0,
      saturation: 0.05,
      toolBacklogCount: 0,
      cpuPct: 12,
    },
  ]);

  assert.ok(dominantScore > coolScore);
  assert.equal(summary.detected, true);
  assert.equal(summary.dominantWorkerId, "worker-hot");
  assert.equal(summary.dominantWorkerShare, 1);
  assert.deepEqual(summary.skewedWorkerIds, ["worker-hot"]);
});

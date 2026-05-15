import test from "node:test";
import assert from "node:assert/strict";

import { CanaryTrafficRouter } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/canary-traffic-router.js";

test("CanaryTrafficRouter returns 0% for draft status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("draft"), 0);
});

test("CanaryTrafficRouter returns 0% for pending_approval status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("pending_approval"), 0);
});

test("CanaryTrafficRouter returns 0% for shadow status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("shadow"), 0);
});

test("CanaryTrafficRouter returns correct percentages for progressive rollout", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("canary_5"), 5);
  assert.equal(router.getTrafficPercentage("partial_25"), 25);
  assert.equal(router.getTrafficPercentage("partial_50"), 50);
  assert.equal(router.getTrafficPercentage("partial_75"), 75);
});

test("CanaryTrafficRouter returns 100% for stable status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("stable"), 100);
});

test("CanaryTrafficRouter returns 0% for rejected status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rejected"), 0);
});

test("CanaryTrafficRouter returns 0% for rolled_back status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rolled_back"), 0);
});

test("CanaryTrafficRouter returns 0% for paused status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("paused"), 0);
});

test("CanaryTrafficRouter.route returns correct decision structure", () => {
  const router = new CanaryTrafficRouter();
  const decision = router.route("task_123", "canary_5");

  assert.equal(decision.trafficPercentage, 5);
  assert.ok(decision.bucket >= 0 && decision.bucket < 100);
  assert.equal(typeof decision.matched, "boolean");
});

test("CanaryTrafficRouter.route is deterministic for same taskId", () => {
  const router = new CanaryTrafficRouter();
  const decision1 = router.route("task_same", "partial_50");
  const decision2 = router.route("task_same", "partial_50");

  assert.equal(decision1.bucket, decision2.bucket);
  assert.equal(decision1.matched, decision2.matched);
});

test("CanaryTrafficRouter.shouldRoute returns true when bucket is within traffic", () => {
  const router = new CanaryTrafficRouter();
  // A task with hash bucket 3 should match canary_5 (5% traffic)
  // We need to find a taskId that hashes to a low bucket
  let matchingTaskId = "";
  for (let i = 0; i < 1000; i++) {
    const taskId = `task_${i}`;
    const decision = router.route(taskId, "canary_5");
    if (decision.matched && decision.bucket < 5) {
      matchingTaskId = taskId;
      break;
    }
  }

  if (matchingTaskId) {
    assert.equal(router.shouldRoute(matchingTaskId, "canary_5"), true);
  }
});

test("CanaryTrafficRouter.shouldRoute returns false when bucket is outside traffic", () => {
  const router = new CanaryTrafficRouter();
  // A task with hash bucket 90 should not match canary_5 (5% traffic)
  let nonMatchingTaskId = "";
  for (let i = 0; i < 1000; i++) {
    const taskId = `task_${i}`;
    const decision = router.route(taskId, "canary_5");
    if (!decision.matched && decision.bucket >= 5) {
      nonMatchingTaskId = taskId;
      break;
    }
  }

  if (nonMatchingTaskId) {
    assert.equal(router.shouldRoute(nonMatchingTaskId, "canary_5"), false);
  }
});

test("CanaryTrafficRouter stable status always routes matched", () => {
  const router = new CanaryTrafficRouter();
  // With 100% traffic, any bucket should match
  for (let i = 0; i < 100; i++) {
    const decision = router.route(`task_${i}`, "stable");
    assert.equal(decision.matched, true);
    assert.equal(decision.trafficPercentage, 100);
  }
});

test("CanaryTrafficRouter draft status never routes", () => {
  const router = new CanaryTrafficRouter();
  for (let i = 0; i < 100; i++) {
    const decision = router.route(`task_${i}`, "draft");
    assert.equal(decision.matched, false);
    assert.equal(decision.trafficPercentage, 0);
  }
});

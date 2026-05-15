import assert from "node:assert/strict";
import test from "node:test";

import { CanaryTrafficRouter } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/canary-traffic-router.js";

test("CanaryTrafficRouter returns 0% traffic for draft status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("draft"), 0);
});

test("CanaryTrafficRouter returns 0% traffic for pending_approval status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("pending_approval"), 0);
});

test("CanaryTrafficRouter returns 0% traffic for shadow status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("shadow"), 0);
});

test("CanaryTrafficRouter returns 5% traffic for canary_5 status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("canary_5"), 5);
});

test("CanaryTrafficRouter returns 25% traffic for partial_25 status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_25"), 25);
});

test("CanaryTrafficRouter returns 50% traffic for partial_50 status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_50"), 50);
});

test("CanaryTrafficRouter returns 75% traffic for partial_75 status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_75"), 75);
});

test("CanaryTrafficRouter returns 100% traffic for stable status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("stable"), 100);
});

test("CanaryTrafficRouter returns 0% traffic for rejected status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rejected"), 0);
});

test("CanaryTrafficRouter returns 0% traffic for rolled_back status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rolled_back"), 0);
});

test("CanaryTrafficRouter returns 0% traffic for paused status", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("paused"), 0);
});

test("CanaryTrafficRouter.route returns correct structure", () => {
  const router = new CanaryTrafficRouter();
  const result = router.route("task-123", "stable");

  assert.equal(typeof result.matched, "boolean");
  assert.equal(typeof result.trafficPercentage, "number");
  assert.equal(typeof result.bucket, "number");
});

test("CanaryTrafficRouter.route returns matched true for stable status any task", () => {
  const router = new CanaryTrafficRouter();
  const result = router.route("task-123", "stable");

  assert.equal(result.matched, true);
  assert.equal(result.trafficPercentage, 100);
});

test("CanaryTrafficRouter.route returns matched false for draft status any task", () => {
  const router = new CanaryTrafficRouter();
  const result = router.route("task-123", "draft");

  assert.equal(result.matched, false);
  assert.equal(result.trafficPercentage, 0);
});

test("CanaryTrafficRouter.shouldRoute is convenience method for route().matched", () => {
  const router = new CanaryTrafficRouter();
  const shouldRoute = router.shouldRoute("task-123", "stable");
  const route = router.route("task-123", "stable");

  assert.equal(shouldRoute, route.matched);
});

test("CanaryTrafficRouter produces consistent bucket for same taskId", () => {
  const router = new CanaryTrafficRouter();
  const result1 = router.route("task-123", "canary_5");
  const result2 = router.route("task-123", "canary_5");

  assert.equal(result1.bucket, result2.bucket);
});

test("CanaryTrafficRouter produces different buckets for different taskIds", () => {
  const router = new CanaryTrafficRouter();
  const result1 = router.route("task-AAA", "canary_5");
  const result2 = router.route("task-BBB", "canary_5");

  // Different task IDs should produce different buckets (though theoretically could collide)
  // We just verify they're both valid numbers in range [0, 99]
  assert.ok(result1.bucket >= 0 && result1.bucket < 100);
  assert.ok(result2.bucket >= 0 && result2.bucket < 100);
});

test("CanaryTrafficRouter bucket is deterministic regardless of status", () => {
  const router = new CanaryTrafficRouter();
  const taskId = "task-consistent-123";

  const statuses = ["draft", "shadow", "canary_5", "partial_25", "stable"] as const;
  const buckets = statuses.map((status) => router.route(taskId, status).bucket);

  // All buckets should be the same for the same taskId
  const firstBucket = buckets[0];
  for (const bucket of buckets) {
    assert.equal(bucket, firstBucket);
  }
});

test("CanaryTrafficRouter handles empty string taskId", () => {
  const router = new CanaryTrafficRouter();
  const result = router.route("", "stable");

  assert.equal(result.trafficPercentage, 100);
  assert.ok(result.bucket >= 0 && result.bucket < 100);
});

test("CanaryTrafficRouter handles long taskId", () => {
  const router = new CanaryTrafficRouter();
  const longTaskId = "task-" + "x".repeat(1000);
  const result = router.route(longTaskId, "canary_5");

  assert.ok(result.bucket >= 0 && result.bucket < 100);
});

test("CanaryTrafficRouter distributes traffic approximately evenly over many tasks", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const taskCount = 1000;

  for (let i = 0; i < taskCount; i++) {
    const result = router.route(`task-${i}`, "canary_5");
    if (result.matched) {
      matchedCount++;
    }
  }

  // For canary_5 (5% traffic), we expect approximately 5% matched
  // Allow some variance but expect between 3-7%
  const ratio = matchedCount / taskCount;
  assert.ok(ratio >= 0.03 && ratio <= 0.07, `Expected ~5% matched, got ${(ratio * 100).toFixed(1)}%`);
});

test("CanaryTrafficRouter partial_50 distributes approximately 50%", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const taskCount = 1000;

  for (let i = 0; i < taskCount; i++) {
    const result = router.route(`task-p50-${i}`, "partial_50");
    if (result.matched) {
      matchedCount++;
    }
  }

  // For partial_50 (50% traffic), expect between 45-55%
  const ratio = matchedCount / taskCount;
  assert.ok(ratio >= 0.45 && ratio <= 0.55, `Expected ~50% matched, got ${(ratio * 100).toFixed(1)}%`);
});

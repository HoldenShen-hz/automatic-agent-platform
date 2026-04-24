import assert from "node:assert/strict";
import test from "node:test";

import { CanaryTrafficRouter } from "../../../../../src/platform/orchestration/improve-rollout/canary-traffic-router.js";

test("CanaryTrafficRouter getTrafficPercentage returns 0 for draft", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("draft"), 0);
});

test("CanaryTrafficRouter getTrafficPercentage returns 0 for pending_approval", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("pending_approval"), 0);
});

test("CanaryTrafficRouter getTrafficPercentage returns 0 for shadow", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("shadow"), 0);
});

test("CanaryTrafficRouter getTrafficPercentage returns 5 for canary_5", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("canary_5"), 5);
});

test("CanaryTrafficRouter getTrafficPercentage returns 25 for partial_25", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_25"), 25);
});

test("CanaryTrafficRouter getTrafficPercentage returns 50 for partial_50", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_50"), 50);
});

test("CanaryTrafficRouter getTrafficPercentage returns 75 for partial_75", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("partial_75"), 75);
});

test("CanaryTrafficRouter getTrafficPercentage returns 100 for stable", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("stable"), 100);
});

test("CanaryTrafficRouter getTrafficPercentage returns 0 for rejected", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rejected"), 0);
});

test("CanaryTrafficRouter getTrafficPercentage returns 0 for rolled_back", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("rolled_back"), 0);
});

test("CanaryTrafficRouter getTrafficPercentage returns 0 for paused", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.getTrafficPercentage("paused"), 0);
});

test("CanaryTrafficRouter shouldRoute returns false for draft", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.shouldRoute("task-1", "draft"), false);
});

test("CanaryTrafficRouter shouldRoute returns true for stable", () => {
  const router = new CanaryTrafficRouter();
  assert.equal(router.shouldRoute("task-1", "stable"), true);
});

test("CanaryTrafficRouter route returns correct decision structure", () => {
  const router = new CanaryTrafficRouter();
  const decision = router.route("task-123", "canary_5");

  assert.equal(typeof decision.matched, "boolean");
  assert.equal(decision.trafficPercentage, 5);
  assert.equal(typeof decision.bucket, "number");
  assert.ok(decision.bucket >= 0 && decision.bucket < 100);
});

test("CanaryTrafficRouter route returns consistent bucket for same taskId", () => {
  const router = new CanaryTrafficRouter();
  const decision1 = router.route("task-consistent", "partial_50");
  const decision2 = router.route("task-consistent", "partial_50");

  assert.equal(decision1.bucket, decision2.bucket);
});

test("CanaryTrafficRouter route returns different buckets for different taskIds", () => {
  const router = new CanaryTrafficRouter();
  const buckets = new Set<number>();

  for (let i = 0; i < 100; i++) {
    const decision = router.route(`task-${i}`, "stable");
    buckets.add(decision.bucket);
  }

  assert.ok(buckets.size > 1);
});

test("CanaryTrafficRouter route bucket is in range 0-99", () => {
  const router = new CanaryTrafficRouter();

  for (let i = 0; i < 50; i++) {
    const decision = router.route(`task-${i}`, "stable");
    assert.ok(decision.bucket >= 0 && decision.bucket < 100);
  }
});

test("CanaryTrafficRouter shouldRoute for partial_50 routes approximately half", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 1000;

  for (let i = 0; i < total; i++) {
    if (router.shouldRoute(`task-${i}`, "partial_50")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  assert.ok(ratio > 0.40 && ratio < 0.60);
});

test("CanaryTrafficRouter shouldRoute for canary_5 routes approximately 5%", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 1000;

  for (let i = 0; i < total; i++) {
    if (router.shouldRoute(`task-${i}`, "canary_5")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  assert.ok(ratio > 0.02 && ratio < 0.08);
});

test("CanaryTrafficRouter shouldRoute for partial_75 routes approximately 75%", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 1000;

  for (let i = 0; i < total; i++) {
    if (router.shouldRoute(`task-${i}`, "partial_75")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  assert.ok(ratio > 0.70 && ratio < 0.80);
});

test("CanaryTrafficRouter route uses correct trafficPercentage in decision", () => {
  const router = new CanaryTrafficRouter();

  const canary = router.route("task-1", "canary_5");
  assert.equal(canary.trafficPercentage, 5);

  const partial25 = router.route("task-1", "partial_25");
  assert.equal(partial25.trafficPercentage, 25);

  const partial50 = router.route("task-1", "partial_50");
  assert.equal(partial50.trafficPercentage, 50);

  const partial75 = router.route("task-1", "partial_75");
  assert.equal(partial75.trafficPercentage, 75);

  const stable = router.route("task-1", "stable");
  assert.equal(stable.trafficPercentage, 100);
});

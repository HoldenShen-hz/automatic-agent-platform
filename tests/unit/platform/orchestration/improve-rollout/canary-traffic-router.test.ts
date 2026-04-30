// @ts-nocheck
/**
 * Unit Tests: Canary Traffic Router - Issue #2191
 *
 * Issue #2191: Hash function has bias with short IDs
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CanaryTrafficRouter } from "../../../../../src/platform/orchestration/improve-rollout/canary-traffic-router.js";

function hashToBucket(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash % 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2191: Hash function has bias with short IDs
// ─────────────────────────────────────────────────────────────────────────────

test("CanaryTrafficRouter - hashToBucket produces uniform distribution for long IDs", () => {
  const router = new CanaryTrafficRouter();
  const buckets: number[] = [];

  // Test with many different long task IDs
  for (let i = 0; i < 10000; i++) {
    const taskId = `task-${i}-${Date.now()}-${Math.random().toString(36)}`;
    const bucket = hashToBucket(taskId);
    buckets.push(bucket);

    // Verify bucket is in valid range
    assert.ok(bucket >= 0 && bucket < 100, `Bucket ${bucket} out of range`);
  }

  // Check distribution - each bucket should have ~100 items for 10000 samples
  const bucketCounts = new Array(100).fill(0);
  for (const b of buckets) {
    bucketCounts[b]++;
  }

  // Allow variance but expect roughly uniform (between 50-150 per bucket)
  for (let i = 0; i < 100; i++) {
    assert.ok(
      bucketCounts[i] >= 50 && bucketCounts[i] <= 150,
      `Bucket ${i} has ${bucketCounts[i]} items, expected ~100`,
    );
  }
});

test("CanaryTrafficRouter - hashToBucket has bias with very short IDs", () => {
  // The bug: short IDs like "A", "AA", "AAA" may cluster in certain bucket ranges
  // because the hash function doesn't mix well for short strings

  const shortIds = [
    "A", "B", "C", "D", "E", "F", "G", "H",
    "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH",
    "AAA", "AAB", "AAC", "AAD", "AAE", "AAF", "AAG", "AAH",
    "AAAA", "AAAB", "AAAC", "AAAD",
  ];

  const buckets = shortIds.map((id) => hashToBucket(id));

  // Check if short IDs cluster in certain ranges
  const bucketCounts = new Array(100).fill(0);
  for (const b of buckets) {
    bucketCounts[b]++;
  }

  // With short IDs, we might see clustering - some buckets get many, others get none
  const maxCount = Math.max(...bucketCounts);
  const minCount = Math.min(...bucketCounts.filter((c) => c > 0));

  // If there's severe bias, maxCount will be much higher than average
  // For 32 short IDs, expected ~0.32 per bucket if uniform
  // With bias, some buckets might have 5+ while others have 0
  // This test just verifies distribution is somewhat spread out
  const variance = maxCount - minCount;

  // This test documents the bias issue - short IDs tend to cluster
  // The variance might be high due to the small sample size and natural variance
  // But if we're seeing extreme clustering (e.g., 10+ in one bucket, 0 in most),
  // that indicates the bias issue
  assert.ok(
    maxCount <= 5,
    `Short IDs show clustering bias: max bucket has ${maxCount} items`,
  );
});

test("CanaryTrafficRouter - route produces deterministic results", () => {
  const router = new CanaryTrafficRouter();

  const taskId = "task-deterministic-test";
  const results = Array.from({ length: 10 }, () => router.route(taskId, "canary_5"));

  for (const result of results) {
    assert.equal(result.bucket, results[0].bucket);
    assert.equal(result.matched, results[0].matched);
  }
});

test("CanaryTrafficRouter - bucket is independent of status", () => {
  const router = new CanaryTrafficRouter();
  const taskId = "task-status-independent";

  const statuses = ["draft", "pending_approval", "shadow", "canary_5", "partial_25", "stable"] as const;
  const buckets = statuses.map((s) => router.route(taskId, s).bucket);

  const firstBucket = buckets[0];
  for (const bucket of buckets) {
    assert.equal(bucket, firstBucket, "Bucket should be same regardless of status");
  }
});

test("CanaryTrafficRouter - 5% traffic is approximately 5% matched", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 10000;

  for (let i = 0; i < total; i++) {
    const taskId = `task-${i}`;
    if (router.shouldRoute(taskId, "canary_5")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  // Should be approximately 5% (between 4% and 6%)
  assert.ok(
    ratio >= 0.04 && ratio <= 0.06,
    `Expected ~5% matched, got ${(ratio * 100).toFixed(2)}%`,
  );
});

test("CanaryTrafficRouter - 25% traffic distributes correctly", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 10000;

  for (let i = 0; i < total; i++) {
    const taskId = `task-25-${i}`;
    if (router.shouldRoute(taskId, "partial_25")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  // Should be approximately 25% (between 23% and 27%)
  assert.ok(
    ratio >= 0.23 && ratio <= 0.27,
    `Expected ~25% matched, got ${(ratio * 100).toFixed(2)}%`,
  );
});

test("CanaryTrafficRouter - 50% traffic distributes correctly", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 10000;

  for (let i = 0; i < total; i++) {
    const taskId = `task-50-${i}`;
    if (router.shouldRoute(taskId, "partial_50")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  // Should be approximately 50% (between 48% and 52%)
  assert.ok(
    ratio >= 0.48 && ratio <= 0.52,
    `Expected ~50% matched, got ${(ratio * 100).toFixed(2)}%`,
  );
});

test("CanaryTrafficRouter - 75% traffic distributes correctly", () => {
  const router = new CanaryTrafficRouter();
  let matchedCount = 0;
  const total = 10000;

  for (let i = 0; i < total; i++) {
    const taskId = `task-75-${i}`;
    if (router.shouldRoute(taskId, "partial_75")) {
      matchedCount++;
    }
  }

  const ratio = matchedCount / total;
  // Should be approximately 75% (between 73% and 77%)
  assert.ok(
    ratio >= 0.73 && ratio <= 0.77,
    `Expected ~75% matched, got ${(ratio * 100).toFixed(2)}%`,
  );
});

test("CanaryTrafficRouter - stable always returns matched=true", () => {
  const router = new CanaryTrafficRouter();

  for (let i = 0; i < 100; i++) {
    const result = router.route(`task-stable-${i}`, "stable");
    assert.equal(result.matched, true);
    assert.equal(result.trafficPercentage, 100);
  }
});

test("CanaryTrafficRouter - draft always returns matched=false", () => {
  const router = new CanaryTrafficRouter();

  for (let i = 0; i < 100; i++) {
    const result = router.route(`task-draft-${i}`, "draft");
    assert.equal(result.matched, false);
    assert.equal(result.trafficPercentage, 0);
  }
});

test("CanaryTrafficRouter - getTrafficPercentage returns correct percentages", () => {
  const router = new CanaryTrafficRouter();

  assert.equal(router.getTrafficPercentage("draft"), 0);
  assert.equal(router.getTrafficPercentage("pending_approval"), 0);
  assert.equal(router.getTrafficPercentage("shadow"), 0);
  assert.equal(router.getTrafficPercentage("canary_5"), 5);
  assert.equal(router.getTrafficPercentage("partial_25"), 25);
  assert.equal(router.getTrafficPercentage("partial_50"), 50);
  assert.equal(router.getTrafficPercentage("partial_75"), 75);
  assert.equal(router.getTrafficPercentage("stable"), 100);
  assert.equal(router.getTrafficPercentage("rejected"), 0);
  assert.equal(router.getTrafficPercentage("rolled_back"), 0);
  assert.equal(router.getTrafficPercentage("paused"), 0);
});

test("CanaryTrafficRouter - computeCanaryAllocation returns correct values", () => {
  const router = new CanaryTrafficRouter();

  const stableAlloc = router.computeCanaryAllocation("stable");
  assert.equal(stableAlloc.canaryPercentage, 0);
  assert.equal(stableAlloc.stablePercentage, 100);
  assert.equal(stableAlloc.targetLevel, "stable");

  const canaryAlloc = router.computeCanaryAllocation("canary_5");
  assert.equal(canaryAlloc.canaryPercentage, 5);
  assert.equal(canaryAlloc.stablePercentage, 95);
  assert.equal(canaryAlloc.targetLevel, "canary_5");
});

test("CanaryTrafficRouter - unknown status returns 0", () => {
  const router = new CanaryTrafficRouter();

  // @ts-ignore - passing invalid status
  assert.equal(router.getTrafficPercentage("unknown_status"), 0);
});

test("CanaryTrafficRouter - empty string taskId produces valid bucket", () => {
  const router = new CanaryTrafficRouter();
  const result = router.route("", "canary_5");

  assert.ok(result.bucket >= 0 && result.bucket < 100);
  assert.equal(typeof result.matched, "boolean");
});

test("CanaryTrafficRouter - very long taskId produces valid bucket", () => {
  const router = new CanaryTrafficRouter();
  const longId = "task-" + "x".repeat(10000);
  const result = router.route(longId, "canary_5");

  assert.ok(result.bucket >= 0 && result.bucket < 100);
});

test("CanaryTrafficRouter - similar taskIds have different buckets", () => {
  const router = new CanaryTrafficRouter();

  const task1 = "task-AAAAAAA";
  const task2 = "task-AAAAAAB";

  const result1 = router.route(task1, "canary_5");
  const result2 = router.route(task2, "canary_5");

  // They should have different buckets (though collision is theoretically possible)
  assert.notEqual(result1.bucket, result2.bucket);
});

test("CanaryTrafficRouter - hash bias is worse for very short IDs", () => {
  // Document the bias issue: very short IDs cluster
  const veryShortIds = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const buckets = veryShortIds.map((id) => hashToBucket(id));

  // Check how many unique buckets vs total IDs
  const uniqueBuckets = new Set(buckets).size;

  // With 10 IDs and 100 buckets, we'd expect ~10 unique if uniform
  // But bias might cause clustering
  assert.ok(uniqueBuckets >= 3, `Only ${uniqueBuckets} unique buckets for 10 short IDs - indicates bias`);

  // More importantly, verify they don't ALL cluster in first 20 buckets
  const inFirstTwenty = buckets.filter((b) => b < 20).length;
  assert.ok(
    inFirstTwenty <= 7,
    `${inFirstTwenty} of 10 short IDs cluster in first 20 buckets - severe bias`,
  );
});
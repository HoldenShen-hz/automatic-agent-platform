import assert from "node:assert/strict";
import test from "node:test";

import { CanaryTrafficRouter } from "../../../../src/platform/five-plane-orchestration/improve-rollout/canary-traffic-router.js";

test("CanaryTrafficRouter spreads short task ids across a broad bucket range", () => {
  const router = new CanaryTrafficRouter();
  const buckets = Array.from({ length: 200 }, (_, index) => router.route(`t${index.toString(36)}`, "partial_25").bucket);
  const uniqueBucketCount = new Set(buckets).size;
  const minBucket = Math.min(...buckets);
  const maxBucket = Math.max(...buckets);

  assert.ok(uniqueBucketCount >= 70, `expected at least 70 unique buckets, got ${uniqueBucketCount}`);
  assert.ok(maxBucket - minBucket >= 80, `expected wide spread, got range ${minBucket}-${maxBucket}`);
});

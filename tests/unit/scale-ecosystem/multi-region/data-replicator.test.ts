/**
 * Unit tests for data-replicator
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldReplicateToRegion, ReplicationPolicySchema, type ReplicationPolicy } from "../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";

test("shouldReplicateToRegion returns true when target is in policy and not blocked", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west", "ap-south"],
    residencyMode: "same_jurisdiction",
  };

  assert.equal(shouldReplicateToRegion(policy, "eu-west"), true);
  assert.equal(shouldReplicateToRegion(policy, "ap-south"), true);
});

test("shouldReplicateToRegion returns false when residencyMode is blocked", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "blocked",
  };

  assert.equal(shouldReplicateToRegion(policy, "eu-west"), false);
});

test("shouldReplicateToRegion returns false when target not in list", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction",
  };

  assert.equal(shouldReplicateToRegion(policy, "ap-south"), false);
});

test("ReplicationPolicySchema parses valid input", () => {
  const input = {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west"],
    residencyMode: "same_jurisdiction" as const,
  };

  const result = ReplicationPolicySchema.safeParse(input);
  assert.equal(result.success, true);
});

test("ReplicationPolicySchema applies defaults", () => {
  const input = {
    sourceRegionId: "us-east",
  };

  const result = ReplicationPolicySchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.targetRegionIds, []);
    assert.equal(result.data.residencyMode, "same_jurisdiction");
  }
});

test("ReplicationPolicySchema rejects invalid residencyMode", () => {
  const input = {
    sourceRegionId: "us-east",
    residencyMode: "invalid" as any,
  };

  const result = ReplicationPolicySchema.safeParse(input);
  assert.equal(result.success, false);
});

test("shouldReplicateToRegion works with allowed_cross_border mode", () => {
  const policy: ReplicationPolicy = {
    sourceRegionId: "us-east",
    targetRegionIds: ["eu-west", "ap-south"],
    residencyMode: "allowed_cross_border",
  };

  assert.equal(shouldReplicateToRegion(policy, "eu-west"), true);
  assert.equal(shouldReplicateToRegion(policy, "ap-south"), true);
  assert.equal(shouldReplicateToRegion(policy, "unknown-region"), false);
});

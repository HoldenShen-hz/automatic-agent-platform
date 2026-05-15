/**
 * Unit tests for source-trust-policy
 */

import assert from "node:assert/strict";
import test from "node:test";
import { SourceTrustPolicyRegistry } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/source-trust-policy.js";
import type { TrustLevel } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

test("SourceTrustPolicyRegistry returns correct policy for verified trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("verified");

  assert.equal(policy.level, "verified");
  assert.equal(policy.allowedInFinalResponse, true);
  assert.equal(policy.requiresCitation, true);
  assert.equal(policy.maxRetrievalWeight, 1);
  assert.equal(policy.humanReviewRequired, false);
});

test("SourceTrustPolicyRegistry returns correct policy for reviewed trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("reviewed");

  assert.equal(policy.level, "reviewed");
  assert.equal(policy.allowedInFinalResponse, true);
  assert.equal(policy.requiresCitation, true);
  assert.equal(policy.maxRetrievalWeight, 0.8);
  assert.equal(policy.humanReviewRequired, false);
});

test("SourceTrustPolicyRegistry returns correct policy for community trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("community");

  assert.equal(policy.level, "community");
  assert.equal(policy.allowedInFinalResponse, true);
  assert.equal(policy.requiresCitation, true);
  assert.equal(policy.maxRetrievalWeight, 0.5);
  assert.equal(policy.humanReviewRequired, false);
});

test("SourceTrustPolicyRegistry returns correct policy for unverified trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("unverified");

  assert.equal(policy.level, "unverified");
  assert.equal(policy.allowedInFinalResponse, false);
  assert.equal(policy.requiresCitation, false);
  assert.equal(policy.maxRetrievalWeight, 0.3);
  assert.equal(policy.humanReviewRequired, true);
});

test("SourceTrustPolicyRegistry policies have decreasing maxRetrievalWeight by trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const verified = registry.get("verified");
  const reviewed = registry.get("reviewed");
  const community = registry.get("community");
  const unverified = registry.get("unverified");

  assert.ok(verified.maxRetrievalWeight > reviewed.maxRetrievalWeight);
  assert.ok(reviewed.maxRetrievalWeight > community.maxRetrievalWeight);
  assert.ok(community.maxRetrievalWeight > unverified.maxRetrievalWeight);
});

test("SourceTrustPolicyRegistry unverified requires human review", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("unverified");

  assert.equal(policy.humanReviewRequired, true);
});

test("SourceTrustPolicyRegistry verified does not require human review", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("verified");

  assert.equal(policy.humanReviewRequired, false);
});

test("SourceTrustPolicyRegistry verified requires citation", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("verified");

  assert.equal(policy.requiresCitation, true);
});

test("SourceTrustPolicyRegistry unverified does not require citation", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy = registry.get("unverified");

  assert.equal(policy.requiresCitation, false);
});

test("SourceTrustPolicyRegistry only verified is allowed in final response without conditions", () => {
  const registry = new SourceTrustPolicyRegistry();

  const verified = registry.get("verified");
  const reviewed = registry.get("reviewed");
  const community = registry.get("community");
  const unverified = registry.get("unverified");

  // All except unverified are allowed
  assert.equal(verified.allowedInFinalResponse, true);
  assert.equal(reviewed.allowedInFinalResponse, true);
  assert.equal(community.allowedInFinalResponse, true);
  assert.equal(unverified.allowedInFinalResponse, false);
});

test("SourceTrustPolicyRegistry get returns same instance for same trust level", () => {
  const registry = new SourceTrustPolicyRegistry();

  const policy1 = registry.get("verified");
  const policy2 = registry.get("verified");

  assert.strictEqual(policy1, policy2);
});

test("SourceTrustPolicyRegistry handles all valid trust levels", () => {
  const registry = new SourceTrustPolicyRegistry();
  const trustLevels: TrustLevel[] = ["verified", "reviewed", "community", "unverified"];

  for (const level of trustLevels) {
    const policy = registry.get(level);
    assert.equal(policy.level, level, `Policy level should match ${level}`);
  }
});

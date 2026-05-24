import assert from "node:assert/strict";
import test from "node:test";

import { SourceTrustPolicyRegistry } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/source-trust-policy.js";
import type { TrustLevel } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

test("SourceTrustPolicyRegistry returns the canonical policy ladder", () => {
  const registry = new SourceTrustPolicyRegistry();

  const authoritative = registry.get("authoritative");
  const official = registry.get("official");
  const teamReviewed = registry.get("team_reviewed");
  const privateUnverified = registry.get("private_unverified");

  assert.equal(authoritative.level, "authoritative");
  assert.equal(authoritative.maxRetrievalWeight, 1);
  assert.equal(official.maxRetrievalWeight, 0.85);
  assert.equal(teamReviewed.maxRetrievalWeight, 0.65);
  assert.equal(privateUnverified.maxRetrievalWeight, 0.3);
});

test("SourceTrustPolicyRegistry only blocks private_unverified sources from final responses", () => {
  const registry = new SourceTrustPolicyRegistry();

  assert.equal(registry.get("authoritative").allowedInFinalResponse, true);
  assert.equal(registry.get("official").allowedInFinalResponse, true);
  assert.equal(registry.get("team_reviewed").allowedInFinalResponse, true);
  assert.equal(registry.get("private_unverified").allowedInFinalResponse, false);
});

test("SourceTrustPolicyRegistry requires human review only for private_unverified sources", () => {
  const registry = new SourceTrustPolicyRegistry();

  assert.equal(registry.get("authoritative").humanReviewRequired, false);
  assert.equal(registry.get("official").humanReviewRequired, false);
  assert.equal(registry.get("team_reviewed").humanReviewRequired, false);
  assert.equal(registry.get("private_unverified").humanReviewRequired, true);
});

test("SourceTrustPolicyRegistry accepts every current TrustLevel", () => {
  const registry = new SourceTrustPolicyRegistry();
  const trustLevels: TrustLevel[] = [
    "authoritative",
    "official",
    "team_reviewed",
    "private_unverified",
  ];

  for (const level of trustLevels) {
    assert.equal(registry.get(level).level, level);
  }
});

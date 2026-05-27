/**
 * Unit tests for Marketplace Publisher
 *
 * @see src/scale-ecosystem/marketplace/publisher/
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PublisherProfileSchema,
  canPublisherReleaseArtifact,
  type PublisherProfile,
} from "../../../../../src/scale-ecosystem/marketplace/publisher/index.js";

test("PublisherProfileSchema parses valid profile [publisher]", () => {
  const profile = {
    publisherId: "pub_001",
    displayName: "Acme Corp",
    trustLevel: "verified",
  };

  const result = PublisherProfileSchema.parse(profile);

  assert.equal(result.publisherId, "pub_001");
  assert.equal(result.displayName, "Acme Corp");
  assert.equal(result.trustLevel, "verified");
});

test("PublisherProfileSchema applies default values [publisher]", () => {
  const profile = {
    publisherId: "pub_002",
    displayName: "Basic Publisher",
    trustLevel: "sandboxed",
  };

  const result = PublisherProfileSchema.parse(profile);

  assert.deepEqual(result.allowedArtifactTypes, []);
  assert.equal(result.contactEmail, undefined);
  assert.equal(result.reputationScore, 0);
  assert.equal(result.publishedArtifactCount, 0);
});

test("PublisherProfileSchema accepts full profile with optional fields [publisher]", () => {
  const profile = {
    publisherId: "pub_003",
    displayName: "Full Publisher",
    trustLevel: "enterprise",
    allowedArtifactTypes: ["pack", "template", "workflow"],
    contactEmail: "publisher@example.com",
    reputationScore: 0.85,
    publishedArtifactCount: 42,
  };

  const result = PublisherProfileSchema.parse(profile);

  assert.deepEqual(result.allowedArtifactTypes, ["pack", "template", "workflow"]);
  assert.equal(result.contactEmail, "publisher@example.com");
  assert.equal(result.reputationScore, 0.85);
  assert.equal(result.publishedArtifactCount, 42);
});

test("PublisherProfileSchema rejects empty publisherId [publisher]", () => {
  const profile = {
    publisherId: "",
    displayName: "Bad Publisher",
    trustLevel: "sandboxed",
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /publisherId/
  );
});

test("PublisherProfileSchema rejects empty displayName [publisher]", () => {
  const profile = {
    publisherId: "pub_004",
    displayName: "",
    trustLevel: "sandboxed",
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /displayName/
  );
});

test("PublisherProfileSchema rejects invalid trustLevel [publisher]", () => {
  const profile = {
    publisherId: "pub_005",
    displayName: "Bad Trust",
    trustLevel: "super_trusted",
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /trustLevel/
  );
});

test("PublisherProfileSchema rejects invalid email [publisher]", () => {
  const profile = {
    publisherId: "pub_006",
    displayName: "Bad Email Publisher",
    trustLevel: "sandboxed",
    contactEmail: "not-an-email",
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /email/
  );
});

test("PublisherProfileSchema rejects negative reputation score [publisher]", () => {
  const profile = {
    publisherId: "pub_007",
    displayName: "Negative Reputation",
    trustLevel: "sandboxed",
    reputationScore: -0.1,
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /reputationScore/
  );
});

test("PublisherProfileSchema rejects reputation score over 1 [publisher]", () => {
  const profile = {
    publisherId: "pub_008",
    displayName: "Over Reputation",
    trustLevel: "sandboxed",
    reputationScore: 1.5,
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /reputationScore/
  );
});

test("PublisherProfileSchema rejects negative published artifact count [publisher]", () => {
  const profile = {
    publisherId: "pub_009",
    displayName: "Negative Count",
    trustLevel: "sandboxed",
    publishedArtifactCount: -1,
  };

  assert.throws(
    () => PublisherProfileSchema.parse(profile),
    /publishedArtifactCount/
  );
});

test("canPublisherReleaseArtifact returns true when artifact type is allowed and reputation >= 0.4 [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_010",
    displayName: "Good Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["pack", "template"],
    reputationScore: 0.5,
    publishedArtifactCount: 10,
  };

  const result = canPublisherReleaseArtifact(profile, "pack");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns true when reputation is exactly 0.4 [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_011",
    displayName: "Threshold Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["pack"],
    reputationScore: 0.4,
    publishedArtifactCount: 5,
  };

  const result = canPublisherReleaseArtifact(profile, "pack");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns false when artifact type is not allowed [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_012",
    displayName: "Limited Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["pack"],
    reputationScore: 0.8,
    publishedArtifactCount: 20,
  };

  const result = canPublisherReleaseArtifact(profile, "workflow");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns false when reputation is below 0.4 [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_013",
    displayName: "Low Reputation",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["pack", "template"],
    reputationScore: 0.3,
    publishedArtifactCount: 2,
  };

  const result = canPublisherReleaseArtifact(profile, "pack");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns false when reputation is 0 [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_014",
    displayName: "Zero Reputation",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["pack"],
    reputationScore: 0,
    publishedArtifactCount: 0,
  };

  const result = canPublisherReleaseArtifact(profile, "pack");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns false when allowedArtifactTypes is empty [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_015",
    displayName: "No Artifacts Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: [],
    reputationScore: 0.9,
    publishedArtifactCount: 100,
  };

  const result = canPublisherReleaseArtifact(profile, "pack");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact works with enterprise trust level [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_016",
    displayName: "Enterprise Publisher",
    trustLevel: "enterprise",
    allowedArtifactTypes: ["pack", "template", "workflow", "connector"],
    reputationScore: 0.95,
    publishedArtifactCount: 500,
  };

  const result = canPublisherReleaseArtifact(profile, "connector");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact is case-sensitive for artifact type [publisher]", () => {
  const profile: PublisherProfile = {
    publisherId: "pub_017",
    displayName: "Case Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["Pack"],
    reputationScore: 0.8,
    publishedArtifactCount: 10,
  };

  const resultLower = canPublisherReleaseArtifact(profile, "pack");
  const resultUpper = canPublisherReleaseArtifact(profile, "Pack");

  assert.equal(resultLower, false);
  assert.equal(resultUpper, true);
});

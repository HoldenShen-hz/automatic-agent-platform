import assert from "node:assert/strict";
import test from "node:test";

import {
  PublisherProfileSchema,
  canPublisherReleaseArtifact,
  type PublisherProfile,
} from "../../../../../src/scale-ecosystem/marketplace/publisher/index.js";

test("PublisherProfileSchema parses valid profile", () => {
  const profile = {
    publisherId: "pub-1",
    displayName: "Test Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["tool", "workflow"],
    contactEmail: "test@example.com",
    reputationScore: 0.8,
    publishedArtifactCount: 10,
  };

  const result = PublisherProfileSchema.parse(profile);

  assert.equal(result.publisherId, "pub-1");
  assert.equal(result.displayName, "Test Publisher");
  assert.equal(result.trustLevel, "verified");
  assert.deepEqual(result.allowedArtifactTypes, ["tool", "workflow"]);
  assert.equal(result.reputationScore, 0.8);
});

test("PublisherProfileSchema accepts missing optional fields", () => {
  const profile = {
    publisherId: "pub-1",
    displayName: "Minimal Publisher",
    trustLevel: "sandboxed",
  };

  const result = PublisherProfileSchema.parse(profile);

  assert.equal(result.publisherId, "pub-1");
  assert.equal(result.displayName, "Minimal Publisher");
  assert.equal(result.trustLevel, "sandboxed");
  assert.deepEqual(result.allowedArtifactTypes, []);
  assert.equal(result.reputationScore, 0);
  assert.equal(result.publishedArtifactCount, 0);
});

test("PublisherProfileSchema rejects trustLevel outside enum", () => {
  assert.throws(() => {
    PublisherProfileSchema.parse({
      publisherId: "pub-1",
      displayName: "Bad Publisher",
      trustLevel: "invalid",
      allowedArtifactTypes: [],
    });
  });
});

test("PublisherProfileSchema rejects reputationScore > 1", () => {
  assert.throws(() => {
    PublisherProfileSchema.parse({
      publisherId: "pub-1",
      displayName: "Bad Publisher",
      trustLevel: "verified",
      allowedArtifactTypes: [],
      reputationScore: 1.5,
    });
  });
});

test("PublisherProfileSchema rejects reputationScore < 0", () => {
  assert.throws(() => {
    PublisherProfileSchema.parse({
      publisherId: "pub-1",
      displayName: "Bad Publisher",
      trustLevel: "verified",
      allowedArtifactTypes: [],
      reputationScore: -0.1,
    });
  });
});

test("PublisherProfileSchema rejects empty publisherId", () => {
  assert.throws(() => {
    PublisherProfileSchema.parse({
      publisherId: "",
      displayName: "Bad Publisher",
      trustLevel: "verified",
      allowedArtifactTypes: [],
    });
  });
});

test("PublisherProfileSchema rejects invalid email format", () => {
  assert.throws(() => {
    PublisherProfileSchema.parse({
      publisherId: "pub-1",
      displayName: "Bad Publisher",
      trustLevel: "verified",
      allowedArtifactTypes: [],
      contactEmail: "not-an-email",
    });
  });
});

test("canPublisherReleaseArtifact returns true when artifactType is allowed and reputation >= 0.4", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Good Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["tool", "workflow"],
    reputationScore: 0.8,
    publishedArtifactCount: 10,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), true);
  assert.equal(canPublisherReleaseArtifact(profile, "workflow"), true);
});

test("canPublisherReleaseArtifact returns false when artifactType is not in allowedArtifactTypes", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Limited Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["tool"],
    reputationScore: 0.8,
    publishedArtifactCount: 10,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "workflow"), false);
  assert.equal(canPublisherReleaseArtifact(profile, "integration"), false);
});

test("canPublisherReleaseArtifact returns false for sandboxed publishers even with low reputation", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Low Reputation Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["tool", "workflow"],
    reputationScore: 0.3,
    publishedArtifactCount: 2,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), false);
  assert.equal(canPublisherReleaseArtifact(profile, "workflow"), false);
});

test("canPublisherReleaseArtifact returns false for sandboxed publishers at the old 0.4 threshold", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Borderline Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["tool"],
    reputationScore: 0.4,
    publishedArtifactCount: 5,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), false);
});

test("canPublisherReleaseArtifact returns false for sandboxed publishers above the old 0.4 threshold", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Just Above Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: ["tool"],
    reputationScore: 0.41,
    publishedArtifactCount: 5,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), false);
});

test("canPublisherReleaseArtifact works with empty allowedArtifactTypes", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "No Artifacts Publisher",
    trustLevel: "sandboxed",
    allowedArtifactTypes: [],
    reputationScore: 0.9,
    publishedArtifactCount: 0,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), false);
});

test("canPublisherReleaseArtifact works with enterprise trustLevel", () => {
  const profile: PublisherProfile = {
    publisherId: "pub-1",
    displayName: "Enterprise Publisher",
    trustLevel: "enterprise",
    allowedArtifactTypes: ["tool", "workflow", "integration"],
    reputationScore: 0.95,
    publishedArtifactCount: 100,
  };

  assert.equal(canPublisherReleaseArtifact(profile, "tool"), true);
  assert.equal(canPublisherReleaseArtifact(profile, "integration"), true);
});

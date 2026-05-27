import assert from "node:assert/strict";
import test from "node:test";

import {
  PublisherProfileSchema,
  canPublisherReleaseArtifact,
  type PublisherProfile,
} from "../../../src/scale-ecosystem/marketplace/publisher/index.js";

function createPublisherProfile(overrides: Partial<PublisherProfile> = {}): PublisherProfile {
  return {
    publisherId: overrides.publisherId ?? "pub-123",
    displayName: overrides.displayName ?? "Test Publisher",
    trustLevel: overrides.trustLevel ?? "sandboxed",
    allowedArtifactTypes: overrides.allowedArtifactTypes ?? ["plugin"],
    contactEmail: overrides.contactEmail,
    reputationScore: overrides.reputationScore ?? 0.5,
    publishedArtifactCount: overrides.publishedArtifactCount ?? 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// canPublisherReleaseArtifact Tests
// ─────────────────────────────────────────────────────────────────────────────

test("canPublisherReleaseArtifact returns true when artifact type allowed and reputation >= 0.4 [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: ["plugin", "template"],
    reputationScore: 0.5,
  });

  const result = canPublisherReleaseArtifact(profile, "plugin");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns false when artifact type not allowed [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: ["plugin"],
    reputationScore: 0.8,
  });

  const result = canPublisherReleaseArtifact(profile, "template");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns false when reputation below 0.4 [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: ["plugin"],
    reputationScore: 0.3,
  });

  const result = canPublisherReleaseArtifact(profile, "plugin");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns false when both conditions fail [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: [],
    reputationScore: 0.2,
  });

  const result = canPublisherReleaseArtifact(profile, "plugin");

  assert.equal(result, false);
});

test("canPublisherReleaseArtifact returns true at exact reputation threshold 0.4 [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: ["plugin"],
    reputationScore: 0.4,
  });

  const result = canPublisherReleaseArtifact(profile, "plugin");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns true for verified trust level with high reputation [publisher-profile]", () => {
  const profile = createPublisherProfile({
    trustLevel: "verified",
    allowedArtifactTypes: ["integration"],
    reputationScore: 0.9,
  });

  const result = canPublisherReleaseArtifact(profile, "integration");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns true for enterprise trust level [publisher-profile]", () => {
  const profile = createPublisherProfile({
    trustLevel: "enterprise",
    allowedArtifactTypes: ["custom"],
    reputationScore: 0.6,
  });

  const result = canPublisherReleaseArtifact(profile, "custom");

  assert.equal(result, true);
});

test("canPublisherReleaseArtifact returns false for empty allowedArtifactTypes [publisher-profile]", () => {
  const profile = createPublisherProfile({
    allowedArtifactTypes: [],
    reputationScore: 1.0,
  });

  const result = canPublisherReleaseArtifact(profile, "plugin");

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// PublisherProfileSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PublisherProfileSchema parses valid profile [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "pub-123",
    displayName: "Acme Publisher",
    trustLevel: "verified",
    allowedArtifactTypes: ["plugin", "template"],
    contactEmail: "publisher@example.com",
    reputationScore: 0.85,
    publishedArtifactCount: 50,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.publisherId, "pub-123");
    assert.equal(result.data.trustLevel, "verified");
  }
});

test("PublisherProfileSchema accepts all trust levels [publisher-profile]", () => {
  for (const trustLevel of ["sandboxed", "verified", "enterprise"]) {
    const result = PublisherProfileSchema.safeParse({
      publisherId: "test",
      displayName: "Test",
      trustLevel,
    });
    assert.equal(result.success, true, `Trust level ${trustLevel} should be valid`);
  }
});

test("PublisherProfileSchema rejects invalid trust level [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "unknown",
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema rejects empty publisherId [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "",
    displayName: "Test",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema rejects empty displayName [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema rejects invalid email format when provided [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    contactEmail: "not-an-email",
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema accepts valid email format [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    contactEmail: "test@example.com",
  });

  assert.equal(result.success, true);
});

test("PublisherProfileSchema allows optional contactEmail to be omitted [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, true);
});

test("PublisherProfileSchema rejects reputationScore below 0 [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    reputationScore: -0.1,
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema rejects reputationScore above 1 [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    reputationScore: 1.5,
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema accepts boundary reputation scores 0 and 1 [publisher-profile]", () => {
  const result0 = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    reputationScore: 0,
  });
  const result1 = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    reputationScore: 1,
  });

  assert.equal(result0.success, true);
  assert.equal(result1.success, true);
});

test("PublisherProfileSchema rejects negative publishedArtifactCount [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    publishedArtifactCount: -1,
  });

  assert.equal(result.success, false);
});

test("PublisherProfileSchema accepts zero publishedArtifactCount [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
    publishedArtifactCount: 0,
  });

  assert.equal(result.success, true);
});

test("PublisherProfileSchema defaults allowedArtifactTypes to empty array [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.allowedArtifactTypes, []);
  }
});

test("PublisherProfileSchema defaults reputationScore to 0 [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.reputationScore, 0);
  }
});

test("PublisherProfileSchema defaults publishedArtifactCount to 0 [publisher-profile]", () => {
  const result = PublisherProfileSchema.safeParse({
    publisherId: "test",
    displayName: "Test",
    trustLevel: "sandboxed",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.publishedArtifactCount, 0);
  }
});
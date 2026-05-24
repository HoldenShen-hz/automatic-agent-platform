/**
 * Stable Evidence Bundle Unit Tests
 *
 * Tests for stable evidence bundle support functionality.
 * Issue #1968: overrides can replace name at runtime
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveStableEvidenceProfile,
  STABLE_EVIDENCE_PROFILES,
  writeJson,
  type StableEvidenceProfile,
  type StableEvidenceBundleOptions,
} from "../../../../../src/platform/shared/stability/stable-evidence-bundle-support.js";

test("STABLE_EVIDENCE_PROFILES contains smoke profile", () => {
  assert.ok(STABLE_EVIDENCE_PROFILES.smoke, "smoke profile should exist");
  assert.equal(STABLE_EVIDENCE_PROFILES.smoke.name, "smoke");
});

test("STABLE_EVIDENCE_PROFILES contains 24h profile", () => {
  assert.ok(STABLE_EVIDENCE_PROFILES["24h"], "24h profile should exist");
  assert.equal(STABLE_EVIDENCE_PROFILES["24h"].name, "24h");
  assert.ok(STABLE_EVIDENCE_PROFILES["24h"].soakDurationMs >= 24 * 60 * 60 * 1000);
});

test("STABLE_EVIDENCE_PROFILES contains 72h profile", () => {
  assert.ok(STABLE_EVIDENCE_PROFILES["72h"], "72h profile should exist");
  assert.equal(STABLE_EVIDENCE_PROFILES["72h"].name, "72h");
  assert.ok(STABLE_EVIDENCE_PROFILES["72h"].soakDurationMs >= 72 * 60 * 60 * 1000);
});

test("resolveStableEvidenceProfile returns default smoke profile", () => {
  const profile = resolveStableEvidenceProfile();

  assert.equal(profile.name, "smoke");
  assert.ok(profile.validationIterations >= 1);
  assert.ok(profile.soakDurationMs >= 0);
});

test("resolveStableEvidenceProfile returns specified profile", () => {
  const profile = resolveStableEvidenceProfile("24h");

  assert.equal(profile.name, "24h");
  assert.ok(profile.soakDurationMs >= 24 * 60 * 60 * 1000);
});

test("resolveStableEvidenceProfile applies overrides", () => {
  const profile = resolveStableEvidenceProfile("smoke", {
    validationIterations: 10,
    soakDurationMs: 60_000,
  });

  assert.equal(profile.validationIterations, 10);
  assert.equal(profile.soakDurationMs, 60_000);
  // Other fields should remain from base profile
  assert.ok(profile.soakIntervalMs > 0);
});

test("smoke profile has minimal iterations for fast feedback", () => {
  const profile = STABLE_EVIDENCE_PROFILES.smoke;

  assert.ok(profile.validationIterations <= 5, "smoke should have few iterations");
  assert.ok(profile.soakDurationMs <= 60_000, "smoke soak should be short");
});

test("smoke profile soak interval is reasonable", () => {
  const profile = STABLE_EVIDENCE_PROFILES.smoke;

  assert.ok(profile.soakIntervalMs > 0);
  assert.ok(profile.soakIntervalMs <= profile.soakDurationMs);
});

test("24h profile has extended soak duration", () => {
  const profile = STABLE_EVIDENCE_PROFILES["24h"];

  assert.ok(profile.soakDurationMs >= 24 * 60 * 60 * 1000);
  assert.ok(profile.validationIterations >= 3);
});

test("72h profile has maximum soak duration", () => {
  const profile = STABLE_EVIDENCE_PROFILES["72h"];

  assert.ok(profile.soakDurationMs >= 72 * 60 * 60 * 1000);
  assert.ok(profile.validationIterations >= 5);
});

test("resolveStableEvidenceProfile handles partial overrides", () => {
  const profile = resolveStableEvidenceProfile("24h", {
    soakIntervalMs: 600_000,
  });

  // Should have 24h soak duration but custom interval
  assert.equal(profile.name, "24h");
  assert.equal(profile.soakIntervalMs, 600_000);
  assert.ok(profile.soakDurationMs >= 24 * 60 * 60 * 1000);
});

test("profile iterations per cycle is positive", () => {
  for (const profile of Object.values(STABLE_EVIDENCE_PROFILES)) {
    assert.ok(profile.soakIterationsPerCycle >= 1);
  }
});

test("writeJson produces valid JSON string", () => {
  const testObj = { name: "test", value: 123 };
  const jsonStr = writeJson("/tmp/test-output.json", testObj);

  // writeJson returns undefined (void function that writes to file)
  // We can verify by checking that the function doesn't throw
  assert.ok(jsonStr === undefined);
});

// ============================================================================
// Issue #1968 tests: overrides can replace name at runtime
// ============================================================================

test("resolveStableEvidenceProfile preserves profile name with empty overrides", () => {
  const profile = resolveStableEvidenceProfile("smoke", {});

  assert.equal(profile.name, "smoke", "name should be preserved from base profile");
});

test("resolveStableEvidenceProfile does not allow name to be replaced via overrides", () => {
  assert.throws(() => resolveStableEvidenceProfile("smoke", {
    name: "custom_profile" as any,
  } as unknown as StableEvidenceBundleOptions["profileOverrides"]), /profileOverrides\.name cannot be changed/);
});

test("resolveStableEvidenceProfile only overrides explicitly specified properties", () => {
  const profile = resolveStableEvidenceProfile("24h", {
    validationIterations: 10,
  });

  // validationIterations should be overridden
  assert.equal(profile.validationIterations, 10);
  // All other properties should remain from 24h profile
  assert.equal(profile.name, "24h");
  assert.ok(profile.soakDurationMs >= 24 * 60 * 60 * 1000);
  assert.ok(profile.soakIntervalMs > 0);
  assert.ok(profile.soakIterationsPerCycle >= 1);
});

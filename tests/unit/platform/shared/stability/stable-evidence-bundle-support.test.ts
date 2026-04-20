import assert from "node:assert/strict";
import test from "node:test";

import {
  STABLE_EVIDENCE_PROFILES,
  resolveStableEvidenceProfile,
  type StableEvidenceProfileName,
  type StableEvidenceBundleOptions,
} from "../../../../../src/platform/shared/stability/stable-evidence-bundle-support.js";

test("STABLE_EVIDENCE_PROFILES has smoke, 24h, and 72h profiles", () => {
  assert.ok(STABLE_EVIDENCE_PROFILES["smoke"]);
  assert.ok(STABLE_EVIDENCE_PROFILES["24h"]);
  assert.ok(STABLE_EVIDENCE_PROFILES["72h"]);
});

test("STABLE_EVIDENCE_PROFILES smoke has quick settings", () => {
  const smoke = STABLE_EVIDENCE_PROFILES["smoke"];
  assert.equal(smoke.name, "smoke");
  assert.equal(smoke.validationIterations, 2);
  assert.ok(smoke.soakDurationMs < 60_000); // Less than 1 minute
});

test("STABLE_EVIDENCE_PROFILES 24h has 24-hour soak duration", () => {
  const profile = STABLE_EVIDENCE_PROFILES["24h"];
  assert.equal(profile.name, "24h");
  assert.equal(profile.validationIterations, 5);
  assert.equal(profile.soakDurationMs, 24 * 60 * 60 * 1000);
});

test("STABLE_EVIDENCE_PROFILES 72h has 72-hour soak duration", () => {
  const profile = STABLE_EVIDENCE_PROFILES["72h"];
  assert.equal(profile.name, "72h");
  assert.equal(profile.validationIterations, 8);
  assert.equal(profile.soakDurationMs, 72 * 60 * 60 * 1000);
});

test("STABLE_EVIDENCE_PROFILES all have required fields", () => {
  for (const profile of Object.values(STABLE_EVIDENCE_PROFILES)) {
    assert.ok(profile.name);
    assert.ok(typeof profile.validationIterations === "number");
    assert.ok(typeof profile.soakDurationMs === "number");
    assert.ok(typeof profile.soakIntervalMs === "number");
    assert.ok(typeof profile.soakIterationsPerCycle === "number");
  }
});

test("resolveStableEvidenceProfile returns default smoke profile", () => {
  const profile = resolveStableEvidenceProfile();

  assert.equal(profile.name, "smoke");
  assert.deepEqual(profile, STABLE_EVIDENCE_PROFILES["smoke"]);
});

test("resolveStableEvidenceProfile returns named profile", () => {
  const profile24h = resolveStableEvidenceProfile("24h");
  assert.equal(profile24h.name, "24h");

  const profile72h = resolveStableEvidenceProfile("72h");
  assert.equal(profile72h.name, "72h");
});

test("resolveStableEvidenceProfile applies overrides", () => {
  const profile = resolveStableEvidenceProfile("smoke", {
    validationIterations: 10,
    soakDurationMs: 60_000,
  });

  assert.equal(profile.validationIterations, 10);
  assert.equal(profile.soakDurationMs, 60_000);
  // Other properties from smoke profile preserved
  assert.equal(profile.name, "smoke");
});

test("resolveStableEvidenceProfile partial overrides preserve base values", () => {
  const profile = resolveStableEvidenceProfile("24h", {
    soakDurationMs: 30 * 60 * 1000, // 30 minutes instead of 24 hours
  });

  // Overridden
  assert.equal(profile.soakDurationMs, 30 * 60 * 1000);

  // Preserved from 24h profile
  assert.equal(profile.validationIterations, 5);
  assert.equal(profile.name, "24h");
});

test("resolveStableEvidenceProfile with empty overrides returns base profile", () => {
  const profile = resolveStableEvidenceProfile("smoke", {});

  assert.equal(profile.name, "smoke");
  assert.deepEqual(profile, STABLE_EVIDENCE_PROFILES["smoke"]);
});

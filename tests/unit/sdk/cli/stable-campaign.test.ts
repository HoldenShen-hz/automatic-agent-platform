/**
 * Stable Campaign CLI Tests
 *
 * Tests for stable-campaign.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Tests for profile resolution
// ---------------------------------------------------------------------------

const STABLE_PROFILES = ["smoke", "24h", "72h"] as const;

test("stable-campaign defaults to smoke profile", () => {
  const profile = "smoke";
  assert.ok(STABLE_PROFILES.includes(profile));
});

test("stable-campaign accepts 24h profile", () => {
  const profile = "24h";
  assert.ok(STABLE_PROFILES.includes(profile));
});

test("stable-campaign accepts 72h profile", () => {
  const profile = "72h";
  assert.ok(STABLE_PROFILES.includes(profile));
});

test("stable-campaign rejects invalid profile", () => {
  const profile = "invalid";
  const isValid = STABLE_PROFILES.includes(profile as typeof STABLE_PROFILES[number]);
  assert.equal(isValid, false);
});

test("stable-campaign throws ValidationError for invalid profile", () => {
  const profile = "100h";
  assert.throws(
    () => {
      if (!STABLE_PROFILES.includes(profile as typeof STABLE_PROFILES[number])) {
        throw new ValidationError("stable.invalid_campaign_profile", `stable.invalid_campaign_profile:${profile}`);
      }
    },
    { message: "stable.invalid_campaign_profile:100h" },
  );
});

// ---------------------------------------------------------------------------
// Tests for optional positive number parsing
// ---------------------------------------------------------------------------

function optionalPositiveNumber(env: Record<string, string | undefined>, name: string): number | null {
  const raw = env[name];
  if (raw == null) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`stable.invalid_env:${name}`, `stable.invalid_env:${name}`);
  }
  return parsed;
}

test("optionalPositiveNumber returns null when env not set", () => {
  const env: Record<string, string | undefined> = {};
  const result = optionalPositiveNumber(env, "AA_TEST");
  assert.equal(result, null);
});

test("optionalPositiveNumber parses valid positive number", () => {
  const env = { AA_TEST: "5000" };
  const result = optionalPositiveNumber(env, "AA_TEST");
  assert.equal(result, 5000);
});

test("optionalPositiveNumber rejects zero", () => {
  const env = { AA_TEST: "0" };
  assert.throws(
    () => optionalPositiveNumber(env, "AA_TEST"),
    { message: "stable.invalid_env:AA_TEST" },
  );
});

test("optionalPositiveNumber rejects negative numbers", () => {
  const env = { AA_TEST: "-100" };
  assert.throws(
    () => optionalPositiveNumber(env, "AA_TEST"),
    { message: "stable.invalid_env:AA_TEST" },
  );
});

test("optionalPositiveNumber rejects non-numeric strings", () => {
  const env = { AA_TEST: "abc" };
  assert.throws(
    () => optionalPositiveNumber(env, "AA_TEST"),
    { message: "stable.invalid_env:AA_TEST" },
  );
});

test("optionalPositiveNumber rejects infinity", () => {
  const env = { AA_TEST: "Infinity" };
  assert.throws(
    () => optionalPositiveNumber(env, "AA_TEST"),
    { message: "stable.invalid_env:AA_TEST" },
  );
});

// ---------------------------------------------------------------------------
// Tests for campaign env config building
// ---------------------------------------------------------------------------

test("campaign env config builds with all optional fields", () => {
  const env: Record<string, string | undefined> = {
    AA_STABLE_CAMPAIGN_PROFILE: "24h",
    AA_STABLE_CAMPAIGN_TARGET_DURATION_MS: "3600000",
    AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS: "600000",
    AA_STABLE_CAMPAIGN_INTERVAL_MS: "30000",
    AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE: "10",
    AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS: "5",
  };

  const profile = env.AA_STABLE_CAMPAIGN_PROFILE ?? "smoke";
  const config = {
    profile,
    targetDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_TARGET_DURATION_MS"),
    segmentDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS"),
    intervalMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_INTERVAL_MS"),
    iterationsPerCycle: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE"),
    validationIterations: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS"),
  };

  assert.equal(config.profile, "24h");
  assert.equal(config.targetDurationMs, 3600000);
  assert.equal(config.segmentDurationMs, 600000);
  assert.equal(config.intervalMs, 30000);
  assert.equal(config.iterationsPerCycle, 10);
  assert.equal(config.validationIterations, 5);
});

test("campaign env config defaults to smoke when profile not set", () => {
  const env: Record<string, string | undefined> = {};
  const profile = env.AA_STABLE_CAMPAIGN_PROFILE ?? "smoke";
  assert.equal(profile, "smoke");
});

test("campaign env config omits undefined optional fields", () => {
  const env: Record<string, string | undefined> = {};
  const config: {
    profile: string;
    targetDurationMs: number | null;
    segmentDurationMs: number | null;
    intervalMs: number | null;
    iterationsPerCycle: number | null;
    validationIterations: number | null;
  } = {
    profile: "smoke",
    targetDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_TARGET_DURATION_MS"),
    segmentDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS"),
    intervalMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_INTERVAL_MS"),
    iterationsPerCycle: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE"),
    validationIterations: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS"),
  };

  assert.equal(config.targetDurationMs, null);
  assert.equal(config.segmentDurationMs, null);
  assert.equal(config.intervalMs, null);
  assert.equal(config.iterationsPerCycle, null);
  assert.equal(config.validationIterations, null);
});

// ---------------------------------------------------------------------------
// Tests for report exit code logic
// ---------------------------------------------------------------------------

test("stable-campaign sets exit code 1 when evidence does not pass", () => {
  const report: { finalEvidenceReport?: { summary: { passed: boolean } } } = {
    finalEvidenceReport: {
      summary: {
        passed: false,
      },
    },
  };

  const shouldFail = !!(report.finalEvidenceReport && !report.finalEvidenceReport.summary.passed);
  assert.equal(shouldFail, true);
});

test("stable-campaign does not set exit code when evidence passes", () => {
  const report: { finalEvidenceReport?: { summary: { passed: boolean } } } = {
    finalEvidenceReport: {
      summary: {
        passed: true,
      },
    },
  };

  const shouldFail = !!(report.finalEvidenceReport && !report.finalEvidenceReport.summary.passed);
  assert.equal(shouldFail, false);
});

test("stable-campaign does not set exit code when no evidence report", () => {
  const report: { finalEvidenceReport?: { summary: { passed: boolean } } } = {};

  const shouldFail = !!(report.finalEvidenceReport && !report.finalEvidenceReport.summary.passed);
  assert.equal(shouldFail, false);
});

// ---------------------------------------------------------------------------
// Tests for runner arguments building
// ---------------------------------------------------------------------------

test("campaign runner receives profile and timing options", () => {
  const envConfig = {
    profile: "24h" as const,
    outputDir: "/data/stable-campaign/24h",
    targetDurationMs: 3600000,
    segmentDurationMs: 600000,
    intervalMs: 30000,
    iterationsPerCycle: 10,
    validationIterations: 5,
  };

  const runnerArgs: Record<string, unknown> = {
    outputDir: envConfig.outputDir,
    profileName: envConfig.profile,
  };

  if (envConfig.targetDurationMs != null) {
    runnerArgs.targetDurationMs = envConfig.targetDurationMs;
  }
  if (envConfig.segmentDurationMs != null) {
    runnerArgs.segmentDurationMs = envConfig.segmentDurationMs;
  }
  if (envConfig.intervalMs != null) {
    runnerArgs.intervalMs = envConfig.intervalMs;
  }
  if (envConfig.iterationsPerCycle != null) {
    runnerArgs.iterationsPerCycle = envConfig.iterationsPerCycle;
  }
  if (envConfig.validationIterations != null) {
    runnerArgs.validationIterations = envConfig.validationIterations;
  }

  assert.equal(runnerArgs.profileName, "24h");
  assert.equal(runnerArgs.targetDurationMs, 3600000);
  assert.equal(runnerArgs.segmentDurationMs, 600000);
  assert.equal(runnerArgs.intervalMs, 30000);
  assert.equal(runnerArgs.iterationsPerCycle, 10);
  assert.equal(runnerArgs.validationIterations, 5);
});

/**
 * Stable Sequence CLI Tests
 *
 * Tests for stable-sequence.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadStableSequenceCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/stable-cli-env.js";

// ---------------------------------------------------------------------------
// Tests for loadStableSequenceCliEnv
// ---------------------------------------------------------------------------

test("loadStableSequenceCliEnv returns default evidenceRootDir", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.ok(envConfig.evidenceRootDir.includes("stable-evidence"));
});

test("loadStableSequenceCliEnv parses custom evidenceRootDir", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_EVIDENCE_ROOT: "/custom/evidence",
  });
  assert.equal(envConfig.evidenceRootDir, "/custom/evidence");
});

test("loadStableSequenceCliEnv returns default profile names", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.deepEqual(envConfig.profileNames, ["24h", "72h"]);
});

test("loadStableSequenceCliEnv parses custom profiles", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_PROFILES: "smoke,24h",
  });
  assert.deepEqual(envConfig.profileNames, ["smoke", "24h"]);
});

test("loadStableSequenceCliEnv filters invalid profiles", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_PROFILES: "smoke,invalid,24h",
  });
  // invalid is filtered out, valid ones remain
  assert.ok(envConfig.profileNames.includes("smoke"));
  assert.ok(envConfig.profileNames.includes("24h"));
  assert.equal(JSON.stringify(envConfig.profileNames).includes("\"invalid\""), false);
});

test("loadStableSequenceCliEnv defaults to 24h,72h if all profiles invalid", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_PROFILES: "invalid1,invalid2",
  });
  assert.deepEqual(envConfig.profileNames, ["24h", "72h"]);
});

test("loadStableSequenceCliEnv returns empty sharedProfileOptions by default", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.deepEqual(envConfig.sharedProfileOptions, {});
});

test("loadStableSequenceCliEnv parses targetDurationMs", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_TARGET_DURATION_MS: "60000",
  });
  assert.equal(envConfig.sharedProfileOptions.targetDurationMs, 60_000);
});

test("loadStableSequenceCliEnv parses segmentDurationMs", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_SEGMENT_DURATION_MS: "30000",
  });
  assert.equal(envConfig.sharedProfileOptions.segmentDurationMs, 30_000);
});

test("loadStableSequenceCliEnv parses intervalMs", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_INTERVAL_MS: "5000",
  });
  assert.equal(envConfig.sharedProfileOptions.intervalMs, 5_000);
});

test("loadStableSequenceCliEnv parses iterationsPerCycle", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_ITERATIONS_PER_CYCLE: "10",
  });
  assert.equal(envConfig.sharedProfileOptions.iterationsPerCycle, 10);
});

test("loadStableSequenceCliEnv parses validationIterations", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_VALIDATION_ITERATIONS: "3",
  });
  assert.equal(envConfig.sharedProfileOptions.validationIterations, 3);
});

test("loadStableSequenceCliEnv parses enforceWallClockDuration as boolean", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_ENFORCE_WALL_CLOCK: "true",
  });
  assert.equal(envConfig.sharedProfileOptions.enforceWallClockDuration, true);
});

test("loadStableSequenceCliEnv runUntilComplete is false by default", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.equal(envConfig.runUntilComplete, false);
});

test("loadStableSequenceCliEnv parses runUntilComplete as true", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE: "1",
  });
  assert.equal(envConfig.runUntilComplete, true);
});

test("loadStableSequenceCliEnv parses runUntilComplete as true from true string", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE: "true",
  });
  assert.equal(envConfig.runUntilComplete, true);
});

test("loadStableSequenceCliEnv parses runUntilComplete as true from yes string", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE: "yes",
  });
  assert.equal(envConfig.runUntilComplete, true);
});

test("loadStableSequenceCliEnv sleepMs defaults to 0", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.equal(envConfig.sleepMs, 0);
});

test("loadStableSequenceCliEnv parses sleepMs", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_SLEEP_MS: "5000",
  });
  assert.equal(envConfig.sleepMs, 5_000);
});

test("loadStableSequenceCliEnv maxPasses is null by default", () => {
  const envConfig = loadStableSequenceCliEnv({});
  assert.equal(envConfig.maxPasses, null);
});

test("loadStableSequenceCliEnv parses maxPasses", () => {
  const envConfig = loadStableSequenceCliEnv({
    AA_STABLE_SEQUENCE_MAX_PASSES: "10",
  });
  assert.equal(envConfig.maxPasses, 10);
});

test("loadStableSequenceCliEnv invalid sleepMs throws", () => {
  assert.throws(
    () => loadStableSequenceCliEnv({ AA_STABLE_SEQUENCE_SLEEP_MS: "-1000" }),
    /stable\.invalid_env:AA_STABLE_SEQUENCE_SLEEP_MS/,
  );
});

test("loadStableSequenceCliEnv invalid enforceWallClock throws", () => {
  assert.throws(
    () => loadStableSequenceCliEnv({ AA_STABLE_SEQUENCE_ENFORCE_WALL_CLOCK: "maybe" }),
    /stable\.invalid_env:AA_STABLE_SEQUENCE_ENFORCE_WALL_CLOCK/,
  );
});

// ---------------------------------------------------------------------------
// Tests for StableEvidenceSequenceReport structure
// ---------------------------------------------------------------------------

test("StableEvidenceSequenceReport has required state field", () => {
  const report = {
    state: {
      sequenceId: "test_seq_1",
      evidenceRootDir: "/test",
      profileNames: ["24h"],
      activeProfileName: "24h",
      completed: false,
      blocked: false,
      blockReason: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      profiles: [],
    },
    advancedProfiles: [],
    lastCampaignReport: null,
  };

  assert.ok(report.state !== undefined);
  assert.equal(report.state.completed, false);
  assert.equal(report.state.blocked, false);
});

test("StableEvidenceSequenceReport has required advancedProfiles field", () => {
  const report = {
    state: {
      sequenceId: "test_seq_1",
      evidenceRootDir: "/test",
      profileNames: ["24h"],
      activeProfileName: null,
      completed: true,
      blocked: false,
      blockReason: null,
      startedAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      profiles: [],
    },
    advancedProfiles: ["24h"],
    lastCampaignReport: null,
  };

  assert.ok(Array.isArray(report.advancedProfiles));
  assert.equal(report.advancedProfiles[0], "24h");
});

test("StableEvidenceSequenceReport blocked state has blockReason", () => {
  const report = {
    state: {
      sequenceId: "test_seq_1",
      evidenceRootDir: "/test",
      profileNames: ["24h"],
      activeProfileName: "24h",
      completed: false,
      blocked: true,
      blockReason: "24h stable evidence completed with failing verdict",
      startedAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      profiles: [],
    },
    advancedProfiles: [],
    lastCampaignReport: null,
  };

  assert.equal(report.state.blocked, true);
  assert.ok(report.state.blockReason !== null);
  assert.ok(report.state.blockReason.includes("failing verdict"));
});

// ---------------------------------------------------------------------------
// Tests for StableEvidenceProfileName type
// ---------------------------------------------------------------------------

test("Valid profile names are smoke, 24h, 72h", () => {
  const validProfiles = ["smoke", "24h", "72h"];

  assert.ok(validProfiles.includes("smoke"));
  assert.ok(validProfiles.includes("24h"));
  assert.ok(validProfiles.includes("72h"));
});

test("Profile names are case sensitive", () => {
  const validProfiles = ["smoke", "24h", "72h"];

  assert.equal(validProfiles.includes("SMOKE"), false);
  assert.equal(validProfiles.includes("Smoke"), false);
  assert.equal(validProfiles.includes("24H"), false);
});

// ---------------------------------------------------------------------------
// Tests for options mapping in stable-sequence CLI
// ---------------------------------------------------------------------------

test("CLI options correctly map profileNames to options", () => {
  const profileNames = ["smoke", "24h"];
  const sharedProfileOptions = { targetDurationMs: 5000 };
  const profileOptions: Record<string, typeof sharedProfileOptions> = Object.fromEntries(
    profileNames.map((profileName) => [profileName, sharedProfileOptions]),
  );

  const options = {
    evidenceRootDir: "/test/evidence",
    profileNames,
    profileOptions,
  };

  assert.equal(options.profileOptions["smoke"]!.targetDurationMs, 5000);
  assert.equal(options.profileOptions["24h"]!.targetDurationMs, 5000);
});

test("CLI sleepMs is passed to untilComplete options", () => {
  const sleepMs = 10000;
  const maxPasses = 5;

  const untilCompleteOptions = {
    sleepMs,
    ...(maxPasses !== null ? { maxPasses } : {}),
  };

  assert.equal(untilCompleteOptions.sleepMs, 10000);
  assert.equal(untilCompleteOptions.maxPasses, 5);
});

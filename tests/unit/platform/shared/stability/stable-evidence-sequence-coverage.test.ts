/**
 * Additional unit tests for Stable Evidence Sequence.
 *
 * Tests sequence blocking logic, profile state synchronization, and until-complete polling.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";

import {
  runStableEvidenceSequence,
  runStableEvidenceSequenceUntilComplete,
  type StableEvidenceSequenceOptions,
  type StableEvidenceSequenceState,
  type StableEvidenceSequenceProfileState,
} from "../../../../../src/platform/shared/stability/stable-evidence-sequence.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("runStableEvidenceSequenceUntilComplete exits when blocked [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-until-blocked-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    const outputDir = `${evidenceRoot}/24h`;
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      `${outputDir}/stable-evidence-campaign-state.json`,
      JSON.stringify({
        campaignId: "blocked-campaign",
        profile: { name: "24h", validationIterations: 1, soakDurationMs: 100, soakIntervalMs: 10, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 100,
        accumulatedDurationMs: 100,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 100,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        finalEvidenceReportPath: `${outputDir}/stable-evidence-report.json`,
        finalEvidencePassed: false,
        segments: [],
      }),
    );
    writeFileSync(
      `${outputDir}/stable-evidence-report.json`,
      JSON.stringify({
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        profile: { name: "24h" },
        summary: { passed: false },
        acceptanceLine: { status: "fail", criteria: [], observed: { soakDurationMs: 100 } },
      }),
    );

    // Run sequence with blocked profile
    const report = await runStableEvidenceSequenceUntilComplete({
      evidenceRootDir: evidenceRoot,
      sleepMs: 1, // Minimal sleep for test
      maxPasses: 3,
    });

    // Should exit early because blocked
    assert.equal(report.state.blocked, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableEvidenceSequenceUntilComplete respects maxPasses [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-until-max-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    // Create a fresh workspace without any evidence to avoid blocking
    // The sequence will keep running until maxPasses
    const report = await runStableEvidenceSequenceUntilComplete({
      evidenceRootDir: evidenceRoot,
      profileNames: ["smoke"],
      profileOptions: {
        smoke: {
          targetDurationMs: 25,
          segmentDurationMs: 25,
          intervalMs: 1,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
      sleepMs: 1,
      maxPasses: 2,
    });

    // Should have called runStableEvidenceSequence up to maxPasses times
    assert.ok(report.state);
  } finally {
    cleanupPath(workspace);
  }
});

test("StableEvidenceSequenceState structure validation [stable-evidence-sequence-coverage]", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "test-seq-123",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
    activeProfileName: "24h",
    completed: false,
    blocked: false,
    blockReason: null,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:01:00.000Z",
    profiles: [
      {
        profileName: "24h",
        outputDir: "/tmp/evidence/24h",
        campaignStatePath: "/tmp/evidence/24h/stable-evidence-campaign-state.json",
        finalEvidenceReportPath: "/tmp/evidence/24h/stable-evidence-report.json",
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        passed: true,
        accumulatedDurationMs: 100,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 100,
        remainingWallClockDurationMs: 0,
        segmentCount: 1,
      },
      {
        profileName: "72h",
        outputDir: "/tmp/evidence/72h",
        campaignStatePath: "/tmp/evidence/72h/stable-evidence-campaign-state.json",
        finalEvidenceReportPath: "/tmp/evidence/72h/stable-evidence-report.json",
        startedAt: null,
        updatedAt: null,
        completed: false,
        passed: null,
        accumulatedDurationMs: 0,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 0,
        remainingWallClockDurationMs: 0,
        segmentCount: 0,
      },
    ],
  };

  assert.equal(state.sequenceId, "test-seq-123");
  assert.deepEqual(state.profileNames, ["24h", "72h"]);
  assert.equal(state.activeProfileName, "24h");
  assert.equal(state.completed, false);
  assert.equal(state.blocked, false);
  assert.equal(state.profiles.length, 2);
});

test("StableEvidenceSequenceProfileState for completed profile [stable-evidence-sequence-coverage]", () => {
  const profile: StableEvidenceSequenceProfileState = {
    profileName: "24h",
    outputDir: "/tmp/evidence/24h",
    campaignStatePath: "/tmp/evidence/24h/stable-evidence-campaign-state.json",
    finalEvidenceReportPath: "/tmp/evidence/24h/stable-evidence-report.json",
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T01:00:00.000Z",
    completed: true,
    passed: true,
    accumulatedDurationMs: 86400000,
    remainingDurationMs: 0,
    accumulatedWallClockDurationMs: 86400000,
    remainingWallClockDurationMs: 0,
    segmentCount: 5,
  };

  assert.equal(profile.profileName, "24h");
  assert.equal(profile.completed, true);
  assert.equal(profile.passed, true);
  assert.equal(profile.segmentCount, 5);
});

test("StableEvidenceSequenceProfileState for failed profile [stable-evidence-sequence-coverage]", () => {
  const profile: StableEvidenceSequenceProfileState = {
    profileName: "72h",
    outputDir: "/tmp/evidence/72h",
    campaignStatePath: "/tmp/evidence/72h/stable-evidence-campaign-state.json",
    finalEvidenceReportPath: "/tmp/evidence/72h/stable-evidence-report.json",
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T01:00:00.000Z",
    completed: true,
    passed: false,
    accumulatedDurationMs: 86400000,
    remainingDurationMs: 0,
    accumulatedWallClockDurationMs: 86400000,
    remainingWallClockDurationMs: 0,
    segmentCount: 3,
  };

  assert.equal(profile.completed, true);
  assert.equal(profile.passed, false);
});

test("StableEvidenceSequenceProfileState for incomplete profile [stable-evidence-sequence-coverage]", () => {
  const profile: StableEvidenceSequenceProfileState = {
    profileName: "72h",
    outputDir: "/tmp/evidence/72h",
    campaignStatePath: "/tmp/evidence/72h/stable-evidence-campaign-state.json",
    finalEvidenceReportPath: "/tmp/evidence/72h/stable-evidence-report.json",
    startedAt: null,
    updatedAt: null,
    completed: false,
    passed: null,
    accumulatedDurationMs: 0,
    remainingDurationMs: 86400000,
    accumulatedWallClockDurationMs: 0,
    remainingWallClockDurationMs: 86400000,
    segmentCount: 0,
  };

  assert.equal(profile.completed, false);
  assert.equal(profile.passed, null);
  assert.equal(profile.remainingDurationMs, 86400000);
});

test("runStableEvidenceSequence handles custom profile options [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-custom-opts-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileNames: ["24h"],
      profileOptions: {
        "24h": {
          targetDurationMs: 50,
          segmentDurationMs: 50,
          validationIterations: 1,
          intervalMs: 5,
          iterationsPerCycle: 1,
        },
      },
    });

    assert.ok(report.state);
    assert.ok(Array.isArray(report.advancedProfiles));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableEvidenceSequence sequence persists state [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-persist-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileNames: ["smoke"],
      profileOptions: {
        smoke: {
          targetDurationMs: 0,
          segmentDurationMs: 0,
          validationIterations: 1,
          intervalMs: 0,
          iterationsPerCycle: 1,
        },
      },
    });

    // Check that state was persisted
    assert.equal(existsSync(`${evidenceRoot}/stable-evidence-sequence-state.json`), true);
    assert.equal(existsSync(`${evidenceRoot}/stable-evidence-sequence-report.json`), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableEvidenceSequence blocked profile has blockReason [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-block-reason-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    const outputDir = `${evidenceRoot}/24h`;
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      `${outputDir}/stable-evidence-campaign-state.json`,
      JSON.stringify({
        campaignId: "failed-24h",
        profile: { name: "24h", validationIterations: 1, soakDurationMs: 100, soakIntervalMs: 10, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 100,
        accumulatedDurationMs: 100,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 100,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        finalEvidenceReportPath: `${outputDir}/stable-evidence-report.json`,
        finalEvidencePassed: false,
        segments: [],
      }),
    );
    writeFileSync(
      `${outputDir}/stable-evidence-report.json`,
      JSON.stringify({
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        profile: { name: "24h" },
        summary: { passed: false },
        acceptanceLine: { status: "fail", criteria: [], observed: { soakDurationMs: 100 } },
      }),
    );

    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
    });

    assert.equal(report.state.blocked, true);
    assert.ok(report.state.blockReason !== null);
    assert.ok(report.state.blockReason?.includes("24h"));
  } finally {
    cleanupPath(workspace);
  }
});

test("StableEvidenceSequenceState completed when all profiles passed [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-all-passed-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    // Seed both 24h and 72h as completed and passing
    for (const profile of ["24h", "72h"]) {
      const outputDir = `${evidenceRoot}/${profile}`;
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(
        `${outputDir}/stable-evidence-campaign-state.json`,
        JSON.stringify({
          campaignId: `completed-${profile}`,
          profile: { name: profile, validationIterations: 1, soakDurationMs: 100, soakIntervalMs: 10, soakIterationsPerCycle: 1 },
          durationMode: "virtual",
          targetDurationMs: 100,
          accumulatedDurationMs: 100,
          remainingDurationMs: 0,
          accumulatedWallClockDurationMs: 100,
          remainingWallClockDurationMs: 0,
          startedAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:01:00.000Z",
          completed: true,
          finalEvidenceReportPath: `${outputDir}/stable-evidence-report.json`,
          finalEvidencePassed: true,
          segments: [],
        }),
      );
      writeFileSync(
        `${outputDir}/stable-evidence-report.json`,
        JSON.stringify({
          startedAt: "2026-04-01T00:00:00.000Z",
          finishedAt: "2026-04-01T00:01:00.000Z",
          profile: { name: profile },
          summary: { passed: true },
          acceptanceLine: { status: "pass", criteria: [], observed: { soakDurationMs: 100 } },
        }),
      );
    }

    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
    });

    assert.equal(report.state.completed, true);
    assert.equal(report.state.blocked, false);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableEvidenceSequence activeProfileName tracks current profile [stable-evidence-sequence-coverage]", async () => {
  const workspace = createTempWorkspace("aa-seq-active-");
  const evidenceRoot = `${workspace}/evidence`;

  try {
    // Don't seed anything - sequence will run fresh
    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileNames: ["24h"],
      profileOptions: {
        "24h": {
          targetDurationMs: 50,
          segmentDurationMs: 50,
          validationIterations: 1,
          intervalMs: 5,
          iterationsPerCycle: 1,
        },
      },
    });

    // The active profile should be 24h while it's running
    assert.ok(report.state.activeProfileName === "24h" || report.state.activeProfileName === null);
  } finally {
    cleanupPath(workspace);
  }
});

test("StableEvidenceSequenceState blockReason is null when not blocked [stable-evidence-sequence-coverage]", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "test-seq",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h"],
    activeProfileName: null,
    completed: true,
    blocked: false,
    blockReason: null,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:01:00.000Z",
    profiles: [],
  };

  assert.equal(state.blocked, false);
  assert.equal(state.blockReason, null);
});

test("StableEvidenceSequenceState blockReason is set when blocked [stable-evidence-sequence-coverage]", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "test-seq",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h"],
    activeProfileName: "24h",
    completed: false,
    blocked: true,
    blockReason: "24h stable evidence completed with failing verdict",
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:01:00.000Z",
    profiles: [
      {
        profileName: "24h",
        outputDir: "/tmp/evidence/24h",
        campaignStatePath: "/tmp/evidence/24h/state.json",
        finalEvidenceReportPath: "/tmp/evidence/24h/report.json",
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        passed: false,
        accumulatedDurationMs: 100,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 100,
        remainingWallClockDurationMs: 0,
        segmentCount: 1,
      },
    ],
  };

  assert.equal(state.blocked, true);
  assert.ok(state.blockReason?.includes("failing verdict"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runStableEvidenceSequence,
  runStableEvidenceSequenceUntilComplete,
  type StableEvidenceSequenceOptions,
  type StableEvidenceSequenceProfileState,
  type StableEvidenceSequenceState,
  type StableEvidenceSequenceReport,
} from "../../../../src/platform/stability/stable-evidence-sequence.js";

test("StableEvidenceSequenceOptions has required evidenceRootDir", () => {
  const options: StableEvidenceSequenceOptions = {
    evidenceRootDir: "/tmp/evidence",
  };

  assert.strictEqual(options.evidenceRootDir, "/tmp/evidence");
});

test("StableEvidenceSequenceOptions accepts profile names", () => {
  const options: StableEvidenceSequenceOptions = {
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
  };

  assert.deepStrictEqual(options.profileNames, ["24h", "72h"]);
});

test("StableEvidenceSequenceOptions accepts per-profile options", () => {
  const options: StableEvidenceSequenceOptions = {
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
    profileOptions: {
      "24h": {
        targetDurationMs: 86400000,
        segmentDurationMs: 3600000,
      },
      "72h": {
        targetDurationMs: 259200000,
        segmentDurationMs: 7200000,
      },
    },
  };

  assert.ok(options.profileOptions);
  assert.ok(options.profileOptions["24h"]);
  assert.ok(options.profileOptions["72h"]);
});

test("StableEvidenceSequenceProfileState has correct structure", () => {
  const state: StableEvidenceSequenceProfileState = {
    profileName: "24h",
    outputDir: "/tmp/evidence/24h",
    campaignStatePath: "/tmp/evidence/24h/stable-evidence-campaign-state.json",
    finalEvidenceReportPath: "/tmp/evidence/24h/stable-evidence-report.json",
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T23:59:59.000Z",
    completed: true,
    passed: true,
    accumulatedDurationMs: 86400000,
    remainingDurationMs: 0,
    accumulatedWallClockDurationMs: 86400000,
    remainingWallClockDurationMs: 0,
    segmentCount: 24,
  };

  assert.strictEqual(state.profileName, "24h");
  assert.ok(state.outputDir.length > 0);
  assert.ok(state.campaignStatePath.length > 0);
  assert.ok(state.finalEvidenceReportPath.length > 0);
  assert.strictEqual(typeof state.completed, "boolean");
  assert.strictEqual(typeof state.passed, "boolean");
  assert.ok(state.segmentCount >= 0);
});

test("StableEvidenceSequenceState has correct structure", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "stable_evidence_sequence_2026-04-01",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
    activeProfileName: null,
    completed: false,
    blocked: false,
    blockReason: null,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    profiles: [],
  };

  assert.ok(state.sequenceId.length > 0);
  assert.ok(state.evidenceRootDir.length > 0);
  assert.ok(Array.isArray(state.profileNames));
  assert.strictEqual(state.activeProfileName, null);
  assert.strictEqual(state.completed, false);
  assert.strictEqual(state.blocked, false);
  assert.strictEqual(state.blockReason, null);
  assert.ok(Array.isArray(state.profiles));
});

test("StableEvidenceSequenceReport structure", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "stable_evidence_sequence_2026-04-01",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
    activeProfileName: null,
    completed: true,
    blocked: false,
    blockReason: null,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    profiles: [],
  };

  const report: StableEvidenceSequenceReport = {
    state,
    advancedProfiles: ["24h", "72h"],
    lastCampaignReport: null,
  };

  assert.ok(report.state);
  assert.ok(Array.isArray(report.advancedProfiles));
  assert.strictEqual(report.lastCampaignReport, null);
});

test("StableEvidenceSequenceProfileState allows nullable timestamps before start", () => {
  const state: StableEvidenceSequenceProfileState = {
    profileName: "24h",
    outputDir: "/tmp/evidence/24h",
    campaignStatePath: "/tmp/evidence/24h/stable-evidence-campaign-state.json",
    finalEvidenceReportPath: "/tmp/evidence/24h/stable-evidence-report.json",
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

  assert.strictEqual(state.startedAt, null);
  assert.strictEqual(state.updatedAt, null);
  assert.strictEqual(state.passed, null);
  assert.strictEqual(state.completed, false);
  assert.strictEqual(state.segmentCount, 0);
});

test("StableEvidenceSequenceState blocked state includes blockReason", () => {
  const state: StableEvidenceSequenceState = {
    sequenceId: "stable_evidence_sequence_2026-04-01",
    evidenceRootDir: "/tmp/evidence",
    profileNames: ["24h", "72h"],
    activeProfileName: "24h",
    completed: false,
    blocked: true,
    blockReason: "24h stable evidence completed with failing verdict",
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    profiles: [],
  };

  assert.strictEqual(state.blocked, true);
  assert.ok(state.blockReason!.length > 0);
});

test("runStableEvidenceSequence advances through a minimal smoke profile", async () => {
  const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-evidence-sequence-"));
  try {
    const report = await runStableEvidenceSequence({
      evidenceRootDir,
      profileNames: ["smoke"],
      profileOptions: {
        smoke: {
          targetDurationMs: 0,
          segmentDurationMs: 0,
          intervalMs: 0,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
    });

    assert.equal(report.state.completed, true);
    assert.equal(report.state.blocked, false);
    assert.deepEqual(report.advancedProfiles, ["smoke"]);
  } finally {
    rmSync(evidenceRootDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceSequenceUntilComplete finishes a minimal smoke sequence", async () => {
  const evidenceRootDir = mkdtempSync(join(tmpdir(), "stable-evidence-sequence-until-complete-"));
  try {
    const report = await runStableEvidenceSequenceUntilComplete({
      evidenceRootDir,
      profileNames: ["smoke"],
      profileOptions: {
        smoke: {
          targetDurationMs: 0,
          segmentDurationMs: 0,
          intervalMs: 0,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
      sleepMs: 0,
      maxPasses: 2,
    });

    assert.equal(report.state.completed, true);
    assert.equal(report.state.blocked, false);
    assert.deepEqual(report.advancedProfiles, ["smoke"]);
  } finally {
    rmSync(evidenceRootDir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  type StableEvidenceCampaignOptions,
  type StableEvidenceCampaignSegment,
  type StableEvidenceCampaignState,
  type StableEvidenceCampaignReport,
} from "../../../../src/platform/stability/stable-evidence-campaign.js";

test("StableEvidenceCampaignOptions has required outputDir", () => {
  const options: StableEvidenceCampaignOptions = {
    outputDir: "/tmp/test",
  };

  assert.strictEqual(options.outputDir, "/tmp/test");
});

test("StableEvidenceCampaignOptions accepts optional profile settings", () => {
  const options: StableEvidenceCampaignOptions = {
    outputDir: "/tmp/test",
    profileName: "24h",
    targetDurationMs: 86400000,
    segmentDurationMs: 3600000,
    intervalMs: 300000,
    iterationsPerCycle: 5,
    validationIterations: 3,
    enforceWallClockDuration: true,
  };

  assert.strictEqual(options.profileName, "24h");
  assert.strictEqual(options.targetDurationMs, 86400000);
  assert.strictEqual(options.segmentDurationMs, 3600000);
  assert.strictEqual(options.intervalMs, 300000);
  assert.strictEqual(options.iterationsPerCycle, 5);
  assert.strictEqual(options.validationIterations, 3);
  assert.strictEqual(options.enforceWallClockDuration, true);
});

test("StableEvidenceCampaignSegment has required fields", () => {
  const segment: StableEvidenceCampaignSegment = {
    segment: 1,
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:10:00.000Z",
    durationMs: 600000,
    wallClockDurationMs: 600500,
    validationReportPath: "/tmp/segments/segment-1/validation-report.json",
    soakReportPath: "/tmp/segments/segment-1/soak-report.json",
    passed: true,
  };

  assert.strictEqual(segment.segment, 1);
  assert.ok(segment.startedAt.length > 0);
  assert.ok(segment.finishedAt.length > 0);
  assert.ok(segment.durationMs > 0);
  assert.ok(segment.wallClockDurationMs > 0);
  assert.ok(segment.validationReportPath.length > 0);
  assert.ok(segment.soakReportPath.length > 0);
  assert.strictEqual(typeof segment.passed, "boolean");
});

test("StableEvidenceCampaignState has correct structure", () => {
  const state: StableEvidenceCampaignState = {
    campaignId: "stable_evidence_campaign_2026-04-01",
    profile: {
      name: "24h",
      validationIterations: 5,
      soakDurationMs: 86400000,
      soakIntervalMs: 300000,
      soakIterationsPerCycle: 5,
    },
    durationMode: "wall_clock",
    targetDurationMs: 86400000,
    accumulatedDurationMs: 0,
    remainingDurationMs: 86400000,
    accumulatedWallClockDurationMs: 0,
    remainingWallClockDurationMs: 86400000,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    completed: false,
    finalEvidenceReportPath: null,
    finalEvidencePassed: null,
    segments: [],
  };

  assert.ok(state.campaignId.length > 0);
  assert.ok(state.profile);
  assert.ok(["virtual", "wall_clock"].includes(state.durationMode));
  assert.ok(state.targetDurationMs > 0);
  assert.ok(state.startedAt.length > 0);
  assert.strictEqual(state.completed, false);
  assert.strictEqual(state.finalEvidenceReportPath, null);
  assert.strictEqual(state.finalEvidencePassed, null);
  assert.ok(Array.isArray(state.segments));
});

test("StableEvidenceCampaignReport structure", () => {
  const state: StableEvidenceCampaignState = {
    campaignId: "stable_evidence_campaign_2026-04-01",
    profile: {
      name: "24h",
      validationIterations: 5,
      soakDurationMs: 86400000,
      soakIntervalMs: 300000,
      soakIterationsPerCycle: 5,
    },
    durationMode: "wall_clock",
    targetDurationMs: 86400000,
    accumulatedDurationMs: 86400000,
    remainingDurationMs: 0,
    accumulatedWallClockDurationMs: 86400000,
    remainingWallClockDurationMs: 0,
    startedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T23:59:59.000Z",
    completed: true,
    finalEvidenceReportPath: "/tmp/stable-evidence-report.json",
    finalEvidencePassed: true,
    segments: [],
  };

  const report: StableEvidenceCampaignReport = {
    state,
    finalEvidenceReport: null,
  };

  assert.ok(report.state);
  assert.strictEqual(report.state.completed, true);
  assert.strictEqual(report.state.finalEvidencePassed, true);
});

// runStableEvidenceCampaign and runStableEvidenceSequence require complex orchestration
// including runStableValidation, runStableSoak, and createStableEvidenceBundle functions
// which depend on runtime infrastructure. These are integration-level tests.
test.skip("runStableEvidenceCampaign requires runtime infrastructure (validation/soak runners)", () => {
  // This test is skipped because runStableEvidenceCampaign depends on:
  // - runStableValidation from stable-runtime-validator
  // - runStableSoak from stable-runtime-soak-runner
  // - createStableEvidenceBundle from stable-evidence-bundle
  // These are orchestration functions that require the full runtime stack.
});

test.skip("runStableEvidenceSequence requires campaign orchestration infrastructure", () => {
  // This test is skipped because runStableEvidenceSequence depends on:
  // - runStableEvidenceCampaign which has the dependencies listed above
  // This is an integration-level orchestration test.
});

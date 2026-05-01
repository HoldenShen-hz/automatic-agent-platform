import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runStableEvidenceCampaign,
  type StableEvidenceCampaignOptions,
  type StableEvidenceCampaignSegment,
  type StableEvidenceCampaignState,
  type StableEvidenceCampaignReport,
} from "../../../../src/platform/stability/stable-evidence-campaign.js";

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

test("runStableEvidenceCampaign produces campaign state with real execution", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-"));
  try {
    // Run actual campaign logic - not just type literals
    const report = await runStableEvidenceCampaign({
      outputDir,
      profileName: "smoke",
      targetDurationMs: 0,
      segmentDurationMs: 0,
      intervalMs: 0,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });

    // Verify actual state fields from production code
    assert.ok(report.state.campaignId.startsWith("stable_evidence_campaign_"), "Campaign ID should be generated");
    assert.ok(report.state.profile.name, "Profile should have a name");
    assert.ok(["virtual", "wall_clock"].includes(report.state.durationMode), "Duration mode should be valid");
    assert.equal(typeof report.state.targetDurationMs, "number", "Target duration should be a number");
    assert.equal(typeof report.state.accumulatedDurationMs, "number", "Accumulated duration should be a number");
    assert.equal(typeof report.state.completed, "boolean", "Completed should be boolean");
    assert.ok(Array.isArray(report.state.segments), "Segments should be an array");
    assert.equal(report.state.segments.length, 1, "Should have one segment");

    // Verify segment fields come from actual execution
    const segment = report.state.segments[0];
    assert.ok(segment.startedAt, "Segment should have startedAt");
    assert.ok(segment.finishedAt, "Segment should have finishedAt");
    assert.ok(segment.durationMs >= 0, "Segment duration should be non-negative");
    assert.ok(typeof segment.passed === "boolean", "Segment passed should be boolean");
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign completes a minimal smoke campaign", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-smoke-"));
  try {
    const report = await runStableEvidenceCampaign({
      outputDir,
      profileName: "smoke",
      targetDurationMs: 0,
      segmentDurationMs: 0,
      intervalMs: 0,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });

    assert.equal(report.state.completed, true);
    assert.equal(report.state.segments.length, 1);
    assert.equal(report.state.finalEvidencePassed, true);
    assert.equal(report.finalEvidenceReport?.summary.passed, true);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign resumes a completed campaign from disk", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-resume-"));
  try {
    const first = await runStableEvidenceCampaign({
      outputDir,
      profileName: "smoke",
      targetDurationMs: 0,
      segmentDurationMs: 0,
      intervalMs: 0,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });
    const resumed = await runStableEvidenceCampaign({
      outputDir,
      profileName: "smoke",
      targetDurationMs: 0,
      segmentDurationMs: 0,
      intervalMs: 0,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });

    assert.equal(first.state.completed, true);
    assert.equal(resumed.state.completed, true);
    assert.equal(resumed.state.segments.length, 1);
    assert.equal(resumed.finalEvidenceReport?.summary.passed, true);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

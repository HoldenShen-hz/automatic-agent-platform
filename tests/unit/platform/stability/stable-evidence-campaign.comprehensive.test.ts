import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runStableEvidenceCampaign,
  type StableEvidenceCampaignOptions,
  type StableEvidenceCampaignSegment,
  type StableEvidenceCampaignState,
  type StableEvidenceCampaignReport,
} from "../../../../src/platform/stability/stable-evidence-campaign.js";

describe("stable-evidence-campaign comprehensive", () => {
  describe("StableEvidenceCampaignOptions", () => {
    test("accepts minimal options with outputDir only", () => {
      const options: StableEvidenceCampaignOptions = {
        outputDir: "/tmp/test",
      };

      assert.equal(options.outputDir, "/tmp/test");
      assert.strictEqual(options.profileName, undefined);
      assert.strictEqual(options.targetDurationMs, undefined);
    });

    test("accepts all optional profile settings", () => {
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

      assert.equal(options.profileName, "24h");
      assert.equal(options.targetDurationMs, 86400000);
      assert.equal(options.segmentDurationMs, 3600000);
      assert.equal(options.intervalMs, 300000);
      assert.equal(options.iterationsPerCycle, 5);
      assert.equal(options.validationIterations, 3);
      assert.equal(options.enforceWallClockDuration, true);
    });

    test("profileName accepts valid profile names", () => {
      const validProfiles = ["smoke", "24h", "72h"] as const;

      for (const profile of validProfiles) {
        const options: StableEvidenceCampaignOptions = {
          outputDir: "/tmp/test",
          profileName: profile,
        };
        assert.equal(options.profileName, profile);
      }
    });
  });

  describe("StableEvidenceCampaignSegment", () => {
    test("has all required fields", () => {
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

      assert.equal(segment.segment, 1);
      assert.ok(segment.startedAt.length > 0);
      assert.ok(segment.finishedAt.length > 0);
      assert.ok(segment.durationMs > 0);
      assert.ok(segment.wallClockDurationMs > 0);
      assert.ok(segment.validationReportPath.length > 0);
      assert.ok(segment.soakReportPath.length > 0);
      assert.strictEqual(typeof segment.passed, "boolean");
    });

    test("segment number is positive integer", () => {
      const segment: StableEvidenceCampaignSegment = {
        segment: 5,
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:10:00.000Z",
        durationMs: 600000,
        wallClockDurationMs: 600500,
        validationReportPath: "/tmp/path",
        soakReportPath: "/tmp/path",
        passed: true,
      };

      assert.ok(segment.segment >= 1);
    });

    test("passed can be false", () => {
      const segment: StableEvidenceCampaignSegment = {
        segment: 1,
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:10:00.000Z",
        durationMs: 600000,
        wallClockDurationMs: 600500,
        validationReportPath: "/tmp/path",
        soakReportPath: "/tmp/path",
        passed: false,
      };

      assert.strictEqual(segment.passed, false);
    });
  });

  describe("StableEvidenceCampaignState", () => {
    test("has all required fields for initial state", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "stable_evidence_campaign_2026-04-01",
        profile: {
          name: "smoke",
          validationIterations: 2,
          soakDurationMs: 5000,
          soakIntervalMs: 500,
          soakIterationsPerCycle: 1,
        },
        durationMode: "virtual",
        targetDurationMs: 5000,
        accumulatedDurationMs: 0,
        remainingDurationMs: 5000,
        accumulatedWallClockDurationMs: 0,
        remainingWallClockDurationMs: 5000,
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
      assert.equal(state.accumulatedDurationMs, 0);
      assert.equal(state.remainingDurationMs, state.targetDurationMs);
      assert.equal(state.completed, false);
      assert.strictEqual(state.finalEvidenceReportPath, null);
      assert.strictEqual(state.finalEvidencePassed, null);
      assert.ok(Array.isArray(state.segments));
    });

    test("has all required fields for completed state", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "stable_evidence_campaign_2026-04-01",
        profile: {
          name: "smoke",
          validationIterations: 2,
          soakDurationMs: 5000,
          soakIntervalMs: 500,
          soakIterationsPerCycle: 1,
        },
        durationMode: "virtual",
        targetDurationMs: 5000,
        accumulatedDurationMs: 5000,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 5000,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        finalEvidenceReportPath: "/tmp/stable-evidence-report.json",
        finalEvidencePassed: true,
        segments: [],
      };

      assert.equal(state.completed, true);
      assert.ok(state.finalEvidenceReportPath !== null);
      assert.strictEqual(state.finalEvidencePassed, true);
    });

    test("durationMode can be virtual", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "test",
        profile: { name: "smoke", validationIterations: 1, soakDurationMs: 1000, soakIntervalMs: 100, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 1000,
        accumulatedDurationMs: 0,
        remainingDurationMs: 1000,
        accumulatedWallClockDurationMs: 0,
        remainingWallClockDurationMs: 1000,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        completed: false,
        finalEvidenceReportPath: null,
        finalEvidencePassed: null,
        segments: [],
      };

      assert.equal(state.durationMode, "virtual");
    });

    test("durationMode can be wall_clock", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "test",
        profile: { name: "24h", validationIterations: 1, soakDurationMs: 86400000, soakIntervalMs: 300000, soakIterationsPerCycle: 1 },
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

      assert.equal(state.durationMode, "wall_clock");
    });

    test("segments can be populated", () => {
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

      const state: StableEvidenceCampaignState = {
        campaignId: "test",
        profile: { name: "smoke", validationIterations: 1, soakDurationMs: 1000, soakIntervalMs: 100, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 1000,
        accumulatedDurationMs: 600000,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 600500,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:10:00.000Z",
        completed: true,
        finalEvidenceReportPath: "/tmp/report.json",
        finalEvidencePassed: true,
        segments: [segment],
      };

      assert.equal(state.segments.length, 1);
      assert.equal(state.segments[0]!.segment, 1);
    });
  });

  describe("StableEvidenceCampaignReport", () => {
    test("has correct structure with null finalEvidenceReport", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "test",
        profile: { name: "smoke", validationIterations: 1, soakDurationMs: 1000, soakIntervalMs: 100, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 1000,
        accumulatedDurationMs: 0,
        remainingDurationMs: 1000,
        accumulatedWallClockDurationMs: 0,
        remainingWallClockDurationMs: 1000,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        completed: false,
        finalEvidenceReportPath: null,
        finalEvidencePassed: null,
        segments: [],
      };

      const report: StableEvidenceCampaignReport = {
        state,
        finalEvidenceReport: null,
      };

      assert.ok(report.state);
      assert.strictEqual(report.finalEvidenceReport, null);
    });

    test("state must be completed when finalEvidenceReport is present", () => {
      const state: StableEvidenceCampaignState = {
        campaignId: "test",
        profile: { name: "smoke", validationIterations: 1, soakDurationMs: 1000, soakIntervalMs: 100, soakIterationsPerCycle: 1 },
        durationMode: "virtual",
        targetDurationMs: 1000,
        accumulatedDurationMs: 1000,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 1000,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:01:00.000Z",
        completed: true,
        finalEvidenceReportPath: "/tmp/report.json",
        finalEvidencePassed: true,
        segments: [],
      };

      const report: StableEvidenceCampaignReport = {
        state,
        finalEvidenceReport: null,
      };

      assert.equal(report.state.completed, true);
    });
  });

  describe("runStableEvidenceCampaign", () => {
    test("completes minimal smoke campaign", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-comp-"));

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
        assert.ok(report.finalEvidenceReport);
        assert.equal(report.finalEvidenceReport.summary.passed, true);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("resumes completed campaign from disk", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-resume-comp-"));

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
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("creates state file on disk", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-state-"));

      try {
        await runStableEvidenceCampaign({
          outputDir,
          profileName: "smoke",
          targetDurationMs: 0,
          segmentDurationMs: 0,
          intervalMs: 0,
          iterationsPerCycle: 1,
          validationIterations: 1,
        });

        const statePath = join(outputDir, "stable-evidence-campaign-state.json");
        assert.ok(existsSync(statePath));

        const stateContent = readFileSync(statePath, "utf8");
        const state = JSON.parse(stateContent) as StableEvidenceCampaignState;
        assert.ok(state.campaignId.length > 0);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("creates evidence report on completion", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-report-"));

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

        assert.ok(report.finalEvidenceReport);
        assert.ok(report.state.finalEvidenceReportPath);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("state has correct profile after completion", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-campaign-profile-"));

      try {
        const report = await runStableEvidenceCampaign({
          outputDir,
          profileName: "24h",
          targetDurationMs: 0,
          segmentDurationMs: 0,
          intervalMs: 0,
          iterationsPerCycle: 1,
          validationIterations: 1,
        });

        assert.equal(report.state.profile.name, "24h");
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});

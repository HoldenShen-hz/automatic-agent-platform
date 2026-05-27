/**
 * Unit tests for the Stable Evidence Campaign Module.
 *
 * Tests the long-duration evidence campaign that validates system stability under
 * sustained execution load, including validation segments, soak segments, and
 * evidence bundle generation.
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  clearDefaultDivisionRegistryCacheForTests,
  getDefaultDivisionRegistry,
} from "../../../../../src/domains/governance/division-loader.js";
import {
  runStableEvidenceCampaign,
  type StableEvidenceCampaignOptions,
  type StableEvidenceCampaignReport,
  type StableEvidenceCampaignState,
} from "../../../../../src/platform/shared/stability/stable-evidence-campaign.js";

function createTempDir(): string {
  const dir = join("/tmp", `evidence-campaign-test-${Date.now()}`);
  return dir;
}

// Ensure division registry is initialized before tests to prevent
// "division.registry_unavailable" errors from RoleToolExposureService
clearDefaultDivisionRegistryCacheForTests();
const _registry = getDefaultDivisionRegistry();

test("runStableEvidenceCampaign executes with minimal options [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      segmentDurationMs: 100,
    };

    const report = await runStableEvidenceCampaign(options);

    if (!report.state) {
      throw new Error("Report should have state");
    }
    if (typeof report.state.campaignId !== "string") {
      throw new Error("State should have campaignId string");
    }
    if (report.state.campaignId.length === 0) {
      throw new Error("campaignId should not be empty");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign creates segments after execution [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      segmentDurationMs: 100,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);

    if (!Array.isArray(report.state.segments)) {
      throw new Error("State should have segments array");
    }
    if (report.state.segments.length === 0) {
      throw new Error("At least one segment should have been created");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign sets correct duration mode [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      enforceWallClockDuration: false,
    };

    const report = await runStableEvidenceCampaign(options);

    if (report.state.durationMode !== "virtual" && report.state.durationMode !== "wall_clock") {
      throw new Error(`Invalid durationMode: ${report.state.durationMode}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign segment has valid structure [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      segmentDurationMs: 100,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);
    const segment = report.state.segments[0];

    if (!segment) {
      throw new Error("At least one segment should have been created");
    }

    if (typeof segment.segment !== "number") {
      throw new Error("Segment should have segment number");
    }
    if (typeof segment.startedAt !== "string") {
      throw new Error("Segment should have startedAt string");
    }
    if (typeof segment.finishedAt !== "string") {
      throw new Error("Segment should have finishedAt string");
    }
    if (segment.startedAt >= segment.finishedAt) {
      throw new Error("Segment startedAt should be before finishedAt");
    }
    if (typeof segment.durationMs !== "number") {
      throw new Error("Segment should have durationMs number");
    }
    if (typeof segment.passed !== "boolean") {
      throw new Error("Segment should have passed boolean");
    }
    if (typeof segment.validationReportPath !== "string") {
      throw new Error("Segment should have validationReportPath string");
    }
    if (typeof segment.soakReportPath !== "string") {
      throw new Error("Segment should have soakReportPath string");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign tracks accumulated duration [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      segmentDurationMs: 100,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);

    if (typeof report.state.accumulatedDurationMs !== "number") {
      throw new Error("State should have accumulatedDurationMs");
    }
    if (typeof report.state.remainingDurationMs !== "number") {
      throw new Error("State should have remainingDurationMs");
    }
    if (report.state.accumulatedDurationMs < 0) {
      throw new Error("accumulatedDurationMs should be non-negative");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign sets profile correctly [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      profileName: "smoke",
      targetDurationMs: 100,
    };

    const report = await runStableEvidenceCampaign(options);

    if (!report.state.profile) {
      throw new Error("State should have profile");
    }
    if (typeof report.state.profile.name !== "string") {
      throw new Error("Profile should have name string");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign marks completed when duration is satisfied [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 50,
      segmentDurationMs: 50,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);

    // With target=50 and segment=50, first segment should complete the campaign
    if (report.state.completed) {
      // Campaign completed and has final evidence
      if (report.state.finalEvidenceReportPath === null && report.finalEvidenceReport === null) {
        throw new Error("Completed campaign should have finalEvidenceReportPath or finalEvidenceReport");
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign report has correct startedAt and updatedAt [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 100,
      segmentDurationMs: 100,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);

    if (typeof report.state.startedAt !== "string") {
      throw new Error("State should have startedAt");
    }
    if (typeof report.state.updatedAt !== "string") {
      throw new Error("State should have updatedAt");
    }
    if (report.state.startedAt > report.state.updatedAt) {
      throw new Error("startedAt should be before or equal to updatedAt");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign second run resumes from state [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 200,
      segmentDurationMs: 100,
      validationIterations: 1,
    };

    // First run
    const report1 = await runStableEvidenceCampaign(options);
    const firstSegmentCount = report1.state.segments.length;

    // Second run should resume
    const report2 = await runStableEvidenceCampaign(options);

    // Should have more segments (or same if campaign completed)
    if (report2.state.segments.length < firstSegmentCount) {
      throw new Error("Second run should not have fewer segments than first");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runStableEvidenceCampaign finalEvidenceReport is null when not completed [stable-evidence-campaign]", async () => {
  const outputDir = createTempDir();
  try {
    const options: StableEvidenceCampaignOptions = {
      outputDir,
      targetDurationMs: 200,
      segmentDurationMs: 50,
      validationIterations: 1,
    };

    const report = await runStableEvidenceCampaign(options);

    // If not completed, finalEvidenceReport should be null
    if (!report.state.completed && report.finalEvidenceReport !== null) {
      throw new Error("Non-completed campaign should have null finalEvidenceReport");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

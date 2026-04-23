/**
 * Unit tests for Stable Evidence Bundle.
 *
 * Tests the createStableEvidenceBundle function which runs
 * all stability rehearsals and produces a comprehensive report.
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createStableEvidenceBundle } from "../../../../../src/platform/shared/stability/stable-evidence-bundle.js";

function createTempDir(): string {
  return join("/tmp", `evidence-bundle-test-${Date.now()}`);
}

test("createStableEvidenceBundle produces a valid report with smoke profile", async () => {
  const outputDir = createTempDir();
  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
    });

    if (!report.startedAt) {
      throw new Error("Report missing startedAt");
    }
    if (!report.finishedAt) {
      throw new Error("Report missing finishedAt");
    }
    if (report.startedAt >= report.finishedAt) {
      throw new Error("startedAt should be before finishedAt");
    }
    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
    if (report.profile.name !== "smoke") {
      throw new Error(`Expected profile smoke, got ${report.profile.name}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("createStableEvidenceBundle report has all required artifacts paths", async () => {
  const outputDir = createTempDir();
  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
    });

    const artifacts = report.artifacts;
    if (!artifacts) {
      throw new Error("Report missing artifacts");
    }
    // Should have various report paths
    if (!artifacts.bundleReportPath) {
      throw new Error("Report missing bundleReportPath");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("createStableEvidenceBundle report has acceptanceLine", async () => {
  const outputDir = createTempDir();
  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
    });

    if (!report.acceptanceLine) {
      throw new Error("Report missing acceptanceLine");
    }
    if (typeof report.acceptanceLine.status !== "string") {
      throw new Error("acceptanceLine should have a status");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("createStableEvidenceBundle report has summary", async () => {
  const outputDir = createTempDir();
  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
    });

    if (!report.summary) {
      throw new Error("Report missing summary");
    }
    // Summary should have boolean passed field
    if (typeof report.summary.passed !== "boolean") {
      throw new Error("summary should have boolean passed");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("createStableEvidenceBundle creates bundle report JSON file", { timeout: 300_000 }, async () => {
  const outputDir = createTempDir();
  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
    });

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(report.artifacts.bundleReportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.profile?.name !== "smoke") {
      throw new Error("Bundle report should have smoke profile");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

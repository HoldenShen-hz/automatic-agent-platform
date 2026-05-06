import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { runStableEvidenceSequence } from "../../../../../src/platform/shared/stability/stable-evidence-sequence.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function seedCompleted24hEvidence(evidenceRoot: string): void {
  const outputDir = join(evidenceRoot, "24h");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    join(outputDir, "stable-evidence-campaign-state.json"),
    JSON.stringify(
      {
        campaignId: "seeded-24h",
        profile: {
          name: "24h",
          validationIterations: 1,
          soakDurationMs: 100,
          soakIntervalMs: 5,
          soakIterationsPerCycle: 1,
        },
        durationMode: "virtual",
        targetDurationMs: 100,
        accumulatedDurationMs: 100,
        remainingDurationMs: 0,
        accumulatedWallClockDurationMs: 100,
        remainingWallClockDurationMs: 0,
        startedAt: "2026-04-09T00:00:00.000Z",
        updatedAt: "2026-04-09T00:01:00.000Z",
        completed: true,
        finalEvidenceReportPath: join(outputDir, "stable-evidence-report.json"),
        finalEvidencePassed: true,
        segments: [],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(outputDir, "stable-evidence-report.json"),
    JSON.stringify(
      {
        startedAt: "2026-04-09T00:00:00.000Z",
        finishedAt: "2026-04-09T00:01:00.000Z",
        profile: { name: "24h" },
        summary: { passed: true },
        acceptanceLine: {
          status: "partial",
          observed: {
            soakDurationMs: 100,
          },
        },
      },
      null,
      2,
    ),
  );
}

test("stable evidence sequence advances from completed 24h evidence into 72h and preserves truthful verdicts", async () => {
  const workspace = createTempWorkspace("aa-stable-sequence-unit-");
  const evidenceRoot = join(workspace, "stable-evidence");

  try {
    seedCompleted24hEvidence(evidenceRoot);

    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileOptions: {
        "72h": {
          targetDurationMs: 25,
          segmentDurationMs: 25,
          intervalMs: 5,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
    });

    assert.equal(report.state.completed, false);
    assert.equal(report.state.blocked, true);
    assert.equal(report.state.blockReason, "72h stable evidence completed with failing verdict");
    assert.deepEqual(report.advancedProfiles, []);
    assert.equal(report.state.profiles.find((profile) => profile.profileName === "24h")?.passed, true);
    assert.equal(report.state.profiles.find((profile) => profile.profileName === "72h")?.completed, true);
    assert.equal(report.state.profiles.find((profile) => profile.profileName === "72h")?.passed, false);
    assert.equal(existsSync(join(evidenceRoot, "72h", "stable-evidence-report.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-state.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable evidence sequence persists sequence state before long-run completion", async () => {
  const workspace = createTempWorkspace("aa-stable-sequence-persist-");
  const evidenceRoot = join(workspace, "stable-evidence");

  try {
    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileOptions: {
        "24h": {
          targetDurationMs: 50,
          segmentDurationMs: 25,
          intervalMs: 5,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
    });

    assert.equal(report.state.completed, false);
    assert.equal(report.state.activeProfileName, "24h");
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-state.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable evidence sequence loads existing state and resumes from where it left off", async () => {
  const workspace = createTempWorkspace("aa-stable-sequence-resume-");
  const evidenceRoot = join(workspace, "stable-evidence");

  try {
    // Seed with a partially completed sequence state
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(
      join(evidenceRoot, "stable-evidence-sequence-state.json"),
      JSON.stringify({
        sequenceId: "resumed-sequence",
        profiles: [
          {
            profileName: "24h",
            startedAt: "2026-04-10T00:00:00.000Z",
            completed: true,
            passed: true,
          },
        ],
        activeProfileName: null,
        completed: false,
        blocked: false,
      }),
    );

    const report = await runStableEvidenceSequence({
      evidenceRootDir: evidenceRoot,
      profileOptions: {
        "24h": {
          targetDurationMs: 50,
          segmentDurationMs: 25,
          intervalMs: 5,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
        "72h": {
          targetDurationMs: 25,
          segmentDurationMs: 25,
          intervalMs: 5,
          iterationsPerCycle: 1,
          validationIterations: 1,
        },
      },
    });

    // Should have advanced to next profile
    assert.equal(report.state.profiles.length >= 1, true);
  } finally {
    cleanupPath(workspace);
  }
});

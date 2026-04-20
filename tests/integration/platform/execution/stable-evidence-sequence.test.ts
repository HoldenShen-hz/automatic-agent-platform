import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { runStableEvidenceSequenceUntilComplete } from "../../../../src/platform/shared/stability/stable-evidence-sequence.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable evidence sequence runs 24h and 72h profiles to completion in order", async () => {
  const workspace = createTempWorkspace("aa-stable-sequence-runtime-");
  const evidenceRoot = join(workspace, "stable-evidence");

  try {
    const report = await runStableEvidenceSequenceUntilComplete({
      evidenceRootDir: evidenceRoot,
      profileOptions: {
        "24h": {
          targetDurationMs: 25,
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
      maxPasses: 4,
    });

    assert.equal(report.state.completed, true);
    assert.equal(report.state.blocked, false);
    assert.deepEqual(
      report.state.profiles.map((profile) => ({
        profileName: profile.profileName,
        completed: profile.completed,
        passed: profile.passed,
      })),
      [
        { profileName: "24h", completed: true, passed: true },
        { profileName: "72h", completed: true, passed: true },
      ],
    );
    assert.equal(existsSync(join(evidenceRoot, "24h", "stable-evidence-report.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "72h", "stable-evidence-report.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-state.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

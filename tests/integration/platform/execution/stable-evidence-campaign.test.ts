import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { runStableEvidenceCampaign } from "../../../../src/platform/shared/stability/stable-evidence-campaign.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable evidence campaign accumulates segments and finalizes a resumable long-run bundle", async () => {
  const workspace = createTempWorkspace("aa-stable-campaign-");

  try {
    const first = await runStableEvidenceCampaign({
      outputDir: workspace,
      profileName: "24h",
      targetDurationMs: 40,
      segmentDurationMs: 25,
      intervalMs: 5,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });

    assert.equal(first.state.completed, false);
    assert.equal(first.state.accumulatedDurationMs, 25);
    assert.equal(first.state.segments.length, 1);
    assert.equal(first.finalEvidenceReport, null);

    const second = await runStableEvidenceCampaign({
      outputDir: workspace,
      profileName: "24h",
      targetDurationMs: 40,
      segmentDurationMs: 25,
      intervalMs: 5,
      iterationsPerCycle: 1,
      validationIterations: 1,
    });

    assert.equal(second.state.completed, true);
    assert.equal(second.state.accumulatedDurationMs, 40);
    assert.equal(second.state.remainingDurationMs, 0);
    assert.equal(second.state.segments.length, 2);
    assert.equal(second.finalEvidenceReport?.profile.name, "24h");
    assert.equal(second.finalEvidenceReport?.summary.passed, true);
    assert.equal(existsSync(join(workspace, "stable-evidence-report.json")), true);
    assert.equal(existsSync(join(workspace, "stable-evidence-campaign-state.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const calibrationModule = new URL("../../../scripts/ci/run-benchmark-calibration.mjs", import.meta.url).href;
const reconciliationModule = new URL("../../../scripts/ci/reconcile-benchmark-evidence.mjs", import.meta.url).href;

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("benchmark governance scripts build pass reports when calibration artifacts are complete", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-benchmark-governance-"));
  const configRoot = join(workspace, "config", "division-coverage");
  try {
    writeFile(join(configRoot, "family-readiness.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    displayName: Engineering",
      "    readinessStatus: local_leadership_ready",
      "    targetClaimLevel: local_leader",
      "    owner: engineering-platform-owner",
      "    canonicalFamilies: [engineering]",
      "    canonicalDivisions: [coding]",
      "    benchmarkRefs: [swe-bench-verified]",
      "    minimumEvidenceRef: engineering-core",
      "    notes: \"issue-to-patch closed loop\"",
    ].join("\n"));
    writeFile(join(configRoot, "benchmark-map.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    benchmarks:",
      "      - benchmarkId: swe-bench-verified",
      "        label: SWE-bench Verified",
      "        url: \"https://example.com/swe\"",
      "        purpose: \"correctness\"",
      "    internalMappings:",
      "      - metricId: patch_correctness",
      "        description: \"patch remains correct\"",
    ].join("\n"));
    writeFile(join(configRoot, "minimum-leading-evidence.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    mvpThresholds:",
      "      - label: Internal SWE tasks",
      "        requirement: \">=50\"",
      "    leadershipThresholds:",
      "      - label: Internal SWE tasks",
      "        requirement: \">=200\"",
    ].join("\n"));
    writeFile(join(configRoot, "benchmark-calibration.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    owner: Engineering Eval Owner + Eng Platform Owner",
      "    refreshCadence: monthly",
      "    releaseGateConsumption: [correctness, rollback]",
      "    claimReviewConsumption: [heldout_scale, pr_acceptance]",
    ].join("\n"));
    writeFile(join(configRoot, "family-expansion.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    leadershipTypes: [capability_leadership]",
      "    pilotDivisions: [coding]",
      "    targetDivisions: [devops]",
      "    requiredEvidence: [patch correctness]",
      "    blockedRisks: [auto-merge without review]",
      "    targetRelease: \"v3.3\"",
    ].join("\n"));
    writeFile(join(configRoot, "claims", "records.yaml"), [
      "claims:",
      "  - claimId: coding-local-leader",
      "    familyId: engineering",
      "    divisionId: coding",
      "    claimLevel: local_leader",
      "    claimText: \"coding division achieves local leader status\"",
      "    allowedSurfaces: [docs]",
      "    evidenceRefs: [eval://coding]",
      "    reviewedBy: [platform-owner]",
      "    expiresAt: \"2026-12-01T00:00:00Z\"",
      "    status: approved",
    ].join("\n"));

    const { buildBenchmarkCalibrationReport } = await import(calibrationModule);
    const { buildBenchmarkEvidenceReconciliation } = await import(reconciliationModule);
    const calibration = buildBenchmarkCalibrationReport(workspace);
    const reconciliation = buildBenchmarkEvidenceReconciliation(workspace, new Date("2026-06-03T00:00:00.000Z"));

    assert.equal(calibration.status, "pass");
    assert.equal(calibration.findingCount, 0);
    assert.equal(reconciliation.status, "pass");
    assert.equal(reconciliation.findingCount, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

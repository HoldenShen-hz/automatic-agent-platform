import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { FamilyLeadershipReadinessService } from "../../../../../src/platform/shared/stability/family-leadership-readiness-service.js";

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("FamilyLeadershipReadinessService derives scores, transitions, and expansion plans", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-family-readiness-"));
  const configRoot = join(workspace, "config", "division-coverage");
  try {
    writeFile(join(configRoot, "family-readiness.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    displayName: Engineering",
      "    readinessStatus: pilot_ready",
      "    targetClaimLevel: local_leader",
      "    owner: engineering-platform-owner",
      "    canonicalFamilies: [engineering]",
      "    canonicalDivisions: [coding, devops]",
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
    writeFile(join(configRoot, "family-expansion.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    leadershipTypes: [capability_leadership, evidence_leadership]",
      "    pilotDivisions: [coding]",
      "    targetDivisions: [devops]",
      "    requiredEvidence: [patch correctness]",
      "    blockedRisks: [auto-merge without review]",
      "    targetRelease: \"v3.3\"",
    ].join("\n"));
    writeFile(join(workspace, "config", "policy", "no-go-actions.yaml"), [
      "globalActions: []",
      "familyActions:",
      "  - familyId: engineering",
      "    actions:",
      "      - id: no-untrusted-command-execution",
      "        description: \"No untrusted command execution\"",
      "        riskClass: R4",
      "        scopes: [engineering]",
      "        enforcementSurfaces: [ToolRisk]",
      "        blockModes: [shell_execution]",
    ].join("\n"));
    writeFile(join(configRoot, "inventory", "division-inventory.generated.json"), JSON.stringify({
      generatedAt: "2026-06-03T00:00:00.000Z",
      records: [
        { divisionId: "coding", status: "production_ready" },
        { divisionId: "devops", status: "pilot_ready" },
      ],
    }, null, 2));

    const service = new FamilyLeadershipReadinessService({
      platformRoot: workspace,
      configRoot,
    });
    const assessments = service.listAssessments(new Date("2026-06-03T00:00:00.000Z"));

    assert.equal(assessments.length, 1);
    assert.equal(assessments[0]?.approvedActiveClaimCount, 1);
    assert.equal(assessments[0]?.recommendedLeadershipTypes.includes("capability_leadership"), true);
    assert.equal(assessments[0]?.transition.currentStatus, "pilot_ready");
    assert.equal(assessments[0]?.transition.nextStatus, "local_leadership_ready");
    assert.equal(assessments[0]?.scoreCard.overall > 0, true);
    assert.equal(assessments[0]?.expansionPlan?.targetRelease, "v3.3");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

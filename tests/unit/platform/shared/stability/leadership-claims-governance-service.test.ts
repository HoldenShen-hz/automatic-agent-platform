import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

import { LeadershipClaimsGovernanceService } from "../../../../../src/platform/shared/stability/leadership-claims-governance-service.js";

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("LeadershipClaimsGovernanceService builds a console snapshot from config and persisted review data", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-leadership-governance-"));
  const configRoot = join(workspace, "config", "division-coverage");
  const policyRoot = join(workspace, "config", "policy");
  const dataRoot = join(workspace, "data");
  const now = new Date("2026-05-31T00:00:00.000Z");

  try {
    writeFile(join(configRoot, "family-readiness.yaml"), [
      "families:",
      "  - familyId: engineering",
      "    displayName: Engineering",
      "    readinessStatus: local_leadership_ready",
      "    targetClaimLevel: local_leader",
      "    owner: platform-owner",
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
      "    minimumEvidenceId: engineering-core",
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
      "    scenarioId: issue-to-patch",
      "    claimLevel: local_leader",
      "    claimText: \"coding division achieves local leader status\"",
      "    allowedSurfaces: [docs, ui]",
      "    evidenceRefs: [eval://coding]",
      "    reviewedBy: [platform-owner]",
      "    expiresAt: \"2026-06-15T00:00:00Z\"",
      "    status: approved",
      "  - claimId: coding-expired",
      "    familyId: engineering",
      "    claimLevel: local_leader",
      "    claimText: \"expired claim\"",
      "    allowedSurfaces: [docs]",
      "    evidenceRefs: [eval://old]",
      "    reviewedBy: [platform-owner]",
      "    expiresAt: \"2026-05-01T00:00:00Z\"",
      "    status: approved",
    ].join("\n"));
    writeFile(join(configRoot, "claims", "allowlist.yaml"), [
      "entries:",
      "  - filePath: docs_zh/reference/release.md",
      "    matchedText: industry-leading",
      "    reason: governance_rule_definition",
      "    owner: governance-owner",
      "    expiresAt: \"2027-01-01T00:00:00Z\"",
      "  - filePath: docs_zh/reference/expired.md",
      "    matchedText: production-ready",
      "    reason: expired_definition",
      "    owner: governance-owner",
      "    expiresAt: \"2026-05-01T00:00:00Z\"",
    ].join("\n"));
    writeFile(join(policyRoot, "no-go-actions.yaml"), [
      "globalActions:",
      "  - id: no-auto-payment",
      "    description: \"No automated payment\"",
      "    riskClass: R5",
      "    scopes: [finance]",
      "    enforcementSurfaces: [ReleaseGate]",
      "    blockModes: [autonomous_execution]",
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
    writeFile(join(dataRoot, "governance", "leadership-claim-review-requests.json"), JSON.stringify([
      {
        requestId: "req-1",
        familyId: "engineering",
        divisionId: "coding",
        scenarioId: "issue-to-patch",
        requestedClaimLevel: "local_leader",
        requestedSurfaces: ["docs"],
        requestedBy: "ops-lead",
        rationale: "ready for review",
        requestedAt: "2026-05-30T00:00:00.000Z",
        status: "pending",
      },
    ], null, 2));
    writeFile(join(dataRoot, "governance", "leadership-claim-scan-report.json"), JSON.stringify({
      generatedAt: "2026-05-31T00:00:00.000Z",
      hits: [
        {
          filePath: "docs_zh/reference/release.md",
          matchedText: "industry-leading",
          lineNumber: 4,
          excerpt: "industry-leading is governed",
          surface: "docs",
          status: "allowlisted",
          claimId: null,
          reason: "governance_rule_definition",
        },
        {
          filePath: "docs_zh/reference/expired.md",
          matchedText: "production-ready",
          lineNumber: 7,
          excerpt: "production-ready wording remains",
          surface: "docs",
          status: "expired_allowlist",
          claimId: null,
          reason: "expired_definition",
        },
      ],
    }, null, 2));

    const service = new LeadershipClaimsGovernanceService({
      platformRoot: workspace,
      configRoot,
      policyRoot,
      dataRoot,
    });
    const snapshot = service.buildConsoleSnapshot(now);

    assert.equal(snapshot.families.length, 1);
    assert.equal(snapshot.families[0]?.benchmarks.length, 1);
    assert.equal(snapshot.claims.length, 2);
    assert.equal(snapshot.claims.find((claim) => claim.claimId === "coding-expired")?.effectiveStatus, "expired");
    assert.equal(snapshot.allowlist.filter((entry) => entry.expired).length, 1);
    assert.equal(snapshot.reviewRequests.length, 1);
    assert.equal(snapshot.noGoActions.length, 2);
    assert.equal(snapshot.summary.approvedClaimCount, 1);
    assert.equal(snapshot.summary.expiringClaimCount, 1);
    assert.equal(snapshot.summary.blockedScannerHitCount, 1);
    assert.equal(snapshot.summary.expiredAllowlistCount, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("LeadershipClaimsGovernanceService persists review requests without touching old fixtures", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-leadership-review-request-"));
  const configRoot = join(workspace, "config", "division-coverage");
  const policyRoot = join(workspace, "config", "policy");
  const dataRoot = join(workspace, "data");

  try {
    writeFile(join(configRoot, "family-readiness.yaml"), "families: []");
    writeFile(join(configRoot, "benchmark-map.yaml"), "families: []");
    writeFile(join(configRoot, "minimum-leading-evidence.yaml"), "families: []");
    writeFile(join(configRoot, "claims", "records.yaml"), "claims: []");
    writeFile(join(configRoot, "claims", "allowlist.yaml"), "entries: []");
    writeFile(join(policyRoot, "no-go-actions.yaml"), "globalActions: []");
    writeFile(join(dataRoot, "governance", "leadership-claim-review-requests.json"), "[]");

    const service = new LeadershipClaimsGovernanceService({
      platformRoot: workspace,
      configRoot,
      policyRoot,
      dataRoot,
    });
    const reviewRequest = service.submitReviewRequest({
      familyId: "engineering",
      divisionId: "coding",
      scenarioId: "issue-to-patch",
      requestedClaimLevel: "local_leader",
      requestedSurfaces: ["docs", "ui"],
      requestedBy: "release-owner",
      rationale: "evidence package is complete",
      requestedAt: "2026-05-31T00:00:00.000Z",
    });

    assert.equal(reviewRequest.status, "pending");
    assert.equal(service.listReviewRequests().length, 1);
    assert.equal(service.listReviewRequests()[0]?.requestedBy, "release-owner");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

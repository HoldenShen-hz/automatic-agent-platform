import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

type DomainCoverageReport = {
  mode: string;
  warnings: string[];
  blockers: string[];
};

type AuditDomainCoverageModule = {
  buildDomainCoverageReport: (options: {
    platformRoot: string;
    mode: string;
    now: string;
  }) => DomainCoverageReport;
};

const auditModule = await import(
  new URL("../../../scripts/ci/audit-domain-coverage.mjs", import.meta.url).href,
) as AuditDomainCoverageModule;

const { buildDomainCoverageReport } = auditModule;

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeJson(path: string, value: unknown): void {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createMinimalCatalog(): unknown {
  return {
    divisions: [
      { divisionId: "coding", family: "engineering", canonicalDivisionId: "coding", scope: "pilot" },
    ],
  };
}

test("buildDomainCoverageReport blocks production_ready claims without approved claim records and fresh evidence", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-domain-coverage-prod-ready-"));
  try {
    writeJson(join(workspace, "config", "quality", "division-catalog.json"), createMinimalCatalog());
    writeFile(join(workspace, "config", "division-coverage", "families", "engineering.yaml"), [
      "familyId: engineering",
      "defaultAutonomyBoundary: prepared_action_only",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "divisions", "coding.yaml"), [
      "divisionId: coding",
      "familyId: engineering",
      "status: production_ready",
      "riskLevel: high",
      "owner: engineering-owner",
      "evidence:",
      "  evaluation:",
      "    refs:",
      "      - eval/divisions/coding/eval-suite.yaml",
      "    lastUpdatedAt: \"2025-01-01T00:00:00.000Z\"",
      "  operation:",
      "    refs:",
      "      - redteam/divisions/coding/redteam-suite.yaml",
      "    lastUpdatedAt: \"2025-01-01T00:00:00.000Z\"",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "scenarios", "issue-to-patch.yaml"), [
      "scenarioId: issue-to-patch",
      "divisionId: coding",
      "toolActions:",
      "  - toolId: github",
      "    actionId: create_pr_draft",
    ].join("\n"));
    writeFile(join(workspace, "config", "tool-risk", "tool-action-descriptors", "github.yaml"), [
      "toolId: github",
      "actions:",
      "  - actionId: create_pr_draft",
      "    riskClass: R4",
      "    requiresHITL: false",
      "    requiresPreparedAction: true",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "claims", "records.yaml"), "claims: []");
    writeFile(join(workspace, "divisions", "coding", "division.yaml"), [
      "domain_descriptor:",
      "  ownerOrgNodeId: engineering-owner",
    ].join("\n"));
    writeJson(join(workspace, "config", "domains", "coding.json"), { divisionId: "coding" });
    writeFile(join(workspace, "src", "domains", "coding", "index.ts"), "export const division = 'coding';");
    writeFile(join(workspace, "eval", "divisions", "coding", "eval-suite.yaml"), [
      "divisionId: coding",
      "lastRefreshedAt: \"2025-01-01T00:00:00.000Z\"",
    ].join("\n"));
    writeFile(join(workspace, "redteam", "divisions", "coding", "redteam-suite.yaml"), [
      "divisionId: coding",
      "lastRefreshedAt: \"2025-01-01T00:00:00.000Z\"",
      "cases:",
      "  - caseId: example",
      "    severity: Critical",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "divisions", "coding.yaml"), "divisionId: coding");

    const report = buildDomainCoverageReport({
      platformRoot: workspace,
      mode: "production-ready",
      now: "2026-06-01T00:00:00.000Z",
    });

    assert.equal(report.mode, "production-ready");
    assert.ok(report.blockers.some((entry) => entry.endsWith(":production_ready_without_claim_record")));
    assert.ok(report.blockers.some((entry) => entry.endsWith(":expired_eval")));
    assert.ok(report.blockers.some((entry) => entry.endsWith(":expired_redteam")));
    assert.ok(report.blockers.some((entry) => entry.includes(":r3plus_without_hitl:github:create_pr_draft")));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildDomainCoverageReport validates governance dataset, suite, roi, and training policy contracts", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-domain-coverage-governance-"));
  try {
    writeJson(join(workspace, "config", "quality", "division-catalog.json"), createMinimalCatalog());
    writeFile(join(workspace, "config", "division-coverage", "families", "engineering.yaml"), [
      "familyId: engineering",
      "defaultAutonomyBoundary: prepared_action_only",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "divisions", "coding.yaml"), [
      "divisionId: coding",
      "familyId: engineering",
      "status: pilot_ready",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "claims", "records.yaml"), "claims: []");
    writeFile(join(workspace, "divisions", "coding", "division.yaml"), [
      "domain_descriptor:",
      "  ownerOrgNodeId: engineering-owner",
    ].join("\n"));
    writeJson(join(workspace, "config", "domains", "coding.json"), { divisionId: "coding" });
    writeFile(join(workspace, "src", "domains", "coding", "index.ts"), "export const division = 'coding';");
    writeFile(join(workspace, "config", "division-coverage", "scenarios", "issue-to-patch.yaml"), [
      "scenarioId: issue-to-patch",
      "divisionId: coding",
      "toolActions:",
      "  - toolId: github",
      "    actionId: create_pr_draft",
    ].join("\n"));
    writeFile(join(workspace, "config", "tool-risk", "tool-action-descriptors", "github.yaml"), [
      "toolId: github",
      "actions:",
      "  - actionId: create_pr_draft",
      "    riskClass: R2",
      "    requiresHITL: true",
    ].join("\n"));
    writeJson(join(workspace, "eval", "datasets", "swe-style", "dataset-card.json"), {
      datasetId: "swe-style-heldout-v1",
      divisionId: "coding",
      scenarioId: "issue-to-patch",
      version: "2026.06",
      source: "internal_repository_snapshots",
      taskCount: 60,
      split: "heldout",
      contaminationStatus: "clean",
      privacyStatus: "restricted",
      labelingMethod: "maintainer_review",
      allowedForTraining: false,
      allowedForReleaseGate: true,
      retentionPolicyRef: "training-data-policy/retention.yaml",
      frozenHash: "sha256:placeholder",
    });
    writeJson(join(workspace, "eval", "runner-registry.json"), {
      $schema: "eval/schemas/eval-runner-registry.schema.json",
      runners: [
        {
          runnerId: "patch-gate",
          runnerVersion: "1.0.0",
          implementationRef: "src/platform/shared/stability/patch-gate.ts",
        },
      ],
    });
    writeFile(join(workspace, "src", "platform", "shared", "stability", "patch-gate.ts"), "export const patchGate = true;");
    writeFile(join(workspace, "eval", "divisions", "coding", "eval-suite.yaml"), [
      "$schema: eval/schemas/eval-suite.schema.json",
      "divisionId: coding",
      "datasetCardRef: eval/datasets/swe-style/dataset-card.json",
      "runnerRegistryRef: eval/runner-registry.json",
      "runner:",
      "  runnerId: patch-gate",
      "  runnerVersion: \"1.0.0\"",
      "  implementationRef: src/platform/shared/stability/patch-gate.ts",
      "reportRef: docs_zh/divisions/customer-service/leadership-evidence/eval-report.md",
      "lastRefreshedAt: \"2026-06-02T08:00:00.000Z\"",
      "metrics:",
      "  - patch_apply_success",
    ].join("\n"));
    writeFile(join(workspace, "redteam", "divisions", "coding", "redteam-suite.yaml"), [
      "$schema: redteam/schemas/redteam-suite.schema.json",
      "divisionId: coding",
      "caseCount: 1",
      "reportRef: docs_zh/divisions/coding/leadership-evidence/redteam-report.md",
      "lastRefreshedAt: \"2026-06-02T10:00:00.000Z\"",
      "cases:",
      "  - caseId: malicious-issue-body",
      "    severity: Critical",
      "    objective: Block malicious prompt injection.",
    ].join("\n"));
    writeFile(join(workspace, "roi", "divisions", "coding.yaml"), [
      "$schema: roi/schemas/division-roi.schema.json",
      "divisionId: coding",
      "method: assisted_vs_manual",
      "sampleWindow: 14d",
      "minimumSampleSize: 50",
      "metrics:",
      "  - review_time_saved",
      "confidence: medium",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "divisions", "coding.yaml"), [
      "$schema: training-data-policy/schemas/division-policy.schema.json",
      "divisionId: coding",
      "policyMode: redacted_only",
      "allowedSources:",
      "  - redacted_repository_snapshots",
      "forbiddenSources:",
      "  - raw_secrets",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "revocation.yaml"), [
      "$schema: training-data-policy/schemas/revocation.schema.json",
      "version: v1.0",
      "affectedStores:",
      "  - state_evidence",
      "requiresModelDataTombstone: true",
      "customerDeletionPropagation:",
      "  - memory",
      "sourceInvalidationPropagation:",
      "  - eval",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "retention.yaml"), [
      "$schema: training-data-policy/schemas/retention.schema.json",
      "retentionPolicyId: heldout-eval-retention-v1",
      "releaseGateHeldoutRetentionDays: 365",
      "shadowRetentionDays: 90",
      "trainRetentionDays: 30",
      "restrictedRetentionHandling: no-train",
    ].join("\n"));
    writeFile(join(workspace, "docs_zh", "divisions", "coding", "leadership-evidence", "redteam-report.md"), [
      "# Coding Red-team Report",
      "",
      "LastRefreshedAt: `2026-06-02T10:00:00.000Z`",
    ].join("\n"));

    const report = buildDomainCoverageReport({
      platformRoot: workspace,
      mode: "warning",
      now: "2026-06-02T12:00:00.000Z",
    });

    assert.ok(report.blockers.includes("eval/datasets/swe-style/dataset-card.json:invalid_frozen_hash_format"));
    assert.ok(report.blockers.includes("eval/divisions/coding/eval-suite.yaml:report_ref_mismatch"));
    assert.ok(report.blockers.includes("eval/divisions/coding/eval-suite.yaml:missing_report_refresh_timestamp"));
    assert.ok(report.blockers.includes("redteam/divisions/coding/redteam-suite.yaml:invalid_severity:malicious-issue-body"));
    assert.ok(report.blockers.includes("redteam/divisions/coding/redteam-suite.yaml:missing_scope:malicious-issue-body"));
    assert.ok(report.blockers.includes("redteam/divisions/coding/redteam-suite.yaml:missing_evidence_refs:malicious-issue-body"));
    assert.ok(report.blockers.includes("roi/divisions/coding.yaml:invalid_protocol_ref"));
    assert.ok(report.blockers.includes("roi/divisions/coding.yaml:missing_cost_delta_metrics"));
    assert.ok(report.blockers.includes("training-data-policy/divisions/coding.yaml:invalid_policy_mode_ref"));
    assert.ok(report.blockers.includes("training-data-policy/revocation.yaml:invalid_affectedStores"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("audit-domain-coverage warning mode still exits non-zero when blockers exist", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-domain-coverage-warning-exit-"));
  const scriptPath = join(process.cwd(), "scripts", "ci", "audit-domain-coverage.mjs");
  try {
    writeJson(join(workspace, "config", "quality", "division-catalog.json"), createMinimalCatalog());
    writeFile(join(workspace, "config", "division-coverage", "families", "engineering.yaml"), [
      "familyId: engineering",
      "defaultAutonomyBoundary: prepared_action_only",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "divisions", "coding.yaml"), [
      "divisionId: coding",
      "familyId: engineering",
      "status: production_ready",
      "evidence: {}",
    ].join("\n"));
    writeFile(join(workspace, "config", "division-coverage", "claims", "records.yaml"), "claims: []\n");
    writeFile(join(workspace, "divisions", "coding", "division.yaml"), [
      "domain_descriptor:",
      "  ownerOrgNodeId: engineering-owner",
    ].join("\n"));
    writeJson(join(workspace, "config", "domains", "coding.json"), { divisionId: "coding" });
    writeFile(join(workspace, "src", "domains", "coding", "index.ts"), "export const division = 'coding';");
    writeFile(join(workspace, "training-data-policy", "divisions", "coding.yaml"), [
      "$schema: training-data-policy/schemas/division-policy.schema.json",
      "divisionId: coding",
      "policyMode: redacted_only",
      "policyModeRef: training-data-policy/policy-modes.md",
      "allowedSources:",
      "  - redacted_repository_snapshots",
      "forbiddenSources:",
      "  - raw_secrets",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "revocation.yaml"), [
      "$schema: training-data-policy/schemas/revocation.schema.json",
      "version: v1.0",
      "affectedStores:",
      "  - memory",
      "requiresModelDataTombstone: true",
      "customerDeletionPropagation:",
      "  - memory",
      "sourceInvalidationPropagation:",
      "  - eval",
    ].join("\n"));
    writeFile(join(workspace, "training-data-policy", "retention.yaml"), [
      "$schema: training-data-policy/schemas/retention.schema.json",
      "retentionPolicyId: holdout",
      "releaseGateHeldoutRetentionDays: 30",
      "shadowRetentionDays: 10",
      "trainRetentionDays: 5",
      "restrictedRetentionHandling: no-train",
    ].join("\n"));

    const result = spawnSync(process.execPath, [scriptPath, "--mode=warning", "--root=."], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /domain_coverage\.warning:warnings=\d+:blockers=\d+/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

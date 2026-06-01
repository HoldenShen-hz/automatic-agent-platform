import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

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

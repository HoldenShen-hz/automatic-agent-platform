/**
 * @issue  AUDIT-TOOL-REDTEAM-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-017
 * @gate   audit:redteam
 * @severity P0
 *
 * Self-test for the redteam-suite audit script (§12.3).
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.3 and §44.13.1):
 *   1. positive seed: redteam suite missing runner/result/criticalSuccessCount/releaseBlocking
 *      -> audit MUST report P0
 *   2. negative seed: redteam suite with runner, result object, criticalSuccessCount>=1,
 *      releaseBlocking=true, and full evidenceRefs per case -> audit MUST NOT report
 *   3. evasion seed: redteam suite with placeholder "TODO" result, releaseBlocking="yes"
 *      (string), criticalSuccessCount=0, and an empty evidenceRefs[] -> audit MUST still
 *      report P0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "redteam");
const reportPath = join(repoRoot, "artifacts", "assurance", "redteam-report.json");

interface AuditFinding {
  rule: string;
  severity: string;
  path: string;
  line: number;
  message: string;
}

interface AuditReport {
  findings: AuditFinding[];
  findingCount: number;
  bySeverity: Record<string, number>;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-redteam.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: redteam self-test (§12.3)", () => {
  it("writes the methodology report artifact", () => {
    const out = runAudit("tests/fixtures/seeded-defects/redteam/negative");
    assert.ok(existsSync(reportPath), "expected redteam-report.json to be written");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as AuditReport & { scannedPath: string };
    assert.equal(report.scannedPath, "tests/fixtures/seeded-defects/redteam/negative");
    assert.equal(report.findingCount, out.findingCount);
  });

  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/redteam/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 4, `expected at least 4 seed entries, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
    assert.ok(names.some((n) => n.endsWith("manifest.json")), "missing manifest.json");
  });

  it("positive seed (missing runner/result/criticalSuccessCount/releaseBlocking) is reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/redteam/positive");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("redteam.suite_required_field_missing") || rules.has("redteam.runner_missing"),
      `expected suite_required_field_missing or runner_missing finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("negative seed (full P0 suite with concrete runner result) is NOT reported (0 P0 findings)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/redteam/negative");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      findings.length,
      0,
      `expected 0 P0 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed (placeholder result, releaseBlocking string, empty evidenceRefs) is still reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/redteam/evasion");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("redteam.result_placeholder"),
      `expected result_placeholder finding, got: ${JSON.stringify([...rules])}`,
    );
    assert.ok(
      rules.has("redteam.release_blocking_not_bool"),
      `expected release_blocking_not_bool finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("manifest.json is well-formed and references all three seed files", () => {
    const manifestPath = join(fixtureDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json missing");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.expectedGate, "audit-redteam");
    const kinds = new Set((manifest.seeds ?? []).map((seed: { kind: string }) => seed.kind));
    assert.ok(kinds.has("positive"), "manifest missing positive seed");
    assert.ok(kinds.has("negative"), "manifest missing negative seed");
    assert.ok(kinds.has("evasion"), "manifest missing evasion seed");
  });
});

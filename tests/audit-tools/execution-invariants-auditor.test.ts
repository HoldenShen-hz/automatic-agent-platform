/**
 * @issue  AUDIT-TOOL-EXECUTION-INVARIANTS-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-015
 * @gate   audit:execution-invariants
 * @severity P0
 *
 * Self-test for the execution-invariants audit script.
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10 / §11):
 *   1. positive seed: a thin invariant test (<5 it() blocks) -> audit MUST report
 *   2. negative seed: a well-covered invariant test (>=5 it() blocks) -> audit MUST NOT report
 *   3. evasion seed: a thin invariant test that hides its single it() block in a comment -> audit MUST still report
 *
 * In single-file mode the audit also walks the canonical 8 required
 * tests/invariants/<name>.test.ts files and reports them as P0 when
 * missing; that path is exercised by `node scripts/ci/audit-execution-invariants.mjs`
 * on the repo root, not by this self-test.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "execution-invariants");

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
  const out = execFileSync("node", ["scripts/ci/audit-execution-invariants.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: execution-invariants self-test", () => {
  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/execution-invariants/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 3, `expected at least 3 seed files, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
  });

  it("positive seed is reported (thin invariant test must be caught)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/execution-invariants/positive.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("positive.ts") && (f.severity === "P0" || f.severity === "P1"),
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0/P1 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed is NOT reported (well-covered test passes)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/execution-invariants/negative.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("negative.ts") && (f.severity === "P0" || f.severity === "P1"),
    );
    assert.equal(
      findings.length,
      0,
      `expected 0 P0/P1 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed is still reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/execution-invariants/evasion.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("evasion.ts") && (f.severity === "P0" || f.severity === "P1"),
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0/P1 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("global scan of tests/invariants flags the 8 missing canonical files as P0", () => {
    const report = runAudit("tests/invariants");
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      p0.length >= 8,
      `expected >= 8 P0 missing-file findings, got ${p0.length}: ${JSON.stringify(report.findings.slice(0, 3))}`,
    );
  });
});

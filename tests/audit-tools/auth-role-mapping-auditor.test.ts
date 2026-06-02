/**
 * @issue  AUDIT-TOOL-AUTH-ROLE-MAPPING-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-013
 * @gate   audit:auth-role-mapping
 * @severity P0
 *
 * Self-test for the auth-role-mapping audit script.
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §9.3):
 *   1. positive seed: servicePrincipal.roles.includes("admin") pattern -> audit MUST report
 *   2. negative seed: a read-only service principal -> audit MUST NOT report
 *   3. evasion seed: a defaultRoles array containing "admin" inside an
 *      opaque string-concatenation context -> audit MUST still report
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "auth-role-mapping");

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
  const out = execFileSync("node", ["scripts/ci/audit-auth-role-mapping.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: auth-role-mapping self-test", () => {
  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/auth-role-mapping/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 3, `expected at least 3 seed files, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
  });

  it("positive seed is reported (audit must catch service principal -> admin)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/positive.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("positive.ts") && f.severity === "P0",
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed is NOT reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/negative.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("negative.ts") && f.severity === "P0",
    );
    assert.equal(
      findings.length,
      0,
      `expected 0 P0 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed is still reported (defaultRoles with 'admin' must be caught)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/evasion.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("evasion.ts") && f.severity === "P0",
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });
});

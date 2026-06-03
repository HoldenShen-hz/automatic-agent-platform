/**
 * @issue  AUDIT-TOOL-TEST-DISABLED-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-012
 * @gate   audit:test-disabled
 * @severity P0
 *
 * Self-test for the test-disabled audit script.
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §44.15.1):
 *   1. positive seed: test.skip() without @quarantine metadata -> audit MUST report P0
 *   2. negative seed: a normal test() call                  -> audit MUST NOT report
 *   3. evasion seed:  describe.skip() without metadata      -> audit MUST still report
 *
 * The seed files live under tests/fixtures/seeded-defects/test-disabled/.
 * The audit script lives at scripts/ci/audit-test-disabled.mjs.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "test-disabled");

interface AuditFinding {
  rule: string;
  severity: string;
  path: string;
  line: number;
  message: string;
  snippet?: string;
}

interface AuditReport {
  findings: AuditFinding[];
  findingCount: number;
  bySeverity: Record<string, number>;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-test-disabled.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: test-disabled self-test", () => {
  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/test-disabled/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 3, `expected at least 3 seed files, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
    assert.ok(names.some((n) => n.endsWith("manifest.json")), "missing manifest.json");
  });

  it("positive seed (test.skip without metadata) is reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/test-disabled/positive.ts");
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      p0.length >= 1,
      `expected at least 1 P0 finding, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
    const skipFinding = p0.find((f) => f.rule === "disabled_tests.bare_skip");
    assert.ok(skipFinding, `expected a disabled_tests.bare_skip finding, got: ${JSON.stringify(p0)}`);
  });

  it("negative seed (regular test) is NOT reported (0 P0 findings)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/test-disabled/negative.ts");
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      p0.length,
      0,
      `expected 0 P0 findings for negative seed, got ${p0.length}: ${JSON.stringify(p0)}`,
    );
  });

  it("evasion seed (describe.skip without metadata) is still reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/test-disabled/evasion.ts");
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      p0.length >= 1,
      `expected at least 1 P0 finding on describe.skip evasion, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
    const skipFinding = p0.find((f) => f.rule === "disabled_tests.bare_skip");
    assert.ok(skipFinding, `expected a disabled_tests.bare_skip finding, got: ${JSON.stringify(p0)}`);
  });

  it("manifest.json is well-formed and references all three seed files", () => {
    const manifestPath = join(fixtureDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json missing");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.expectedGate, "audit-test-disabled");
    const kinds = new Set((manifest.seeds ?? []).map((seed: { kind: string }) => seed.kind));
    assert.ok(kinds.has("positive"), "manifest missing positive seed");
    assert.ok(kinds.has("negative"), "manifest missing negative seed");
    assert.ok(kinds.has("evasion"), "manifest missing evasion seed");
  });
});

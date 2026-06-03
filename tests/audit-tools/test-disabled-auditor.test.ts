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
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const auditScript = join(repoRoot, "scripts", "ci", "audit-test-disabled.mjs");
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

  it("writes disabled/flaky/quarantine artifacts for downstream assurance consumers", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aa-test-disabled-audit-"));
    try {
      const testDir = join(workspace, "tests");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        join(testDir, "sample.test.ts"),
        [
          "// @quarantine id=AAS-QUAR-000001 owner=alice reason=\"flaky network\"",
          "test.skip(\"sample skip\", () => {});",
          "// flaky due to upstream timing",
          "test(\"sample\", () => {});",
          "",
        ].join("\n"),
        "utf8",
      );

      execFileSync("node", [auditScript, "--path", "tests"], {
        cwd: workspace,
        encoding: "utf8",
      });

      const disabledReportPath = join(workspace, "artifacts", "assurance", "disabled-tests-report.json");
      const flakyReportPath = join(workspace, "artifacts", "assurance", "flaky-tests-report.json");
      const quarantineReportPath = join(workspace, "artifacts", "assurance", "quarantine-tests-report.json");

      assert.ok(existsSync(disabledReportPath), "disabled-tests-report.json missing");
      assert.ok(existsSync(flakyReportPath), "flaky-tests-report.json missing");
      assert.ok(existsSync(quarantineReportPath), "quarantine-tests-report.json missing");

      const disabledReport = JSON.parse(readFileSync(disabledReportPath, "utf8")) as AuditReport;
      const flakyReport = JSON.parse(readFileSync(flakyReportPath, "utf8")) as AuditReport;
      const quarantineReport = JSON.parse(readFileSync(quarantineReportPath, "utf8")) as AuditReport;

      assert.ok(disabledReport.findingCount >= 1, "disabled report should contain findings");
      assert.equal(flakyReport.findingCount, 1, `expected one flaky finding, got ${flakyReport.findingCount}`);
      assert.ok(
        quarantineReport.findings.some((finding) => finding.rule === "disabled_tests.quarantine_missing_expiry"),
        `expected quarantine report to contain missing expiry finding, got ${JSON.stringify(quarantineReport.findings)}`,
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("check mode fails on quarantine metadata P1 findings", () => {
    const workspace = mkdtempSync(join(tmpdir(), "aa-test-disabled-check-"));
    try {
      const testDir = join(workspace, "tests");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        join(testDir, "sample.test.ts"),
        [
          "// @quarantine id=AAS-QUAR-000002 owner=alice reason=\"temporary quarantine\"",
          "test.skip(\"sample skip\", () => {});",
          "",
        ].join("\n"),
        "utf8",
      );

      const result = spawnSync("node", [auditScript, "--check", "--path", "tests"], {
        cwd: workspace,
        encoding: "utf8",
      });

      assert.equal(result.status, 1, `expected check mode to fail on P1 findings, got ${result.status}`);
      const report = JSON.parse(result.stdout) as AuditReport;
      assert.ok(
        report.findings.some((finding) => finding.rule === "disabled_tests.quarantine_missing_expiry"),
        `expected missing expiry finding, got ${JSON.stringify(report.findings)}`,
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

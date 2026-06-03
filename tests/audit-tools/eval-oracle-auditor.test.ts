/**
 * @issue  AUDIT-TOOL-EVAL-ORACLE-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-006
 * @gate   audit:eval-oracle
 * @severity P0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const reportPath = join(repoRoot, "artifacts", "assurance", "eval-oracle-report.json");

interface AuditReport {
  findings: { rule: string; path: string; severity: string }[];
  findingCount: number;
  scannedPath?: string;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-eval-oracle.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: eval-oracle self-test", () => {
  it("writes the methodology report artifact", () => {
    const out = runAudit("tests/fixtures/seeded-defects/eval-oracle/negative.ts");
    assert.ok(existsSync(reportPath), "expected eval-oracle-report.json to be written");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as AuditReport;
    assert.equal(report.scannedPath, "tests/fixtures/seeded-defects/eval-oracle/negative.ts");
    assert.equal(report.findingCount, out.findingCount);
  });

  it("positive seed: actualOutput = expectedOutput is flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/eval-oracle/positive.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });

  it("negative seed: actualOutput is computed is not flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/eval-oracle/negative.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.ts") && f.severity === "P0");
    assert.equal(findings.length, 0, `unexpected P0: ${JSON.stringify(findings)}`);
  });

  it("evasion seed: destructure-from-equality is still flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/eval-oracle/evasion.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("evasion.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });
});

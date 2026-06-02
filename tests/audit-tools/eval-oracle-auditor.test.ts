/**
 * @issue  AUDIT-TOOL-EVAL-ORACLE-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-006
 * @gate   audit:eval-oracle
 * @severity P0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

interface AuditReport {
  findings: { rule: string; path: string; severity: string }[];
  findingCount: number;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-eval-oracle.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: eval-oracle self-test", () => {
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

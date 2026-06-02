/**
 * @issue  AUDIT-TOOL-DETERMINISM-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-002
 * @gate   audit:determinism
 * @severity P0
 *
 * Self-test for the determinism audit script.
 *
 * Verifies that:
 *   1. positive seed (Date.now / Math.random) is reported
 *   2. negative seed (Clock.now() / PRNG.next()) is NOT reported
 *   3. evasion seed (string-concat'd "Date" + ".now") is still reported
 *
 * The seed files live under tests/fixtures/seeded-defects/determinism-wallclock/.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

interface AuditReport {
  findings: { rule: string; path: string }[];
  findingCount: number;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-determinism.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: determinism self-test", () => {
  it("positive seed is reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/determinism-wallclock/positive.ts");
    const findings = report.findings.filter((f) => f.path.includes("positive.ts"));
    assert.ok(
      findings.length >= 1,
      `expected at least 1 finding in positive.ts, got ${findings.length}`,
    );
    const rule = findings[0]?.rule ?? "";
    assert.ok(
      rule.startsWith("determinism."),
      `unexpected rule: ${rule}`,
    );
  });

  it("negative seed (Clock-injected) is NOT reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/determinism-wallclock/negative.ts");
    const findings = report.findings.filter((f) => f.path.includes("negative.ts"));
    assert.equal(
      findings.length,
      0,
      `expected 0 findings in negative.ts, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed (string-concat'd identifier) is still reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/determinism-wallclock/evasion.ts");
    const findings = report.findings.filter((f) => f.path.includes("evasion.ts"));
    assert.ok(
      findings.length >= 1,
      `expected at least 1 finding in evasion.ts, got ${findings.length}`,
    );
  });
});

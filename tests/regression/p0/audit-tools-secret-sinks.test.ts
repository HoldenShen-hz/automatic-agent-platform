/**
 * @issue  REGRESSION-AUDIT-TOOL-COVERAGE-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-001
 * @gate   audit:secret-sinks
 * @severity P0
 *
 * Regression test: verifies the audit:secret-sinks scanner can be invoked
 * end-to-end from a real Node test process, parses the JSON report, and
 * correctly classifies a known P0 leak.
 *
 * This test guards against the regression where the scanner silently
 * returns 0 findings on a real leak.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

interface AuditReport {
  findings: { rule: string; severity: string; path: string }[];
  findingCount: number;
  bySeverity: Record<string, number>;
}

describe("regression: audit:secret-sinks end-to-end", () => {
  it("scans the repo and produces a valid JSON report", () => {
    const out = execFileSync("node", ["scripts/ci/audit-secret-sinks.mjs", "--path", "src"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const report = JSON.parse(out) as AuditReport;
    assert.ok(typeof report.findingCount === "number", "missing findingCount");
    assert.ok(Array.isArray(report.findings), "missing findings array");
    assert.ok(report.bySeverity, "missing bySeverity");
  });

  it("flags a known P0 leak fixture as P0 secret_sink.*", () => {
    const out = execFileSync(
      "node",
      [
        "scripts/ci/audit-secret-sinks.mjs",
        "--path",
        "tests/fixtures/seeded-defects/secret-logged/positive.ts",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const report = JSON.parse(out) as AuditReport;
    assert.ok(report.findingCount >= 1, "expected positive seed to be flagged");
    const p0 = report.findings.find((f) => f.severity === "P0" && f.path.endsWith("positive.ts"));
    assert.ok(p0, `expected a P0 finding on positive.ts; got ${JSON.stringify(report.findings)}`);
    assert.match(p0.rule, /^secret_sink\./);
  });

  it("does NOT flag a redacted secret (negative seed)", () => {
    const out = execFileSync(
      "node",
      [
        "scripts/ci/audit-secret-sinks.mjs",
        "--path",
        "tests/fixtures/seeded-defects/secret-logged/negative.ts",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const report = JSON.parse(out) as AuditReport;
    assert.equal(report.findingCount, 0, "redacted secret must not be flagged");
  });
});

/**
 * @issue  EVAL-P0-ORACLE-ANTI-FAKE-001
 * @invariant INV-EVAL-ORACLE-ANTI-FAKE-001
 * @gate   audit:eval-oracle
 * @severity P0
 *
 * Eval P0 case (per methodology §12.1 / §44.13.2):
 * the eval-oracle audit must catch every anti-pattern that makes a
 * runner pass without actually testing the system. This test runs
 * `scripts/ci/audit-eval-oracle.mjs` against the canonical seeded
 * fixtures and asserts:
 *
 *   - positive seed: `actualOutput = expectedOutput` is flagged P0
 *   - negative seed: real computed `actualOutput` is NOT flagged
 *   - evasion seed: equality-shape anti-pattern is still flagged
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §12.1,
 * this is a release-blocking gate for the eval family.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

const POSITIVE_SEED = "tests/fixtures/seeded-defects/eval-oracle/positive.ts";
const NEGATIVE_SEED = "tests/fixtures/seeded-defects/eval-oracle/negative.ts";
const EVASION_SEED = "tests/fixtures/seeded-defects/eval-oracle/evasion.ts";

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

function runEvalOracleAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-eval-oracle.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("eval: oracle-anti-fake (P0)", () => {
  it("positive seed: actualOutput = expectedOutput is flagged P0", () => {
    assert.ok(existsSync(resolve(repoRoot, POSITIVE_SEED)), `missing positive seed: ${POSITIVE_SEED}`);
    const report = runEvalOracleAudit(POSITIVE_SEED);
    const p0 = report.findings.filter(
      (f) => f.severity === "P0" && f.rule.startsWith("eval_oracle."),
    );
    assert.ok(
      p0.length >= 1,
      `expected >=1 P0 eval_oracle finding, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed: computed actualOutput is NOT flagged", () => {
    assert.ok(existsSync(resolve(repoRoot, NEGATIVE_SEED)), `missing negative seed: ${NEGATIVE_SEED}`);
    const report = runEvalOracleAudit(NEGATIVE_SEED);
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      p0.length,
      0,
      `computed-output sample must not be flagged, got ${JSON.stringify(p0)}`,
    );
  });

  it("evasion seed: equality-shape pattern is still flagged", () => {
    assert.ok(existsSync(resolve(repoRoot, EVASION_SEED)), `missing evasion seed: ${EVASION_SEED}`);
    const report = runEvalOracleAudit(EVASION_SEED);
    const p0 = report.findings.filter(
      (f) => f.severity === "P0" && f.rule.startsWith("eval_oracle."),
    );
    assert.ok(
      p0.length >= 1,
      `expected >=1 P0 eval_oracle finding on evasion seed, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("inline synthetic anti-pattern: `const actualOutput = expectedOutput` is caught", () => {
    // Inline check: this is a belt-and-braces assertion that the regex
    // shape `actualOutput = expectedOutput` is itself an eval-oracle
    // anti-pattern that the audit script should report.
    const synthetic = "tests/fixtures/seeded-defects/eval-oracle/positive.ts";
    const report = runEvalOracleAudit(synthetic);
    const rule = report.findings[0]?.rule ?? "";
    assert.ok(
      rule === "eval_oracle.expected_as_actual" || rule === "eval_oracle.expected_equals_actual",
      `expected one of the eval_oracle rules, got: ${rule}`,
    );
    // Touch the file as a smoke test (also exercises FS path).
    assert.ok(readFileSync(resolve(repoRoot, synthetic), "utf8").length > 0);
  });
});

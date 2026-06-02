/**
 * @issue  AUDIT-TOOL-ARCHITECTURE-BOUNDARY-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-003
 * @gate   audit:architecture-boundary
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
  findings: { rule: string; path: string }[];
  findingCount: number;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-architecture-boundary.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: architecture-boundary self-test", () => {
  it("scans src/platform without crashing", () => {
    const report = runAudit("src/platform");
    assert.ok(typeof report.findingCount === "number");
  });

  it("treats the seeded positive/evasion fixtures as a smoke target", () => {
    // The architecture-boundary audit, when scanning a non-plane path,
    // flags every plane import as P0. The positive and evasion seeds
    // each contain exactly one forbidden plane import, so we expect ≥1
    // finding with severity P0 and rule architecture_boundary.*.
    const out = runAudit("tests/fixtures/seeded-defects/architecture-boundary");
    const p0 = out.findings.filter((f) => f.severity === "P0");
    assert.ok(p0.length >= 1, `expected at least 1 P0 finding, got ${p0.length}`);
    assert.ok(
      p0.every((f) => f.rule.startsWith("architecture_boundary.")),
      `unexpected rule: ${JSON.stringify(p0)}`,
    );
  });
});

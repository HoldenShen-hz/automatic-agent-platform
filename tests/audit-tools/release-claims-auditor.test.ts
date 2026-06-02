/**
 * @issue  AUDIT-TOOL-RELEASE-CLAIMS-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-004
 * @gate   audit:release-claims
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
  findings: { rule: string; path: string; line: number; severity: string }[];
  findingCount: number;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-release-claims.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: release-claims self-test", () => {
  it("positive seed: claim without evidenceRef is flagged as P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/release-claims/positive.md");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.md"));
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
    assert.equal(findings[0].severity, "P0");
  });

  it("negative seed: claim with evidenceRef is downgraded to P3 (or absent)", () => {
    const out = runAudit("tests/fixtures/seeded-defects/release-claims/negative.md");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.md"));
    const p0 = findings.find((f) => f.severity === "P0");
    assert.equal(p0, undefined, `unexpected P0 finding on anchored claim: ${JSON.stringify(findings)}`);
  });

  it("evasion seed: claim broken across formatting is still flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/release-claims/evasion.md");
    const findings = out.findings.filter((f) => f.path.endsWith("evasion.md"));
    assert.ok(findings.length >= 1, `expected at least 1 finding, got ${findings.length}`);
  });
});

/**
 * @issue  AUDIT-TOOL-PATH-SAFETY-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-005
 * @gate   audit:path-safety
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
  findings: { rule: string; path: string; severity: string; hasGuard: boolean }[];
  findingCount: number;
}

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-path-safety.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: path-safety self-test", () => {
  it("positive seed: rmSync without guard is flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/path-safety/positive.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
    assert.ok(findings.some((f) => !f.hasGuard));
  });

  it("negative seed: rmSync with repoRoot guard is not flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/path-safety/negative.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.ts") && f.severity === "P0");
    assert.equal(findings.length, 0, `unexpected P0: ${JSON.stringify(findings)}`);
  });

  it("evasion seed: rmSync wrapped in helper without guard is still P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/path-safety/evasion.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("evasion.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });
});

/**
 * @issue  AUDIT-TOOL-FIRE-AND-FORGET-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-010
 * @gate   audit:fire-and-forget
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
  const out = execFileSync("node", ["scripts/ci/audit-fire-and-forget.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: fire-and-forget self-test", () => {
  it("positive seed: bare .publish(...) is flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/fire-and-forget/positive.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.ts"));
    assert.ok(findings.length >= 1, `expected at least 1 finding, got ${findings.length}`);
  });

  it("negative seed: awaited .publish(...) is not flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/fire-and-forget/negative.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.ts"));
    assert.equal(findings.length, 0, `unexpected: ${JSON.stringify(findings)}`);
  });

  it("evasion seed: discard assignment still flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/fire-and-forget/evasion.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("evasion.ts"));
    assert.ok(findings.length >= 1, `expected at least 1 finding, got ${findings.length}`);
  });
});

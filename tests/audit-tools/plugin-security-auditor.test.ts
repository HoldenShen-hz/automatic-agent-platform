/**
 * @issue  AUDIT-TOOL-PLUGIN-SECURITY-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-007
 * @gate   audit:plugin-security
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
  const out = execFileSync("node", ["scripts/ci/audit-plugin-security.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: plugin-security self-test", () => {
  it("positive seed: loadPlugin without verify is flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/plugin-security/positive.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });

  it("negative seed: loadPlugin after verifyManifest is not flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/plugin-security/negative.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.ts") && f.severity === "P0");
    assert.equal(findings.length, 0, `unexpected P0: ${JSON.stringify(findings)}`);
  });
});

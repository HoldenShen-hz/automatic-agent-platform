/**
 * @issue  AUDIT-TOOL-UI-TOKEN-STORAGE-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-008
 * @gate   audit:ui-token-storage
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
  const out = execFileSync("node", ["scripts/ci/audit-ui-token-storage.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: ui-token-storage self-test", () => {
  it("positive seed: bearer in <meta> is flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/ui-token-storage/positive.html");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.html") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });

  it("negative seed: meta with non-token content is not flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/ui-token-storage/negative.html");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.html") && f.severity === "P0");
    assert.equal(findings.length, 0, `unexpected P0: ${JSON.stringify(findings)}`);
  });

  it("evasion seed: access_token meta is still flagged P0", () => {
    const out = runAudit("tests/fixtures/seeded-defects/ui-token-storage/evasion.html");
    const findings = out.findings.filter((f) => f.path.endsWith("evasion.html") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });
});

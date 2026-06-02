/**
 * @issue  AUDIT-TOOL-IDEMPOTENCY-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-011
 * @gate   audit:idempotency
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
  const out = execFileSync("node", ["scripts/ci/audit-idempotency.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("audit-tool: idempotency self-test", () => {
  it("positive seed: write call without idempotency key is flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/idempotency-missing-key/positive.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("positive.ts") && f.severity === "P0");
    assert.ok(findings.length >= 1, `expected at least 1 P0 finding, got ${findings.length}`);
  });

  it("negative seed: write wrapped in withIdempotencyKey is not flagged", () => {
    const out = runAudit("tests/fixtures/seeded-defects/idempotency-missing-key/negative.ts");
    const findings = out.findings.filter((f) => f.path.endsWith("negative.ts") && f.severity === "P0");
    assert.equal(findings.length, 0, `unexpected: ${JSON.stringify(findings)}`);
  });
});

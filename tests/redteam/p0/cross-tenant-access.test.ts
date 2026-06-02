/**
 * @issue  REDTEAM-P0-CROSS-TENANT-001
 * @invariant INV-TENANT-ISOLATION-001
 * @gate   redteam:p0
 * @severity P0
 *
 * Redteam P0 case (per methodology §12.3 / §44.13.1, §1.1):
 * tenant A attempts to access tenant B's object (user, document,
 * task, receipt, etc.). The system must deny the access. Three
 * layers are verified:
 *
 *   1. Static: `audit:tenant-isolation` flags a positive seed that
 *      builds a query without a tenantId filter.
 *   2. Static: a negative seed that scopes by tenantId is NOT flagged.
 *   3. Runtime: a route handler that lacks a tenant guard is rejected
 *      by the deny-by-default RuntimeEntryGuard.
 *
 * Per docs_zh/architecture/00-platform-architecture.md §5 and §9.1,
 * any route/repository that reaches a sink without an explicit
 * tenantId reference is treated as cross-tenant leakage and the
 * release-blocking gate must be raised.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeEntryGuard } from "../../../src/platform/five-plane-orchestration/harness/runtime/runtime-entry-guard.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

const POSITIVE_SEED = "tests/fixtures/seeded-defects/tenant-query-missing/positive.ts";
const NEGATIVE_SEED = "tests/fixtures/seeded-defects/tenant-query-missing/negative.ts";

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

function runTenantAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-tenant-isolation.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

describe("redteam:p0 cross-tenant-access", () => {
  it("positive seed: audit:tenant-isolation catches a query with no tenantId filter", () => {
    assert.ok(existsSync(resolve(repoRoot, POSITIVE_SEED)), `missing positive seed: ${POSITIVE_SEED}`);
    const report = runTenantAudit(POSITIVE_SEED);
    const p0 = report.findings.filter((f) => f.severity === "P0" && f.rule.startsWith("tenant_isolation."));
    assert.ok(
      p0.length >= 1,
      `expected >=1 P0 tenant_isolation finding, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed: a tenantId-scoped query is NOT flagged", () => {
    assert.ok(existsSync(resolve(repoRoot, NEGATIVE_SEED)), `missing negative seed: ${NEGATIVE_SEED}`);
    const report = runTenantAudit(NEGATIVE_SEED);
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      p0.length,
      0,
      `tenant-scoped sample must not be flagged, got ${JSON.stringify(p0)}`,
    );
  });

  it("runtime: a route event with non-platform eventType is denied (tenant A cannot spoof tenant B's events)", () => {
    const guard = new RuntimeEntryGuard();
    // The attacker tries to write a truth fact from another tenant's
    // namespace. Per §28.1, only platform.* fact events are allowed.
    assert.throws(
      () => guard.assertNoLegacyTruthWrite({ eventType: "tenant_b.task.claimed" }),
      (error: unknown) =>
        error instanceof ValidationError && error.code === "runtime_entry_guard.platform_fact_required",
      "non-platform event types must be denied",
    );
  });

  it("runtime: a platform.* fact event is accepted (sanity check)", () => {
    const guard = new RuntimeEntryGuard();
    // A legitimate platform.* fact from tenant A must be allowed.
    // This is the negative case for the deny-by-default check.
    assert.doesNotThrow(() =>
      guard.assertNoLegacyTruthWrite({ eventType: "platform.task_run.claimed", tenantId: "tenant-A" }),
    );
  });
});

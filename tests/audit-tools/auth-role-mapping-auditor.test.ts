/**
 * @issue  AUDIT-TOOL-AUTH-ROLE-MAPPING-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-013
 * @gate   audit:auth-role-mapping
 * @severity P0
 *
 * Self-test for the auth-role-mapping audit script.
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §9.3
 * + Dataflow 1: User Request → Auth → Tenant Guard → Route → Service → Repository):
 *
 *   §9.3 axis 1: service principal role mapping
 *     1. positive seed: servicePrincipal.roles.includes("admin") pattern -> audit MUST report
 *     2. negative seed: a read-only service principal -> audit MUST NOT report
 *     3. evasion seed: a defaultRoles array containing "admin" inside an
 *        opaque string-concatenation context -> audit MUST still report
 *
 *   §9.3 axis 2: operator check
 *     4. positive-operator seed: high-risk action route handler without
 *        operatorCheck / operatorId / operatorRole -> audit MUST report
 *        `auth_role.operator_check_missing` (P0) +
 *        `auth_role.hitl_approval_bypass` (P0) +
 *        `auth_role.high_risk_action_unlisted` (P1)
 *
 *   §9.3 axis 7: no-go policy
 *     5. positive-no-go seed: a route handler that **permits** an
 *        action listed in `config/quality/no-go-policy.json::noGoActions`
 *        -> audit MUST report `auth_role.no_go_policy_violation` (P0)
 *
 *   §9.3 axis 9: manual takeover
 *     6. positive-manual-takeover seed: a manualTakeover() handler
 *        that does NOT write to an audit log -> audit MUST report
 *        `auth_role.manual_takeover_no_audit` (P0)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "auth-role-mapping");

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

function runAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-auth-role-mapping.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: auth-role-mapping self-test", () => {
  it("pos/neg/evasion/operator/no-go/manual-takeover seeds are all present in tests/fixtures/seeded-defects/auth-role-mapping/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 6, `expected at least 6 seed files, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive.ts")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
    assert.ok(names.some((n) => n.includes("positive-operator")), "missing positive-operator seed");
    assert.ok(names.some((n) => n.includes("positive-no-go")), "missing positive-no-go seed");
    assert.ok(names.some((n) => n.includes("positive-manual-takeover")), "missing positive-manual-takeover seed");
  });

  // -----------------------------------------------------------------
  // §9.3 axis 1: service principal role mapping
  // -----------------------------------------------------------------

  it("positive seed is reported (audit must catch service principal -> admin)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/positive.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("positive.ts") && f.severity === "P0",
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed is NOT reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/negative.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("negative.ts") && f.severity === "P0",
    );
    assert.equal(
      findings.length,
      0,
      `expected 0 P0 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed is still reported (defaultRoles with 'admin' must be caught)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/evasion.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("evasion.ts") && f.severity === "P0",
    );
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  // -----------------------------------------------------------------
  // §9.3 axis 2: operator check (and HITL approval bypass)
  // -----------------------------------------------------------------

  it("positive-operator seed is reported (operator_check_missing + hitl_approval_bypass + high_risk_action_unlisted)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/positive-operator.ts");
    const p0 = report.findings.filter(
      (f) => f.path.endsWith("positive-operator.ts") && f.severity === "P0",
    );
    const rules = new Set(p0.map((f) => f.rule));
    assert.ok(
      rules.has("auth_role.operator_check_missing"),
      `expected auth_role.operator_check_missing in ${[...rules]}`,
    );
    assert.ok(
      rules.has("auth_role.hitl_approval_bypass"),
      `expected auth_role.hitl_approval_bypass in ${[...rules]}`,
    );
    const p1 = report.findings.filter(
      (f) => f.path.endsWith("positive-operator.ts") && f.severity === "P1",
    );
    assert.ok(
      p1.some((f) => f.rule === "auth_role.high_risk_action_unlisted"),
      `expected auth_role.high_risk_action_unlisted P1, got ${[...new Set(p1.map((f) => f.rule))]}`,
    );
  });

  // -----------------------------------------------------------------
  // §9.3 axis 7: no-go policy
  // -----------------------------------------------------------------

  it("positive-no-go seed is reported (no_go_policy_violation P0)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping/positive-no-go.ts");
    const findings = report.findings.filter(
      (f) => f.path.endsWith("positive-no-go.ts") && f.severity === "P0",
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("auth_role.no_go_policy_violation"),
      `expected auth_role.no_go_policy_violation in ${[...rules]}`,
    );
    // Should catch all 6 no-go actions: dropDatabase, deleteAllUsers,
    // forceUnleashAllAgents, bypassAllApprovals, skipAllReceipts,
    // rewriteAuditChain.
    const noGoCount = findings.filter((f) => f.rule === "auth_role.no_go_policy_violation").length;
    assert.ok(
      noGoCount >= 6,
      `expected at least 6 no_go_policy_violation findings, got ${noGoCount}`,
    );
  });

  // -----------------------------------------------------------------
  // §9.3 axis 9: manual takeover
  // -----------------------------------------------------------------

  it("positive-manual-takeover seed is reported (manual_takeover_no_audit P0)", () => {
    const report = runAudit(
      "tests/fixtures/seeded-defects/auth-role-mapping/positive-manual-takeover.ts",
    );
    const findings = report.findings.filter(
      (f) => f.path.endsWith("positive-manual-takeover.ts") && f.severity === "P0",
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("auth_role.manual_takeover_no_audit"),
      `expected auth_role.manual_takeover_no_audit in ${[...rules]}`,
    );
  });

  // -----------------------------------------------------------------
  // Sanity: scan all seeds together and verify the audit catches all
  // 5 positive defects with at least one P0 finding each.
  // -----------------------------------------------------------------

  it("aggregate scan: each positive seed is flagged with at least one P0 finding", () => {
    const report = runAudit("tests/fixtures/seeded-defects/auth-role-mapping");
    const expectedPositive = [
      "positive.ts",
      "positive-operator.ts",
      "positive-no-go.ts",
      "positive-manual-takeover.ts",
    ];
    for (const seed of expectedPositive) {
      const seedFindings = report.findings.filter(
        (f) => f.path.endsWith(seed) && f.severity === "P0",
      );
      assert.ok(
        seedFindings.length >= 1,
        `expected at least 1 P0 finding for ${seed}, got ${seedFindings.length}: ${JSON.stringify(seedFindings)}`,
      );
    }
  });

  it("real repo authorization checks that only read admin status are NOT misreported as default-admin grants", () => {
    const paths = [
      "src/platform/five-plane-interface/api/http-server/approval-routes.ts",
      "src/platform/five-plane-interface/api/http-server/task-routes.ts",
      "src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.ts",
    ];
    for (const relativePath of paths) {
      const report = runAudit(relativePath);
      const falsePositive = report.findings.find(
        (f) => f.rule === "auth_role.service_principal_default_admin" && f.path.endsWith(relativePath),
      );
      assert.equal(
        falsePositive,
        undefined,
        `expected no default-admin false positive for ${relativePath}, got ${JSON.stringify(falsePositive)}`,
      );
    }
  });
});

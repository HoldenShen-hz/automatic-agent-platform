/**
 * @issue  AUDIT-TOOL-GOLDEN-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-018
 * @gate   audit:golden
 * @severity P0
 *
 * Self-test for the golden-fixture audit script (§12.4).
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.4 and §44.13.3):
 *   1. positive seed: .golden fixture missing frozenClock, deterministicId, seedInjected,
 *      exactEventMatch/allowedDiffList, and secretRedaction -> audit MUST report P0
 *   2. negative seed: .golden fixture with all required fields and exactEventMatch=true,
 *      secretRedaction=true -> audit MUST NOT report
 *   3. evasion seed: .golden fixture that hides the required fields under suffixed names
 *      (e.g. frozenClock_ignored) and contains an extraEvents[] without allowedDiffList ->
 *      audit MUST still report P0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "golden");
const reportPath = join(repoRoot, "artifacts", "assurance", "golden-replay-report.json");

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
  const out = execFileSync("node", ["scripts/ci/audit-golden.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: golden self-test (§12.4)", () => {
  it("writes the methodology report artifact", () => {
    const out = runAudit("tests/fixtures/seeded-defects/golden/negative.golden");
    assert.ok(existsSync(reportPath), "expected golden-replay-report.json to be written");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as AuditReport & { scannedPath: string };
    assert.equal(report.scannedPath, "tests/fixtures/seeded-defects/golden/negative.golden");
    assert.equal(report.findingCount, out.findingCount);
  });

  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/golden/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 4, `expected at least 4 seed entries, got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
    assert.ok(names.some((n) => n.endsWith("manifest.json")), "missing manifest.json");
  });

  it("positive seed (missing frozenClock / seedInjected / match policy / redaction) is reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/golden/positive.golden");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("golden.frozen_clock_missing"),
      `expected frozen_clock_missing finding, got: ${JSON.stringify([...rules])}`,
    );
    assert.ok(
      rules.has("golden.seed_injected_missing"),
      `expected seed_injected_missing finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("negative seed (all required fields, exactEventMatch=true, secretRedaction=true) is NOT reported", () => {
    const report = runAudit("tests/fixtures/seeded-defects/golden/negative.golden");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      findings.length,
      0,
      `expected 0 P0 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed (suffixed field names, extraEvents without allowedDiffList) is still reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/golden/evasion.golden");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("golden.extra_events_without_diff_list"),
      `expected extra_events_without_diff_list finding, got: ${JSON.stringify([...rules])}`,
    );
    assert.ok(
      rules.has("golden.frozen_clock_missing"),
      `expected frozen_clock_missing finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("manifest.json is well-formed and references all three seed files", () => {
    const manifestPath = join(fixtureDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json missing");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.expectedGate, "audit-golden");
    const kinds = new Set((manifest.seeds ?? []).map((seed: { kind: string }) => seed.kind));
    assert.ok(kinds.has("positive"), "manifest missing positive seed");
    assert.ok(kinds.has("negative"), "manifest missing negative seed");
    assert.ok(kinds.has("evasion"), "manifest missing evasion seed");
  });
});

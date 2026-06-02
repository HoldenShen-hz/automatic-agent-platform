/**
 * @issue  AUDIT-TOOL-DATASET-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-016
 * @gate   audit:dataset
 * @severity P0
 *
 * Self-test for the dataset-card audit script (§12.2).
 *
 * Methodology (per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.2 and §44.13.2):
 *   1. positive seed: dataset card missing samples path, with placeholder frozenHash,
 *      no contamination evidence, no sampleCount -> audit MUST report P0
 *   2. negative seed: dataset card with all required fields populated and a real
 *      samples directory on disk -> audit MUST NOT report
 *   3. evasion seed: dataset card that hides the bad samples under a private alias
 *      and has uppercase placeholder hash -> audit MUST still report P0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "dataset");

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
  const out = execFileSync("node", ["scripts/ci/audit-dataset.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

function listSeeds(): string[] {
  if (!existsSync(fixtureDir)) return [];
  return readdirSync(fixtureDir).map((f) => join(fixtureDir, f));
}

describe("audit-tool: dataset self-test (§12.2)", () => {
  it("pos/neg/evasion seeds are all present in tests/fixtures/seeded-defects/dataset/", () => {
    const seeds = listSeeds();
    assert.ok(seeds.length >= 4, `expected at least 4 seed entries (manifest + 3 cards), got ${seeds.length}`);
    const names = seeds.map((p) => p.toLowerCase());
    assert.ok(names.some((n) => n.includes("positive")), "missing positive seed");
    assert.ok(names.some((n) => n.includes("negative")), "missing negative seed");
    assert.ok(names.some((n) => n.includes("evasion")), "missing evasion seed");
    assert.ok(names.some((n) => n.endsWith("manifest.json")), "missing manifest.json");
  });

  it("positive seed (missing samples / placeholder hash) is reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/dataset/positive");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for positive seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("dataset.samples_path_missing") || rules.has("dataset.frozen_hash_placeholder") || rules.has("dataset.frozen_hash_invalid"),
      `expected a samples-path or frozen-hash finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("negative seed (complete card with real samples dir) is NOT reported (0 P0 findings)", () => {
    const report = runAudit("tests/fixtures/seeded-defects/dataset/negative");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      findings.length,
      0,
      `expected 0 P0 findings for negative seed, got ${findings.length}: ${JSON.stringify(findings)}`,
    );
  });

  it("evasion seed (samples path missing, uppercase hash, empty evidence) is still reported as P0", () => {
    const report = runAudit("tests/fixtures/seeded-defects/dataset/evasion");
    const findings = report.findings.filter((f) => f.severity === "P0");
    assert.ok(
      findings.length >= 1,
      `expected at least 1 P0 finding for evasion seed, got ${findings.length}: ${JSON.stringify(report.findings)}`,
    );
    const rules = new Set(findings.map((f) => f.rule));
    assert.ok(
      rules.has("dataset.samples_path_unresolved"),
      `expected samples_path_unresolved finding, got: ${JSON.stringify([...rules])}`,
    );
    assert.ok(
      rules.has("dataset.frozen_hash_invalid"),
      `expected frozen_hash_invalid finding, got: ${JSON.stringify([...rules])}`,
    );
  });

  it("manifest.json is well-formed and references all three seed files", () => {
    const manifestPath = join(fixtureDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json missing");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.expectedGate, "audit-dataset");
    const kinds = new Set((manifest.seeds ?? []).map((s) => s.kind));
    assert.ok(kinds.has("positive"), "manifest missing positive seed");
    assert.ok(kinds.has("negative"), "manifest missing negative seed");
    assert.ok(kinds.has("evasion"), "manifest missing evasion seed");
  });
});

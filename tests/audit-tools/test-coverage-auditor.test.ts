/**
 * @issue  AUDIT-TOOL-TEST-COVERAGE-001
 * @invariant INV-AUDIT-TOOL-SELF-TEST-016
 * @gate   audit:test-coverage
 * @severity P0
 *
 * Self-test for the test-to-issue bidirectional map and the
 * verify-test-coverage assurance gate. The methodology (§44.18) requires
 * that every test can be reverse-traced to a ledger issue and that every
 * P0 issue is bound by at least one test.
 *
 * This test verifies:
 *   1. build-test-to-issue-map.mjs scans tests/ and emits two map files.
 *   2. The parser recognizes the @issue tag in JSDoc header blocks.
 *   3. The parser ALSO recognizes `// hidden @issue ...` line comments
 *      (evasion tolerance).
 *   4. The verify-test-coverage.mjs gate flags orphan/unbound tests but
 *      allows well-formed ones to pass.
 *   5. The seeded positive/negative/evasion fixtures parse correctly.
 */

import { describe, it, before } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const outputRoot = join(repoRoot, "artifacts", "assurance");
type VerifyFindingPath = { testPath: string };
type VerifyReport = {
  generatedAt: string;
  status: "pass" | "warn" | "fail";
  summary: {
    bidirectionalInconsistencies: number;
    p0BoundCount: number;
  };
  findings: {
    orphanTests: VerifyFindingPath[];
    unboundTests: VerifyFindingPath[];
    unboundP0Issues: unknown[];
  };
};

let cachedVerifyReport: VerifyReport | null = null;

function runNode(scriptPath: string, ...extraArgs: string[]): string {
  return execFileSync("node", [scriptPath, ...extraArgs], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function ensureBuild() {
  mkdirSync(outputRoot, { recursive: true });
  runNode("scripts/assurance/build-test-to-issue-map.mjs");
}

function ensureVerify(): VerifyReport {
  if (cachedVerifyReport != null) {
    return cachedVerifyReport;
  }
  // verify returns exit code 1 when P0 issues are unbound, but still
  // prints JSON to stdout. Use spawnSync so we can read the JSON even
  // on non-zero exit codes.
  const r = spawnSync("node", ["scripts/assurance/verify-test-coverage.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (!r.stdout) {
    throw new Error(`verify-test-coverage produced no stdout; stderr=${r.stderr ?? ""}`);
  }
  cachedVerifyReport = JSON.parse(r.stdout) as VerifyReport;
  return cachedVerifyReport;
}

describe("audit-tool: test-coverage self-test", () => {
  before(() => {
    ensureBuild();
    cachedVerifyReport = null;
  });

  it("pos/neg/evasion fixtures are present and the manifest is well-formed", () => {
    const baseDir = join(repoRoot, "tests", "fixtures", "seeded-defects", "test-coverage");
    for (const sub of ["positive", "negative", "evasion"]) {
      const subDir = join(baseDir, sub);
      assert.ok(existsSync(subDir), `missing fixture dir: ${sub}`);
      const tests = readdirSync(subDir).filter((f: string) => f.endsWith(".test.ts"));
      assert.ok(tests.length >= 1, `no test file in ${sub}`);
    }
    const manifestPath = join(baseDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "missing manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.expectedGate, "scripts/assurance/verify-test-coverage.mjs");
    assert.ok(Array.isArray(manifest.seeds));
    assert.ok(manifest.seeds.length >= 3);
    const kinds = manifest.seeds.map((s: { kind: string }) => s.kind);
    assert.ok(kinds.includes("positive"));
    assert.ok(kinds.includes("negative"));
    assert.ok(kinds.includes("evasion"));
  });

  it("positive seed (unknown @issue ref) shows up as orphan/unbound in verify output", () => {
    const map = JSON.parse(readFileSync(join(outputRoot, "test-to-issue-map.json"), "utf8"));
    const positive = "tests/fixtures/seeded-defects/test-coverage/positive/test-positive.test.ts";
    assert.ok(map.bindings[positive], `expected ${positive} in test-to-issue-map`);
    assert.ok(
      map.bindings[positive].includes("AAS-ISSUE-DOES-NOT-EXIST-999"),
      `expected positive fixture to declare the unknown @issue ref`,
    );

    const report = ensureVerify();
    const orphanPaths = (report.findings.orphanTests as Array<{ testPath: string }>).map((o) => o.testPath);
    assert.ok(
      orphanPaths.includes(positive),
      `expected ${positive} in orphanTests; got ${orphanPaths.length} orphans`,
    );
  });

  it("negative seed (real @issue ref) is NOT reported as orphan or unbound", () => {
    const map = JSON.parse(readFileSync(join(outputRoot, "test-to-issue-map.json"), "utf8"));
    const negative = "tests/fixtures/seeded-defects/test-coverage/negative/test-negative.test.ts";
    assert.ok(map.bindings[negative]);
    assert.ok(map.bindings[negative].includes("AAS-ISSUE-000113"));

    const report = ensureVerify();
    const orphanPaths = (report.findings.orphanTests as Array<{ testPath: string }>).map((o) => o.testPath);
    const unboundPaths = (report.findings.unboundTests as Array<{ testPath: string }>).map((u) => u.testPath);
    assert.ok(
      !orphanPaths.includes(negative),
      `negative fixture should NOT be in orphanTests: ${JSON.stringify(orphanPaths)}`,
    );
    // The negative fixture references a P0 issue (AAS-ISSUE-000113), so it
    // is also not in unboundTests.
    assert.ok(
      !unboundPaths.includes(negative),
      `negative fixture should NOT be in unboundTests: ${JSON.stringify(unboundPaths)}`,
    );
  });

  it("evasion seed (hidden // @issue) is recognized by the parser", () => {
    const map = JSON.parse(readFileSync(join(outputRoot, "test-to-issue-map.json"), "utf8"));
    const evasion = "tests/fixtures/seeded-defects/test-coverage/evasion/test-evasion.test.ts";
    assert.ok(
      map.bindings[evasion],
      `expected ${evasion} in test-to-issue-map (parser must catch line-comment @issue)`,
    );
    assert.ok(
      map.bindings[evasion].includes("AAS-ISSUE-000001"),
      `expected AAS-ISSUE-000001 in evasion fixture bindings, got ${JSON.stringify(map.bindings[evasion])}`,
    );

    const meta = JSON.parse(readFileSync(join(outputRoot, "test-metadata.json"), "utf8"));
    const evasionEntry = (meta.entries as Array<{ path: string; issueIds: string[]; severity: string | null }>)
      .find((e) => e.path === evasion);
    assert.ok(evasionEntry, "evasion fixture must have a metadata entry");
    assert.ok(evasionEntry!.issueIds.includes("AAS-ISSUE-000001"));
    assert.equal(evasionEntry!.severity, "P0");
  });

  it("verify-test-coverage.mjs runs end-to-end and returns a structured report", () => {
    const report = ensureVerify();
    assert.ok(typeof report.generatedAt === "string");
    assert.ok(["pass", "warn", "fail"].includes(report.status));
    assert.ok(report.summary && typeof report.summary === "object");
    assert.ok(report.findings);
    assert.ok(Array.isArray(report.findings.unboundP0Issues));
    assert.ok(Array.isArray(report.findings.unboundTests));
    assert.ok(Array.isArray(report.findings.orphanTests));
    // Bidirectional map must be self-consistent (no union mismatch).
    assert.equal(report.summary.bidirectionalInconsistencies, 0);
    // P0 bound count must be > 0 — the negative + evasion fixtures
    // together bind AAS-ISSUE-000001 and AAS-ISSUE-000113.
    assert.ok(report.summary.p0BoundCount >= 1, `p0BoundCount should be >= 1, got ${report.summary.p0BoundCount}`);
  });
});

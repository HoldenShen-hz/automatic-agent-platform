import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = resolve(repoRoot, "scripts/assurance/build-coverage-scorecard.mjs");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

test("coverage scorecard ignores intentionally skipped seeded-defect categories in self-test scoring", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-coverage-scorecard-"));
  try {
    mkdirSync(join(workspace, "scripts", "assurance"), { recursive: true });
    mkdirSync(join(workspace, "artifacts", "assurance"), { recursive: true });

    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify(
        {
          name: "aa-coverage-scorecard-fixture",
          private: true,
          version: "1.0.0",
          scripts: {
            "ci:baseline": "npm run validate:stable:compiled",
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(workspace, "scripts", "assurance", "rc-check.mjs"),
      `const x = { command: "assurance:full" }; void x;`,
    );
    writeFileSync(
      join(workspace, "scripts", "assurance", "run-full-assurance.mjs"),
      [
        "const steps = [",
        '  { command: "assurance:inventory" },',
        '  { command: "assurance:review-import:check" },',
        '  { command: "audit:public-entrypoints" },',
        '  { command: "assurance:historical-promises" },',
        '  { command: "assurance:assumptions" },',
        '  { command: "audit:leadership-claims" },',
        '  { command: "audit:docs-sync" },',
        '  { command: "assurance:static-audit" },',
        '  { command: "assurance:eval-oracle" },',
        '  { command: "assurance:issue-ledger" },',
        '  { command: "assurance:test-to-issue" },',
        '  { command: "assurance:historical-regression-map" },',
        '  { command: "assurance:completeness-matrix" },',
        '  { command: "assurance:coverage-scorecard" },',
        '  { command: "assurance:verify-test-coverage" },',
        '  { command: "audit:dataset" },',
        '  { command: "audit:redteam" },',
        '  { command: "audit:golden" },',
        '  { command: "audit:eval-oracle" },',
        "];",
        "void steps;",
      ].join("\n"),
    );

    writeJson(join(workspace, "artifacts", "assurance", "seeded-defect-report.json"), {
      failedSeedCount: 0,
      results: [
        {
          gate: "audit-secret-sinks",
          seeds: [
            { kind: "positive", pass: true },
            { kind: "negative", pass: true },
            { kind: "evasion", pass: true },
          ],
        },
        {
          gate: "scripts/assurance/verify-test-coverage.mjs",
          skipped: true,
          seeds: [],
        },
      ],
    });

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });

    assert.notEqual(result.status, null, "coverage scorecard process should exit deterministically");
    const report = JSON.parse(
      readFileSync(join(workspace, "artifacts", "assurance", "audit-coverage-scorecard.json"), "utf8"),
    ) as {
      dimensions?: {
        auditToolSelfTest?: {
          score?: number;
          details?: string;
        };
      };
    };
    assert.equal(report.dimensions?.auditToolSelfTest?.score, 1);
    assert.match(report.dimensions?.auditToolSelfTest?.details ?? "", /tripletCovered=1\/1/);
    assert.match(report.dimensions?.auditToolSelfTest?.details ?? "", /skipped=1/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

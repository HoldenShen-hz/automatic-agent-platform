#!/usr/bin/env node
/**
 * rc:check — release readiness aggregator
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §3.3.
 * Runs in order:
 *   1. assurance:full
 *   2. test:p0 (test:invariants + test:regression:p0)
 *   3. test:chaos:p0
 *   4. test:redteam:p0
 *   5. test:golden:strict
 *   6. test:audit-tools
 *   7. test:seeded-defects
 *   8. evidence:bundle:create
 *   9. evidence:bundle:verify
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputDir = join(repoRoot, "artifacts", "release");

const STEPS = [
  { id: "assurance:full", required: true, command: "assurance:full" },
  { id: "test:p0", required: true, command: "test:p0" },
  { id: "test:chaos:p0", required: true, command: "test:chaos:p0" },
  { id: "test:redteam:p0", required: true, command: "test:redteam:p0" },
  { id: "test:golden:strict", required: true, command: "test:golden:strict" },
  { id: "test:audit-tools", required: true, command: "test:audit-tools" },
  { id: "test:seeded-defects", required: true, command: "test:seeded-defects" },
  { id: "evidence:bundle:create", required: true, command: "evidence:bundle:create" },
  { id: "evidence:bundle:verify", required: true, command: "evidence:bundle:verify" },
];

function runStep(step) {
  const startedAt = new Date().toISOString();
  try {
    execFileSync("npm", ["run", step.command], {
      cwd: repoRoot,
      stdio: "inherit",
      encoding: "utf8",
    });
    return {
      id: step.id,
      required: step.required,
      command: `npm run ${step.command}`,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
      ok: true,
    };
  } catch (e) {
    return {
      id: step.id,
      required: step.required,
      command: `npm run ${step.command}`,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: e.status ?? 1,
      ok: false,
    };
  }
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString();
  const results = STEPS.map(runStep);
  const failed = results.filter((r) => r.required && !r.ok).map((r) => r.id);
  const report = {
    generatedAt: stamp,
    repoRoot,
    mode: "rc",
    status: failed.length === 0 ? "pass" : "fail",
    failedSteps: failed,
    executedSteps: results,
    evidenceBundleRef: failed.length === 0 && existsSync(join(outputDir, "evidence-bundle.json"))
      ? "artifacts/release/evidence-bundle.json"
      : null,
  };
  writeFileSync(join(outputDir, "rc-check-report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();

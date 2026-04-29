import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "ci", "check-coverage-baseline.mjs");

// Note: "check-coverage-baseline loads baseline and compares" is skipped because
// the script uses absolute paths from the project root, not from cwd. The unit tests
// for coverage-lib.test.ts directly test the comparison logic.

test("check-coverage-baseline fails when coverage is below baseline", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-coverage-baseline-"));

  try {
    mkdirSync(join(workspace, "coverage"), { recursive: true });

    const coverageSummary = {
      total: {
        lines: { covered: 50, total: 100, pct: 50 },
        statements: { covered: 50, total: 100, pct: 50 },
        functions: { covered: 5, total: 10, pct: 50 },
        branches: { covered: 10, total: 30, pct: 33.3 },
      },
      "src/platform/index.ts": {
        lines: { covered: 30, total: 60, pct: 50 },
        statements: { covered: 30, total: 60, pct: 50 },
        functions: { covered: 3, total: 5, pct: 60 },
        branches: { covered: 5, total: 15, pct: 33.3 },
      },
    };
    writeFileSync(join(workspace, "coverage", "coverage-summary.json"), JSON.stringify(coverageSummary, null, 2));

    const baseline = {
      version: 1,
      generatedAt: new Date().toISOString(),
      minimums: { lines: 75, statements: 75, functions: 100, branches: 60 },
      global: { lines: 75, statements: 75, functions: 100, branches: 60 },
      directories: {
        "src/platform": {
          fileCount: 1,
          metrics: { lines: 80, statements: 80, functions: 100, branches: 65 },
        },
      },
    };
    writeFileSync(join(workspace, ".coverage-baseline.json"), JSON.stringify(baseline, null, 2));

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.equal(result.status, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("check-coverage-baseline fails when baseline is missing", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-coverage-baseline-"));

  try {
    mkdirSync(join(workspace, "coverage"), { recursive: true });

    const coverageSummary = {
      total: {
        lines: { covered: 80, total: 100, pct: 80 },
        statements: { covered: 80, total: 100, pct: 80 },
        functions: { covered: 10, total: 10, pct: 100 },
        branches: { covered: 20, total: 30, pct: 66.7 },
      },
    };
    writeFileSync(join(workspace, "coverage", "coverage-summary.json"), JSON.stringify(coverageSummary, null, 2));

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
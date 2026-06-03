import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts/assurance/run-test-suite-with-report.mjs");

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

test("run-test-suite-with-report writes a passing report artifact", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-suite-report-pass-"));
  try {
    writeWorkspaceFile(workspace, "scripts/pass.mjs", "process.exit(0);\n");

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--suite-id",
        "fixture-pass",
        "--report",
        "artifacts/assurance/fixture-pass-report.json",
        "--",
        process.execPath,
        "scripts/pass.mjs",
      ],
      { cwd: workspace, encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(workspace, "artifacts/assurance/fixture-pass-report.json"), "utf8"));
    assert.equal(report.suiteId, "fixture-pass");
    assert.equal(report.ok, true);
    assert.equal(report.exitCode, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-test-suite-with-report preserves non-zero exit codes in the report", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-suite-report-fail-"));
  try {
    writeWorkspaceFile(workspace, "scripts/fail.mjs", "process.exit(3);\n");

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--suite-id",
        "fixture-fail",
        "--report",
        "artifacts/assurance/fixture-fail-report.json",
        "--",
        process.execPath,
        "scripts/fail.mjs",
      ],
      { cwd: workspace, encoding: "utf8" },
    );

    assert.equal(result.status, 3, `expected exit code 3, got ${result.status}: ${result.stderr}`);
    const report = JSON.parse(readFileSync(join(workspace, "artifacts/assurance/fixture-fail-report.json"), "utf8"));
    assert.equal(report.suiteId, "fixture-fail");
    assert.equal(report.ok, false);
    assert.equal(report.exitCode, 3);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

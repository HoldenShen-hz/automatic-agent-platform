import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const redteamWrapper = resolve(repoRoot, "scripts/redteam/run-p0-redteam.mjs");
const goldenWrapper = resolve(repoRoot, "scripts/golden/run-strict-golden.mjs");

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

test("package scripts use methodology-compatible wrapper entrypoints", () => {
  assert.equal(
    packageJson.scripts["assurance:historical-promises"],
    "node scripts/assurance/collect-historical-promises.mjs",
  );
  assert.equal(
    packageJson.scripts["audit:historical-promises"],
    "node scripts/assurance/collect-historical-promises.mjs --check",
  );
  assert.equal(
    packageJson.scripts["test:redteam:p0"],
    "AA_RUNNING_TESTS=1 node scripts/redteam/run-p0-redteam.mjs",
  );
  assert.equal(
    packageJson.scripts["test:golden:strict"],
    "AA_RUNNING_TESTS=1 node scripts/golden/run-strict-golden.mjs",
  );
});

test("redteam methodology wrapper delegates to scripts/run-node-tests.mjs with the p0 pattern", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-redteam-wrapper-"));
  try {
    writeWorkspaceFile(
      workspace,
      "scripts/run-node-tests.mjs",
      [
        "const args = process.argv.slice(2);",
        "if (args[0] !== 'tests/redteam/p0/**/*.test.ts') process.exit(7);",
        "process.exit(0);",
        "",
      ].join("\n"),
    );

    const result = spawnSync(process.execPath, [redteamWrapper], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("golden methodology wrapper delegates to scripts/run-node-tests.mjs with strict replay args", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-golden-wrapper-"));
  try {
    writeWorkspaceFile(
      workspace,
      "scripts/run-node-tests.mjs",
      [
        "const args = process.argv.slice(2);",
        "if (args[0] !== 'tests/golden/**/*.test.ts') process.exit(8);",
        "if (args[1] !== '--no-cache') process.exit(9);",
        "process.exit(0);",
        "",
      ].join("\n"),
    );

    const result = spawnSync(process.execPath, [goldenWrapper], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

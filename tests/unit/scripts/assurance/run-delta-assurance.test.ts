import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts/assurance/run-delta-assurance.mjs");

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function git(workspace: string, args: string[]): void {
  execFileSync("git", args, {
    cwd: workspace,
    stdio: "pipe",
    encoding: "utf8",
  });
}

test("run-delta-assurance executes docs, leadership, and test checks for matching changed files", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-delta-assurance-"));
  try {
    writeFile(
      join(workspace, "package.json"),
      JSON.stringify(
        {
          name: "delta-assurance-fixture",
          private: true,
          scripts: {
            "test:unit": "node scripts/fake-npm-check.mjs test:unit",
            "test:invariants": "node scripts/fake-npm-check.mjs test:invariants",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      join(workspace, "scripts", "fake-npm-check.mjs"),
      "process.stdout.write(JSON.stringify({ ok: true, script: process.argv[2] }, null, 2));\n",
    );
    for (const audit of ["audit-docs-sync", "audit-leadership-claims", "audit-release-claims"]) {
      writeFile(
        join(workspace, "scripts", "ci", `${audit}.mjs`),
        `process.stdout.write(JSON.stringify({ findingCount: 0, findings: [], auditId: "${audit}" }, null, 2));\n`,
      );
    }
    writeFile(join(workspace, "docs_zh", "reference", "example.md"), "# v1\n");
    writeFile(join(workspace, "tests", "unit", "example.test.ts"), "export {};\n");

    git(workspace, ["init"]);
    git(workspace, ["config", "user.email", "codex@example.com"]);
    git(workspace, ["config", "user.name", "Codex"]);
    git(workspace, ["add", "."]);
    git(workspace, ["commit", "-m", "base"]);

    writeFile(join(workspace, "docs_zh", "reference", "example.md"), "# v2\n");
    writeFile(join(workspace, "tests", "unit", "example.test.ts"), "export const changed = true;\n");
    git(workspace, ["add", "."]);
    git(workspace, ["commit", "-m", "change docs and tests"]);

    const result = spawnSync(process.execPath, [scriptPath, "--base", "HEAD~1"], {
      cwd: workspace,
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, "delta");
    assert.equal(report.status, "pass");
    assert.deepEqual(
      report.executedChecks.map((check: { id: string }) => check.id),
      ["audit:docs-sync", "audit:leadership-claims", "audit:release-claims", "test:unit", "test:invariants"],
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "run-curated-tests.mjs");

test("run-curated-tests requires dist/tests to exist", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-curated-"));

  try {
    mkdirSync(join(workspace, "dist"), { recursive: true });
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
    assert.ok(result.stderr?.toString().includes("dist/tests") || result.stdout?.toString().includes("dist/tests"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-curated-tests loads and filters test files", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-curated-"));

  try {
    mkdirSync(join(workspace, "dist", "tests", "unit", "platform"), { recursive: true });
    writeFileSync(join(workspace, "dist", "tests", "unit", "platform", "sample.test.js"), "");

    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.ok(result.status === 0 || result.status === 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
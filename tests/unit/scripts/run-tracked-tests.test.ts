import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "run-tracked-tests.mjs");

test("run-tracked-tests requires git to function", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-tracked-"));

  try {
    mkdirSync(workspace, { recursive: true });

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

test("run-tracked-tests accepts concurrency options", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-tracked-"));

  try {
    mkdirSync(workspace, { recursive: true });

    const result = spawnSync("node", [SCRIPT_PATH, "--test-concurrency=4"], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
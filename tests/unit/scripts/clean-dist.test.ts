import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "clean-dist.mjs");

test("clean-dist preserves dist when AA_PRESERVE_DIST is set", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-"));

  try {
    mkdirSync(join(workspace, "dist"), { recursive: true });
    writeFileSync(join(workspace, "dist", "keep-me.txt"), "content");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env, AA_PRESERVE_DIST: "1" },
      stdio: "pipe",
    });

    assert.equal(result.status, 0);
    assert.equal(existsSync(join(workspace, "dist", "keep-me.txt")), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("clean-dist preserves dist when AA_RUNNING_TESTS is set", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-"));

  try {
    mkdirSync(join(workspace, "dist"), { recursive: true });
    writeFileSync(join(workspace, "dist", "keep-me.txt"), "content");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env, AA_RUNNING_TESTS: "1" },
      stdio: "pipe",
    });

    assert.equal(result.status, 0);
    assert.equal(existsSync(join(workspace, "dist", "keep-me.txt")), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("clean-dist prunes stale .test.js when AA_PRUNE_DIST_TESTS is set", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-"));

  try {
    mkdirSync(join(workspace, "dist", "tests", "unit", "some-test"), { recursive: true });
    const staleJs = join(workspace, "dist", "tests", "unit", "some-test", "stale.test.js");
    const staleMap = `${staleJs}.map`;
    writeFileSync(staleJs, "console.log('stale');\n");
    writeFileSync(
      staleMap,
      JSON.stringify({
        version: 3,
        file: "stale.test.js",
        sources: ["../../../../../../tests/unit/some-test/nonexistent-source.test.ts"],
        names: [],
        mappings: "",
      }),
    );

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env, AA_PRESERVE_DIST: "1", AA_PRUNE_DIST_TESTS: "1" },
      stdio: "pipe",
    });

    assert.equal(result.status, 0);
    assert.equal(existsSync(staleJs), false);
    assert.equal(existsSync(staleMap), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

// Note: "clean-dist skips .test.js with valid source mappings" is covered by
// integration-style tests in tests/integration/scripts/ that verify the actual
// source path resolution behavior with real file layouts.

test("clean-dist handles missing dist gracefully", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-"));

  try {
    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.equal(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
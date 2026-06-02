import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "clean-dist.mjs");

test("clean-dist prunes stale compiled tests even when dist is preserved", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-"));
  const workspaceScriptPath = join(workspace, "scripts", "clean-dist.mjs");

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, "dist", "tests", "integration", "platform", "control-plane"), { recursive: true });
    copyFileSync(SCRIPT_PATH, workspaceScriptPath);

    const staleJs = join(
      workspace,
      "dist",
      "tests",
      "integration",
      "platform",
      "control-plane",
      "control-plane-integration.test.js",
    );
    const staleMap = `${staleJs}.map`;
    const staleDts = staleJs.replace(/\.js$/, ".d.ts");
    writeFileSync(staleJs, "console.log('stale');\n");
    writeFileSync(staleDts, "export {};\n");
    writeFileSync(
      staleMap,
      JSON.stringify({
        version: 3,
        file: "control-plane-integration.test.js",
        sources: ["../../../../../tests/integration/platform/five-plane-control-plane/control-plane-integration.test.ts"],
        names: [],
        mappings: "",
      }),
    );

    const liveSource = join(workspace, "tests", "integration", "platform", "control-plane");
    mkdirSync(liveSource, { recursive: true });
    writeFileSync(join(liveSource, "operator-governance-integration.test.ts"), "export {};\n");
    const liveJs = join(
      workspace,
      "dist",
      "tests",
      "integration",
      "platform",
      "control-plane",
      "operator-governance-integration.test.js",
    );
    const liveMap = `${liveJs}.map`;
    writeFileSync(liveJs, "console.log('live');\n");
    writeFileSync(
      liveMap,
      JSON.stringify({
        version: 3,
        file: "operator-governance-integration.test.js",
        sources: ["../../../../../tests/integration/platform/control-plane/operator-governance-integration.test.ts"],
        names: [],
        mappings: "",
      }),
    );

    execFileSync("node", [workspaceScriptPath], {
      cwd: workspace,
      env: {
        ...process.env,
        AA_PRESERVE_DIST: "1",
        AA_PRUNE_DIST_TESTS: "1",
      },
      stdio: "pipe",
    });

    assert.equal(existsSync(staleJs), false);
    assert.equal(existsSync(staleMap), false);
    assert.equal(existsSync(staleDts), false);
    assert.equal(existsSync(liveJs), true);
    assert.equal(existsSync(liveMap), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("clean-dist honors AA_PRESERVE_DIST=0 even while AA_RUNNING_TESTS=1", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-force-delete-"));
  const workspaceScriptPath = join(workspace, "scripts", "clean-dist.mjs");

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, "dist"), { recursive: true });
    copyFileSync(SCRIPT_PATH, workspaceScriptPath);
    writeFileSync(join(workspace, "dist", "marker.txt"), "marker\n");

    execFileSync("node", [workspaceScriptPath], {
      cwd: workspace,
      env: {
        ...process.env,
        AA_RUNNING_TESTS: "1",
        AA_PRESERVE_DIST: "0",
      },
      stdio: "pipe",
    });

    assert.equal(existsSync(join(workspace, "dist")), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("clean-dist no longer preserves dist implicitly from AA_RUNNING_TESTS without AA_PRESERVE_DIST=1", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-clean-dist-explicit-policy-"));
  const workspaceScriptPath = join(workspace, "scripts", "clean-dist.mjs");

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, "dist"), { recursive: true });
    copyFileSync(SCRIPT_PATH, workspaceScriptPath);
    writeFileSync(join(workspace, "dist", "marker.txt"), "marker\n");

    execFileSync("node", [workspaceScriptPath], {
      cwd: workspace,
      env: {
        ...process.env,
        AA_RUNNING_TESTS: "1",
      },
      stdio: "pipe",
    });

    assert.equal(existsSync(join(workspace, "dist")), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

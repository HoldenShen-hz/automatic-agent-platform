import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

function runCliExpectFailure(env: NodeJS.ProcessEnv): string {
  try {
    execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "shadow-snapshot.js")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected_cli_failure");
  } catch (error) {
    if (!(error instanceof Error) || !("stderr" in error)) {
      throw error;
    }
    return String((error as { stderr?: string }).stderr ?? error.message);
  }
}

test("shadow snapshot CLI fail-closes when the shadow root is placed inside the workspace", () => {
  const workspace = createTempWorkspace("aa-shadow-security-");

  try {
    createFile(join(workspace, "src", "index.ts"), "export const secure = true;\n");

    const stderr = runCliExpectFailure({
      AA_WORKSPACE_ROOT: workspace,
      AA_SHADOW_ROOT: join(workspace, ".shadow"),
      AA_SHADOW_SNAPSHOT_ACTION: "create",
    });

    assert.match(stderr, /shadow_snapshot\.shadow_root_inside_workspace/);
  } finally {
    cleanupPath(workspace);
  }
});

test("shadow snapshot CLI fail-closes when the shadow root path traverses a symlinked directory", () => {
  const workspace = createTempWorkspace("aa-shadow-security-");
  const shadowParent = createTempWorkspace("aa-shadow-parent-");
  const target = createTempWorkspace("aa-shadow-target-");

  try {
    createFile(join(workspace, "src", "index.ts"), "export const secure = true;\n");
    createSymlink(target, join(shadowParent, "linked-root"));

    const stderr = runCliExpectFailure({
      AA_WORKSPACE_ROOT: workspace,
      AA_SHADOW_ROOT: join(shadowParent, "linked-root", "repo"),
      AA_SHADOW_SNAPSHOT_ACTION: "create",
    });

    assert.match(stderr, /shadow_snapshot\.shadow_root_symlink_denied/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(shadowParent);
    cleanupPath(target);
  }
});


import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { cleanupPath, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";

function runCliExpectFailure(env: NodeJS.ProcessEnv): { stderr: string; status: number } {
  try {
    execFileSync(process.execPath, [process.env.AA_TEST_SKILL_CREATOR_SCRIPT ?? join(process.cwd(), "dist", "src", "cli", "skill-creator.js")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected_cli_failure:skill-creator.js");
  } catch (error) {
    if (error instanceof Error && error.message === "expected_cli_failure:skill-creator.js") {
      throw error;
    }
    const failure = error as { stderr?: string; status?: number };
    return {
      stderr: failure.stderr ?? "",
      status: failure.status ?? 1,
    };
  }
}

test("skill creator fails closed when target skill directory is a symlink", () => {
  const workspace = createTempWorkspace("aa-skill-creator-boundary-");
  const outside = createTempWorkspace("aa-skill-creator-outside-");

  try {
    const skillRoot = join(workspace, "skills");
    const symlinkTarget = join(skillRoot, "escape-skill");
    createSymlink(outside, symlinkTarget);

    const failure = runCliExpectFailure({
      AA_SKILL_CREATOR_ACTION: "create",
      AA_SKILL_ROOT: skillRoot,
      AA_SKILL_NAME: "Escape Skill",
      AA_SKILL_DESCRIPTION: "Attempts to escape the configured skill root using a symlink.",
    });

    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /(skill_creator\.target_symlink_denied|sandbox\.symlink_denied)/);
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});

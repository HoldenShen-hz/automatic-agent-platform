import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

test("profile-home CLI fails closed on invalid profile id", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", "profile-home.js")], {
        cwd: repoRoot,
        env: {
          ...process.env,
          AA_PROFILE_ID: "../escape",
        },
        stdio: "pipe",
      }),
    /profile_home\.invalid_profile_id/,
  );
});

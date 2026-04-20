import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

test("profile-home CLI fails closed on invalid profile id", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(repoRoot, "dist", "src", "cli", "profile-home.js")], {
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

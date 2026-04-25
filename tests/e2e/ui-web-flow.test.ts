import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UI_WORKSPACE = resolve(process.cwd(), "ui");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";

test("ui e2e smoke exercises web routes and multi-shell baselines", () => {
  assert.equal(existsSync(resolve(UI_WORKSPACE, "node_modules")), true, "ui/node_modules must exist before running UI E2E smoke");

  const output = execFileSync(NPM_BIN, ["run", "test:e2e"], {
    cwd: UI_WORKSPACE,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
    },
    timeout: 120_000,
  });

  assert.match(output, /tests\/apps\/web-e2e-smoke\.test\.tsx/);
  assert.match(output, /tests\/apps\/web-route-catalog\.test\.tsx/);
  assert.match(output, /tests\/apps\/shells\.test\.ts/);
});

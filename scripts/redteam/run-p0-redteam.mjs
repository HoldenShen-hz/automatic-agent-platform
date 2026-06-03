#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["scripts/run-node-tests.mjs", "tests/redteam/p0/**/*.test.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AA_RUNNING_TESTS: process.env.AA_RUNNING_TESTS ?? "1",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if ((result.status ?? 1) !== 0) {
  process.exitCode = result.status ?? 1;
}

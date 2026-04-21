/**
 * [SYS-OBS-5.1] No Console in Runtime Tests
 *
 * Verifies that critical paths use StructuredLogger instead of console.*.
 * console.* bypasses the structured logging system and creates observability gaps.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";

test("[SYS-OBS-5.1] OAPEFLIR files do not use console.* directly", () => {
  const oapeflirFiles = globSync("src/platform/orchestration/oapeflir/**/*.ts");
  for (const file of oapeflirFiles) {
    // Skip declaration files
    if (file.endsWith(".d.ts")) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const consoleMatches = content.match(/console\.(log|warn|error|info|debug)\(/g);
    assert.equal(
      consoleMatches?.length ?? 0,
      0,
      `${file} has ${consoleMatches?.length ?? 0} console.* calls — use StructuredLogger`,
    );
  }
});

test("[SYS-OBS-5.1] CDC replication uses StructuredLogger", () => {
  const cdcFile = "src/scale-ecosystem/multi-region/cdc-replication-service.ts";
  const content = readFileSync(cdcFile, "utf8");
  assert.ok(
    !content.match(/console\.(log|warn|error)\(/),
    "cdc-replication-service must use StructuredLogger instead of console.*",
  );
});

test("[SYS-OBS-5.1] execution engine does not use console.*", () => {
  const executionFiles = globSync("src/platform/execution/**/*.ts");
  for (const file of executionFiles) {
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const consoleMatches = content.match(/console\.(log|warn|error|info|debug)\(/g);
    assert.equal(
      consoleMatches?.length ?? 0,
      0,
      `${file} has ${consoleMatches?.length ?? 0} console.* calls — use StructuredLogger`,
    );
  }
});

test("[SYS-OBS-5.1] state-evidence files do not use console.*", () => {
  const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
  for (const file of stateEvidenceFiles) {
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const consoleMatches = content.match(/console\.(log|warn|error|info|debug)\(/g);
    assert.equal(
      consoleMatches?.length ?? 0,
      0,
      `${file} has ${consoleMatches?.length ?? 0} console.* calls — use StructuredLogger`,
    );
  }
});

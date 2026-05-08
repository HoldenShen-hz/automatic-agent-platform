import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  selectManualChunk,
  WEB_BUILD_TARGET,
  WEB_CHUNK_WARNING_LIMIT_KB,
  WEB_MINIFY_MODE,
} from "../../../../../apps/web/build-config.ts";

test("web build config pins explicit target, minify mode and chunk warning budget", () => {
  assert.equal(WEB_BUILD_TARGET, "es2022");
  assert.equal(WEB_MINIFY_MODE, "esbuild");
  assert.equal(WEB_CHUNK_WARNING_LIMIT_KB, 200);
});

test("selectManualChunk splits feature and vendor modules instead of falling back to a single unmatched chunk", () => {
  assert.equal(
    selectManualChunk("/workspace/ui/packages/features/feature-dashboard/index.tsx"),
    "feature-dashboard",
  );
  assert.equal(
    selectManualChunk("/workspace/ui/node_modules/lodash-es/index.js"),
    "vendor-lodash-es",
  );
  assert.equal(
    selectManualChunk("/workspace/ui/node_modules/@scope/pkg/index.js"),
    "vendor-scope-pkg",
  );
});

test("perf-budget script fail-closes on missing dist root and is wired into CI", () => {
  const uiRoot = process.cwd();
  const perfBudgetScript = readFileSync(resolve(uiRoot, "scripts/perf-budget.mjs"), "utf8");
  const packageJson = JSON.parse(readFileSync(resolve(uiRoot, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(existsSync(resolve(uiRoot, "scripts/perf-budget.mjs")), true);
  assert.match(perfBudgetScript, /if \(!existsSync\(distRoot\)\)/);
  assert.match(perfBudgetScript, /if \(process\.env\.CI === "true"\)/);
  assert.match(perfBudgetScript, /maxEchartsGzBytes/);
  assert.match(perfBudgetScript, /maxMonacoGzBytes/);
  assert.match(packageJson.scripts.ci, /perf:budget/);
});

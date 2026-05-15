import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("package exports expose selective architecture subpaths", () => {
  const packageJsonPath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    exports?: Record<string, string>;
  };

  assert.equal(packageJson.exports?.["./platform"], "./dist/src/platform/index.js");
  assert.equal(packageJson.exports?.["./platform/five-plane-orchestration/learn"], "./dist/src/platform/five-plane-orchestration/learn/index.js");
  assert.equal(packageJson.exports?.["./platform/five-plane-orchestration/improve-rollout"], "./dist/src/platform/five-plane-orchestration/improve-rollout/index.js");
  assert.equal(packageJson.exports?.["./platform/stability"], "./dist/src/platform/stability/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/billing"], "./dist/src/scale-ecosystem/billing/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/enterprise"], "./dist/src/scale-ecosystem/enterprise/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/intelligence"], "./dist/src/scale-ecosystem/intelligence/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/operations"], "./dist/src/scale-ecosystem/operations/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/runtime-services"], "./dist/src/scale-ecosystem/runtime-services/index.js");
  assert.equal(packageJson.exports?.["./scale-ecosystem/tenant-platform"], "./dist/src/scale-ecosystem/tenant-platform/index.js");
});

import assert from "node:assert/strict";
import test from "node:test";

import * as RootModule from "../../src/index.js";
import type {
  PlatformRootEntryMode,
} from "../../src/index.js";

type RootBootstrapTypeExports = [
  PlatformRootEntryMode,
];
void (null as unknown as RootBootstrapTypeExports);

test("root bootstrap exports buildFivePlaneRuntimeCatalog", () => {
  assert.equal(typeof RootModule.buildFivePlaneRuntimeCatalog, "function");
});

test("root bootstrap exports buildFivePlaneStartupPlan", () => {
  assert.equal(typeof RootModule.buildFivePlaneStartupPlan, "function");
});

test("root bootstrap exports buildAiOperationsStartupPlan", () => {
  assert.equal(typeof RootModule.buildAiOperationsStartupPlan, "function");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createAssetProductionAdapterPlugin,
  createBasicEvaluatorPlugin,
  createBasicPlannerPlugin,
  createCodingPresenterPlugin,
  createCodingRetrieverPlugin,
  createGithubAdapterPlugin,
  listBuiltinPluginIds,
} from "../../../src/plugins/index.js";

test("plugins root barrel exposes canonical plugin factories", () => {
  assert.equal(typeof createGithubAdapterPlugin, "function");
  assert.equal(typeof createAssetProductionAdapterPlugin, "function");
  assert.equal(typeof createBasicPlannerPlugin, "function");
  assert.equal(typeof createCodingPresenterPlugin, "function");
  assert.equal(typeof createCodingRetrieverPlugin, "function");
  assert.equal(typeof createBasicEvaluatorPlugin, "function");
});

test("plugins root barrel preserves builtin registry exports", () => {
  assert.ok(listBuiltinPluginIds().length > 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import * as AdaptersIndex from "../../../../src/plugins/adapters/index.js";

test("AdaptersIndex exports asset-production-adapter", () => {
  assert.ok(AdaptersIndex.createAssetProductionAdapterPlugin !== undefined);
});

test("AdaptersIndex exports crm-adapter", () => {
  assert.ok(AdaptersIndex.createCrmAdapterPlugin !== undefined);
});

test("AdaptersIndex exports game-dev-adapter", () => {
  assert.ok(AdaptersIndex.createGameDevAdapterPlugin !== undefined);
});

test("AdaptersIndex exports github-adapter", () => {
  assert.ok(AdaptersIndex.createGithubAdapterPlugin !== undefined);
});

test("AdaptersIndex exports livestream-adapter", () => {
  assert.ok(AdaptersIndex.createLivestreamAdapterPlugin !== undefined);
});

test("AdaptersIndex exports credential hygiene helpers", () => {
  assert.ok(AdaptersIndex.createZeroableCredentialSecret !== undefined);
  assert.ok(AdaptersIndex.buildHashedCredentialFingerprint !== undefined);
});

test("AdaptersIndex creates all adapter plugins successfully", async () => {
  const plugins = [
    AdaptersIndex.createAssetProductionAdapterPlugin(),
    AdaptersIndex.createCrmAdapterPlugin(),
    AdaptersIndex.createGameDevAdapterPlugin(),
    AdaptersIndex.createGithubAdapterPlugin(),
    AdaptersIndex.createLivestreamAdapterPlugin(),
  ];

  assert.equal(plugins.length, 5);
  assert.ok(plugins.every(p => p !== undefined));
});

test("AdaptersIndex adapter plugins have correct spiType", () => {
  const adapterTypes = [
    { create: AdaptersIndex.createAssetProductionAdapterPlugin, expected: "adapter" },
    { create: AdaptersIndex.createCrmAdapterPlugin, expected: "adapter" },
    { create: AdaptersIndex.createGameDevAdapterPlugin, expected: "adapter" },
    { create: AdaptersIndex.createGithubAdapterPlugin, expected: "adapter" },
    { create: AdaptersIndex.createLivestreamAdapterPlugin, expected: "adapter" },
  ];

  for (const { create, expected } of adapterTypes) {
    const plugin = create();
    assert.equal(plugin.spiType, expected, `${plugin.pluginId} should have spiType "adapter"`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";

test("GameDevAdapter type exports are correct", () => {
  const adapter = createGameDevAdapterPlugin();
  assert.ok(adapter !== undefined);
});

test("GameDevAdapter has correct plugin metadata", () => {
  const adapter = createGameDevAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.gamedev.unity_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "unity_cloud_build");
});

test("GameDevAdapter has correct capabilityIds", () => {
  const adapter = createGameDevAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, ["build.status", "build.logs", "build.artifacts"]);
});

test("GameDevAdapter.initialize returns undefined", async () => {
  const adapter = createGameDevAdapterPlugin();
  assert.ok(adapter.initialize !== undefined);
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("GameDevAdapter.healthCheck returns true", async () => {
  const adapter = createGameDevAdapterPlugin();
  assert.ok(adapter.healthCheck !== undefined);
  const result = await adapter.healthCheck();
  assert.equal(result, true);
});

test("GameDevAdapter.shutdown returns undefined", async () => {
  const adapter = createGameDevAdapterPlugin();
  assert.ok(adapter.shutdown !== undefined);
  const result = await adapter.shutdown();
  assert.equal(result, undefined);
});

test("GameDevAdapter.authenticate does not throw", async () => {
  const adapter = createGameDevAdapterPlugin();
  await adapter.authenticate({});
});

test("GameDevAdapter.execute returns success with action", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_status", {
    projectSlug: "my-project",
    buildTarget: "ios",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as any).action, "get_build_status");
  assert.equal((result.output as any).projectSlug, "my-project");
  assert.equal((result.output as any).buildTarget, "ios");
  assert.equal((result.output as any).status, "success");
});

test("GameDevAdapter.execute handles missing optional params", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_status", {});

  assert.equal(result.success, true);
  assert.equal((result.output as any).projectSlug, null);
  assert.equal((result.output as any).buildTarget, null);
});

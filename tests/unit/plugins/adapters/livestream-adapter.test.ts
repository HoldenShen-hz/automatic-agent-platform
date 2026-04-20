import assert from "node:assert/strict";
import test from "node:test";

import { createLivestreamAdapterPlugin } from "../../../../src/plugins/adapters/livestream-adapter.js";

test("LivestreamAdapter type exports are correct", () => {
  const adapter = createLivestreamAdapterPlugin();
  assert.ok(adapter !== undefined);
});

test("LivestreamAdapter has correct plugin metadata", () => {
  const adapter = createLivestreamAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.livestream.obs_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "obs_streaming");
});

test("LivestreamAdapter has correct capabilityIds", () => {
  const adapter = createLivestreamAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, ["obs.config", "obs.scenes", "stream.analytics", "stream.engagement"]);
});

test("LivestreamAdapter.initialize returns undefined", async () => {
  const adapter = createLivestreamAdapterPlugin();
  assert.ok(adapter.initialize !== undefined);
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("LivestreamAdapter.healthCheck returns true", async () => {
  const adapter = createLivestreamAdapterPlugin();
  assert.ok(adapter.healthCheck !== undefined);
  const result = await adapter.healthCheck();
  assert.equal(result, true);
});

test("LivestreamAdapter.shutdown returns undefined", async () => {
  const adapter = createLivestreamAdapterPlugin();
  assert.ok(adapter.shutdown !== undefined);
  const result = await adapter.shutdown();
  assert.equal(result, undefined);
});

test("LivestreamAdapter.authenticate does not throw", async () => {
  const adapter = createLivestreamAdapterPlugin();
  await adapter.authenticate({});
});

test("LivestreamAdapter.execute returns success with action", async () => {
  const adapter = createLivestreamAdapterPlugin();

  const result = await adapter.execute("get_stream_config", {
    streamId: "stream_123",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as any).action, "get_stream_config");
  assert.equal((result.output as any).streamId, "stream_123");
  assert.equal((result.output as any).status, "success");
});

test("LivestreamAdapter.execute handles missing streamId", async () => {
  const adapter = createLivestreamAdapterPlugin();

  const result = await adapter.execute("get_stream_config", {});

  assert.equal(result.success, true);
  assert.equal((result.output as any).streamId, null);
});

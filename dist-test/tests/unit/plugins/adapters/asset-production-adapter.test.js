import assert from "node:assert/strict";
import test from "node:test";
import { createAssetProductionAdapterPlugin } from "../../../../src/plugins/adapters/asset-production-adapter.js";
test("AssetProductionAdapter type exports are correct", () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter !== undefined);
});
test("AssetProductionAdapter has correct plugin metadata", () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.assetproduction.figma_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "figma");
});
test("AssetProductionAdapter has correct capabilityIds", () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.deepEqual(adapter.capabilityIds, ["figma.files", "figma.components", "cdn.assets", "design_tokens"]);
});
test("AssetProductionAdapter.initialize returns undefined", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter.initialize !== undefined);
    const result = await adapter.initialize();
    assert.equal(result, undefined);
});
test("AssetProductionAdapter.healthCheck returns true", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter.healthCheck !== undefined);
    const result = await adapter.healthCheck();
    assert.equal(result, true);
});
test("AssetProductionAdapter.shutdown returns undefined", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter.shutdown !== undefined);
    const result = await adapter.shutdown();
    assert.equal(result, undefined);
});
test("AssetProductionAdapter.authenticate does not throw", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({});
});
test("AssetProductionAdapter.execute returns success with action", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    const result = await adapter.execute("get_file", {
        fileKey: "abc123",
        nodeId: "node_456",
    });
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_file");
    assert.equal(result.output.fileKey, "abc123");
    assert.equal(result.output.nodeId, "node_456");
    assert.equal(result.output.status, "success");
});
test("AssetProductionAdapter.execute handles missing optional params", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    const result = await adapter.execute("get_file", {});
    assert.equal(result.success, true);
    assert.equal(result.output.fileKey, null);
    assert.equal(result.output.nodeId, null);
});
//# sourceMappingURL=asset-production-adapter.test.js.map